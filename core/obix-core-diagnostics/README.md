# @obinexusltd/obix-core-diagnostics

Stable compatibility errors, human + JSON reporters, and an injection-based
doctor runner for the OBIX CLI.

## The problem it owns

CLI "success" that does not correspond to emitted files; errors that lose the
real cause; JSON output mixed with log text on the same stream; and missing test
coverage reported as compatibility. This package gives one error type, one report
schema, a strict stdout/stderr split, and four honest support states.

## API

```ts
import {
  normalizeError, runDoctor, formatReport, createReporter,
  exitCodeFor, EXIT, EXIT_CANCELLED,
  CompatError, isCompatError,
  type DoctorCheck, type DoctorReport, type CheckResult, type SupportStatus,
} from "@obinexusltd/obix-core-diagnostics";
```

| Export | Description |
|--------|-------------|
| `normalizeError(value, ctx)` | Coerce any thrown value to a `CompatError`, keeping the original as `cause`. A `CompatError` is returned unchanged. |
| `runDoctor(checks, { signal?, onCheck? })` | Run injected checks, assemble a `DoctorReport`. `ok` is `false` on any `tested-fail`, or a **required** `unsupported` / `not-tested`. A non-required `unsupported` / `not-tested` does **not** fail the report. |
| `formatReport(report, { json })` | `json:true` → **exactly one** JSON document (`\n`-terminated, no log text). `json:false` → the human block as a string. |
| `createReporter({ write, color? })` | Human report/error writer. Writes **only** to the injected sink — the CLI binds it to **stderr**. |
| `exitCodeFor(report)` | `0` if `ok`, else `1`. |
| `EXIT` | `{ ok: 0, failure: 1, invalidInvocation: 2 }`. `EXIT_CANCELLED = 130`. |

### Support states

`tested-pass` · `tested-fail` · `unsupported` · `not-tested`. A `DoctorCheck` is
`{ id, title, required?, run(): CheckResult | Promise<CheckResult> }`.

## Output contract

- `doctor` → human report on **stderr**, exit `0` / `1`.
- `doctor --json` → one JSON document on **stdout**, human logs on **stderr**,
  exit `0` / `1`.
- **No telemetry** is ever transmitted. Basic doctor is read-only.

## Host support (verified 2026-09-07)

Node 26.7.0, Deno 2.9.6, Bun 1.4.2 — all Windows x64 — **11/11 contract tests**.
Pure JS + Web APIs; no host-specific code, so behaviour is uniform across
runtimes. Linux/macOS + Node LTS: authored, `not-tested`.

## Errors

`normalizeError` never throws; it always returns a `CompatError`. `runDoctor`
never throws for a failing check — it records `tested-fail` with a normalized
error and continues.

## Example

```ts
import { runDoctor, formatReport, createReporter, exitCodeFor } from "@obinexusltd/obix-core-diagnostics";

const checks = [
  { id: "host.identity", title: "runtime detected", run: () => ({ status: "tested-pass", detail: "node 26.7.0" }) },
  { id: "native.addon", title: "N-API provider", required: false, run: () => ({ status: "not-tested", detail: "no provider requested" }) },
];

const report = await runDoctor(checks);

if (process.argv.includes("--json")) {
  process.stdout.write(formatReport(report, { json: true }));   // one JSON doc, stdout
} else {
  createReporter({ write: (l) => process.stderr.write(l + "\n") }).report(report);  // human, stderr
}
process.exit(exitCodeFor(report));
```

## Boundary

Receives checks by **injection** — it never imports the other `obix-core-*`
providers, so no dependency cycle is possible. It does not duplicate existing
business telemetry.

MIT — OBINexus Computing
