# The spawn model

## Concurrent drain

`run()` reads stdout and stderr **at the same time**:

```js
await Promise.all([drain(proc.streams.stdout), drain(proc.streams.stderr), proc.exited]);
```

Draining stdout to completion *then* stderr deadlocks: a child that fills the
stderr pipe blocks on `write()` and never closes stdout, so the first `drain`
never returns. Both must be pumped concurrently. Each `drain` is bounded to
`maxBuffer` (default 8 MiB) and sets a `*Truncated` flag when it clips.

## Tool resolution

| spec | resolution |
|------|------------|
| `{ kind: "js-bin", package, bin? }` | `{ command: process.execPath, args: [absoluteBinPath], runtime }` — the JS bin runs under **the current runtime** (node/deno/bun), never a global `node` that may be a different version. |
| `{ kind: "executable", name }` | `which(name)` — tries the name verbatim first (so `node.exe` is not turned into `node.exe.exe`), then each `PATHEXT` extension on Windows. |

## Failure classification

The spawn error is asynchronous — it arrives via `proc.exited` rejecting. The
`Promise.all` is wrapped so:

```
spawn ... ENOENT           -> process/tool-not-found
exit code != 0             -> process/nonzero-exit  (SpawnResult still returned unless the caller opts into throwing)
timeoutMs elapsed          -> process/timeout       (child killed with killSignal)
AbortSignal fired          -> process/aborted
```

## Termination scope

`kill()` signals the **direct child only**. `killTree()` (Win32:
`taskkill /pid <pid> /T /F`) attempts the whole tree. On non-Win32 without a
process-group kill wired up, tree termination is not available and the API says
so — it does not silently leave orphans while reporting success.

## No shell

`spawn` runs with `shell: false`, `windowsHide: true`. Shell scripts go through
`spawnShellScript(req & { shellArgsArray })`, which only accepts `.cmd` / `.bat`
/ `.ps1` and passes an explicit argument array — there is no string
interpolation path.

## Runtime notes

Tests use **script files**, not `-e "..."`, because Deno and Bun differ from Node
in how `-e` populates `process.argv`. `process.execPath` is the current binary
on all three.
