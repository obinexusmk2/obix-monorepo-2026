# @obinexusltd/obix-core-capabilities

Host identity, capability inspection and requirement checks for the OBIX CLI.
The **portable root** of the `obix-core-*` family — it owns the shared
compatibility types and does no deep host access at import time.

## The problem it owns

A Deno or Bun process exposes a Node-compatible `process`, so naïve detection
selects "Node" and then behaves wrongly. Separately, code treats the *presence*
of an API (`fetch`, `fs`) as permission to use it, and confuses a Web API with a
real DOM. This package separates three concerns: **runtime identity**, **feature
availability**, and **permission state** — and models `unknown` as a real state,
not implicit permission.

## API

```ts
import {
  detectHost, probeCapabilities, requireCapability, inspect,
  CompatError, isCompatError,
  type HostRecord, type CapabilityResult, type CapabilityName,
} from "@obinexusltd/obix-core-capabilities";
```

| Export | Description |
|--------|-------------|
| `detectHost(): HostRecord` | Runtime (`node`/`deno`/`bun`/`browser`/`webworker`/`unknown`) decided from runtime-specific markers **before** Node-compat globals, plus os/arch/libc/version. Fresh object each call. |
| `probeCapabilities(names?): Record<CapabilityName, CapabilityResult>` | Non-destructive inspection. Never opens a resource, spawns, loads a library or prompts. Each result is `{ status: "available" \| "unavailable" \| "denied" \| "unknown", reason, provider }`. |
| `requireCapability(name, { package, operation, results?, allowUnknown? })` | Preflight guard. Returns the result if `available` (or `unknown` with `allowUnknown`); otherwise throws a `CompatError`. **Advisory only** — still handle denials at the real call site. |
| `inspect()` | `{ host, capabilities }` for `obix-core-diagnostics`. |
| `CompatError` | The single error type every `obix-core-*` package throws/returns. `code`, `package`, `operation`, `reason`, `runtime`, `capability?`, `remediation?`, `.toJSON()`. |
| `ALL_CAPABILITIES` | The probe list: `fs`, `fs-watch`, `spawn`, `worker-threads`, `web-worker`, `native-addon`, `ffi`, `dom`, `fetch`, `web-streams`, `abort-signal`, `performance-now`, `high-res-time`, `ref-unref`. |

## Host support (verified 2026-09-07)

| Runtime | Identity | Notes |
|---------|----------|-------|
| Node 26.7.0 / Win x64 | ✅ `node` | `worker-threads` available, `web-worker` unavailable |
| Deno 2.9.6 / Win x64 | ✅ `deno` | `web-worker` available; `fs`/`spawn` = `unknown` unless `--allow-read`/`--allow-run` (no prompt) |
| Bun 1.4.2 / Win x64 | ✅ `bun` | `process.versions.bun` preferred over the Node marker |
| browser / web worker | authored, not run here | `dom` available in a window; `fs`/`spawn` unavailable |

Linux/macOS, Node 22/24 LTS: authored, `not-tested` (see repo
`docs/core-compatibility/implementation-status.md`).

## Fallbacks

- Deno permission `"prompt"` state → `unknown` (this package never prompts).
- Node without `--permission` → capabilities that only need API presence report
  `available`; a denied `--permission` scope reports `denied`.
- `ffi` on plain Node → `unknown` (experimental, flag-gated; not the LTS baseline).

## Errors

Every failure is a `CompatError`. `requireCapability` throws
`capability/unavailable`, `capability/denied` or `capability/unknown`, each with a
runtime-specific `remediation` string.

## Example

```ts
import { requireCapability, probeCapabilities, isCompatError } from "@obinexusltd/obix-core-capabilities";

const caps = probeCapabilities(["fs", "spawn"]);
console.log(caps.fs.status, "-", caps.fs.reason);

try {
  requireCapability("spawn", { package: "my-tool", operation: "build" });
  // ...spawn the compiler...
} catch (err) {
  if (isCompatError(err)) {
    console.error(`[${err.code}] ${err.reason}`);
    if (err.remediation) console.error("  ->", err.remediation);
    process.exitCode = 1;
  } else {
    throw err;
  }
}
```

## Boundary

Owns host-metadata and compatibility-result types only. It does **not** move OBIX
component types here, and it is **not** a JavaScript security sandbox.

MIT — OBINexus Computing
