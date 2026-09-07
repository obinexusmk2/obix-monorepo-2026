import { CompatError } from "@obinexusltd/obix-core-capabilities";
export { CompatError } from "@obinexusltd/obix-core-capabilities";
function abortError(signal, op) {
    return new CompatError({
        code: "streams/aborted",
        package: "obix-core-streams",
        operation: op,
        reason: (signal.reason instanceof Error ? signal.reason.message : String(signal.reason)) || "aborted",
    });
}
export function toReadableStream(source, opts = {}) {
    const hwm = Math.max(0, opts.highWaterMark ?? 1);
    const signal = opts.signal;
    let iter;
    if (source instanceof Uint8Array) {
        iter = [source][Symbol.iterator]();
    }
    else if (Array.isArray(source)) {
        iter = source[Symbol.iterator]();
    }
    else if (typeof source[Symbol.asyncIterator] === "function") {
        iter = source[Symbol.asyncIterator]();
    }
    else if (typeof source[Symbol.iterator] === "function") {
        iter = source[Symbol.iterator]();
    }
    else {
        throw new CompatError({
            code: "streams/aborted",
            package: "obix-core-streams",
            operation: "toReadableStream",
            reason: "source is not a Uint8Array, array, iterable or async iterable of Uint8Array",
        });
    }
    let onAbort = null;
    return new ReadableStream({
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
                    if (signal && onAbort)
                        signal.removeEventListener("abort", onAbort);
                    return;
                }
                if (!(value instanceof Uint8Array)) {
                    controller.error(new CompatError({
                        code: "streams/aborted",
                        package: "obix-core-streams",
                        operation: "toReadableStream",
                        reason: `source yielded a non-Uint8Array chunk (${typeof value})`,
                    }));
                    return;
                }
                controller.enqueue(value);
            }
            catch (err) {
                controller.error(err instanceof CompatError
                    ? err
                    : new CompatError({
                        code: "streams/aborted",
                        package: "obix-core-streams",
                        operation: "toReadableStream",
                        reason: err instanceof Error ? err.message : String(err),
                        cause: err,
                    }));
            }
        },
        async cancel(reason) {
            if (signal && onAbort)
                signal.removeEventListener("abort", onAbort);
            if (typeof iter.return === "function") {
                try {
                    await iter.return(reason);
                }
                catch {
                }
            }
        },
    }, { highWaterMark: hwm });
}
export async function* fromReadableStream(stream, opts = {}) {
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
        void reader.cancel(signal?.reason).catch(() => { });
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
            if (done)
                return;
            if (aborted)
                throw abortError(signal, "fromReadableStream");
            yield value;
        }
    }
    finally {
        if (signal)
            signal.removeEventListener("abort", onAbort);
        try {
            if (!opts.preventCancel && !aborted) {
            }
            reader.releaseLock();
        }
        catch {
        }
    }
}
export async function collectBytes(stream) {
    const chunks = [];
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
export async function* decodeText(stream, opts = {}) {
    const dec = new TextDecoder(opts.encoding ?? "utf-8", { fatal: opts.fatal === true });
    for await (const chunk of fromReadableStream(stream, { signal: opts.signal })) {
        const piece = dec.decode(chunk, { stream: true });
        if (piece)
            yield piece;
    }
    const tail = dec.decode();
    if (tail)
        yield tail;
}
export async function pipeBytes(readable, writable, opts = {}) {
    let bytes = 0;
    const counter = new TransformStream({
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
    }
    catch (err) {
        if (err instanceof CompatError)
            throw err;
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
export function countingStream() {
    let bytes = 0;
    let chunks = 0;
    const stream = new TransformStream({
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
//# sourceMappingURL=index.js.map