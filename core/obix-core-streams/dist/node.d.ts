import { Readable, Writable } from "node:stream";
export declare function nodeReadableToWeb(nodeReadable: Readable): ReadableStream<Uint8Array>;
export declare function webReadableToNode(webStream: ReadableStream<Uint8Array>): Readable;
export declare function nodeWritableToWeb(nodeWritable: Writable): WritableStream<Uint8Array>;
export type { Readable, Writable } from "node:stream";
//# sourceMappingURL=node.d.ts.map