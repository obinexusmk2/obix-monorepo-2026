/**
 * @obinexusltd/obix-core-workers/web
 *
 * Web `Worker` backend (Deno, Bun, browsers). Importing this reads the global
 * `Worker`; do not import it from a portable context.
 *
 * Browser lifecycle for this backend is authored but **not tested** in this
 * environment (see repo docs/core-compatibility). Deno/Bun expose a global
 * `Worker` and are exercised.
 */
import {
  createWorkerPool,
  type BackendWorker,
  type WorkerBackend,
  type WorkerPoolAPI,
} from "./index.js";

const WORKER_URL = new URL("./worker.js", import.meta.url);

export interface WebWorkerPoolOptions {
  size?: number;
  queueLimit?: number;
  defaultTimeoutMs?: number;
  moduleParentURL?: string;
}

export function createWebWorkerBackend(): WorkerBackend {
  const WorkerCtor = (globalThis as { Worker?: typeof Worker }).Worker;
  if (typeof WorkerCtor !== "function") {
    throw new Error("global Worker is not available in this runtime — use @obinexusltd/obix-core-workers/node");
  }
  return {
    kind: "web-worker",
    // Web Workers have no equivalent of worker_threads resourceLimits.
    resourceLimitsHonored: false,
    async create(): Promise<BackendWorker> {
      const w = new WorkerCtor(WORKER_URL, { type: "module" });
      await new Promise<void>((resolve, reject) => {
        const onErr = (e: unknown) => {
          cleanup();
          reject(e);
        };
        const onMsg = (ev: MessageEvent) => {
          if ((ev.data as { type?: string })?.type === "ready") {
            cleanup();
            resolve();
          }
        };
        const cleanup = () => {
          w.removeEventListener("message", onMsg as EventListener);
          w.removeEventListener("error", onErr as EventListener);
        };
        w.addEventListener("message", onMsg as EventListener);
        w.addEventListener("error", onErr as EventListener);
        setTimeout(() => {
          cleanup();
          reject(new Error("worker did not signal ready within 5000ms"));
        }, 5000);
      });
      return {
        postMessage: (msg, transfer) => w.postMessage(msg, (transfer as Transferable[]) ?? []),
        onMessage: (cb) => w.addEventListener("message", (ev) => cb((ev as MessageEvent).data)),
        onError: (cb) => w.addEventListener("error", (ev) => cb(ev)),
        onExit: () => {
          /* web workers have no exit event */
        },
        terminate: () => w.terminate(),
      };
    },
  };
}

export function createWebWorkerPool(o: WebWorkerPoolOptions = {}): WorkerPoolAPI {
  return createWorkerPool({
    backend: createWebWorkerBackend(),
    size: o.size,
    queueLimit: o.queueLimit,
    defaultTimeoutMs: o.defaultTimeoutMs,
    moduleParentURL: o.moduleParentURL ?? new URL("./", import.meta.url).href,
  });
}

export type { WorkerPoolAPI, JobRequest } from "./index.js";
