# The doctor report

`@obinexusltd/obix-core-diagnostics` turns a list of injected checks into one
machine-readable report. It imports nothing from the other nine core packages —
the CLI passes the checks in, so there is no cycle.

## Check contract

```ts
interface DoctorCheck {
  id: string;
  title: string;
  required?: boolean;
  run(): CheckResult | Promise<CheckResult>;
}
interface CheckResult {
  status: "tested-pass" | "tested-fail" | "unsupported" | "not-tested";
  detail: string;
  data?: unknown;
  error?: CompatError;
}
```

| status | meaning |
| --- | --- |
| `tested-pass` | the operation ran here and worked |
| `tested-fail` | it ran and failed |
| `unsupported` | this runtime cannot do it (deliberate, explicit) |
| `not-tested` | deliberately not run here (deep-only, or no fixture) |

## `runDoctor(checks, { signal?, onCheck? })`

Runs each check in order. `ok` is `false` if **any** check is `tested-fail`, or if
a **required** check is `unsupported` / `not-tested`. A non-required
`unsupported` / `not-tested` does not fail the run. A thrown check becomes
`tested-fail` with a normalized `CompatError`. An aborted `signal` marks the
remaining checks `not-tested` ("cancelled before execution") — it does not throw;
the caller decides the exit code.

The report (`schema: "obix-core-diagnostics/doctor@1"`) carries `runtime`,
`runtimeVersion`, `os`, `arch`, `generatedAt`, a `summary` count per status, and
the per-check rows.

## Output routing

`formatReport(report, { json })`:

* `json: true` -> **exactly one** JSON document, newline-terminated, on the sink.
* `json: false` -> a human table.

`createReporter({ write, color? })` writes only to the injected `write` sink —
the CLI binds it to **stderr**, keeping stdout clean for the JSON document.

## Exit codes

`EXIT` = `{ ok: 0, failure: 1, invalidInvocation: 2 }`, `EXIT_CANCELLED = 130`.
`exitCodeFor(report)` returns `0` when `report.ok`, else `1`. The CLI adds `2`
for a bad invocation and `130` when a SIGINT aborted the run.
