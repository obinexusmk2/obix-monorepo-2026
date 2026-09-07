/**
 * @obinexusltd/obix-core-process
 *
 * Tool resolution and shell-free asynchronous spawn: explicit executable + argv
 * array, `cwd` / `env` / declared runtime, `AbortSignal`, timeout, streamed and
 * bounded stdout/stderr, and owned-child cleanup.
 *
 * Portable root: no `node:child_process` import. Spawning goes through an
 * injected `SpawnImpl`; `createNodeProcessRunner` (`./node`) wires the real one.
 *
 * `shell: false` is the only mode here. Arbitrary project input is never
 * concatenated into a command string. A separate, explicit
 * `spawnShellScript` path exists for `.cmd` / `.bat` / `.ps1` and passes its
 * arguments as an array (the host handles quoting).
 *
 * Launching a command successfully is NOT proof it did its job — inspect
 * `result.code` / `result.signal`, never "it started, therefore it compiled".
 *
 * Termination (`terminateChild`, `disposeAll`) covers the **direct child**. On
 * Windows, pass `tree: true` to also kill descendants via `taskkill /T`.
 */
import { CompatError, probeCapabilities } from "@obinexusltd/obix-core-capabilities";

export { CompatError } from "@obinexusltd/obix-core-capabilities";

// ── injected spawn ──────────────────────────────────────────────────────────

export interface ChildStreams {
  stdout: ReadableStream<Uint8Array> | null;
  stderr: ReadableStream<Uint8Array> | null;
}

export interface ChildProc {
  readonly pid: number | undefined;
  readonly streams: ChildStreams;
  /** Resolves with `{ code, signal }` when the process exits. */
  readonly exited: Promise<{ code: number | null; signal: string | null }>;
  /** Send a signal to the direct child. Returns whether the signal was delivered. */
  kill(signal?: string): boolean;
  /** Windows tree kill (taskkill /pid <pid> /T /F). No-op / false elsewhere. */
  killTree?(): Promise<boolean>;
}

export interface SpawnParams {
  command: string;
  args: readonly string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
}

export type SpawnImpl = (params: SpawnParams) => ChildProc;

// ── results ─────────────────────────────────────────────────────────────────

export interface SpawnResult {
  command: string;
  args: readonly string[];
  cwd: string | undefined;
  code: number | null;
  signal: string | null;
  /** true when the timeout fired. */
  timedOut: boolean;
  /** true when the AbortSignal aborted it. */
  aborted: boolean;
  durationMs: number;
  stdout: Uint8Array;
  stderr: Uint8Array;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
}

export interface SpawnRequest {
  command: string;
  args?: readonly string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  signal?: AbortSignal;
  /** Kill the child after this many ms; sets `timedOut`. */
  timeoutMs?: number;
  /** Signal used for timeout / abort / dispose. Default `"SIGTERM"`. */
  killSignal?: string;
  /** Max bytes collected per stream. Beyond this, output is dropped and the
   *  corresponding `*Truncated` flag is set. Default 8 MiB. */
  maxBuffer?: number;
  /** Windows: also kill descendants on timeout / abort / dispose. */
  tree?: boolean;
}

// ── tool resolution ─────────────────────────────────────────────────────────

export interface ToolResolution {
  found: boolean;
  /** How to run it. `runtime` is set for a JS tool run under a declared runtime. */
  command: string;
  args: string[];
  kind: "executable" | "js-bin";
  /** For `js-bin`: the runtime executable the JS file is invoked with. */
  runtime?: string;
  detail: string;
}

export interface ResolveToolHooks {
  /** Resolve a `bin` field of an installed package to an absolute JS path. */
  resolveJsBin?: (pkgName: string, binName?: string) => string | null;
  /** Look an executable up on PATH. Return an absolute path or null. */
  which?: (name: string) => string | null;
  /** The runtime executable JS bins are launched with (default: the current one). */
  jsRuntime?: string;
}

/**
 * Resolve how to invoke a tool.
 *  - `{ kind: "js-bin", package, bin? }` → the package's installed `bin` script,
 *    run under `jsRuntime` (the current runtime by default) — never a global.
 *  - `{ kind: "executable", name }` → an absolute path from PATH.
 */
export function resolveTool(
  spec:
    | { kind: "js-bin"; package: string; bin?: string }
    | { kind: "executable"; name: string },
  hooks: ResolveToolHooks = {},
): ToolResolution {
  if (spec.kind === "js-bin") {
    const abs = hooks.resolveJsBin?.(spec.package, spec.bin) ?? null;
    if (!abs) {
      return {
        found: false,
        command: "",
        args: [],
        kind: "js-bin",
        detail: `no installed "${spec.bin ?? spec.package}" bin for package ${spec.package}`,
      };
    }
    const runtime = hooks.jsRuntime ?? currentRuntimeExecPath();
    return {
      found: true,
      command: runtime,
      args: [abs],
      kind: "js-bin",
      runtime,
      detail: `${spec.package} bin resolved to ${abs}, run under ${runtime}`,
    };
  }
  const abs = hooks.which?.(spec.name) ?? null;
  return abs
    ? { found: true, command: abs, args: [], kind: "executable", detail: `${spec.name} on PATH: ${abs}` }
    : { found: false, command: "", args: [], kind: "executable", detail: `${spec.name} not found on PATH` };
}

function currentRuntimeExecPath(): string {
  const p = (globalThis as { process?: { execPath?: string } }).process;
  return typeof p?.execPath === "string" ? p.execPath : "node";
}

// ── runner ──────────────────────────────────────────────────────────────────

export interface ProcessRunnerAPI {
  spawnTool(req: SpawnRequest): Promise<SpawnResult>;
  /** Explicit, constrained path for a Windows `.cmd` / `.bat` / `.ps1`. Args are an array. */
  spawnShellScript(req: SpawnRequest & { shellArgsArray: string[] }): Promise<SpawnResult>;
  /** Kill one tracked child. Idempotent. */
  terminateChild(handle: RunningChild, opts?: { signal?: string; tree?: boolean }): Promise<void>;
  /** Kill every tracked child. Returns when they have all exited (or been force-killed). */
  disposeAll(opts?: { signal?: string; tree?: boolean }): Promise<void>;
  readonly activeCount: number;
}

export interface RunningChild {
  readonly pid: number | undefined;
  readonly done: Promise<SpawnResult>;
  kill(signal?: string): void;
}

export function createProcessRunner(spawnImpl: SpawnImpl): ProcessRunnerAPI {
  const live = new Set<{ proc: ChildProc; tree: boolean }>();

  async function run(params: SpawnParams, req: SpawnRequest): Promise<SpawnResult> {
    if (typeof params.command !== "string" || params.command === "") {
      throw new CompatError({
        code: "process/tool-not-found",
        package: "obix-core-process",
        operation: "spawnTool",
        reason: "command must be a non-empty string (an executable path, not a shell line)",
      });
    }
    const maxBuffer = req.maxBuffer ?? 8 * 1024 * 1024;
    const killSignal = req.killSignal ?? "SIGTERM";
    const started = now();

    let proc: ChildProc;
    try {
      proc = spawnImpl(params);
    } catch (err) {
      throw new CompatError({
        code: "process/tool-not-found",
        package: "obix-core-process",
        operation: "spawnTool",
        reason: `cannot spawn ${params.command}: ${err instanceof Error ? err.message : String(err)}`,
        cause: err,
        remediation: "Check the executable path exists and is executable; a JS tool must be resolved to its installed bin.",
      });
    }
    const entry = { proc, tree: req.tree === true };
    live.add(entry);

    let timedOut = false;
    let aborted = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = (why: "timeout" | "abort") => {
      if (why === "timeout") timedOut = true;
      else aborted = true;
      if (entry.tree && proc.killTree) void proc.killTree();
      else proc.kill(killSignal);
    };
    if (req.timeoutMs && req.timeoutMs > 0) {
      timer = setTimeout(() => stop("timeout"), req.timeoutMs);
      if (typeof timer.unref === "function") timer.unref();
    }
    const onAbort = () => stop("abort");
    if (req.signal) {
      if (req.signal.aborted) stop("abort");
      else req.signal.addEventListener("abort", onAbort, { once: true });
    }

    // Drain BOTH streams concurrently — sequential draining deadlocks when the
    // child fills the pipe buffer of the stream we are not yet reading.
    let stdout: Uint8Array;
    let stderr: Uint8Array;
    let stdoutTruncated: boolean;
    let stderrTruncated: boolean;
    let code: number | null;
    let signal: string | null;
    try {
      const [[so, sot], [se, set], exit] = await Promise.all([
        drain(proc.streams.stdout, maxBuffer),
        drain(proc.streams.stderr, maxBuffer),
        proc.exited,
      ]);
      [stdout, stdoutTruncated] = [so, sot];
      [stderr, stderrTruncated] = [se, set];
      ({ code, signal } = exit);
    } catch (err) {
      if (timer) clearTimeout(timer);
      if (req.signal) req.signal.removeEventListener("abort", onAbort);
      live.delete(entry);
      const e = err as { code?: string; message?: string };
      const enoent = e?.code === "ENOENT" || /ENOENT/.test(e?.message ?? "");
      throw new CompatError({
        code: enoent ? "process/tool-not-found" : "process/nonzero-exit",
        package: "obix-core-process",
        operation: "spawnTool",
        reason: enoent
          ? `executable not found: ${params.command}`
          : `child process error: ${e?.message ?? String(err)}`,
        cause: err,
        remediation: enoent
          ? "Resolve a JS tool to its installed bin (resolveTool), or give an absolute executable path."
          : undefined,
      });
    }

    if (timer) clearTimeout(timer);
    if (req.signal) req.signal.removeEventListener("abort", onAbort);
    live.delete(entry);

    return {
      command: params.command,
      args: params.args,
      cwd: params.cwd,
      code,
      signal,
      timedOut,
      aborted,
      durationMs: now() - started,
      stdout,
      stderr,
      stdoutTruncated,
      stderrTruncated,
    };
  }

  return {
    spawnTool(req) {
      return run({ command: req.command, args: req.args ?? [], cwd: req.cwd, env: req.env }, req);
    },
    async spawnShellScript(req) {
      // Still shell:false at the process layer — the host's `spawn` is expected
      // to recognise a .cmd/.bat/.ps1 target. Args are an ARRAY; nothing is
      // string-concatenated.
      const lower = req.command.toLowerCase();
      if (!/\.(cmd|bat|ps1)$/.test(lower)) {
        throw new CompatError({
          code: "process/tool-not-found",
          package: "obix-core-process",
          operation: "spawnShellScript",
          reason: `spawnShellScript is only for .cmd/.bat/.ps1 targets, got ${req.command}`,
          remediation: "Use spawnTool for a normal executable.",
        });
      }
      return run({ command: req.command, args: req.shellArgsArray, cwd: req.cwd, env: req.env }, req);
    },
    async terminateChild(handle, opts = {}) {
      handle.kill(opts.signal ?? "SIGTERM");
      try {
        await handle.done;
      } catch {
        /* the result rejection, if any, is the caller's on `.done` */
      }
    },
    async disposeAll(opts = {}) {
      const sig = opts.signal ?? "SIGKILL";
      const pending: Promise<unknown>[] = [];
      for (const entry of [...live]) {
        if ((opts.tree ?? entry.tree) && entry.proc.killTree) pending.push(entry.proc.killTree());
        else entry.proc.kill(sig);
        pending.push(entry.proc.exited.catch(() => {}));
      }
      await Promise.all(pending);
      live.clear();
    },
    get activeCount() {
      return live.size;
    },
  };
}

async function drain(stream: ReadableStream<Uint8Array> | null, maxBuffer: number): Promise<[Uint8Array, boolean]> {
  if (!stream) return [new Uint8Array(0), false];
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  const reader = stream.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (total < maxBuffer) {
        const room = maxBuffer - total;
        if (value.byteLength <= room) {
          chunks.push(value);
          total += value.byteLength;
        } else {
          chunks.push(value.subarray(0, room));
          total = maxBuffer;
          truncated = true;
        }
      } else {
        truncated = true;
      }
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return [out, truncated];
}

function now(): number {
  const perf = (globalThis as { performance?: { now(): number } }).performance;
  return perf?.now ? perf.now() : Date.now();
}

/** `true` when `child_process` (or Deno's equivalent) is usable in this runtime. */
export function canSpawn(): boolean {
  return probeCapabilities(["spawn"])["spawn"].status === "available";
}
