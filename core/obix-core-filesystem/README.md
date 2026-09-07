# @obinexusltd/obix-core-filesystem

Project-scoped file reads, atomic writes and tree watching for the OBIX CLI.
The **portable root** takes an injected `FsProvider` and does no disk access
itself; the `/node` subpath supplies the real `node:fs` provider.

## The problem it owns

A CLI must confine paths to the project root (no `..` escape, no `file:` URL
surprises), write files **atomically** (temp file + rename, serialised per
target) so a crash never leaves a half-written config, preserve bytes exactly
(no CRLF translation), and watch a directory tree with a **native** recursive
watcher where available and a **polling** fallback where not — while being
honest that not every native filesystem event is guaranteed to arrive.

## API

```ts
import {
  createFilesystem,
  type FilesystemAPI, type FsProvider, type WriteResult, type WatchOptions, type WatchHandle,
} from "@obinexusltd/obix-core-filesystem";
import {
  createNodeFsProvider, createNodeFilesystem,
} from "@obinexusltd/obix-core-filesystem/node";
```

| Export | Description |
|--------|-------------|
| `createFilesystem({ provider, timing, projectRoot, randomToken? })` | Wraps a provider with project scoping + atomic writes + watching. |
| `resolveProjectPath(relOrAbs)` | Absolute path inside the root, or a `CompatError` if it escapes / is a URL. |
| `urlToPath` / `pathToUrl` | `file:` URL ⇄ path, Windows drive-letter aware. |
| `readBytes` / `readText(rel, encoding?)` | Exact bytes; text via `TextDecoder` — **CRLF is preserved**, never translated. |
| `writeFileSafely(rel, data, encoding?)` | `.<name>.<rand>.tmp` + `rename`, serialised per target. Returns `{ path, bytes, strategy: "temp-file-rename", durability }`. |
| `watchTree(rel, onInvalidate, { mode, debounceMs, pollMs, signal })` | `mode: "native" \| "poll" \| "auto"`. Debounced batches of changed paths. `close()` idempotent; `handle.mode` reports what is actually in use. |
| `createNodeFsProvider()` / `createNodeFilesystem({ projectRoot })` | `/node` — `node:fs/promises` + recursive `fs.watch` + `node:path`. |

## Example (JavaScript)

```js
import { createNodeFilesystem } from "@obinexusltd/obix-core-filesystem/node";

const fs = createNodeFilesystem({ projectRoot: process.cwd() });

const res = await fs.writeFileSafely("build/out.json", JSON.stringify({ ok: true }));
console.log(res.strategy, res.bytes); // temp-file-rename 15

const watch = fs.watchTree("src", (paths) => console.log("changed:", paths), { debounceMs: 40 });
// …later…
watch.close();
```

## Example (TypeScript) — injected provider

```ts
import { createFilesystem, type FsProvider } from "@obinexusltd/obix-core-filesystem";

const provider: FsProvider = /* your in-memory or platform provider */ makeProvider();
const fs = createFilesystem({
  provider,
  timing: { now: () => Date.now(), setTimeout, clearTimeout },
  projectRoot: "/workspace/app",
});
const text: string = await fs.readText("config/app.toml");
```

## Host support (verified 2026-09-07)

| Runtime | `writeFileSafely` | `watchTree` native | `watchTree` poll |
|---------|-------------------|--------------------|------------------|
| Node 26.7.0 / Win x64 | ✅ temp+rename | ✅ recursive `fs.watch` | ✅ |
| Deno 2.9.6 / Win x64 | ✅ (via portable root + a Deno provider) | host-dependent | ✅ |
| Bun 1.4.2 / Win x64 | ✅ (`node:fs` shim) | ✅ | ✅ |
| browser / web worker | `fs` capability unavailable → not applicable | — | — |

Linux/macOS and Node 22/24 LTS: authored, `not-tested`. Native recursive watch on
Linux historically needs a per-directory fallback — `mode:"auto"` picks polling
when the native watcher reports it cannot go recursive.

## Fallbacks

- `mode:"auto"` → native recursive watch if the provider offers it, else a
  snapshot **poll** (`${size}:${mtimeMs}` per file) at `pollMs`.
- Debounce (`debounceMs`) coalesces a burst of events into one `onInvalidate`
  call with the union of changed paths.
- **No guarantee** every native event is delivered — treat `onInvalidate` as
  "something under here changed, re-read", not a change log.

## Errors

`CompatError`: `fs/read`, `fs/write` (includes a failed temp-rename),
`fs/watch`. `resolveProjectPath` throws `fs/read` for a `..` escape or a URL
argument.

## Boundary

No globbing, no ignore-file parsing, no content diffing. Atomicity is
temp-file + rename; it does not `fsync` unless the injected provider does
(reported in `durability`).

MIT — OBINexus Computing
