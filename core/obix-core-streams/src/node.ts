/**
 * @obinexusltd/obix-core-streams/node
 *
 * Node ↔ Web stream adapters. Importing this touches `node:stream`; do not
 * import it from a portable context.
 */
import { Readable, Writable } from "node:stream";
import { CompatError } from "@obinexusltd/obix-core-capabilities";

/** A Node `Readable` (object-mode off) as a `ReadableStream<Uint8Array>`. */
export function nodeReadableToWeb(nodeReadable: Readable): ReadableStream<Uint8Array> {
  if (typeof (Readable as unknown as { toWeb?: unknown }).toWeb !== "function") {
    throw new CompatError({
      code: "streams/locked",
      package: "obix-core-streams",
      operation: "nodeReadableToWeb",
      reason: "Readable.toWeb is unavailable in this Node build",
      remediation: "Use Node ≥ 17, or adapt the stream manually.",
    });
  }
  return Readable.toWeb(nodeReadable) as ReadableStream<Uint8Array>;
}

/** A `ReadableStream<Uint8Array>` as a Node `Readable`. */
export function webReadableToNode(webStream: ReadableStream<Uint8Array>): Readable {
  return Readable.fromWeb(webStream as Parameters<typeof Readable.fromWeb>[0]);
}

/** A Node `Writable` as a `WritableStream<Uint8Array>`. */
export function nodeWritableToWeb(nodeWritable: Writable): WritableStream<Uint8Array> {
  return Writable.toWeb(nodeWritable) as WritableStream<Uint8Array>;
}

export type { Readable, Writable } from "node:stream";
