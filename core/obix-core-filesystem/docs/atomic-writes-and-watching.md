# Atomic writes & tree watching

## Atomic write

`writeFileSafely(rel, data)`:

1. resolve `rel` inside `projectRoot` (reject `..` escapes and URL arguments),
2. write to `.<basename>.<randomToken()>.tmp` in the same directory,
3. `rename()` the temp file over the target (atomic on the same filesystem),
4. return `{ path, bytes, strategy: "temp-file-rename", durability }`.

Writes to the **same target** are serialised through a per-path chain
(`writeChains` map), so two concurrent `writeFileSafely("x")` calls never
interleave temp files.

`durability` is a plain string describing what was actually guaranteed — with the
Node provider it notes that the rename is atomic but no `fsync` is performed
unless the provider does one. It does not over-claim.

Bytes are written and read **verbatim**. `readText` decodes with `TextDecoder`;
CRLF is preserved, never converted to LF.

## Tree watching

`watchTree(rel, onInvalidate, { mode, debounceMs, pollMs, signal })`:

| `mode` | behaviour |
|--------|-----------|
| `"native"` | recursive `fs.watch` (provider `watch()`); errors if the provider cannot do recursive |
| `"poll"` | snapshot every `pollMs`: `Map<relPath, "${size}:${mtimeMs}">`, diff, emit changed paths |
| `"auto"` (default) | native if the provider offers recursive watch, else poll |

Events are **debounced**: a burst within `debounceMs` produces one
`onInvalidate(paths)` call with the union of changed paths. `handle.mode` reports
which mechanism is actually running. `close()` is idempotent; a fired `signal`
also closes the watch.

### The honesty rule

`onInvalidate` means *"something under here changed — re-read"*. It is **not** a
guaranteed, ordered change log. Native recursive watchers drop events under load
and differ by platform; the polling fallback only sees net changes between
snapshots. Callers must re-scan, not replay.

## Path safety

`resolveProjectPath` is the single choke point:

- a `file:` URL argument → `fs/read` error (use `urlToPath` explicitly),
- a path that resolves outside `projectRoot` → `fs/read` error,
- Windows drive letters and UNC paths are normalised by the provider's `resolve`.
