export class CompatError extends Error {
    name = "CompatError";
    code;
    package;
    operation;
    reason;
    runtime;
    capability;
    remediation;
    constructor(init) {
        super(`[${init.package}] ${init.operation}: ${init.reason} (${init.code})`, {
            cause: init.cause,
        });
        this.code = init.code;
        this.package = init.package;
        this.operation = init.operation;
        this.reason = init.reason;
        this.runtime = init.runtime ?? detectHost().runtime;
        this.capability = init.capability;
        this.remediation = init.remediation;
    }
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            package: this.package,
            operation: this.operation,
            reason: this.reason,
            runtime: this.runtime,
            capability: this.capability ?? null,
            remediation: this.remediation ?? null,
            cause: this.cause instanceof Error
                ? { name: this.cause.name, message: this.cause.message }
                : this.cause ?? null,
        };
    }
}
export function isCompatError(value) {
    return value instanceof CompatError || (typeof value === "object" && value != null && value.name === "CompatError");
}
const g = () => globalThis;
function readProcess() {
    const p = g().process;
    return p && typeof p === "object" ? p : null;
}
export const HOST_DETECTION_NOTE = "detectHost() is a best-effort heuristic over runtime-specific global markers " +
    "(Deno.version.deno, Bun.version / process.versions.bun, window+document, " +
    "WorkerGlobalScope, process.versions.node), in that precedence order. It is " +
    "NOT authenticated identity: a caller can define those markers. Provider " +
    "selection must therefore depend on probed capabilities and real operation " +
    "outcomes, not on this string alone.";
export function detectHost() {
    const global = g();
    const proc = readProcess();
    const deno = global.Deno;
    const isDeno = !!deno && typeof deno.version?.deno === "string";
    const bun = global.Bun;
    const isBun = (!!bun && typeof bun.version === "string") ||
        (!!proc?.versions?.bun && typeof proc.versions.bun === "string");
    const hasWindow = typeof global.window !== "undefined" && typeof global.document !== "undefined";
    const isWorker = !hasWindow &&
        (typeof global.WorkerGlobalScope !== "undefined" ||
            (typeof global.self !== "undefined" && typeof global.importScripts === "function"));
    let runtime = "unknown";
    let runtimeVersion = null;
    if (isDeno) {
        runtime = "deno";
        runtimeVersion = deno.version.deno ?? null;
    }
    else if (isBun) {
        runtime = "bun";
        runtimeVersion = (bun && bun.version) || proc?.versions?.bun || null;
    }
    else if (hasWindow) {
        runtime = "browser";
        runtimeVersion = typeof global.navigator?.userAgent === "string" ? global.navigator.userAgent : null;
    }
    else if (isWorker && !proc?.versions?.node) {
        runtime = "webworker";
        runtimeVersion = typeof global.navigator?.userAgent === "string" ? global.navigator.userAgent : null;
    }
    else if (proc?.versions?.node) {
        runtime = "node";
        runtimeVersion = proc.versions.node ?? null;
    }
    const nodeCompatVersion = typeof proc?.versions?.node === "string" ? proc.versions.node : null;
    let os = null;
    let arch = null;
    if (isDeno && deno.build) {
        os = deno.build.os ?? null;
        arch = deno.build.arch ?? null;
    }
    else if (proc?.platform) {
        os = proc.platform ?? null;
        arch = proc.arch ?? null;
    }
    else if (typeof global.navigator?.platform === "string") {
        os = global.navigator.platform;
    }
    let libc = null;
    if (os === "linux") {
        const rep = typeof proc?.report?.getReport === "function" ? safe(() => proc.report.getReport()) : null;
        const glibc = rep?.header?.glibcVersionRuntime;
        if (typeof glibc === "string")
            libc = "glibc";
    }
    return {
        runtime,
        runtimeVersion,
        nodeCompatVersion,
        os,
        arch,
        libc,
        isBrowserWindow: hasWindow,
        isWorker,
    };
}
function safe(fn) {
    try {
        return fn();
    }
    catch {
        return null;
    }
}
const ALL_CAPS = [
    "fs",
    "fs-watch",
    "spawn",
    "worker-threads",
    "web-worker",
    "native-addon",
    "ffi",
    "dom",
    "fetch",
    "web-streams",
    "abort-signal",
    "performance-now",
    "high-res-time",
    "ref-unref",
];
function result(capability, status, reason, provider = null) {
    return { capability, status, reason, provider };
}
function denoPermission(name, opts) {
    const deno = g().Deno;
    const q = deno?.permissions?.querySync;
    if (typeof q !== "function")
        return "unknown";
    const st = safe(() => q.call(deno.permissions, { name, ...opts }));
    if (!st || typeof st.state !== "string")
        return "unknown";
    if (st.state === "granted")
        return "available";
    if (st.state === "denied")
        return "denied";
    return "unknown";
}
function nodePermission(scope) {
    const proc = readProcess();
    const perm = proc?.permission;
    if (!perm || typeof perm.has !== "function")
        return "available";
    const key = scope === "fs" ? "fs.read" : scope === "child_process" ? "child" : scope === "worker" ? "worker" : "addon";
    return safe(() => perm.has(key)) ? "available" : "denied";
}
export function probeCapabilities(names = ALL_CAPS) {
    const host = detectHost();
    const global = g();
    const out = {};
    for (const cap of names) {
        out[cap] = probeOne(cap, host, global);
    }
    return out;
}
function probeOne(cap, host, global) {
    switch (cap) {
        case "dom": {
            if (host.isBrowserWindow)
                return result("dom", "available", "window + document present", "window");
            if (typeof global.document !== "undefined")
                return result("dom", "available", "document present", "document");
            return result("dom", "unavailable", "no document in this context");
        }
        case "fetch":
            return typeof global.fetch === "function"
                ? result("fetch", "available", "global fetch", "globalThis.fetch")
                : result("fetch", "unavailable", "no global fetch");
        case "web-streams":
            return typeof global.ReadableStream === "function" && typeof global.WritableStream === "function"
                ? result("web-streams", "available", "ReadableStream + WritableStream", "globalThis")
                : result("web-streams", "unavailable", "Web Streams not global");
        case "abort-signal":
            return typeof global.AbortController === "function"
                ? result("abort-signal", "available", "AbortController", "globalThis.AbortController")
                : result("abort-signal", "unavailable", "no AbortController");
        case "performance-now":
        case "high-res-time":
            return typeof global.performance?.now === "function"
                ? result(cap, "available", "performance.now()", "globalThis.performance")
                : result(cap, "unavailable", "no performance.now");
        case "web-worker":
            return typeof global.Worker === "function"
                ? result("web-worker", "available", "global Worker", "globalThis.Worker")
                : result("web-worker", "unavailable", "no global Worker");
        case "fs": {
            if (host.runtime === "browser")
                return result("fs", "unavailable", "no filesystem in a window context");
            if (host.runtime === "deno") {
                const st = denoPermission("read");
                return result("fs", st, st === "available" ? "Deno read granted" : st === "denied" ? "Deno read denied" : "Deno read prompt — not queried", "Deno");
            }
            if (host.nodeCompatVersion || host.runtime === "bun") {
                const st = nodePermission("fs");
                return result("fs", st, st === "denied" ? "node --permission denies fs" : "node:fs present", "node:fs");
            }
            return result("fs", "unknown", "no filesystem signal for this runtime");
        }
        case "fs-watch": {
            const base = probeOne("fs", host, global);
            if (base.status !== "available")
                return result("fs-watch", base.status, `depends on fs: ${base.reason}`, base.provider);
            return result("fs-watch", "available", "fs.watch present (delivery not guaranteed; use polling fallback)", "node:fs.watch");
        }
        case "spawn": {
            if (host.runtime === "browser" || host.runtime === "webworker")
                return result("spawn", "unavailable", "no child processes in web contexts");
            if (host.runtime === "deno") {
                const st = denoPermission("run");
                return result("spawn", st, st === "available" ? "Deno run granted" : st === "denied" ? "Deno run denied" : "Deno run prompt — not queried", "Deno.Command");
            }
            const st = nodePermission("child_process");
            return result("spawn", st, st === "denied" ? "node --permission denies child processes" : "node:child_process present", "node:child_process");
        }
        case "worker-threads": {
            if (host.runtime === "browser" || host.runtime === "webworker")
                return result("worker-threads", "unavailable", "web contexts use web-worker instead");
            if (host.runtime === "deno")
                return result("worker-threads", "unknown", "Deno node:worker_threads compatibility is host-config dependent");
            const st = nodePermission("worker");
            return result("worker-threads", st, st === "denied" ? "node --permission denies workers" : "node:worker_threads present", "node:worker_threads");
        }
        case "native-addon": {
            if (host.runtime === "browser" || host.runtime === "webworker")
                return result("native-addon", "unavailable", "no native addon loader in web contexts");
            if (host.runtime === "deno") {
                const st = denoPermission("ffi");
                return result("native-addon", st === "denied" ? "denied" : "unknown", "Deno needs --allow-ffi and local node_modules for N-API", "Deno");
            }
            const st = nodePermission("addon");
            const proc = readProcess();
            if (typeof proc?.dlopen !== "function")
                return result("native-addon", "unavailable", "process.dlopen absent");
            return result("native-addon", st, st === "denied" ? "node --permission denies addons" : "process.dlopen present (no addon loaded)", "process.dlopen");
        }
        case "ffi": {
            if (host.runtime === "bun") {
                return typeof global.Bun?.dlopen === "function"
                    ? result("ffi", "available", "Bun.dlopen (experimental — opt-in)", "bun:ffi")
                    : result("ffi", "unavailable", "Bun.dlopen absent");
            }
            if (host.runtime === "deno") {
                const st = denoPermission("ffi");
                return result("ffi", st === "available" ? "available" : st === "denied" ? "denied" : "unknown", "Deno.dlopen behind --allow-ffi", "Deno.dlopen");
            }
            return result("ffi", "unknown", "Node FFI is experimental and flag-gated; not the LTS baseline");
        }
        case "ref-unref": {
            if (host.runtime === "node" || host.runtime === "bun") {
                return result("ref-unref", "available", "timer handles expose ref()/unref()", "node:timers");
            }
            return result("ref-unref", "unavailable", "no ref/unref on timer handles in this runtime");
        }
        default:
            return result(cap, "unknown", "no probe implemented");
    }
}
export function requireCapability(capability, opts) {
    const res = (opts.results ?? probeCapabilities([capability]))[capability];
    const okUnknown = opts.allowUnknown === true && res.status === "unknown";
    if (res.status === "available" || okUnknown)
        return res;
    const code = res.status === "denied" ? "capability/denied" : res.status === "unknown" ? "capability/unknown" : "capability/unavailable";
    const remediation = res.status === "denied"
        ? detectHost().runtime === "deno"
            ? "Re-run with the matching Deno permission flag (e.g. --allow-read / --allow-run / --allow-ffi)."
            : "Re-run without the Node --permission restriction, or grant the required scope."
        : res.status === "unknown"
            ? "Run the operation and handle the failure; capability inspection cannot confirm authorization here."
            : `This runtime does not provide '${capability}'. Use a supported host or an explicit provider.`;
    throw new CompatError({
        code,
        package: opts.package,
        operation: opts.operation,
        capability,
        reason: `capability '${capability}' is '${res.status}': ${res.reason}`,
        remediation,
    });
}
export function inspect() {
    return { host: detectHost(), capabilities: probeCapabilities() };
}
export const ALL_CAPABILITIES = ALL_CAPS;
//# sourceMappingURL=index.js.map