/**
 * @obinexusltd/obix-core-diagnostics
 *
 * Stable compatibility errors, human + JSON reporters, and an injection-based
 * doctor runner for the OBIX CLI.
 *
 * Portable root: no filesystem, process, native or DOM access at import time.
 * `runDoctor` receives its checks by injection — this package never imports the
 * other `obix-core-*` providers, so no dependency cycle is possible.
 *
 * Output contract:
 *   - human logs go to **stderr**
 *   - `formatReport(report, { json: true })` produces exactly **one** JSON
 *     document (no log text mixed in)
 *   - no telemetry is transmitted, ever
 */

import {
  CompatError,
  isCompatError,
  detectHost,
  type CompatErrorCode,
  type RuntimeName,
} from "@obinexusltd/obix-core-capabilities";

export {
  CompatError,
  isCompatError,
  type CompatErrorCode,
} from "@obinexusltd/obix-core-capabilities";

// ── error normalization ─────────────────────────────────────────────────────

export interface NormalizeContext {
  package: string;
  operation: string;
  code?: CompatErrorCode;
  runtime?: RuntimeName;
  remediation?: string;
}

/**
 * Coerce any thrown value into a `CompatError`, preserving the original as
 * `cause`. A value that is already a `CompatError` is returned unchanged.
 */
export function normalizeError(value: unknown, ctx: NormalizeContext): CompatError {
  if (isCompatError(value)) return value as CompatError;

  const message =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : safeStringify(value);

  return new CompatError({
    code: ctx.code ?? "diagnostics/invalid-invocation",
    package: ctx.package,
    operation: ctx.operation,
    reason: message || "unknown error",
    runtime: ctx.runtime,
    cause: value,
    remediation: ctx.remediation,
  });
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// ── doctor checks ───────────────────────────────────────────────────────────

export type SupportStatus = "tested-pass" | "tested-fail" | "unsupported" | "not-tested";

export interface CheckResult {
  status: SupportStatus;
  /** One human line explaining the status. */
  detail: string;
  /** Optional machine payload (must be JSON-serialisable). */
  data?: unknown;
  /** Present when `status === "tested-fail"`. */
  error?: CompatError;
}

export interface DoctorCheck {
  /** Stable dotted id, e.g. `"host.identity"`, `"process.spawn"`. */
  id: string;
  title: string;
  /** `true` when this check targets an explicitly *requested* optional feature. */
  required?: boolean;
  run(): CheckResult | Promise<CheckResult>;
}

export interface DoctorReport {
  schema: "obix-core-diagnostics/doctor@1";
  ok: boolean;
  runtime: RuntimeName;
  runtimeVersion: string | null;
  os: string | null;
  arch: string | null;
  generatedAt: string;
  summary: Record<SupportStatus, number>;
  checks: Array<{
    id: string;
    title: string;
    status: SupportStatus;
    detail: string;
    required: boolean;
    data: unknown;
    error: Record<string, unknown> | null;
  }>;
}

export interface RunDoctorOptions {
  /** Abort in-flight checks. */
  signal?: AbortSignal;
  /** Called after each check completes (for streaming human output). */
  onCheck?: (entry: DoctorReport["checks"][number]) => void;
}

/**
 * Execute the injected checks and assemble a machine-readable report.
 *
 * `ok` is `false` when any check is `tested-fail`, OR when a `required` check is
 * `unsupported` / `not-tested`. A non-required `unsupported` / `not-tested`
 * check does **not** fail the report (missing unrequested optional native
 * functionality must not fail a general JS doctor).
 */
export async function runDoctor(
  checks: readonly DoctorCheck[],
  opts: RunDoctorOptions = {},
): Promise<DoctorReport> {
  const host = detectHost();
  const summary: Record<SupportStatus, number> = {
    "tested-pass": 0,
    "tested-fail": 0,
    unsupported: 0,
    "not-tested": 0,
  };
  const entries: DoctorReport["checks"] = [];
  let ok = true;

  for (const check of checks) {
    if (opts.signal?.aborted) {
      const entry = mkEntry(check, {
        status: "not-tested",
        detail: "cancelled before execution",
      });
      entries.push(entry);
      summary["not-tested"]++;
      opts.onCheck?.(entry);
      continue;
    }

    let res: CheckResult;
    try {
      res = await check.run();
    } catch (err) {
      res = {
        status: "tested-fail",
        detail: err instanceof Error ? err.message : String(err),
        error: normalizeError(err, {
          package: "obix-core-diagnostics",
          operation: `check:${check.id}`,
          runtime: host.runtime,
        }),
      };
    }

    const entry = mkEntry(check, res);
    entries.push(entry);
    summary[res.status]++;

    const required = check.required === true;
    if (res.status === "tested-fail") ok = false;
    else if (required && (res.status === "unsupported" || res.status === "not-tested")) ok = false;

    opts.onCheck?.(entry);
  }

  return {
    schema: "obix-core-diagnostics/doctor@1",
    ok,
    runtime: host.runtime,
    runtimeVersion: host.runtimeVersion,
    os: host.os,
    arch: host.arch,
    generatedAt: new Date().toISOString(),
    summary,
    checks: entries,
  };
}

function mkEntry(check: DoctorCheck, res: CheckResult): DoctorReport["checks"][number] {
  return {
    id: check.id,
    title: check.title,
    status: res.status,
    detail: res.detail,
    required: check.required === true,
    data: res.data ?? null,
    error: res.error ? res.error.toJSON() : null,
  };
}

// ── reporters ───────────────────────────────────────────────────────────────

export interface ReporterOptions {
  /** Where human lines are written. Defaults to a stderr-like sink you supply. */
  write: (line: string) => void;
  /** Emit ANSI colour. Default false. */
  color?: boolean;
}

const MARK: Record<SupportStatus, string> = {
  "tested-pass": "PASS",
  "tested-fail": "FAIL",
  unsupported: "UNSUP",
  "not-tested": "SKIP",
};

function paint(color: boolean, status: SupportStatus, text: string): string {
  if (!color) return text;
  const c =
    status === "tested-pass" ? "32" : status === "tested-fail" ? "31" : status === "unsupported" ? "33" : "90";
  return `\x1b[${c}m${text}\x1b[0m`;
}

/** Human report writer. Writes only to the provided sink (intended: stderr). */
export function createReporter(opts: ReporterOptions) {
  const write = opts.write;
  const color = opts.color === true;
  return {
    report(report: DoctorReport): void {
      write(
        `obix doctor — ${report.runtime}${report.runtimeVersion ? " " + report.runtimeVersion : ""} on ${report.os ?? "?"}/${report.arch ?? "?"}`,
      );
      for (const c of report.checks) {
        write(`  ${paint(color, c.status, MARK[c.status].padEnd(5))}  ${c.id.padEnd(28)} ${c.detail}`);
        if (c.error?.remediation) write(`         ↳ ${c.error.remediation}`);
      }
      const s = report.summary;
      write(
        `${report.ok ? paint(color, "tested-pass", "OK") : paint(color, "tested-fail", "PROBLEMS")}  ` +
          `pass=${s["tested-pass"]} fail=${s["tested-fail"]} unsupported=${s.unsupported} not-tested=${s["not-tested"]}`,
      );
    },
    error(err: unknown): void {
      const e = isCompatError(err)
        ? (err as CompatError)
        : normalizeError(err, { package: "obix-core-diagnostics", operation: "cli" });
      write(paint(color, "tested-fail", `error [${e.code}] ${e.package}/${e.operation}: ${e.reason}`));
      if (e.remediation) write(`  ↳ ${e.remediation}`);
    },
  };
}

/**
 * Serialise a report. `{ json: true }` returns exactly one JSON document with a
 * trailing newline and no other text. `{ json: false }` returns the human block
 * as a single string (newline-joined) for callers that prefer a return value.
 */
export function formatReport(report: DoctorReport, opts: { json: boolean; color?: boolean } = { json: false }): string {
  if (opts.json) return JSON.stringify(report) + "\n";
  const lines: string[] = [];
  createReporter({ write: (l) => lines.push(l), color: opts.color }).report(report);
  return lines.join("\n") + "\n";
}

// ── exit codes ──────────────────────────────────────────────────────────────

export const EXIT = {
  /** Success. */
  ok: 0,
  /** An operation failed or a required compatibility target is unmet. */
  failure: 1,
  /** The command was invoked incorrectly (bad flags / args). */
  invalidInvocation: 2,
} as const;

/** 130 on POSIX (128 + SIGINT); Windows Ctrl-C conventionally yields 3221225786, but Node reports 130 for a handled SIGINT. */
export const EXIT_CANCELLED = 130;

/** Map a doctor report to a process exit code. */
export function exitCodeFor(report: DoctorReport): number {
  return report.ok ? EXIT.ok : EXIT.failure;
}
