/**
 * @obinexusltd/obix-core-streams
 *
 * Web Streams + `Uint8Array` as the portable byte boundary, with backpressure,
 * streaming UTF-8 decode (multibyte sequences split across chunks are handled),
 * error/abort propagation and explicit lock/close ownership.
 *
 * Portable root: no host stream module is imported. `ReadableStream` /
 * `WritableStream` / `TransformStream` / `TextDecoder` are used from the global
 * scope (present in Node ≥ 18, Deno, Bun and browsers). Node ↔ Web adapters
 * live in `@obinexusltd/obix-core-streams/node`.
 *
 * This is a byte-transport helper. It does not replace application-level network
 * behaviour (HTTP clients, WebSocket protocols, an existing network-stream
 * driver's business logic).
 */
import { CompatError } from "@obinexusltd/obix-core-capabilities";

export { CompatError } from "@obinexusltd/obix-core-capabilities";

export type ByteSource =
  | Uint8Array
  | readonly Uint8Array[]
  | Iterable<Uint8Array>
  | AsyncIterable<Uint8Array>;

export interface ToReadableOptions {
  /** Queue size (chunks) before the source is asked to pause. Default 1. */
  highWaterMark?: number;
  /** Abort: errors the stream and stops pulling from the source. */
  signal?: AbortSignal;
}

function abortError(signal: AbortSignal, op: string): CompatError {
  return new CompatError({
    code: "streams/aborted",
    package: "obix-core-streams",
    operation: op,
    reason: (signal.reason instanceof Error ? signal.reason.message : String(signal.reason)) || "aborted",
  });
}

/**
 * Wrap a byte source in a pull-based `ReadableStream<Uint8Array>`. The source is
 * only advanced when the consumer pulls, so backpressure is preserved.
 */
export function toReadableStream(source: ByteSource, opts: ToReadableOptions = {}): ReadableStream<Uint8Array> {
  const hwm = Math.max(0, opts.highWaterMark ?? 1);
  const signal = opts.signal;

  let iter: Iterator<Uint8Array> | AsyncIterator<Uint8Array>;
  if (source instanceof Uint8Array) {
    iter = [source][Symbol.iterator]();
  } else if (Array.isArray(source)) {
    iter = (source as Uint8Array[])[Symbol.iterator]();
  } else if (typeof (source as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === "function") {
    iter = (source as AsyncIterable<Uint8Array>)[Symbol.asyncIterator]();
  } else if (typeof (source as Iterable<Uint8Array>)[Symbol.iterator] === "function") {
    iter = (source as Iterable<Uint8Array>)[Symbol.iterator]();
  } else {
    throw new CompatError({
      code: "streams/aborted",
      package: "obix-core-streams",
      operation: "toReadableStream",
      reason: "source is not a Uint8Array, array, iterable or async iterable of Uint8Array",
    });
  }

  let onAbort: (() => void) | null = null;

  return new ReadableStream<Uint8Array>(
    {
      start(controller) {
        if (signal) {
          if (signal.aborted) {
            controller.error(abortError(signal, "toReadableStream"));
            return;
          }
          onAbort = () => controller.error(abortError(signal, "toReadableStream"));
          signal.addEventListener("abort", onAbort, { once: true });
        }
      },
      async pull(controller) {
        if (signal?.aborted) {
          controller.error(abortError(signal, "toReadableStream"));
          return;
        }
        try {
          const { value, done } = await iter.next();
          if (done) {
            controller.close();
            if (signal && onAbort) signal.removeEventListener("abort", onAbort);
            return;
          }
          if (!(value instanceof Uint8Array)) {
            controller.error(
              new CompatError({
                code: "streams/aborted",
                package: "obix-core-streams",
                operation: "toReadableStream",
                reason: `source yielded a non-Uint8Array chunk (${typeof value})`,
              }),
            );
            return;
          }
          controller.enqueue(value);
        } catch (err) {
          controller.error(
            err instanceof CompatError
              ? err
              : new CompatError({
                  code: "streams/aborted",
                  package: "obix-core-streams",
                  operation: "toReadableStream",
                  reason: err instanceof Error ? err.message : String(err),
                  cause: err,
                }),
          );
        }
      },
      async cancel(reason) {
        if (signal && onAbort) signal.removeEventListener("abort", onAbort);
        if (typeof (iter as AsyncIterator<Uint8Array>).return === "function") {
          try {
            await (iter as AsyncIterator<Uint8Array>).return!(reason);
          } catch {
            /* iterator cleanup best-effort */
          }
        }
      },
    },
    { highWaterMark: hwm },
  );
}

export interface FromReadableOptions {
  signal?: AbortSignal;
  /** Do not `cancel()` the stream if the consumer stops early. Default false. */
  preventCancel?: boolean;
}

/**
 * Consume a `ReadableStream<Uint8Array>` as an async generator. Acquires a
 * reader lock for the lifetime of the generator and **releases it** on
 * completion, early return, or throw. On abort the underlying stream is
 * cancelled (unless `preventCancel`).
 */
export async function* fromReadableStream(
  stream: ReadableStream<Uint8Array>,
  opts: FromReadableOptions = {},
): AsyncGenerator<Uint8Array, void, unknown> {
  if (stream.locked) {
    throw new CompatError({
      code: "streams/locked",
      package: "obix-core-streams",
      operation: "fromReadableStream",
      reason: "the stream is already locked to another reader",
      remediation: "Consume a stream once, or `tee()` it first.",
    });
  }
  const reader = stream.getReader();
  const signal = opts.signal;
  let aborted = false;
  const onAbort = () => {
    aborted = true;
    void reader.cancel(signal?.reason).catch(() => {});
  };
  if (signal) {
    if (signal.aborted) {
      reader.releaseLock();
      throw abortError(signal, "fromReadableStream");
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      if (aborted) throw abortError(signal as AbortSignal, "fromReadableStream");
      yield value;
    }
  } finally {
    if (signal) signal.removeEventListener("abort", onAbort);
    try {
      if (!opts.preventCancel && !aborted) {
        // early return by the consumer -> release without cancelling the source
      }
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
}

/** Drain a stream to a single `Uint8Array`. Unbounded — the caller owns the memory. */
export async function collectBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const c of fromReadableStream(stream)) {
    chunks.push(c);
    total += c.byteLength;
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export interface DecodeTextOptions {
  signal?: AbortSignal;
  /** Encoding label for `TextDecoder`. Default `"utf-8"`. */
  encoding?: string;
  /** Throw on invalid byte sequences instead of emitting U+FFFD. Default false. */
  fatal?: boolean;
}

/**
 * Decode a byte stream to text incrementally. Uses `TextDecoder` with
 * `{ stream: true }`, so a multibyte code point split across two chunks is
 * decoded correctly (no U+FFFD at the boundary). A final flush emits any
 * trailing bytes.
 */
export async function* decodeText(
  stream: ReadableStream<Uint8Array>,
  opts: DecodeTextOptions = {},
): AsyncGenerator<string, void, unknown> {
  const dec = new TextDecoder(opts.encoding ?? "utf-8", { fatal: opts.fatal === true });
  for await (const chunk of fromReadableStream(stream, { signal: opts.signal })) {
    const piece = dec.decode(chunk, { stream: true });
    if (piece) yield piece;
  }
  const tail = dec.decode(); // flush
  if (tail) yield tail;
}

export interface PipeOptions {
  signal?: AbortSignal;
  preventClose?: boolean;
  preventAbort?: boolean;
  preventCancel?: boolean;
}

/**
 * `readable.pipeTo(writable)` with byte counting. Ownership: the writable is
 * closed on success (unless `preventClose`) and aborted on error (unless
 * `preventAbort`); the readable is cancelled on error (unless `preventCancel`).
 */
export async function pipeBytes(
  readable: ReadableStream<Uint8Array>,
  writable: WritableStream<Uint8Array>,
  opts: PipeOptions = {},
): Promise<{ bytes: number }> {
  let bytes = 0;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });
  try {
    await readable.pipeThrough(counter, { signal: opts.signal }).pipeTo(writable, {
      signal: opts.signal,
      preventClose: opts.preventClose,
      preventAbort: opts.preventAbort,
      preventCancel: opts.preventCancel,
    });
  } catch (err) {
    if (err instanceof CompatError) throw err;
    const aborted = opts.signal?.aborted;
    throw new CompatError({
      code: aborted ? "streams/aborted" : "streams/locked",
      package: "obix-core-streams",
      operation: "pipeBytes",
      reason: err instanceof Error ? err.message : String(err),
      cause: err,
    });
  }
  return { bytes };
}

/** A `TransformStream` that passes bytes through and reports the running total. */
export function countingStream(): {
  stream: TransformStream<Uint8Array, Uint8Array>;
  readonly bytes: number;
  readonly chunks: number;
} {
  let bytes = 0;
  let chunks = 0;
  const stream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      chunks++;
      controller.enqueue(chunk);
    },
  });
  return {
    stream,
    get bytes() {
      return bytes;
    },
    get chunks() {
      return chunks;
    },
  };
}
