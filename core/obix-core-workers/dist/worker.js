import { PROTOCOL } from "./index.js";
import { createModuleResolver } from "@obinexusltd/obix-core-modules";
const resolver = createModuleResolver();
const cancelled = new Set();
async function handle(raw, post) {
    const msg = raw;
    if (msg?.protocol !== PROTOCOL) {
        post({ protocol: PROTOCOL, type: "protocol-error", detail: "not obix-core-workers/1" });
        return;
    }
    if (msg.type === "cancel" && typeof msg.jobId === "string") {
        cancelled.add(msg.jobId);
        return;
    }
    const env = raw;
    const jobId = env.jobId;
    try {
        const { namespace } = await resolver.loadModule(env.module, env.moduleParentURL);
        const fn = namespace[env.action];
        if (typeof fn !== "function") {
            post({
                protocol: PROTOCOL,
                jobId,
                ok: false,
                error: { name: "TypeError", message: `no exported function "${env.action}" in "${env.module}"` },
            });
            return;
        }
        const ctx = { jobId, isCancelled: () => cancelled.has(jobId) };
        const result = await fn(env.data, ctx);
        if (cancelled.has(jobId)) {
            cancelled.delete(jobId);
            post({ protocol: PROTOCOL, jobId, ok: false, error: { name: "AbortError", message: "cancelled" } });
            return;
        }
        post({ protocol: PROTOCOL, jobId, ok: true, result });
    }
    catch (err) {
        post({
            protocol: PROTOCOL,
            jobId,
            ok: false,
            error: {
                name: err instanceof Error ? err.name : "Error",
                message: err instanceof Error ? err.message : String(err),
            },
        });
    }
    finally {
        cancelled.delete(jobId);
    }
}
async function boot() {
    try {
        const wt = (await import("node:worker_threads"));
        if (wt.parentPort) {
            const port = wt.parentPort;
            const post = (m) => port.postMessage(m);
            port.on?.("message", (raw) => void handle(raw, post));
            post({ protocol: PROTOCOL, type: "ready" });
            return;
        }
    }
    catch {
    }
    const g = globalThis;
    if (typeof g.postMessage === "function" && typeof g.addEventListener === "function") {
        const post = (m) => g.postMessage(m);
        g.addEventListener("message", (ev) => void handle(ev.data, post));
        post({ protocol: PROTOCOL, type: "ready" });
    }
}
void boot();
//# sourceMappingURL=worker.js.map