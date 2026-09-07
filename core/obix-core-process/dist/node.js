import { spawn as cpSpawn, execFile } from "node:child_process";
import { Readable } from "node:stream";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join, dirname, delimiter } from "node:path";
import { createProcessRunner, resolveTool, } from "./index.js";
function nodeSpawn(params) {
    const child = cpSpawn(params.command, [...params.args], {
        cwd: params.cwd,
        env: params.env,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
    });
    const exited = new Promise((resolve, reject) => {
        child.on("exit", (code, signal) => resolve({ code, signal }));
        child.on("error", (err) => reject(err));
    });
    return {
        pid: child.pid,
        streams: {
            stdout: child.stdout ? Readable.toWeb(child.stdout) : null,
            stderr: child.stderr ? Readable.toWeb(child.stderr) : null,
        },
        exited,
        kill: (signal) => child.kill(signal ?? "SIGTERM"),
        killTree: process.platform === "win32" && child.pid
            ? () => new Promise((resolve) => {
                execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], () => resolve(true));
            })
            : undefined,
    };
}
export function which(name) {
    if (name.includes("/") || name.includes("\\"))
        return existsSync(name) ? name : null;
    const paths = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
    const pathext = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [];
    const hasKnownExt = pathext.some((e) => name.toLowerCase().endsWith(e.toLowerCase()));
    const exts = hasKnownExt ? [""] : ["", ...pathext];
    for (const dir of paths) {
        for (const ext of exts) {
            const candidate = join(dir, name + ext);
            if (existsSync(candidate))
                return candidate;
        }
    }
    return null;
}
export function resolveJsBin(fromDir) {
    const req = createRequire(join(fromDir, "noop.js"));
    return (pkg, bin) => {
        let manifestPath;
        try {
            manifestPath = req.resolve(`${pkg}/package.json`);
        }
        catch {
            return null;
        }
        const manifest = req(manifestPath);
        const pkgDir = dirname(manifestPath);
        if (typeof manifest.bin === "string") {
            return join(pkgDir, manifest.bin);
        }
        if (manifest.bin && typeof manifest.bin === "object") {
            const key = bin ?? Object.keys(manifest.bin)[0];
            const rel = key ? manifest.bin[key] : undefined;
            return rel ? join(pkgDir, rel) : null;
        }
        return null;
    };
}
export function createNodeProcessRunner(opts = {}) {
    const runner = createProcessRunner(nodeSpawn);
    const from = opts.resolveFrom ?? process.cwd();
    const hooks = {
        which,
        resolveJsBin: resolveJsBin(from),
        jsRuntime: process.execPath,
    };
    return Object.assign(runner, {
        resolve: (spec) => resolveTool(spec, hooks),
    });
}
export { resolveTool } from "./index.js";
//# sourceMappingURL=node.js.map