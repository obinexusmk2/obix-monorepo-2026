import { Worker } from "node:worker_threads";
import { createWorkerPool, } from "./index.js";
const WORKER_URL = new URL("./worker.js", import.meta.url);
function resourceLimitsHonored() {
    const p = globalThis.process;
    return !p?.versions?.bun;
}
export function createNodeWorkerBackend(o = {}) {
    return {
        kind: "worker_threads",
        resourceLimitsHonored: resourceLimitsHonored(),
        async create() {
            const w = new Worker(WORKER_URL, {
                resourceLimits: o.resourceLimits,
            });
            await new Promise((resolve, reject) => {
                const onErr = (e) => {
                    cleanup();
                    reject(e);
                };
                const onMsg = (m) => {
                    if (m?.type === "ready") {
                        cleanup();
                        resolve();
                    }
                };
                const cleanup = () => {
                    w.off("error", onErr);
                    w.off("message", onMsg);
                };
                w.once("error", onErr);
                w.on("message", onMsg);
                setTimeout(() => {
                    cleanup();
                    reject(new Error("worker did not signal ready within 5000ms"));
                }, 5000).unref?.();
            });
            return {
                postMessage: (msg, transfer) => w.postMessage(msg, transfer ?? []),
                onMessage: (cb) => w.on("message", cb),
                onError: (cb) => w.on("error", cb),
                onExit: (cb) => w.on("exit", cb),
                terminate: () => w.terminate().then(() => undefined),
            };
        },
    };
}
export function createNodeWorkerPool(o = {}) {
    return createWorkerPool({
        backend: createNodeWorkerBackend(o),
        size: o.size,
        queueLimit: o.queueLimit,
        defaultTimeoutMs: o.defaultTimeoutMs,
        moduleParentURL: o.moduleParentURL ?? new URL(`file://${process.cwd().replace(/\\/g, "/")}/`).href,
    });
}
//# sourceMappingURL=node.js.map