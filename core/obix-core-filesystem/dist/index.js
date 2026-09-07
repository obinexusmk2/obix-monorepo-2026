import { CompatError } from "@obinexusltd/obix-core-capabilities";
export { CompatError } from "@obinexusltd/obix-core-capabilities";
const FILE_URL = /^file:\/\//i;
const ANY_URL = /^[a-z][a-z0-9+.-]*:\/\//i;
export function createFilesystem(opts) {
    const { provider: fs, timing } = opts;
    const root = fs.resolve(opts.projectRoot);
    const rand = opts.randomToken ?? (() => Math.random().toString(36).slice(2, 10));
    const writeChains = new Map();
    function fail(code, operation, reason, extra) {
        return new CompatError({ code, package: "obix-core-filesystem", operation, reason, ...extra });
    }
    function resolveProjectPath(input) {
        if (typeof input !== "string" || input === "") {
            throw fail("fs/read", "resolveProjectPath", "path must be a non-empty string");
        }
        if (ANY_URL.test(input)) {
            throw fail("fs/read", "resolveProjectPath", `got a URL (${input}); pass a filesystem path, or convert with urlToPath()`, {
                remediation: "URLs and filesystem paths are distinct — use urlToPath() first.",
            });
        }
        const abs = fs.resolve(root, input);
        if (!fs.isInside(root, abs) && abs !== root) {
            throw fail("fs/read", "resolveProjectPath", `"${input}" resolves outside the project root (${root})`, {
                remediation: "Keep paths within the project; pass an explicit absolute path only when you mean to.",
            });
        }
        return abs;
    }
    function absOf(relOrAbs) {
        if (fs.resolve(relOrAbs) === relOrAbs && fs.isInside(root, relOrAbs))
            return relOrAbs;
        return resolveProjectPath(relOrAbs);
    }
    function urlToPath(url) {
        const s = typeof url === "string" ? url : url.href;
        if (!FILE_URL.test(s)) {
            throw fail("fs/read", "urlToPath", `not a file: URL: ${s}`);
        }
        const u = new URL(s);
        let p = decodeURIComponent(u.pathname);
        if (/^\/[a-z]:/i.test(p))
            p = p.slice(1);
        return fs.resolve(p.replace(/\//g, fs.sep));
    }
    function pathToUrl(path) {
        const abs = fs.resolve(path);
        const asPosix = abs.replace(/\\/g, "/");
        const withSlash = /^[a-z]:/i.test(asPosix) ? `/${asPosix}` : asPosix;
        return `file://${withSlash.split("/").map((seg) => (seg.includes(":") ? seg : encodeURIComponent(seg))).join("/")}`;
    }
    async function readBytes(relOrAbs) {
        const p = absOf(relOrAbs);
        try {
            return await fs.readFile(p);
        }
        catch (err) {
            throw fail("fs/read", "readBytes", `cannot read ${p}: ${errMsg(err)}`, { cause: err });
        }
    }
    async function readText(relOrAbs, encoding = "utf-8") {
        const bytes = await readBytes(relOrAbs);
        return new TextDecoder(encoding).decode(bytes);
    }
    function writeFileSafely(relOrAbs, data, encoding = "utf-8") {
        const target = absOf(relOrAbs);
        const bytes = typeof data === "string" ? new TextEncoder().encode(encoding === "utf-8" ? data : data) : data;
        const run = async () => {
            const dir = fs.dirname(target);
            await fs.mkdir(dir, { recursive: true });
            const tmp = fs.join(dir, `.${fs.basename(target)}.${rand()}.tmp`);
            try {
                await fs.writeFile(tmp, bytes);
                await fs.rename(tmp, target);
            }
            catch (err) {
                try {
                    await fs.rm(tmp, { force: true });
                }
                catch {
                }
                throw fail("fs/write", "writeFileSafely", `cannot write ${target}: ${errMsg(err)}`, { cause: err });
            }
            return {
                path: target,
                bytes: bytes.byteLength,
                strategy: "temp-file-rename",
                durability: "rename replaced the target; atomic within one directory on a local disk, " +
                    "not guaranteed across filesystems / on network mounts; directory fsync not performed",
            };
        };
        const prev = writeChains.get(target) ?? Promise.resolve();
        const next = prev.then(run, run);
        writeChains.set(target, next.finally(() => {
            if (writeChains.get(target) === next)
                writeChains.delete(target);
        }));
        return next;
    }
    function watchTree(relOrAbs, onInvalidate, o = {}) {
        const base = absOf(relOrAbs);
        const debounceMs = Math.max(0, o.debounceMs ?? 40);
        const pollMs = Math.max(10, o.pollMs ?? 250);
        const wantNative = (o.mode ?? "auto") !== "poll" && typeof fs.watch === "function";
        const mode = wantNative ? "native" : "poll";
        let closed = false;
        let debounceHandle = null;
        const dirty = new Set();
        const flush = () => {
            debounceHandle = null;
            if (dirty.size === 0 || closed)
                return;
            const paths = [...dirty];
            dirty.clear();
            try {
                onInvalidate(paths);
            }
            catch {
            }
        };
        const invalidate = (p) => {
            if (closed)
                return;
            dirty.add(p);
            if (debounceHandle == null)
                debounceHandle = timing.setTimeout(flush, debounceMs);
        };
        let stopNative = null;
        let pollHandle = null;
        if (mode === "native") {
            stopNative = fs.watch(base, (evt) => invalidate(fs.resolve(evt.path)));
        }
        else {
            const snap = new Map();
            const scan = async () => {
                const acc = new Map();
                const walk = async (d) => {
                    let entries = [];
                    try {
                        entries = await fs.readdir(d);
                    }
                    catch {
                        return;
                    }
                    for (const name of entries) {
                        const p = fs.join(d, name);
                        let st;
                        try {
                            st = await fs.stat(p);
                        }
                        catch {
                            continue;
                        }
                        if (st.isDirectory)
                            await walk(p);
                        else
                            acc.set(p, `${st.size}:${st.mtimeMs}`);
                    }
                };
                try {
                    const bst = await fs.stat(base);
                    if (bst.isDirectory)
                        await walk(base);
                    else
                        acc.set(base, `${bst.size}:${bst.mtimeMs}`);
                }
                catch {
                }
                return acc;
            };
            const tick = async () => {
                if (closed)
                    return;
                const cur = await scan();
                for (const [p, sig] of cur)
                    if (snap.get(p) !== sig)
                        invalidate(p);
                for (const p of snap.keys())
                    if (!cur.has(p))
                        invalidate(p);
                snap.clear();
                for (const [p, sig] of cur)
                    snap.set(p, sig);
                if (!closed)
                    pollHandle = timing.setTimeout(() => void tick(), pollMs);
            };
            void scan().then((first) => {
                for (const [p, sig] of first)
                    snap.set(p, sig);
                if (!closed)
                    pollHandle = timing.setTimeout(() => void tick(), pollMs);
            });
        }
        const close = () => {
            if (closed)
                return;
            closed = true;
            if (debounceHandle != null)
                timing.clearTimeout(debounceHandle);
            if (pollHandle != null)
                timing.clearTimeout(pollHandle);
            stopNative?.close();
        };
        o.signal?.addEventListener("abort", close, { once: true });
        return { close, mode };
    }
    return { resolveProjectPath, urlToPath, pathToUrl, readBytes, readText, writeFileSafely, watchTree };
}
function errMsg(err) {
    return err instanceof Error ? err.message : String(err);
}
//# sourceMappingURL=index.js.map