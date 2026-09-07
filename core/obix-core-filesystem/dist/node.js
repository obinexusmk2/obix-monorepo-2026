import { readFile, writeFile, rename, mkdir, rm, stat, readdir } from "node:fs/promises";
import { watch as fsWatch } from "node:fs";
import * as nodePath from "node:path";
import { createFilesystem } from "./index.js";
export function createNodeFsProvider() {
    return {
        async readFile(p) {
            return new Uint8Array(await readFile(p));
        },
        async writeFile(p, data) {
            await writeFile(p, data);
        },
        async rename(from, to) {
            await rename(from, to);
        },
        async mkdir(p, o) {
            await mkdir(p, o);
        },
        async rm(p, o) {
            await rm(p, { force: o.force, recursive: true });
        },
        async stat(p) {
            const s = await stat(p);
            return {
                isFile: s.isFile(),
                isDirectory: s.isDirectory(),
                size: s.size,
                mtimeMs: s.mtimeMs,
            };
        },
        async readdir(p) {
            return readdir(p);
        },
        watch(p, onEvent) {
            const w = fsWatch(p, { recursive: true }, (type, filename) => {
                const rel = typeof filename === "string" ? filename : filename ? Buffer.from(filename).toString() : "";
                onEvent({ type: type === "rename" ? "rename" : "change", path: rel ? nodePath.join(p, rel) : p });
            });
            return { close: () => w.close() };
        },
        join: (...parts) => nodePath.join(...parts),
        dirname: (p) => nodePath.dirname(p),
        basename: (p) => nodePath.basename(p),
        resolve: (...parts) => nodePath.resolve(...parts),
        isInside: (parent, child) => {
            const rel = nodePath.relative(nodePath.resolve(parent), nodePath.resolve(child));
            return rel === "" || (!rel.startsWith("..") && !nodePath.isAbsolute(rel));
        },
        sep: nodePath.sep,
    };
}
export function createNodeFilesystem(opts = {}) {
    return createFilesystem({
        provider: createNodeFsProvider(),
        timing: {
            now: () => performance.now(),
            setTimeout: (fn, ms) => {
                const h = setTimeout(fn, ms);
                if (typeof h.unref === "function")
                    h.unref();
                return h;
            },
            clearTimeout: (h) => clearTimeout(h),
        },
        projectRoot: opts.projectRoot ?? process.cwd(),
    });
}
//# sourceMappingURL=node.js.map