/**
 * @obinexusltd/obix-core-workers — the worker-side runtime (entry).
 *
 * Runs inside `worker_threads` (Node / Deno / Bun) OR a web `Worker`. It loads
 * the job's module and calls the named export. It never receives or evaluates
 * code — only a `JobEnvelope` with a module specifier + export name + data.
 *
 * This file is the built `dist/worker.js`, referenced by the `./node` and
 * `./web` pool factories.
 */
import { PROTOCOL, type JobEnvelope, type WorkerOutbound } from "./index.js";
import { createModuleResolver } from "@obinexusltd/obix-core-modules";

type Port = {
  postMessage(msg: unknown): void;
  on?(event: "message", cb: (msg: unknown) => void): void;
  addEventListener?(event: "message", cb: (ev: { data: unknown }) => void): void;
};

const resolver = createModuleResolver();
const cancelled = new Set<string>();

async function handle(raw: unknown, post: (m: WorkerOutbound) => void): Promise<void> {
  const msg = raw as { protocol?: string; type?: string; jobId?: string };
  if (msg?.protocol !== PROTOCOL) {
    post({ protocol: PROTOCOL, type: "protocol-error", detail: "not obix-core-workers/1" });
    return;
  }
  if (msg.type === "cancel" && typeof msg.jobId === "string") {
    cancelled.add(msg.jobId);
    return;
  }

  const env = raw as JobEnvelope;
  const jobId = env.jobId;
  try {
    const { namespace } = await resolver.loadModule<Record<string, unknown>>(env.module, env.moduleParentURL);
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
    const result = await (fn as (d: unknown, c: unknown) => unknown)(env.data, ctx);
    if (cancelled.has(jobId)) {
      cancelled.delete(jobId);
      post({ protocol: PROTOCOL, jobId, ok: false, error: { name: "AbortError", message: "cancelled" } });
      return;
    }
    post({ protocol: PROTOCOL, jobId, ok: true, result });
  } catch (err) {
    post({
      protocol: PROTOCOL,
      jobId,
      ok: false,
      error: {
        name: err instanceof Error ? err.name : "Error",
        message: err instanceof Error ? err.message : String(err),
      },
    });
  } finally {
    cancelled.delete(jobId);
  }
}

async function boot(): Promise<void> {
  // worker_threads path (Node / Deno / Bun)
  try {
    const wt = (await import("node:worker_threads")) as { parentPort: Port | null };
    if (wt.parentPort) {
      const port = wt.parentPort;
      const post = (m: WorkerOutbound) => port.postMessage(m);
      port.on?.("message", (raw) => void handle(raw, post));
      post({ protocol: PROTOCOL, type: "ready" });
      return;
    }
  } catch {
    /* not a worker_threads context */
  }
  // web Worker path
  const g = globalThis as unknown as {
    postMessage?: (m: unknown) => void;
    addEventListener?: (t: "message", cb: (ev: { data: unknown }) => void) => void;
  };
  if (typeof g.postMessage === "function" && typeof g.addEventListener === "function") {
    const post = (m: WorkerOutbound) => g.postMessage!(m);
    g.addEventListener("message", (ev) => void handle(ev.data, post));
    post({ protocol: PROTOCOL, type: "ready" });
  }
}

void boot();
