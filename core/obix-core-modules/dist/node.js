import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CompatError } from "@obinexusltd/obix-core-capabilities";
import { createModuleResolver } from "./index.js";
export function createNodeModuleResolver(parentForRequire) {
    const req = createRequire(parentForRequire);
    return createModuleResolver({
        resolveImpl(specifier, parentURL) {
            const im = import.meta;
            if (typeof im.resolve === "function") {
                try {
                    return im.resolve(specifier, parentURL);
                }
                catch {
                }
            }
            return pathToFileURL(req.resolve(specifier)).href;
        },
    });
}
export function copyAssets(items, ownerURL) {
    const resolver = createModuleResolver();
    let copied = 0;
    for (const item of items) {
        const srcUrl = resolver.resolveAsset(item.from, ownerURL);
        if (!srcUrl.startsWith("file:")) {
            throw new CompatError({
                code: "module/resolve",
                package: "obix-core-modules",
                operation: "copyAssets",
                reason: `asset "${item.from}" did not resolve to a file: URL (${srcUrl})`,
            });
        }
        const src = fileURLToPath(srcUrl);
        if (!existsSync(src)) {
            throw new CompatError({
                code: "fs/read",
                package: "obix-core-modules",
                operation: "copyAssets",
                reason: `asset not found: ${src}`,
                remediation: "Check the asset path is relative to the module that references it.",
            });
        }
        mkdirSync(dirname(item.to), { recursive: true });
        cpSync(src, item.to, { recursive: true });
        copied++;
    }
    return { copied };
}
//# sourceMappingURL=node.js.map