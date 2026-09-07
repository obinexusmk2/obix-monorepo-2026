/**
 * @obinexusltd/obix-core-workers/node
 *
 * `worker_threads` backend. Importing this touches `node:worker_threads`; do not
 * import it from a portable context.
 */
import { Worker, type TransferListItem } from "node:worker_threads";
import {
  createWorkerPool,
  type BackendWorker,
  type WorkerBackend,
  type WorkerPoolAPI,
} from "./index.js";

const WORKER_URL = new URL("./worker.js", import.meta.url);

/**
 * `resourceLimits` for `worker_threads` are honoured by Node and Deno's compat
 * layer; Bun currently **ignores** them. We detect Bun and report accordingly.
 */
function resourceLimitsHonored(): boolean {
  const p = (globalThis as { process?: { versions?: { bun?: string } } }).process;
  return !p?.versions?.bun;
}

export interface NodeWorkerPoolOptions {
  size?: number;
  queueLimit?: number;
  defaultTimeoutMs?: number;
  /** Base URL job module specifiers resolve against inside the worker. Default: cwd. */
  moduleParentURL?: string;
  /** Advisory only — see `resourceLimitsHonored`. */
  resourceLimits?: { maxOldGenerationSizeMb?: number; maxYoungGenerationSizeMb?: number };
}

export function createNodeWorkerBackend(o: NodeWorkerPoolOptions = {}): WorkerBackend {
  return {
    kind: "worker_threads",
    resourceLimitsHonored: resourceLimitsHonored(),
    async create(): Promise<BackendWorker> {
      const w = new Worker(WORKER_URL, {
        resourceLimits: o.resourceLimits,
      });
      await new Promise<void>((resolve, reject) => {
        const onErr = (e: unknown) => {
          cleanup();
          reject(e);
        };
        const onMsg = (m: unknown) => {
          if ((m as { type?: string })?.type === "ready") {
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
        // if the worker never signals ready, fail fast
        setTimeout(() => {
          cleanup();
          reject(new Error("worker did not signal ready within 5000ms"));
        }, 5000).unref?.();
      });
      return {
        postMessage: (msg, transfer) => w.postMessage(msg, (transfer as TransferListItem[] | undefined) ?? []),
        onMessage: (cb) => w.on("message", cb),
        onError: (cb) => w.on("error", cb),
        onExit: (cb) => w.on("exit", cb),
        terminate: () => w.terminate().then(() => undefined),
      };
    },
  };
}

export function createNodeWorkerPool(o: NodeWorkerPoolOptions = {}): WorkerPoolAPI {
  return createWorkerPool({
    backend: createNodeWorkerBackend(o),
    size: o.size,
    queueLimit: o.queueLimit,
    defaultTimeoutMs: o.defaultTimeoutMs,
    moduleParentURL: o.moduleParentURL ?? new URL(`file://${process.cwd().replace(/\\/g, "/")}/`).href,
  });
}

export type { WorkerPoolAPI, JobRequest } from "./index.js";
