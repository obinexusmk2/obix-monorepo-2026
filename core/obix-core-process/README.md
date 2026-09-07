# @obinexusltd/obix-core-process

Child-process execution for the OBIX CLI: tool resolution, bounded output
capture, timeouts, cancellation and (best-effort) tree termination. The
**portable root** takes an injected `SpawnImpl`; the `/node` subpath supplies
one over `node:child_process`.

## The problem it owns

Running an external tool safely means: resolve it correctly (a JS bin runs under
**the current runtime**, not a global `node`; an executable is found via `PATH`
+ `PATHEXT` on Windows), never go through a shell, drain **stdout and stderr
concurrently** (sequential draining deadlocks on a full pipe), bound the capture
to `maxBuffer`, honour an `AbortSignal` and a `timeoutMs`, and classify failures
(`tool-not-found` vs `nonzero-exit` vs `timeout` vs `aborted`).

## API

```ts
import {
  createProcessRunner, resolveTool, canSpawn,
  type ProcessRunnerAPI, type SpawnRequest, type SpawnResult, type ToolResolution,
} from "@obinexusltd/obix-core-process";
import {
  createNodeProcessRunner, which, resolveJsBin,
} from "@obinexusltd/obix-core-process/node";
```

| Export | Description |
|--------|-------------|
| `createProcessRunner(spawnImpl)` | `spawnTool(req)` · `spawnShellScript(req & { shellArgsArray })` (`.cmd`/`.bat`/`.ps1` only) · `terminateChild` · `disposeAll` · `activeCount`. |
| `SpawnRequest` | `{ command, args?, cwd?, env?, signal?, timeoutMs?, killSignal?, maxBuffer? (8 MiB), tree? }`. |
| `SpawnResult` | `{ code, signal, timedOut, aborted, durationMs, stdout, stderr, stdoutTruncated, stderrTruncated }`. |
| `resolveTool({ kind: "js-bin", package, bin? } \| { kind: "executable", name }, hooks?)` | JS bin → `{ command: <this runtime>, args: [absPath], runtime }`; executable → `which()` result. |
| `canSpawn()` | Whether spawning is available on this host. |
| `createNodeProcessRunner({ resolveFrom? })` | `/node` — runner + `.resolve()`, `shell:false`, `windowsHide:true`, `killTree` via `taskkill /T /F` on Win32. |

## Example (JavaScript)

```js
import { createNodeProcessRunner } from "@obinexusltd/obix-core-process/node";

const runner = createNodeProcessRunner();
const res = await runner.spawnTool({
  command: process.execPath,
  args: ["--version"],
  timeoutMs: 10_000,
});
console.log(res.code, new TextDecoder().decode(res.stdout).trim());
```

## Example (TypeScript) — resolve then run a JS bin

```ts
import { createNodeProcessRunner } from "@obinexusltd/obix-core-process/node";
import type { SpawnResult } from "@obinexusltd/obix-core-process";

const runner = createNodeProcessRunner({ resolveFrom: process.cwd() });
const tool = runner.resolve({ kind: "js-bin", package: "typescript", bin: "tsc" });
if (!tool.found) throw new Error(tool.detail);

const out: SpawnResult = await runner.spawnTool({
  command: tool.command,      // = the current runtime
  args: [...tool.args, "--noEmit"],
  cwd: process.cwd(),
  signal: AbortSignal.timeout(60_000),
});
```

## Host support (verified 2026-09-07)

| Runtime | `spawnTool` | tree kill | JS-bin runtime |
|---------|-------------|-----------|----------------|
| Node 26.7.0 / Win x64 | ✅ | ✅ `taskkill /T /F` | `process.execPath` (node) |
| Deno 2.9.6 / Win x64 | ✅ | direct child only | `process.execPath` (deno) |
| Bun 1.4.2 / Win x64 | ✅ | direct child only | `process.execPath` (bun) |
| browser / web worker | `spawn` capability unavailable → not applicable | — | — |

Linux/macOS and Node 22/24 LTS: authored, `not-tested`. POSIX process-group kill
(`kill(-pid)`) is authored for the `tree` path but unverified here.

## Fallbacks

- No `tree` support / non-Win32 without a process-group kill → **only the direct
  child** is terminated; `SpawnResult`/the runner document this rather than
  pretending descendants were reaped.
- `maxBuffer` exceeded → the stream is truncated and `stdoutTruncated` /
  `stderrTruncated` is set; the process is still awaited.

## Errors

`CompatError`: `process/tool-not-found` (spawn `ENOENT`), `process/nonzero-exit`,
`process/timeout`, `process/aborted`. A missing tool is classified from the async
spawn error, not guessed up front.

## Boundary

No shell interpolation (scripts go through `spawnShellScript` with an explicit
args array). It does not manage long-running daemons or PTYs.

MIT — OBINexus Computing
