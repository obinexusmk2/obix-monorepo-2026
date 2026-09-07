# The byte boundary

Every stream in this package carries `Uint8Array` chunks over a WHATWG
`ReadableStream` / `WritableStream`. That is the portable intersection of Node,
Deno, Bun and the browser — no `Buffer`, no `node:stream` in the portable root.

## Split multi-byte UTF-8

`decodeText` uses `TextDecoder({ stream: true })` and a final flush. A code point
whose bytes span a chunk boundary (e.g. `😀` = `F0 9F 98 80` arriving as
`F0 9F` then `98 80`) is buffered by the decoder and emitted once complete. The
contract test feeds exactly this case.

```
chunk 1: F0 9F         -> decoder buffers, yields ""
chunk 2: 98 80         -> decoder yields "😀"
end: flush()           -> yields "" (nothing pending)
```

Without `{ stream: true }` the first chunk would throw or emit U+FFFD.

## Lock discipline

`fromReadableStream` acquires a reader, and releases it in a `finally` on
return **or** throw. A partially consumed stream can therefore be handed to
another consumer. If the stream is already locked when you call it, you get
`streams/locked` instead of a confusing lower-level error.

## Backpressure & counting

`pipeBytes` respects the destination's `desiredSize`; it does not buffer the
whole source. `countingStream()` is an identity `TransformStream` that exposes
running `bytes` / `chunks` totals — used by the CLI to report transfer sizes
without changing the data.

## Abort

Every function takes an optional `AbortSignal`. A fired signal:

- errors an in-flight `ReadableStream` (readers see the abort reason),
- ends `decodeText` / `fromReadableStream` generators,
- rejects `pipeBytes` with `streams/aborted`.

## Node adapters (`/node`)

`nodeReadableToWeb` / `webReadableToNode` / `nodeWritableToWeb` wrap
`Readable.toWeb` / `Readable.fromWeb` / `Writable.toWeb` with stable typing so
CLI code that already has a Node stream can join the portable pipeline.
