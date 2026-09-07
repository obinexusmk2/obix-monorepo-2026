/**
 * @obinexusltd/obix-core-workers
 *
 * A bounded worker pool and a versioned, serializable job protocol.
 *
 * Portable root: no worker module is imported. The pool drives an injected
 * `WorkerBackend`; `createNodeWorkerPool` (`./node`, `worker_threads`) and
 * `createWebWorkerPool` (`./web`, `Worker`) wire the real ones.
 *
 * Rules:
 *   - A job carries a **module specifier** and an **export name** — never a
 *     function. The worker loads the module and calls the export. Closures are
 *     never serialized, stringified or `eval`'d.
 *   - `data` is passed by **structured clone** (copy) by default. A caller may
 *     opt into `transfer` for `ArrayBuffer`s it is done with — the parent loses
 *     access to a transferred buffer.
 *   - `resourceLimits` passed to a backend are only *advisory*; the pool
 *     reports `resourceLimitsHonored` and never claims enforcement.
 *   - `cancelJob` drops a queued job and asks a running job to stop
 *     **cooperatively** (a `cancel` message). There is no preemptive
 *     interruption. `runInline` (single-thread fallback) says so explicitly.
 */
import { CompatError } from "@obinexusltd/obix-core-capabilities";
import { createModuleResolver } from "@obinexusltd/obix-core-modules";

export { CompatError } from "@obinexusltd/obix-core-capabilities";

export const PROTOCOL = "obix-core-workers/1" as const;

export interface JobRequest {
  /** Module specifier the worker will `import()` (resolved against `moduleParentURL`). */
  module: string;
  /** Named export in that module: `(data, ctx) => result | Promise<result>`. */
  action: string;
  /** Structured-cloneable payload. */
  data: unknown;
}

export interface JobEnvelope extends JobRequest {
  protocol: typeof PROTOCOL;
  jobId: string;
  moduleParentURL: string;
  /** Field paths inside `data` whose ArrayBuffers should be transferred. */
  transfer?: string[];
}

export type WorkerOutbound =
  | { protocol: typeof PROTOCOL; jobId: string; ok: true; result: unknown }
  | { protocol: typeof PROTOCOL; jobId: string; ok: false; error: { name: string; message: string; code?: string } }
  | { protocol: typeof PROTOCOL; type: "ready" }
  | { protocol: typeof PROTOCOL; type: "protocol-error"; detail: string };

export interface BackendWorker {
  postMessage(msg: unknown, transfer?: Transferable[]): void;
  onMessage(cb: (msg: unknown) => void): void;
  onError(cb: (err: unknown) => void): void;
  onExit(cb: (code: number) => void): void;
  terminate(): Promise<void> | void;
}

export interface WorkerBackend {
  /** Create one worker. Rejects on startup failure. */
  create(): Promise<BackendWorker>;
  /** Whether this backend's runtime enforces `resourceLimits`. */
  readonly resourceLimitsHonored: boolean;
  readonly kind: "worker_threads" | "web-worker" | "inline";
}

export interface WorkerPoolOptions {
  backend: WorkerBackend;
  /** Max concurrent workers. Default 2. */
  size?: number;
  /** Max queued jobs before `submitJob` rejects with `workers/queue-full`. Default 64. */
  queueLimit?: number;
  /** Default per-job timeout (ms). 0 = none. */
  defaultTimeoutMs?: number;
  /** Base URL that job module specifiers resolve against inside the worker. */
  moduleParentURL: string;
}

export interface SubmitOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  transfer?: string[];
}

export interface WorkerPoolAPI {
  submitJob<T = unknown>(req: JobRequest, opts?: SubmitOptions): Promise<T>;
  /** Drop a queued job, or cooperatively cancel a running one. Idempotent. */
  cancelJob(jobId: string): void;
  /** Terminate all workers and reject everything pending. Idempotent. */
  dispose(): Promise<void>;
  readonly activeWorkers: number;
  readonly queued: number;
  readonly running: number;
  readonly resourceLimitsHonored: boolean;
  readonly backendKind: WorkerBackend["kind"];
}

interface Pending {
  jobId: string;
  env: JobEnvelope;
  transferables: Transferable[];
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
  timer?: ReturnType<typeof setTimeout>;
  worker?: BackendWorker;
}

let counter = 0;
const newJobId = (): string => `job-${Date.now().toString(36)}-${(++counter).toString(36)}`;

export function createWorkerPool(opts: WorkerPoolOptions): WorkerPoolAPI {
  const size = Math.max(1, opts.size ?? 2);
  const queueLimit = Math.max(0, opts.queueLimit ?? 64);
  const idle: BackendWorker[] = [];
  const all = new Set<BackendWorker>();
  const busy = new Map<BackendWorker, Pending>();
  const queue: Pending[] = [];
  let creating = 0;
  let disposed = false;

  function reap(p: Pending): void {
    if (p.timer) clearTimeout(p.timer);
    if (p.signal && p.onAbort) p.signal.removeEventListener("abort", p.onAbort);
  }

  function fail(p: Pending, err: unknown): void {
    reap(p);
    p.reject(err);
  }

  async function ensureWorker(): Promise<BackendWorker | null> {
    if (idle.length) return idle.pop()!;
    if (all.size + creating >= size) return null;
    creating++;
    try {
      const w = await opts.backend.create();
      creating--;
      all.add(w);
      w.onMessage((raw) => onWorkerMessage(w, raw));
      w.onError((err) => onWorkerDown(w, err, "error"));
      w.onExit((code) => onWorkerDown(w, new Error(`worker exited with code ${code}`), "exit"));
      return w;
    } catch (err) {
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

  function dispatch(): void {
    if (disposed) return;
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
            // startup failure -> fail the head job, keep going
            const p = queue.shift();
            if (p) fail(p, err);
            dispatch();
          });
        return;
      }
      const p = queue.shift()!;
      busy.set(w, p);
      p.worker = w;
      try {
        w.postMessage(p.env, p.transferables);
      } catch (err) {
        busy.delete(w);
        idle.push(w);
        fail(
          p,
          new CompatError({
            code: "workers/protocol",
            package: "obix-core-workers",
            operation: "submitJob",
            reason: `payload is not serializable / transferable: ${err instanceof Error ? err.message : String(err)}`,
            cause: err,
          }),
        );
      }
    }
  }

  function onWorkerMessage(w: BackendWorker, raw: unknown): void {
    const msg = raw as WorkerOutbound;
    if (!msg || typeof msg !== "object" || (msg as { protocol?: string }).protocol !== PROTOCOL) {
      onWorkerDown(w, new CompatError({
        code: "workers/protocol",
        package: "obix-core-workers",
        operation: "worker",
        reason: `worker sent a message that is not ${PROTOCOL}`,
      }), "protocol");
      return;
    }
    if ("type" in msg && (msg.type === "ready" || msg.type === "protocol-error")) return;
    const p = busy.get(w);
    if (!p || !("jobId" in msg) || p.jobId !== msg.jobId) return; // stale / mismatched
    busy.delete(w);
    idle.push(w);
    reap(p);
    if (msg.ok) p.resolve(msg.result);
    else {
      p.reject(
        new CompatError({
          code: "workers/crash",
          package: "obix-core-workers",
          operation: "submitJob",
          reason: `${msg.error.name}: ${msg.error.message}`,
        }),
      );
    }
    dispatch();
  }

  function onWorkerDown(w: BackendWorker, err: unknown, _why: string): void {
    if (!all.has(w)) return;
    all.delete(w);
    const i = idle.indexOf(w);
    if (i >= 0) idle.splice(i, 1);
    const p = busy.get(w);
    if (p) {
      busy.delete(w);
      fail(
        p,
        err instanceof CompatError
          ? err
          : new CompatError({
              code: "workers/crash",
              package: "obix-core-workers",
              operation: "submitJob",
              reason: `worker crashed: ${err instanceof Error ? err.message : String(err)}`,
              cause: err,
            }),
      );
    }
    void w.terminate();
    if (!disposed) dispatch();
  }

  function submitJob<T>(req: JobRequest, so: SubmitOptions = {}): Promise<T> {
    if (disposed) {
      return Promise.reject(
        new CompatError({
          code: "workers/startup",
          package: "obix-core-workers",
          operation: "submitJob",
          reason: "the worker pool has been disposed",
        }),
      );
    }
    if (typeof req?.module !== "string" || typeof req?.action !== "string") {
      return Promise.reject(
        new CompatError({
          code: "workers/protocol",
          package: "obix-core-workers",
          operation: "submitJob",
          reason: "a job needs a string `module` specifier and a string `action` export name",
          remediation: "Pass a module the worker can import and the name of an exported function — not a function value.",
        }),
      );
    }
    if (typeof req.data === "function") {
      return Promise.reject(
        new CompatError({
          code: "workers/protocol",
          package: "obix-core-workers",
          operation: "submitJob",
          reason: "`data` is a function — functions cannot cross the worker boundary",
        }),
      );
    }
    if (busy.size + queue.length >= size + queueLimit) {
      return Promise.reject(
        new CompatError({
          code: "workers/queue-full",
          package: "obix-core-workers",
          operation: "submitJob",
          reason: `pool is full (size=${size}, queueLimit=${queueLimit})`,
          remediation: "Back off and retry, or raise `queueLimit`.",
        }),
      );
    }

    const jobId = newJobId();
    const env: JobEnvelope = {
      protocol: PROTOCOL,
      jobId,
      module: req.module,
      action: req.action,
      data: req.data,
      moduleParentURL: opts.moduleParentURL,
      transfer: so.transfer,
    };
    const transferables: Transferable[] = collectTransferables(req.data, so.transfer);

    return new Promise<T>((resolve, reject) => {
      const p: Pending = { jobId, env, transferables, resolve: resolve as (v: unknown) => void, reject };
      const timeoutMs = so.timeoutMs ?? opts.defaultTimeoutMs ?? 0;
      if (timeoutMs > 0) {
        p.timer = setTimeout(() => {
          removeFromQueue(p);
          if (p.worker) {
            try {
              p.worker.postMessage({ protocol: PROTOCOL, type: "cancel", jobId });
            } catch {
              /* ignore */
            }
          }
          fail(
            p,
            new CompatError({
              code: "workers/crash",
              package: "obix-core-workers",
              operation: "submitJob",
              reason: `job ${jobId} timed out after ${timeoutMs}ms (cooperative cancel sent; no preemption)`,
            }),
          );
        }, timeoutMs);
        if (typeof p.timer.unref === "function") p.timer.unref();
      }
      if (so.signal) {
        p.signal = so.signal;
        p.onAbort = () => {
          removeFromQueue(p);
          if (p.worker) {
            try {
              p.worker.postMessage({ protocol: PROTOCOL, type: "cancel", jobId });
            } catch {
              /* ignore */
            }
          }
          fail(
            p,
            new CompatError({
              code: "workers/crash",
              package: "obix-core-workers",
              operation: "submitJob",
              reason: `job ${jobId} aborted (cooperative cancel sent; no preemption)`,
            }),
          );
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

  function removeFromQueue(p: Pending): void {
    const i = queue.indexOf(p);
    if (i >= 0) queue.splice(i, 1);
  }

  function cancelJob(jobId: string): void {
    const qp = queue.find((p) => p.jobId === jobId);
    if (qp) {
      removeFromQueue(qp);
      fail(
        qp,
        new CompatError({
          code: "workers/crash",
          package: "obix-core-workers",
          operation: "cancelJob",
          reason: `job ${jobId} cancelled before it started`,
        }),
      );
      return;
    }
    for (const [w, p] of busy) {
      if (p.jobId === jobId) {
        try {
          w.postMessage({ protocol: PROTOCOL, type: "cancel", jobId });
        } catch {
          /* ignore */
        }
        return; // cooperative — the worker decides when to stop
      }
    }
  }

  async function dispose(): Promise<void> {
    if (disposed) return;
    disposed = true;
    const err = new CompatError({
      code: "workers/startup",
      package: "obix-core-workers",
      operation: "dispose",
      reason: "the worker pool was disposed",
    });
    for (const p of queue.splice(0)) fail(p, err);
    for (const p of busy.values()) fail(p, err);
    busy.clear();
    await Promise.all([...all].map((w) => Promise.resolve(w.terminate()).catch(() => {})));
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

function get(obj: unknown, path: string): unknown {
  if (path === "") return obj; // "" == the data value itself
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (cur && typeof cur === "object") cur = (cur as Record<string, unknown>)[seg];
    else return undefined;
  }
  return cur;
}

function collectTransferables(data: unknown, paths?: string[]): Transferable[] {
  if (!paths || paths.length === 0) return [];
  const out: Transferable[] = [];
  for (const p of paths) {
    const v = get(data, p);
    if (v instanceof ArrayBuffer) out.push(v);
    else if (ArrayBuffer.isView(v)) out.push(v.buffer);
  }
  return out;
}

// ── single-thread fallback (explicit) ───────────────────────────────────────

export interface InlineResult<T> {
  result: T;
  /** Always `"inline-fallback"` — this ran on the calling thread. No isolation,
   *  no preemptive cancellation. */
  mode: "inline-fallback";
}

/**
 * Run a job on the current thread by loading its module and calling its export.
 * Use only when no worker backend is available. It provides **no** isolation and
 * **no** preemptive cancellation.
 */
export async function runInline<T = unknown>(req: JobRequest, moduleParentURL: string): Promise<InlineResult<T>> {
  const resolver = createModuleResolver();
  const { namespace } = await resolver.loadModule<Record<string, unknown>>(req.module, moduleParentURL);
  const fn = namespace[req.action];
  if (typeof fn !== "function") {
    throw new CompatError({
      code: "workers/protocol",
      package: "obix-core-workers",
      operation: "runInline",
      reason: `module "${req.module}" has no exported function "${req.action}"`,
    });
  }
  const result = (await (fn as (d: unknown) => unknown)(req.data)) as T;
  return { result, mode: "inline-fallback" };
}
