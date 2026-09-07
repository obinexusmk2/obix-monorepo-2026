import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { extname } from "node:path";
import { CompatError } from "@obinexusltd/obix-core-capabilities";
export function nodeApiProvider(o) {
    const ext = extname(o.addonPath).toLowerCase();
    if (ext !== ".node") {
        throw new CompatError({
            code: "native/no-binary",
            package: "obix-core-native",
            operation: "nodeApiProvider",
            reason: `addonPath must be a .node addon, got "${ext}" — a .dll/.so/.dylib needs an FFI provider`,
            remediation: "Point at a compiled Node-API .node addon, or register an ffi-* / bridge provider.",
        });
    }
    return {
        id: o.id,
        kind: "node-api",
        runtime: ["node"],
        os: o.os ?? [process.platform],
        arch: o.arch ?? [process.arch],
        libc: o.libc,
        abi: { napiVersion: o.napiVersion },
        operations: [...o.operations],
        ownership: o.ownership ?? "provider-managed",
        detail: o.detail ?? o.addonPath,
        load: () => {
            if (!existsSync(o.addonPath)) {
                const e = new Error(`ENOENT: no such addon ${o.addonPath}`);
                e.code = "ENOENT";
                throw e;
            }
            const req = createRequire(import.meta.url);
            const addon = req(o.addonPath);
            return o.bind ? o.bind(addon) : addon;
        },
    };
}
export function inspectNodePolycall(fromDir = process.cwd()) {
    const NOTE = "Informational only. To use node-polycall you must register a provider whose " +
        "load() imports it and expose its real, verified operations — this package " +
        "does not assume an API.";
    try {
        const req = createRequire(`${fromDir}/noop.js`);
        const pj = req.resolve("@obinexusltd/node-polycall/package.json");
        const manifest = req(pj);
        return {
            installed: true,
            resolvedFrom: pj,
            exportKeys: manifest.exports ? Object.keys(manifest.exports) : [],
            version: manifest.version ?? null,
            note: NOTE,
        };
    }
    catch {
        return { installed: false, resolvedFrom: null, exportKeys: [], version: null, note: NOTE };
    }
}
export { createNativeRegistry, probeNative } from "./index.js";
//# sourceMappingURL=node.js.map