# Host identity, capabilities and permission state

`@obinexusltd/obix-core-capabilities` separates three things that callers
routinely conflate.

## 1. Runtime identity — `detectHost()`

Decided from **runtime-specific global markers, in precedence order**, *before*
Node-compatibility globals:

```
Deno.version.deno            -> "deno"
Bun.version / process.versions.bun -> "bun"
window && document           -> "browser"
WorkerGlobalScope            -> "webworker"
process.versions.node        -> "node"
else                         -> "unknown"
```

`HostRecord` also carries `runtimeVersion`, `nodeCompatVersion`, `os`, `arch`,
`libc` (`glibc` / `musl` / null) and `isBrowserWindow` / `isWorker`. Every call
returns a fresh object.

**This is a heuristic, not an authenticated identity.** A test that assigns
`process.versions.bun` on Node makes `detectHost()` return `"bun"` — that is
*expected*: it proves the marker set is spoofable, which is exactly why provider
selection in the other packages keys off **probed capabilities and operation
outcomes**, never the runtime string. `HOST_DETECTION_NOTE` documents this.

## 2. Feature availability — `probeCapabilities(names?)`

Non-destructive: never opens a resource, spawns, loads a library or prompts.
Each of the 14 capabilities (`fs`, `fs-watch`, `spawn`, `worker-threads`,
`web-worker`, `native-addon`, `ffi`, `dom`, `fetch`, `web-streams`,
`abort-signal`, `performance-now`, `high-res-time`, `ref-unref`) returns:

```ts
{ capability, status: "available" | "unavailable" | "denied" | "unknown", reason, provider }
```

`unknown` is a **real state** — e.g. Deno's `"prompt"` permission state maps to
`unknown` because this package never triggers the prompt.

## 3. Requirement checks — `requireCapability(cap, { package, operation, results?, allowUnknown? })`

A preflight guard. Returns the `CapabilityResult` when `available` (or `unknown`
with `allowUnknown: true`); otherwise throws a `CompatError`
(`capability/unavailable` | `capability/denied` | `capability/unknown`) with a
runtime-specific `remediation`. It is **advisory** — still handle the real denial
at the call site.

## Verified host support (2026-09-07)

| Runtime | identity | notes |
| --- | --- | --- |
| Node 26.7.0 / Win x64 | `node` | `worker-threads` available; `web-worker` unavailable |
| Deno 2.9.6 / Win x64 | `deno` | global `Worker` -> `web-worker` available; `fs`/`spawn` `unknown` without `--allow-*` (no prompt) |
| Bun 1.4.2 / Win x64 | `bun` | `process.versions.bun` preferred over the Node marker |
| browser / web worker | authored, not run here | `dom` available in a window; `fs`/`spawn` unavailable |

Linux / macOS and Node 22 / 24 LTS: authored, `not-tested`.
