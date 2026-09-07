import { CompatError } from "@obinexusltd/obix-core-capabilities";
import { createModuleResolver } from "@obinexusltd/obix-core-modules";
export { CompatError } from "@obinexusltd/obix-core-capabilities";
export const PROTOCOL = "obix-core-workers/1";
let counter = 0;
const newJobId = () => `job-${Date.now().toString(36)}-${(++counter).toString(36)}`;
export function createWorkerPool(opts) {
    const size = Math.max(1, opts.size ?? 2);
    const queueLimit = Math.max(0, opts.queueLimit ?? 64);
    const idle = [];
    const all = new Set();
    const busy = new Map();
    const queue = [];
    let creating = 0;
    let disposed = false;
    function reap(p) {
        if (p.timer)
            clearTimeout(p.timer);
        if (p.signal && p.onAbort)
            p.signal.removeEventListener("abort", p.onAbort);
    }
    function fail(p, err) {
        reap(p);
        p.reject(err);
    }
    async function ensureWorker() {
        if (idle.length)
            return idle.pop();
        if (all.size + creating >= size)
            return null;
        creating++;
        try {
            const w = await opts.backend.create();
            creating--;
            all.add(w);
            w.onMessage((raw) => onWorkerMessage(w, raw));
            w.onError((err) => onWorkerDown(w, err, "error"));
            w.onExit((code) => onWorkerDown(w, new Error(`worker exited with code ${code}`), "exit"));
            return w;
        }
        catch (err) {
            creating--;
            throw new CompatError({
                code: "workers/startup",
                package: "obix-core-workers",
                operation: "createWorkerPool",
                reason: `worker failed to start: ${err instanceof Error ? err.message : String(err)}`,
                cause: err,
            });
        }
    }
    function dispatch() {
        if (disposed)
            return;
        while (queue.length) {
            const w = idle.pop();
            if (!w) {
                void ensureWorker()
                    .then((created) => {
                    if (created) {
                        idle.push(created);
                        dispatch();
                    }
                })
                    .catch((err) => {
                    const p = queue.shift();
                    if (p)
                        fail(p, err);
                    dispatch();
                });
                return;
            }
            const p = queue.shift();
            busy.set(w, p);
            p.worker = w;
            try {
                w.postMessage(p.env, p.transferables);
            }
            catch (err) {
                busy.delete(w);
                idle.push(w);
                fail(p, new CompatError({
                    code: "workers/protocol",
                    package: "obix-core-workers",
                    operation: "submitJob",
                    reason: `payload is not serializable / transferable: ${err instanceof Error ? err.message : String(err)}`,
                    cause: err,
                }));
            }
        }
    }
    function onWorkerMessage(w, raw) {
        const msg = raw;
        if (!msg || typeof msg !== "object" || msg.protocol !== PROTOCOL) {
            onWorkerDown(w, new CompatError({
                code: "workers/protocol",
                package: "obix-core-workers",
                operation: "worker",
                reason: `worker sent a message that is not ${PROTOCOL}`,
            }), "protocol");
            return;
        }
        if ("type" in msg && (msg.type === "ready" || msg.type === "protocol-error"))
            return;
        const p = busy.get(w);
        if (!p || !("jobId" in msg) || p.jobId !== msg.jobId)
            return;
        busy.delete(w);
        idle.push(w);
        reap(p);
        if (msg.ok)
            p.resolve(msg.result);
        else {
            p.reject(new CompatError({
                code: "workers/crash",
                package: "obix-core-workers",
                operation: "submitJob",
                reason: `${msg.error.name}: ${msg.error.message}`,
            }));
        }
        dispatch();
    }
    function onWorkerDown(w, err, _why) {
        if (!all.has(w))
            return;
        all.delete(w);
        const i = idle.indexOf(w);
        if (i >= 0)
            idle.splice(i, 1);
        const p = busy.get(w);
        if (p) {
            busy.delete(w);
            fail(p, err instanceof CompatError
                ? err
                : new CompatError({
                    code: "workers/crash",
                    package: "obix-core-workers",
                    operation: "submitJob",
                    reason: `worker crashed: ${err instanceof Error ? err.message : String(err)}`,
                    cause: err,
                }));
        }
        void w.terminate();
        if (!disposed)
            dispatch();
    }
    function submitJob(req, so = {}) {
        if (disposed) {
            return Promise.reject(new CompatError({
                code: "workers/startup",
                package: "obix-core-workers",
                operation: "submitJob",
                reason: "the worker pool has been disposed",
            }));
        }
        if (typeof req?.module !== "string" || typeof req?.action !== "string") {
            return Promise.reject(new CompatError({
                code: "workers/protocol",
                package: "obix-core-workers",
                operation: "submitJob",
                reason: "a job needs a string `module` specifier and a string `action` export name",
                remediation: "Pass a module the worker can import and the name of an exported function — not a function value.",
            }));
        }
        if (typeof req.data === "function") {
            return Promise.reject(new CompatError({
                code: "workers/protocol",
                package: "obix-core-workers",
                operation: "submitJob",
                reason: "`data` is a function — functions cannot cross the worker boundary",
            }));
        }
        if (busy.size + queue.length >= size + queueLimit) {
            return Promise.reject(new CompatError({
                code: "workers/queue-full",
                package: "obix-core-workers",
                operation: "submitJob",
                reason: `pool is full (size=${size}, queueLimit=${queueLimit})`,
                remediation: "Back off and retry, or raise `queueLimit`.",
            }));
        }
        const jobId = newJobId();
        const env = {
            protocol: PROTOCOL,
            jobId,
            module: req.module,
            action: req.action,
            data: req.data,
            moduleParentURL: opts.moduleParentURL,
            transfer: so.transfer,
        };
        const transferables = collectTransferables(req.data, so.transfer);
        return new Promise((resolve, reject) => {
            const p = { jobId, env, transferables, resolve: resolve, reject };
            const timeoutMs = so.timeoutMs ?? opts.defaultTimeoutMs ?? 0;
            if (timeoutMs > 0) {
                p.timer = setTimeout(() => {
                    removeFromQueue(p);
                    if (p.worker) {
                        try {
                            p.worker.postMessage({ protocol: PROTOCOL, type: "cancel", jobId });
                        }
                        catch {
                        }
                    }
                    fail(p, new CompatError({
                        code: "workers/crash",
                        package: "obix-core-workers",
                        operation: "submitJob",
                        reason: `job ${jobId} timed out after ${timeoutMs}ms (cooperative cancel sent; no preemption)`,
                    }));
                }, timeoutMs);
                if (typeof p.timer.unref === "function")
                    p.timer.unref();
            }
            if (so.signal) {
                p.signal = so.signal;
                p.onAbort = () => {
                    removeFromQueue(p);
                    if (p.worker) {
                        try {
                            p.worker.postMessage({ protocol: PROTOCOL, type: "cancel", jobId });
                        }
                        catch {
                        }
                    }
                    fail(p, new CompatError({
                        code: "workers/crash",
                        package: "obix-core-workers",
                        operation: "submitJob",
                        reason: `job ${jobId} aborted (cooperative cancel sent; no preemption)`,
                    }));
                };
                if (so.signal.aborted) {
                    p.onAbort();
                    return;
                }
                so.signal.addEventListener("abort", p.onAbort, { once: true });
            }
            queue.push(p);
            dispatch();
        });
    }
    function removeFromQueue(p) {
        const i = queue.indexOf(p);
        if (i >= 0)
            queue.splice(i, 1);
    }
    function cancelJob(jobId) {
        const qp = queue.find((p) => p.jobId === jobId);
        if (qp) {
            removeFromQueue(qp);
            fail(qp, new CompatError({
                code: "workers/crash",
                package: "obix-core-workers",
                operation: "cancelJob",
                reason: `job ${jobId} cancelled before it started`,
            }));
            return;
        }
        for (const [w, p] of busy) {
            if (p.jobId === jobId) {
                try {
                    w.postMessage({ protocol: PROTOCOL, type: "cancel", jobId });
                }
                catch {
                }
                return;
            }
        }
    }
    async function dispose() {
        if (disposed)
            return;
        disposed = true;
        const err = new CompatError({
            code: "workers/startup",
            package: "obix-core-workers",
            operation: "dispose",
            reason: "the worker pool was disposed",
        });
        for (const p of queue.splice(0))
            fail(p, err);
        for (const p of busy.values())
            fail(p, err);
        busy.clear();
        await Promise.all([...all].map((w) => Promise.resolve(w.terminate()).catch(() => { })));
        all.clear();
        idle.length = 0;
    }
    return {
        submitJob,
        cancelJob,
        dispose,
        get activeWorkers() {
            return all.size;
        },
        get queued() {
            return queue.length;
        },
        get running() {
            return busy.size;
        },
        get resourceLimitsHonored() {
            return opts.backend.resourceLimitsHonored;
        },
        get backendKind() {
            return opts.backend.kind;
        },
    };
}
function get(obj, path) {
    if (path === "")
        return obj;
    let cur = obj;
    for (const seg of path.split(".")) {
        if (cur && typeof cur === "object")
            cur = cur[seg];
        else
            return undefined;
    }
    return cur;
}
function collectTransferables(data, paths) {
    if (!paths || paths.length === 0)
        return [];
    const out = [];
    for (const p of paths) {
        const v = get(data, p);
        if (v instanceof ArrayBuffer)
            out.push(v);
        else if (ArrayBuffer.isView(v))
            out.push(v.buffer);
    }
    return out;
}
export async function runInline(req, moduleParentURL) {
    const resolver = createModuleResolver();
    const { namespace } = await resolver.loadModule(req.module, moduleParentURL);
    const fn = namespace[req.action];
    if (typeof fn !== "function") {
        throw new CompatError({
            code: "workers/protocol",
            package: "obix-core-workers",
            operation: "runInline",
            reason: `module "${req.module}" has no exported function "${req.action}"`,
        });
    }
    const result = (await fn(req.data));
    return { result, mode: "inline-fallback" };
}
//# sourceMappingURL=index.js.map