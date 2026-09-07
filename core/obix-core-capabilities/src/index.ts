/**
 * @obinexusltd/obix-core-capabilities
 *
 * Host identity, capability inspection and requirement checks for the OBIX CLI.
 *
 * This is the portable root of the `obix-core-*` family. It owns the shared
 * compatibility types (`HostRecord`, `CapabilityResult`, `CompatError`) and
 * performs **no** deep host access at import time — every probe is a lazy
 * function. Ordinary inspection opens no files, spawns no processes, loads no
 * native code and never prompts for permissions.
 *
 * The wrapper is not a sandbox. Preflight results are advisory: operations must
 * still catch denials at the point of use because permission state can change.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Host identity ────────────────────────────────────────────────────────────

export type RuntimeName = "node" | "deno" | "bun" | "browser" | "webworker" | "unknown";

export interface HostRecord {
  /** The runtime, decided by runtime-specific markers *before* Node-compatible globals. */
  runtime: RuntimeName;
  /** Runtime version string when the runtime reports one, else null. */
  runtimeVersion: string | null;
  /** Node version reported by the runtime's Node-compat layer, when present (may exist on Deno/Bun). */
  nodeCompatVersion: string | null;
  /** `process.platform`-style value, or the browser's `navigator.platform`, else null. */
  os: string | null;
  /** `process.arch`, else null. */
  arch: string | null;
  /** Best-effort libc tag for Linux (`glibc` / `musl` / null). Never a hard probe. */
  libc: "glibc" | "musl" | null;
  /** True only for a real window context (window + document). */
  isBrowserWindow: boolean;
  /** True for a dedicated/shared worker global with no document. */
  isWorker: boolean;
}

// ── Capability results ───────────────────────────────────────────────────────

export type CapabilityStatus = "available" | "unavailable" | "denied" | "unknown";

export type CapabilityName =
  | "fs"
  | "fs-watch"
  | "spawn"
  | "worker-threads"
  | "web-worker"
  | "native-addon"
  | "ffi"
  | "dom"
  | "fetch"
  | "web-streams"
  | "abort-signal"
  | "performance-now"
  | "high-res-time"
  | "ref-unref";

export interface CapabilityResult {
  capability: CapabilityName;
  /**
   * - `available`   — the API is present and (where checkable) permitted
   * - `unavailable` — the API is not present in this runtime
   * - `denied`      — the API is present but the runtime's permission layer denies it
   * - `unknown`     — presence is ambiguous, or authorization cannot be determined
   *                   without an active probe (a real state, NOT implicit permission)
   */
  status: CapabilityStatus;
  /** Short human reason for the status. */
  reason: string;
  /** The concrete backing (e.g. `"node:worker_threads"`, `"WorkerGlobalScope"`), when known. */
  provider: string | null;
}

// ── Shared compatibility error ───────────────────────────────────────────────

export type CompatErrorCode =
  | "capability/unavailable"
  | "capability/denied"
  | "capability/unknown"
  | "host/unsupported"
  | "core/version-skew"
  | "module/resolve"
  | "module/load"
  | "fs/read"
  | "fs/write"
  | "fs/watch"
  | "process/tool-not-found"
  | "process/nonzero-exit"
  | "process/timeout"
  | "process/aborted"
  | "scheduler/disposed"
  | "streams/locked"
  | "streams/aborted"
  | "workers/startup"
  | "workers/crash"
  | "workers/protocol"
  | "workers/queue-full"
  | "native/no-provider"
  | "native/no-binary"
  | "native/abi-mismatch"
  | "native/arch-mismatch"
  | "native/denied"
  | "native/failure"
  | "native/disposed"
  | "web/dom-required"
  | "web/ssr-unsupported"
  | "diagnostics/invalid-invocation";

export interface CompatErrorInit {
  code: CompatErrorCode;
  /** Emitting package, e.g. `"obix-core-process"`. */
  package: string;
  /** The operation that failed, e.g. `"spawnTool"`. */
  operation: string;
  /** Human explanation. */
  reason: string;
  /** Runtime at the time of failure (defaults to `detectHost().runtime`). */
  runtime?: RuntimeName;
  capability?: CapabilityName;
  /** Underlying error / value, preserved for debugging. */
  cause?: unknown;
  /** One practical next step for the operator. */
  remediation?: string;
}

/**
 * The single error type every `obix-core-*` package throws or returns.
 * `diagnostics` formats it; nothing else needs to import a formatter.
 */
export class CompatError extends Error {
  override readonly name = "CompatError";
  readonly code: CompatErrorCode;
  readonly package: string;
  readonly operation: string;
  readonly reason: string;
  readonly runtime: RuntimeName;
  readonly capability?: CapabilityName;
  readonly remediation?: string;

  constructor(init: CompatErrorInit) {
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

  /** Structured form for the diagnostics JSON reporter. */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      package: this.package,
      operation: this.operation,
      reason: this.reason,
      runtime: this.runtime,
      capability: this.capability ?? null,
      remediation: this.remediation ?? null,
      cause:
        this.cause instanceof Error
          ? { name: this.cause.name, message: this.cause.message }
          : this.cause ?? null,
    };
  }
}

export function isCompatError(value: unknown): value is CompatError {
  return value instanceof CompatError || (typeof value === "object" && value != null && (value as any).name === "CompatError");
}

// ── internal global access helpers (never called at module top level) ─────────

const g = (): any => globalThis as any;

function readProcess(): any {
  const p = g().process;
  return p && typeof p === "object" ? p : null;
}

// ── detectHost ───────────────────────────────────────────────────────────────

/**
 * A short, stable statement of what `detectHost` is and is not.
 * Surfaced by `obix doctor` so operators do not over-read the result.
 */
export const HOST_DETECTION_NOTE =
  "detectHost() is a best-effort heuristic over runtime-specific global markers " +
  "(Deno.version.deno, Bun.version / process.versions.bun, window+document, " +
  "WorkerGlobalScope, process.versions.node), in that precedence order. It is " +
  "NOT authenticated identity: a caller can define those markers. Provider " +
  "selection must therefore depend on probed capabilities and real operation " +
  "outcomes, not on this string alone.";

/**
 * Decide the runtime from runtime-specific markers *first*, so a Node-compatible
 * `process` on Deno or Bun never wins. Pure inspection — no side effects.
 *
 * Heuristic, not a security boundary — see {@link HOST_DETECTION_NOTE}. Downstream
 * code (the CLI's provider registry, each package's `./node` vs `./web` choice)
 * keys off `probeCapabilities()` and caught operation failures, so a spoofed
 * marker changes a label, not which backend actually works.
 */
export function detectHost(): HostRecord {
  const global = g();
  const proc = readProcess();

  const deno = global.Deno;
  const isDeno = !!deno && typeof deno.version?.deno === "string";

  const bun = global.Bun;
  const isBun =
    (!!bun && typeof bun.version === "string") ||
    (!!proc?.versions?.bun && typeof proc.versions.bun === "string");

  const hasWindow = typeof global.window !== "undefined" && typeof global.document !== "undefined";
  const isWorker =
    !hasWindow &&
    (typeof global.WorkerGlobalScope !== "undefined" ||
      (typeof global.self !== "undefined" && typeof global.importScripts === "function"));

  let runtime: RuntimeName = "unknown";
  let runtimeVersion: string | null = null;

  if (isDeno) {
    runtime = "deno";
    runtimeVersion = deno.version.deno ?? null;
  } else if (isBun) {
    runtime = "bun";
    runtimeVersion = (bun && bun.version) || proc?.versions?.bun || null;
  } else if (hasWindow) {
    runtime = "browser";
    runtimeVersion = typeof global.navigator?.userAgent === "string" ? global.navigator.userAgent : null;
  } else if (isWorker && !proc?.versions?.node) {
    runtime = "webworker";
    runtimeVersion = typeof global.navigator?.userAgent === "string" ? global.navigator.userAgent : null;
  } else if (proc?.versions?.node) {
    runtime = "node";
    runtimeVersion = proc.versions.node ?? null;
  }

  const nodeCompatVersion =
    typeof proc?.versions?.node === "string" ? proc.versions.node : null;

  let os: string | null = null;
  let arch: string | null = null;
  if (isDeno && deno.build) {
    os = deno.build.os ?? null;
    arch = deno.build.arch ?? null;
  } else if (proc?.platform) {
    os = proc.platform ?? null;
    arch = proc.arch ?? null;
  } else if (typeof global.navigator?.platform === "string") {
    os = global.navigator.platform;
  }

  // libc: best-effort, non-probing. Node exposes it on report.getReport() but
  // that is heavy; use the cheap signal only.
  let libc: HostRecord["libc"] = null;
  if (os === "linux") {
    const rep = typeof proc?.report?.getReport === "function" ? safe(() => proc.report.getReport()) : null;
    const glibc = rep?.header?.glibcVersionRuntime;
    if (typeof glibc === "string") libc = "glibc";
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

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

// ── capability probing (non-destructive) ─────────────────────────────────────

const ALL_CAPS: CapabilityName[] = [
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

function result(
  capability: CapabilityName,
  status: CapabilityStatus,
  reason: string,
  provider: string | null = null,
): CapabilityResult {
  return { capability, status, reason, provider };
}

/**
 * Non-prompting Deno permission query. `Deno.permissions.querySync` never
 * prompts; a missing API yields `unknown`.
 */
function denoPermission(name: string, opts?: Record<string, unknown>): CapabilityStatus {
  const deno = g().Deno;
  const q = deno?.permissions?.querySync;
  if (typeof q !== "function") return "unknown";
  const st = safe(() => q.call(deno.permissions, { name, ...opts }));
  if (!st || typeof st.state !== "string") return "unknown";
  if (st.state === "granted") return "available";
  if (st.state === "denied") return "denied";
  return "unknown"; // "prompt" — we do not prompt, so authorization is unknown
}

/** Node --permission model: if enabled and a scope is denied, report denied. */
function nodePermission(scope: "fs" | "child_process" | "worker" | "addon"): CapabilityStatus {
  const proc = readProcess();
  const perm = proc?.permission;
  if (!perm || typeof perm.has !== "function") return "available"; // model not enabled -> allowed
  // node:permission `has` maps: 'fs.read'/'fs.write', 'child', 'worker', 'addon'
  const key =
    scope === "fs" ? "fs.read" : scope === "child_process" ? "child" : scope === "worker" ? "worker" : "addon";
  return safe(() => perm.has(key)) ? "available" : "denied";
}

/**
 * Inspect the requested capabilities (default: all). Never opens a resource,
 * spawns a process, loads a library or prompts. Returns a stable map.
 */
export function probeCapabilities(names: readonly CapabilityName[] = ALL_CAPS): Record<CapabilityName, CapabilityResult> {
  const host = detectHost();
  const global = g();
  const out = {} as Record<CapabilityName, CapabilityResult>;

  for (const cap of names) {
    out[cap] = probeOne(cap, host, global);
  }
  return out;
}

function probeOne(cap: CapabilityName, host: HostRecord, global: any): CapabilityResult {
  switch (cap) {
    case "dom": {
      if (host.isBrowserWindow) return result("dom", "available", "window + document present", "window");
      if (typeof global.document !== "undefined") return result("dom", "available", "document present", "document");
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
      if (host.runtime === "browser") return result("fs", "unavailable", "no filesystem in a window context");
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
      if (base.status !== "available") return result("fs-watch", base.status, `depends on fs: ${base.reason}`, base.provider);
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
      // presence of process.dlopen is the cheap signal; do NOT call it
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
      // Node experimental node:ffi is build/flag gated — treat as unknown unless the namespace is present
      return result("ffi", "unknown", "Node FFI is experimental and flag-gated; not the LTS baseline");
    }
    case "ref-unref": {
      // timer .ref()/.unref() — Node/Bun expose it on timer objects; check via setTimeout return
      if (host.runtime === "node" || host.runtime === "bun") {
        return result("ref-unref", "available", "timer handles expose ref()/unref()", "node:timers");
      }
      return result("ref-unref", "unavailable", "no ref/unref on timer handles in this runtime");
    }
    default:
      return result(cap, "unknown", "no probe implemented");
  }
}

// ── requireCapability ────────────────────────────────────────────────────────

export interface RequireOptions {
  package: string;
  operation: string;
  /** Reuse an earlier `probeCapabilities` map instead of re-probing. */
  results?: Record<CapabilityName, CapabilityResult>;
  /** Treat `unknown` as acceptable (default false — unknown is not permission). */
  allowUnknown?: boolean;
}

/**
 * Preflight guard. Throws a `CompatError` when the capability is not
 * `available` (or, with `allowUnknown`, not `available`/`unknown`).
 *
 * This is advisory only. Callers must still handle denials thrown by the actual
 * operation, because permission state can change between preflight and use.
 */
export function requireCapability(capability: CapabilityName, opts: RequireOptions): CapabilityResult {
  const res = (opts.results ?? probeCapabilities([capability]))[capability];
  const okUnknown = opts.allowUnknown === true && res.status === "unknown";
  if (res.status === "available" || okUnknown) return res;

  const code: CompatErrorCode =
    res.status === "denied" ? "capability/denied" : res.status === "unknown" ? "capability/unknown" : "capability/unavailable";
  const remediation =
    res.status === "denied"
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

/** Convenience: the full capability map plus host record, for `diagnostics`. */
export function inspect(): { host: HostRecord; capabilities: Record<CapabilityName, CapabilityResult> } {
  return { host: detectHost(), capabilities: probeCapabilities() };
}

export const ALL_CAPABILITIES: readonly CapabilityName[] = ALL_CAPS;
