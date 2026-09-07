# @obinexusltd/obix-core-streams

Portable byte streaming for the OBIX CLI, built on **WHATWG Web Streams** and
`Uint8Array`. The **portable root** does no I/O; the `/node` subpath adapts
Node's `stream` objects.

## The problem it owns

CLI code needs one byte-stream vocabulary across Node, Deno, Bun and the browser:
turn an array / iterable / async-iterable of chunks into a `ReadableStream`,
consume one as an async iterator with correct lock release, decode UTF-8 that is
**split across chunk boundaries**, and pipe with backpressure, cancellation and
a byte count — without importing `node:stream` on non-Node hosts.

## API

```ts
import {
  toReadableStream, fromReadableStream, collectBytes,
  decodeText, pipeBytes, countingStream,
  type ByteSource,
} from "@obinexusltd/obix-core-streams";
import {
  nodeReadableToWeb, webReadableToNode, nodeWritableToWeb,
} from "@obinexusltd/obix-core-streams/node";
```

| Export | Description |
|--------|-------------|
| `toReadableStream(source, { highWaterMark?, signal? })` | `Uint8Array` \| array \| (async)iterable → pull-based `ReadableStream<Uint8Array>`. An aborted `signal` errors the stream. |
| `fromReadableStream(stream, { signal?, preventCancel? })` | `ReadableStream` → `AsyncGenerator<Uint8Array>`. Releases the reader lock on return/throw; `streams/locked` if already locked. |
| `collectBytes(stream)` | Concatenate to one `Uint8Array`. |
| `decodeText(stream, { encoding?, fatal?, signal? })` | `AsyncGenerator<string>` via `TextDecoder({ stream: true })` + a final flush — multi-byte code points that straddle a chunk are reassembled. |
| `pipeBytes(readable, writable, opts?)` | Pipe with backpressure; resolves `{ bytes }`. |
| `countingStream()` | `{ stream: TransformStream, bytes, chunks }` pass-through meter. |
| `/node` adapters | `Readable.toWeb` / `Readable.fromWeb` / `Writable.toWeb` wrappers with consistent typing. |

## Example (JavaScript)

```js
import { toReadableStream, decodeText, collectBytes } from "@obinexusltd/obix-core-streams";

// 😀 (F0 9F 98 80) split down the middle
const parts = [Uint8Array.of(0xf0, 0x9f), Uint8Array.of(0x98, 0x80)];

let text = "";
for await (const s of decodeText(toReadableStream(parts))) text += s;
console.log(text); // "😀"

const bytes = await collectBytes(toReadableStream(parts));
console.log(bytes.length); // 4
```

## Example (TypeScript) — piping with a byte count

```ts
import { toReadableStream, pipeBytes, countingStream } from "@obinexusltd/obix-core-streams";

const meter = countingStream();
const sink = new WritableStream<Uint8Array>({ write() {} });
const { bytes } = await pipeBytes(toReadableStream([new Uint8Array(1024)]), meter.stream.writable);
await meter.stream.readable.pipeTo(sink);
console.log(bytes, meter.bytes, meter.chunks);
```

## Host support (verified 2026-09-07)

| Runtime | Web Streams | `TextDecoder({stream:true})` | `/node` adapters |
|---------|-------------|------------------------------|------------------|
| Node 26.7.0 / Win x64 | ✅ | ✅ | ✅ |
| Deno 2.9.6 / Win x64 | ✅ | ✅ | n/a (use the portable root) |
| Bun 1.4.2 / Win x64 | ✅ | ✅ | ✅ (`node:stream` shim) |
| browser / web worker | authored, not run here | ✅ | n/a |

Linux/macOS and Node 22/24 LTS: authored, `not-tested`.

## Fallbacks

- No host without Web Streams is targeted; `web-streams` is probed by
  `obix-core-capabilities` and a missing implementation is surfaced there rather
  than shimmed silently.
- `fromReadableStream` always releases its lock, so a partially-consumed stream
  can be handed on.

## Errors

`CompatError` `streams/locked` (stream already has a reader) and
`streams/aborted` (a supplied `AbortSignal` fired). Abort reasons propagate as
the stream error.

## Boundary

Bytes only. No text framing, no protocol, no compression — and no
application-level network behaviour (it never replaces `fetch`).

MIT — OBINexus Computing
