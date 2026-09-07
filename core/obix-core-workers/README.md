# @obinexusltd/obix-core-workers

A portable worker-pool protocol for the OBIX CLI. Jobs name a **module and an
export**; the worker `import()`s it and calls it. Functions are never cloned,
stringified or `eval`'d. The **portable root** defines the protocol and an
inline fallback; `/node` and `/web` supply real backends.

## The problem it owns

Off-thread work needs one contract across `node:worker_threads` and Web Workers:
a job is `{ module, action, data }` — a **specifier and an export name**, not a
serialized closure — data is structured-cloned (copy by default, explicit
`transfer` for `ArrayBuffer`s), cancellation is **cooperative** (no preemption),
and when no worker backend exists the pool must fall back **in-process** and say
so — it must not silently pretend a job ran off-thread or claim it was
preemptively cancelled.

## API

```ts
import {
  createWorkerPool, runInline, PROTOCOL,
  type WorkerPoolAPI, type JobRequest, type WorkerBackend, type InlineResult,
} from "@obinexusltd/obix-core-workers";
import { createNodeWorkerPool, createNodeWorkerBackend } from "@obinexusltd/obix-core-workers/node";
import { createWebWorkerPool, createWebWorkerBackend } from "@obinexusltd/obix-core-workers/web";
```

| Export | Description |
|--------|-------------|
| `createWorkerPool({ backend, size?, queueLimit?, defaultTimeoutMs?, moduleParentURL? })` | `submitJob(req, { signal?, timeoutMs?, transfer? })` · `cancelJob(jobId)` · `dispose()` · getters `activeWorkers` / `queued` / `running` / `resourceLimitsHonored` / `backendKind`. |
| `JobRequest` | `{ module: string; action: string; data: unknown }`. `module` is resolved against `moduleParentURL`. |
| `PROTOCOL` | `"obix-core-workers/1"` — the envelope tag. |
| `runInline(req, moduleParentURL)` | In-process execution. Returns `{ result, mode: "inline-fallback" }`. |
| `createNodeWorkerPool(opts)` / `createNodeWorkerBackend(opts)` | `/node` — `worker_threads`; waits for a `ready` message; `resourceLimitsHonored` is `false` on Bun. |
| `createWebWorkerPool(opts)` / `createWebWorkerBackend(opts)` | `/web` — `Worker` + `postMessage`; authored, browser `not-tested`. |

## Job module (`jobs.mjs`)

```js
// Exports are called as (data, ctx). ctx.isCancelled() is the cooperative signal.
export function sum(nums) { return nums.reduce((a, b) => a + b, 0); }
export async function slow(ms, ctx) {
  for (let w = 0; w < ms; w += 10) {
    await new Promise(r => setTimeout(r, 10));
    if (ctx?.isCancelled?.()) return "cancelled-cooperatively";
  }
  return "done";
}
```

## Example (JavaScript)

```js
import { createNodeWorkerPool } from "@obinexusltd/obix-core-workers/node";

const pool = createNodeWorkerPool({ size: 2, moduleParentURL: import.meta.url });
try {
  const total = await pool.submitJob({ module: "./jobs.mjs", action: "sum", data: [1, 2, 3, 4] });
  console.log(total); // 10
} finally {
  await pool.dispose();
}
```

## Example (TypeScript) — transfer an ArrayBuffer

```ts
import { createNodeWorkerPool } from "@obinexusltd/obix-core-workers/node";

const pool = createNodeWorkerPool({ size: 1, moduleParentURL: import.meta.url });
const buf = new ArrayBuffer(1024);
await pool.submitJob(
  { module: "./jobs.mjs", action: "inspectBuffer", data: { buf } },
  { transfer: ["data.buf"] }, // buf is now detached in this thread
);
await pool.dispose();
```

## Host support (verified 2026-09-07)

| Runtime | backend | `resourceLimitsHonored` | cancellation |
|---------|---------|-------------------------|--------------|
| Node 26.7.0 / Win x64 | `worker_threads` | ✅ | cooperative |
| Deno 2.9.6 / Win x64 | `worker_threads` shim | ✅ | cooperative |
| Bun 1.4.2 / Win x64 | `worker_threads` | ❌ (reported `false`) | cooperative |
| browser / web worker | `/web` `Worker` | n/a | cooperative — authored, `not-tested` |

Linux/macOS and Node 22/24 LTS: authored, `not-tested`.

## Fallbacks

- No backend → `runInline`; the result carries `mode: "inline-fallback"` so a
  caller can tell it did **not** run off-thread.
- A cancelled job that has already started only stops at the next
  `ctx.isCancelled()` check — the API never reports preemptive termination.
- `queueLimit` reached → `workers/queue-full` rather than unbounded memory growth.

## Errors

`CompatError`: `workers/startup`, `workers/crash` (worker exited without a
response), `workers/protocol` (e.g. a function was put in `data`),
`workers/queue-full`.

## Boundary

No shared-memory API, no actor mailboxes, no automatic retry. Jobs are
request/response over a module + export.

MIT — OBINexus Computing
