export { CompatError } from "@obinexusltd/obix-core-capabilities";
export type ByteSource = Uint8Array | readonly Uint8Array[] | Iterable<Uint8Array> | AsyncIterable<Uint8Array>;
export interface ToReadableOptions {
    highWaterMark?: number;
    signal?: AbortSignal;
}
export declare function toReadableStream(source: ByteSource, opts?: ToReadableOptions): ReadableStream<Uint8Array>;
export interface FromReadableOptions {
    signal?: AbortSignal;
    preventCancel?: boolean;
}
export declare function fromReadableStream(stream: ReadableStream<Uint8Array>, opts?: FromReadableOptions): AsyncGenerator<Uint8Array, void, unknown>;
export declare function collectBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array>;
export interface DecodeTextOptions {
    signal?: AbortSignal;
    encoding?: string;
    fatal?: boolean;
}
export declare function decodeText(stream: ReadableStream<Uint8Array>, opts?: DecodeTextOptions): AsyncGenerator<string, void, unknown>;
export interface PipeOptions {
    signal?: AbortSignal;
    preventClose?: boolean;
    preventAbort?: boolean;
    preventCancel?: boolean;
}
export declare function pipeBytes(readable: ReadableStream<Uint8Array>, writable: WritableStream<Uint8Array>, opts?: PipeOptions): Promise<{
    bytes: number;
}>;
export declare function countingStream(): {
    stream: TransformStream<Uint8Array, Uint8Array>;
    readonly bytes: number;
    readonly chunks: number;
};
//# sourceMappingURL=index.d.ts.map