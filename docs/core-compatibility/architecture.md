# OBIX core-compatibility — architecture

The ten `@obinexusltd/obix-core-*` packages are the **default host-compatibility
layer** for the `@obinexusltd/obix` command-line experience. They adapt existing
host facilities (Node / Deno / Bun / browser) behind stable, testable contracts.
They are **not** ten replacement JavaScript engines, a second component-type
universe, or a security sandbox.

See `implementation-status.md` for what is actually built and verified.

## 1. Package set & responsibilities

| # | Package | Owns |
|---|---------|------|
| 1 | `@obinexusltd/obix-core-capabilities` | Host identity, capability inspection, requirement checks. Owns the shared `HostRecord` / `CapabilityResult` / `CompatError` types. |
| 2 | `@obinexusltd/obix-core-modules` | Host-delegating module resolution & loading, asset URL resolution, installed package-set validation. |
| 3 | `@obinexusltd/obix-core-filesystem` | Project-root path resolution, byte/text reads, serialized safe writes, normalized watch invalidations + polling fallback. |
| 4 | `@obinexusltd/obix-core-process` | Tool resolution, shell-free async spawn (argv array), AbortSignal + timeout, drained bounded stdout/stderr, owned-child cleanup. |
| 5 | `@obinexusltd/obix-core-scheduler` | Injected monotonic clock, opaque timer tokens, cancellation/disposal, interval-overrun & async-overlap policy. Bridges the frozen Timer contract. |
| 6 | `@obinexusltd/obix-core-streams` | Web Streams + `Uint8Array` byte boundary, Node adapters, backpressure, streaming UTF-8 decode, abort/error propagation, lock/close ownership. |
| 7 | `@obinexusltd/obix-core-workers` | Bounded worker pool, versioned serializable job protocol (`jobId` + module ref + action ref + data), copy-by-default / explicit transfer. |
| 8 | `@obinexusltd/obix-core-native` | TS provider registry, platform/ABI selection, lazy load, managed handles. Node-API preferred; FFI opt-in/version-gated. |
| 9 | `@obinexusltd/obix-core-web` | Portable host contracts + explicit `/dom` and `/server` boundaries around the existing OBIX renderer/adapter. |
| 10 | `@obinexusltd/obix-core-diagnostics` | Stable errors, human (stderr) + JSON (stdout) formatters, `runDoctor(checks)` by injection, support states, exit codes. |

## 2. Dependency graph (one-way, acyclic)

`A → B` = "A may import from B". Enforced by `scripts/check-core-graph.mjs`
against declared `dependencies` in each packed manifest.

```
capabilities  → (nothing)
modules       → capabilities
filesystem    → capabilities
streams       → capabilities
scheduler     → capabilities
diagnostics   → capabilities
process       → capabilities, modules, streams
workers       → capabilities, modules, scheduler
native        → capabilities, modules
web           → capabilities, scheduler
```

```
                       ┌───────────────┐
                       │ capabilities  │  (leaf — owns shared types)
                       └───────┬───────┘
        ┌──────────┬───────────┼───────────┬───────────┬──────────┐
        ▼          ▼           ▼           ▼           ▼          ▼
   ┌────────┐ ┌────────┐  ┌─────────┐ ┌──────────┐ ┌────────────┐ (web, native
   │modules │ │streams │  │scheduler│ │filesystem│ │diagnostics │  also below)
   └───┬─┬──┘ └───┬────┘  └────┬─┬──┘ └──────────┘ └────────────┘
       │ │        │            │ │
       │ └────────┼─────►┌─────▼─┴──┐        ┌──────────┐
       │          └─────►│ process  │        │ workers  │◄── modules, scheduler
       │                 └──────────┘        └──────────┘
       ├────────────────►┌──────────┐   ┌──────────┐
       └────────────────►│  native  │   │   web    │◄── scheduler
                         └──────────┘   └──────────┘
```

- **`capabilities` duplicates no existing OBIX component types.** It owns only
  compatibility-level host/result/error types.
- The **CLI** composes providers and passes checks to `diagnostics` **by
  injection** — `diagnostics` never imports the other nine.
- `filesystem` receives debounce/poll timing **hooks by injection** (a
  `{ now, setTimeout, clearTimeout }` shape), so it needs no edge to `scheduler`.
- `web` **does** use `scheduler`: `obix-core-web/dom`'s `attachWebHost` /
  `defineElement` coalesce synchronous `update()` bursts into one repaint through
  a `SchedulerAPI` (opt-in via `coalesce`). This is the one real use of the
  `web → scheduler` edge; without `coalesce` the edge's code path is inert but
  the dependency is still exercised at the value level.
- Existing OBIX store/renderer/effect integration is via **injected interfaces**
  passed by the CLI, never a static import of `@obinexusltd/obix` from a
  `core/*` package. No `core/*` package depends on the umbrella.

If a concrete extra edge is ever required it must be justified in this file,
tested, and keep the graph acyclic (`scripts/check-core-graph.mjs` runs
`findCycles`).

## 3. Portable roots vs host subpaths

Every package's **`.` export is a portable root**: contracts, type guards, pure
helpers, and a `createX({ providers, hooks })` factory. A portable root has, at
**import time**, no:

- filesystem access · process spawning · native library loading
- DOM access · timer startup · global registration (`customElements`, `process.on`)

Host-specific behaviour lives behind explicit subpath exports:

| Package | Subpaths |
|---------|----------|
| `capabilities` | `.` only (probes are lazy functions, not import-time) |
| `modules` | `.`, `./node` |
| `filesystem` | `.`, `./node` |
| `process` | `.`, `./node` |
| `scheduler` | `.`, `./node` (ref/unref behind a capability) |
| `streams` | `.`, `./node` |
| `workers` | `.`, `./node`, `./web` |
| `native` | `.`, `./node` (provider registry is portable; loading is `./node`) |
| `web` | `.`, `./dom`, `./server` |
| `diagnostics` | `.` only |

`sideEffects: false` is set **only where true** (all ten — none register globals
or run effects at module top level). Portability is asserted by
`scripts/check-core-graph.mjs` (scans the transitive `.`-export graph for
forbidden specifiers) and by `obix-core-web`'s DOM-free import test.

## 4. Versioning

- **One version source** for the ten: `core/version.json` (`0.1.0`). Every
  `core/*` `package.json` carries the same `version`; internal deps are pinned
  **exact** (`"0.1.0"`, never a range).
- `OBIX_VERSION` (`0.2.1`, frozen track) and `suite/SUITE_VERSION` (`0.3.0`) are
  **not touched**. The three tracks version independently.
- `obix-core-modules` `validatePackageSet()` reads installed `core/*` manifests
  and reports a `CompatError` (`code: "core/version-skew"`) if they disagree or
  if a `core/*` dep range is not the exact family version.

## 5. CLI / umbrella integration (the amendment)

Recorded in `implementation-status.md` §3 and `migration.md`.

- `@obinexusltd/obix` (`runtime/obix`) gains:
  - `bin: { "obix": "./dist/bin/obix.js" }` — a thin shim: `import { runCli } from "../cli/index.js"; process.exit(await runCli(process.argv.slice(2)))`.
  - `exports["./cli"]` → `./dist/cli/index.js` (types + import) — the one command
    implementation, exporting `runCli(argv): Promise<number>`.
  - `dependencies`: the ten `@obinexusltd/obix-core-*` at exact `0.1.0`, plus the
    existing adapter deps unchanged.
- **One command implementation.** No copied command bodies. `obixc` (frozen
  `obix-cli`) is unchanged and remains the compiler binary.
- **Lazy provider registry.** `runCli` builds a registry of `() => import(...)`
  thunks. `obix --help` / `--version` load only arg parsing. `obix doctor` loads
  `capabilities` + `diagnostics` + the checks it runs. `obix build` adds
  `modules` + `filesystem` + `process`. `web`/`native`/`workers` load only when a
  command needs them. No browser or native code is imported for `--help` /
  `doctor` / `build`.
- `obix` / `obix --help` / `obix --version` → exit `0`; `--version` prints the
  umbrella version **and** the core family version (`0.1.0`, 10 packages).
- `runCli(argv, io?)` takes an optional IO seam
  (`{ stdout, stderr, env, isTTY, flush, onCancel }`) so it is unit-testable
  without touching the real process streams.
- `obix doctor` → human report on **stderr**, nothing on stdout, exit `0`/`1`.
  `obix doctor --json` → exactly **one** newline-terminated JSON document on
  stdout, human progress on stderr, exit `0`/`1`.
- `--require <target>` marks a check `required` so the run fails (exit `1`)
  unless it is `tested-pass`. Targets: `modules scheduler streams fs spawn
  workers dom native native:<op>` or a check id. A missing optional native
  provider does **not** fail general JS readiness; `--require native` does.
- `--deep` additionally runs the real spawn + real worker checks;
  `--no-color` / `NO_COLOR` / a non-TTY stdout suppress ANSI.
- Exit codes: `0` ok · `1` a check failed or a required check was unmet ·
  `2` invalid invocation · `130` cancelled (SIGINT). No telemetry.

## 6. Compatibility matrix (targets vs. verified — 2026-09-07, session 2 close)

`P` = executed and passing in this session · `A` = authored, not run here · `n/a`.
Deno/Bun rows below were verified on **Windows x64** (not Linux); the Linux
Deno/Bun cells stay `A` until a Linux runner runs them.

| Surface | Node 26 / Win | Node 24 / 22 LTS | Deno 2.9.6 / Win | Bun 1.4.2 / Win | Linux / macOS | Chromium / Win | Firefox / WebKit |
|---------|:-------------:|:----------------:|:----------------:|:---------------:|:-------------:|:--------------:|:----------------:|
| capabilities identity | P | A | P | P | A | n/a | n/a |
| modules resolve/load/validate | P | A | P (bare→passthrough) | P (bare→passthrough) | A | n/a | n/a |
| filesystem read/write/watch | P | A | P | P | A (POSIX paths/signals) | n/a | n/a |
| process spawn/abort/timeout | P | A | P | P | A (process-group kill) | n/a | n/a |
| scheduler frozen-Timer fixture | P | A | P | P | A | n/a | n/a |
| streams backpressure / split-UTF-8 | P | A | P | P | A | n/a | n/a |
| workers pool / protocol / crash | P | A | P | P (limits reported unhonoured) | A | n/a (web backend) | n/a |
| native provider registry + failure model | P | A | P | P | A | n/a | n/a |
| native **execution** | **not-tested** | not-tested | not-tested | not-tested | not-tested | n/a | n/a |
| web `.` + `/server` DOM-free import + purity | P | A | P | P | A | n/a | n/a |
| web `/dom` connect/disconnect/reconnect/focus/coalesce | n/a | n/a | n/a | n/a | n/a | **P (7/7)** | **not-tested** |
| diagnostics doctor / `--json` | P | A | P | P | A | n/a | n/a |
| **`obix` umbrella CLI** (help/version/doctor/`--json`/`--require`/`--deep`) | P (13/13) | A | P (13/13) | P (13/13) | A | n/a | n/a |
| **packed umbrella** (`npm pack` → clean install → `obix doctor --json`) | **P** | A | P (installed entrypoint) | P (installed entrypoint) | A | n/a | n/a |

Advertise a combination only after its cell is `P`. See `implementation-status.md`
§11 for the blocker behind every non-`P` cell.

## 7. Non-goals (explicit)

- TypeScript is not compiled to machine code by these packages; the CLI shells
  out to the project-local compiler (`obix-core-process`).
- A `.dll`/`.so`/`.dylib` is not a `.node` addon; raw FFI needs a real gated
  provider (`obix-core-native`).
- Browser DOM ≠ desktop widgets; `obix-core-web` promises no WinUI/Cocoa/GTK.
- Suite SSR is deferred upstream; `obix-core-web/server` reports it
  **unsupported**, it does not fabricate `renderToString`.
- No LibPolyCall / NSIGII / PyTether exports are invented.
- Not every Node-compatible runtime behaves identically; each is a separate
  tested lane.
