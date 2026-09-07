import { createWorkerPool, } from "./index.js";
const WORKER_URL = new URL("./worker.js", import.meta.url);
export function createWebWorkerBackend() {
    const WorkerCtor = globalThis.Worker;
    if (typeof WorkerCtor !== "function") {
        throw new Error("global Worker is not available in this runtime — use @obinexusltd/obix-core-workers/node");
    }
    return {
        kind: "web-worker",
        resourceLimitsHonored: false,
        async create() {
            const w = new WorkerCtor(WORKER_URL, { type: "module" });
            await new Promise((resolve, reject) => {
                const onErr = (e) => {
                    cleanup();
                    reject(e);
                };
                const onMsg = (ev) => {
                    if (ev.data?.type === "ready") {
                        cleanup();
                        resolve();
                    }
                };
                const cleanup = () => {
                    w.removeEventListener("message", onMsg);
                    w.removeEventListener("error", onErr);
                };
                w.addEventListener("message", onMsg);
                w.addEventListener("error", onErr);
                setTimeout(() => {
                    cleanup();
                    reject(new Error("worker did not signal ready within 5000ms"));
                }, 5000);
            });
            return {
                postMessage: (msg, transfer) => w.postMessage(msg, transfer ?? []),
                onMessage: (cb) => w.addEventListener("message", (ev) => cb(ev.data)),
                onError: (cb) => w.addEventListener("error", (ev) => cb(ev)),
                onExit: () => {
                },
                terminate: () => w.terminate(),
            };
        },
    };
}
export function createWebWorkerPool(o = {}) {
    return createWorkerPool({
        backend: createWebWorkerBackend(),
        size: o.size,
        queueLimit: o.queueLimit,
        defaultTimeoutMs: o.defaultTimeoutMs,
        moduleParentURL: o.moduleParentURL ?? new URL("./", import.meta.url).href,
    });
}
//# sourceMappingURL=web.js.map