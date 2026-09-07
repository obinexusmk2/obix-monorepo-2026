# Worker protocol `obix-core-workers/1`

## A job is a module + an export

```ts
interface JobRequest { module: string; action: string; data: unknown }
```

The worker receives an envelope:

```ts
interface JobEnvelope extends JobRequest {
  protocol: "obix-core-workers/1";
  jobId: string;
  moduleParentURL: string;   // module is resolved against this
  transfer?: string[];       // dotted paths into `data` to transfer, not copy
}
```

It `import(module)` (resolved against `moduleParentURL`), reads `ns[action]`, and
calls it as `action(data, ctx)` where `ctx = { jobId, isCancelled() }`.

**Functions are never sent.** They cannot be structured-cloned; putting one in
`data` is rejected with `workers/protocol` before anything is posted. The worker
loads code by specifier — it never receives stringified source to `eval`.

## Copy vs transfer

`data` is structured-cloned (a copy) by default. To move an `ArrayBuffer`
instead of copying it, pass its dotted path in `transfer`:

```js
await pool.submitJob(
  { module: "./jobs.mjs", action: "hash", data: { buf } },
  { transfer: ["data.buf"] },   // buf is detached in the calling thread afterwards
);
```

`collectTransferables(data, paths)` walks each path (`""` means `data` itself)
and hands the underlying buffers to `postMessage`'s transfer list.

## Cancellation is cooperative

`cancelJob(jobId)` sets a flag the worker exposes as `ctx.isCancelled()`. A job
that never checks it runs to completion. There is **no preemption** — the API
never reports that a running job was forcibly stopped.

## Inline fallback

With no worker backend (`createWorkerPool` given none, or a host with no worker
support), `runInline(req, moduleParentURL)` executes the job in-process and
returns:

```ts
{ result: <value>, mode: "inline-fallback" }
```

The `mode` field is the contract: a caller can always tell whether the job ran
off-thread. The fallback also cannot claim preemptive cancellation.

## Backends

| Backend | Module | Notes |
|---------|--------|-------|
| `worker_threads` | `/node` `createNodeWorkerBackend` | waits for a `{ type: "ready" }` message (5 s timeout); `resourceLimitsHonored` is `false` on Bun |
| Web `Worker` | `/web` `createWebWorkerBackend` | authored; browser execution `not-tested` |

`size` (default 2), `queueLimit` (default 64 → `workers/queue-full`),
`defaultTimeoutMs` and `moduleParentURL` are pool-level options.
