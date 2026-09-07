import { Readable, Writable } from "node:stream";
import { CompatError } from "@obinexusltd/obix-core-capabilities";
export function nodeReadableToWeb(nodeReadable) {
    if (typeof Readable.toWeb !== "function") {
        throw new CompatError({
            code: "streams/locked",
            package: "obix-core-streams",
            operation: "nodeReadableToWeb",
            reason: "Readable.toWeb is unavailable in this Node build",
            remediation: "Use Node ≥ 17, or adapt the stream manually.",
        });
    }
    return Readable.toWeb(nodeReadable);
}
export function webReadableToNode(webStream) {
    return Readable.fromWeb(webStream);
}
export function nodeWritableToWeb(nodeWritable) {
    return Writable.toWeb(nodeWritable);
}
//# sourceMappingURL=node.js.map