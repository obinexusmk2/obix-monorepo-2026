# OBIX core-compatibility — implementation status

> Living record of what was **inspected**, **implemented**, **tested**, and what
> remains **unverified**, for the ten `@obinexusltd/obix-core-*` packages.
> Evidence only — no assumed success. Update on every session.

## 1. Checkout & environment (session opened 2026-09-07)

| Item | Value | How obtained |
|------|-------|--------------|
| Repo | `obix-monorepo` (private root, not published) | `package.json` |
| Checkout commit | `6e411d464aa36c01bd503dace028d3caa3013836` (`main`) | `git rev-parse HEAD` |
| HEAD subject | `suite: publish the umbrella package as \`obixjs\`, not \`obix\`` | `git log` |
| Monorepo version | `0.2.1` (`OBIX_VERSION` = `0.2.1`) | `package.json`, `OBIX_VERSION` |
| Node | **v26.7.0** (Current line) | `node --version` |
| npm | 11.19.0 | `npm --version` |
| TypeScript | 5.9.3 resolved / `^5.7.2` devDep | `npx tsc --version`, root `package.json` |
| Deno | **not installed** | `which deno` → not found |
| Bun | **not installed** | `bun --version` → not found |
| Deno | **2.9.6** (stable, x86_64-pc-windows-msvc) — at `~/.deno/bin/deno.exe`; not on the Git-Bash PATH, works from PowerShell | user-reported + `deno --version` via full path |
| Bun | **1.4.2** — at `~/.bun/bin/bun.exe`; not on the Git-Bash PATH | user-reported + `bun --version` via full path |
| Playwright | 1.63.0; browser cache has **chromium** + headless-shell only (no Firefox/WebKit) | `npx playwright --version`, `~/AppData/Local/ms-playwright/` |
| OS | Windows (win32), x64 | platform |
| Native toolchain | TDM-GCC-64, CMake on PATH; node-gyp / a prebuilt `.node` fixture **not verified/present** | PATH inspection |
| CI | **no `.github/workflows/`** — gates run via `scripts/ci.mjs` (`npm run ci`) | filesystem |

### Consequence for verification

Runnable lanes in this session: **Node 26.7.0 / Deno 2.9.6 / Bun 1.4.2, all on
Windows x64**, plus **Chromium** (Playwright).

Not runnable here (authored + `not-tested`, blocker named in §8):
**Linux x64/glibc**, **macOS arm64**, **Node 24 LTS**, **Node 22 LTS**,
**Firefox / WebKit**, **native execution** (no N-API provider + no built
fixture).

## 2. Package inventory (actual, this checkout)

Root `package.json` `workspaces`: `packages/*`, `suite/*`, `adapters/*`,
`primitives/*`, `overlays/obix-component-{modal,dropdown,tooltip}`, `runtime/obix`.
(`forms/`, `feedback/`, `drivers/`, `bindings/`, `cli/`, `components/` are
gitignored legacy checkouts — **not** part of this monorepo.)

### Frozen compiler track — `packages/*` (20 packages, **bare** names, `v0.2.1`)

`obix-spec` `obix-ir` `obix-parser` `obix-compiler` `obix-template` `obix-styles`
`obix-adapter-{data,func,oop,reactive,native,ssr}` `obix-runtime` `obix-effects`
`obix-validator` `obix-equivalence` `obix-accessibility` `obix-cli`
`obix-language-server` `obix-timer` — all `type: module`, all `v0.2.1`.

- **`obix-cli@0.2.1`** — `bin: { "obixc": "./dist/bin/obixc.js" }`. Deps:
  `obix-compiler`, `obix-equivalence`, `obix-validator` (all `0.2.1`, exact).
  `src/index.ts` calls `compileFile` / `checkSource` from `obix-compiler` and
  `checkEquivalence` / `runWithVirtualTime` from `obix-equivalence`. It does
  **not** `execSync("tsc")` — that behaviour belonged to the *published*
  `@obinexusltd/obix-cli@0.1.1` (research §"Published packages"), which is a
  different artifact from this checkout's `obix-cli`.
- Graph is validated by `scripts/graph.mjs` (`PACKAGES`, `GRAPH`, `RULES`,
  `topoSort`, `findCycles`) + `scripts/check-graph-rules.mjs` +
  `scripts/check-cycles.mjs`. **`obix-timer` is asserted a leaf** ("nothing
  depends on it"); its Timer contract includes unconditional interval arming +
  post-tick predicate checks.

### Suite track — `suite/*` (`v0.3.0`)

`suite/obix` = **`obixjs@0.3.0`**, `suite/obix-core` = `obix-core@0.3.0`,
`suite/obix-test` = `obix-test@0.3.0`. Separate `suite/SUITE_VERSION`.

### Scoped runtime — `runtime/obix` + `adapters/*` (`v0.3.0`)

- **`@obinexusltd/obix@0.3.0`** (`runtime/obix`) — composes
  `@obinexusltd/obix-adapter-{data,func,oop,reactive,ssr}@0.3.0`.
  **No `bin`. No CLI dependency.** Exports `.`, `./src`, `./package.json`.
- `@obinexusltd/obix-adapter-{data,func,oop,reactive,ssr}@0.3.0`.

### Registry check (rechecked this session — see §5)

`@obinexusltd/obix-core-{capabilities,modules,filesystem,process,scheduler,streams,workers,native,web,diagnostics}`
→ **all HTTP 404** (`npm view` E404). Consistent with the research's 6 Sep
finding. Publish rights unverified; **not published by this work**.

## 3. Reconciliation of the supplied sources

| Source | Status in this checkout | Handling |
|--------|-------------------------|----------|
| `OBIX-1.0-LEVEL-0-…-DRAFT-0.2.2-CANDIDATE.md` | **not present as a file**; its rules are encoded in `scripts/graph.mjs` `RULES` and the `packages/*` graph (`v0.2.1`) | Treat the encoded `RULES` + frozen `GRAPH` as the authority. Do not re-scope or re-version `packages/*`. |
| `OBIX-SUITE-0.3.0-DRAFT.md` | **not present as a file**; suite exists as `suite/*` (`obixjs@0.3.0`) | Independent track. SSR / LibPolyCall remain deferred → `obix-core-web` `/server` reports suite SSR **unsupported**. |
| `BOTTLENECK_ANALYSIS.md`, `BUILD_FIX_SUMMARY.md`, `INTERACTIVE_UI_GUIDE.md`, Component docs 1–4 | not present as files (`docs/obix-docs/` vendored per commit `a25f777`; not re-verified line-by-line this session) | Historical context only. |
| Research report (`OBIX-Core-Compatibility-Research.md`) | supplied | Used for package-level rationale; observations re-checked against this checkout. |

### Integration-edge amendment (recorded, to be reviewed)

The prompt targets *"the authoritative OBIX CLI used by `@obinexusltd/obix`"* and
`npm exec --package=@obinexusltd/obix -- obix --help`. In **this checkout**
`@obinexusltd/obix` (`runtime/obix@0.3.0`) has **no CLI and no `bin`**, and the
frozen `obix-cli` publishes the **`obixc`** binary (compiler orchestration) and
is a member of the frozen, unmodifiable `packages/*` graph.

**Amendment (proposed):** add the compatibility-aware CLI to the
**`@obinexusltd/obix` umbrella** — a `bin: { "obix": "./dist/bin/obix.js" }`
shim + an `./cli` subpath export that delegate to an exported `runCli(argv)` —
and make the ten `@obinexusltd/obix-core-*` packages **normal dependencies of
`@obinexusltd/obix`**. The frozen `obix-cli` / `obixc` is **left untouched**.
`obix` (host + doctor + orchestration) and `obixc` (compiler) are documented as
distinct binaries in `docs/core-compatibility/migration.md`.

This amendment changes `runtime/obix`'s manifest (adds `bin`, `./cli` export, 10
deps). It is **not** a change to the frozen `packages/*` set. Rationale + the
"do not silently break the historical `CLI` re-export" review are in the
migration doc.

## 4. New workspace group

- Directory: **`core/obix-core-<suffix>/`** (added to root `workspaces`).
- Single version source: **`core/version.json`** (`{ "version": "0.1.0" }`),
  consumed by every `core/*` manifest and by `scripts/check-core-graph.mjs`.
  `OBIX_VERSION` and `suite/SUITE_VERSION` are **untouched**.
- Internal deps between `core/*` packages are pinned **exact** (`"0.1.0"`).

## 5. Registry recheck (this session)

```
npm view @obinexusltd/obix-core-capabilities version   → npm error code E404
… (all ten) …                                          → npm error code E404
```
Names are unclaimed on the public registry as of this session. No publication
performed. `publishConfig.access` is set to `public` in each manifest for a
*future* authorised publish; **this work does not run `npm publish`.**

## 6. Per-package & per-lane status (session 2 close — 2026-09-07)

Legend: `done` = real TypeScript, no throwing placeholder · `build` = `tsc`
emits JS + `.d.ts` + `.js.map` + `.d.ts.map` · counts = `node --test` /
`deno test --no-check` / `bun test` on the package's `test/*.test.mjs` ·
`not-tested` = authored, no runner available in this environment.

| Package | impl | build | Node 26.7.0 | Deno 2.9.6 | Bun 1.4.2 | packed | Linux/macOS | browser | native exec |
|---------|------|-------|-------------|------------|-----------|--------|-------------|---------|-------------|
| obix-core-capabilities | done | pass | 10/10 | 10/10 | 10/10 | yes | not-tested | n/a | n/a |
| obix-core-diagnostics  | done | pass | 11/11 | 11/11 | 11/11 | yes | not-tested | n/a | n/a |
| obix-core-modules      | done | pass | 11/11 | 11/11 | 11/11 | yes | not-tested | not-tested | n/a |
| obix-core-scheduler    | done | pass | 11/11 | 11/11 | 11/11 | yes | not-tested | not-tested | n/a |
| obix-core-streams      | done | pass | 11/11 | 11/11 | 11/11 | yes | not-tested | not-tested | n/a |
| obix-core-filesystem   | done | pass | 10/10 | 10/10 | 10/10 | yes | not-tested | n/a | n/a |
| obix-core-process      | done | pass | 13/13 | 13/13 | 13/13 | yes | not-tested | n/a | n/a |
| obix-core-workers      | done | pass | 13/13 | 13/13 | 13/13 | yes | not-tested | not-tested (web backend) | n/a |
| obix-core-native       | done | pass | 15/15 | 15/15 | 15/15 | yes | not-tested | n/a | **not-tested** (no provider / toolchain / fixture) |
| obix-core-web          | done | pass | 12/12 | 12/12 | 12/12 | yes | not-tested | **7/7 real Chromium** (Playwright 1.63, Win x64); Firefox/WebKit not-tested | n/a |

**Implemented: 10 of 10** — all `done`, none a scaffold. 117 core contract tests,
0 failures, identical on Node 26.7.0 / Deno 2.9.6 / Bun 1.4.2 (all Windows x64).

### `@obinexusltd/obix` umbrella CLI (`runtime/obix`)

| Item | Result |
|------|--------|
| `bin: { "obix": "./dist/bin/obix.js" }` + `exports["./cli"]` added; 10 `@obinexusltd/obix-core-*@0.1.0` deps added | yes |
| existing `.` export unchanged (`ComplianceError, Data, Func, OOP, Reactive, SSR, checkCompliance, defineComponent`); existing 5 tests still pass | yes |
| `src/cli/index.ts` `runCli(argv, io?)` — lazy `() => import(...)` provider registry, no core package imported for `--help` / `--version` | yes |
| `obix` / `--help` -> 0 · `--version` -> 0 (`@obinexusltd/obix 0.3.0  (core family 0.1.0, 10 packages)`) · unknown command / bad flag -> 2 · cancelled -> 130 | yes |
| `obix doctor` -> human report on **stderr**, nothing on stdout, exit 0/1 | yes |
| `obix doctor --json` -> **exactly one** newline-terminated JSON document on stdout, human progress on stderr, exit 0/1 | yes |
| `--require <target>` (`modules scheduler streams fs spawn workers dom native native:<op>` or a check id) marks a check required; missing optional native does **not** fail general JS readiness, `--require native` **does** (exit 1) | yes |
| `--deep` runs the real spawn + real worker checks (skipped otherwise) | yes |
| `--no-color` / `NO_COLOR` / non-TTY suppress ANSI | yes |
| CLI contract tests | Node 13/13 · Deno 13/13 · Bun 13/13 |

### Packed-consumer fixture — `core/fixtures/pack-and-verify.mjs`

`npm pack` the 10 core packages + the amended umbrella -> tarballs in an OS temp
dir -> `npm install` **outside** the workspace (adapters resolve from the public
registry) -> assert. **Result: PASSED** (Windows x64, Node 26.7.0), every check:

- umbrella + all 10 core packages installed; `node_modules/.bin/obix` present and
  `bin.obix` resolves into the packed `@obinexusltd/obix/dist/bin/obix.js`;
  worker fixture `dist/cli/doctor-job.js` ships.
- `obix --help` / `--version` / `doctor` / `doctor --json` from the installed copy
  -> correct output + exit codes; `doctor --json` is one JSON document, `ok:true`.
- basic doctor: `native/execution`, `process/spawn`, `workers/job` all
  `not-tested`; `web/dom` `unsupported`; `native/registry`, `scheduler/frozen-timer`
  `tested-pass` — no DOM evaluated, no native library opened, no process spawned.
- `obix doctor --require native` -> exit 1, `native/execution` `required:true`.
- every core package's declared `exports` subpath imports and its `.d.ts` is
  present (`obix-core-web/dom` loads fine; its DOM guard is call-time).
- plain-JS consumer imports `@obinexusltd/obix/cli` + a core package; a
  separately type-checked TS consumer compiles against the installed `.d.ts`
  under `moduleResolution: NodeNext`.
- Node **and** Deno **and** Bun each run the installed `dist/bin/obix.js`
  entrypoint directly and produce one `obix-core-diagnostics/doctor@1` document.

### Frozen track regression (unchanged, re-verified this session)

| Check | Result |
|-------|--------|
| `packages/obix-cli` (`obixc`) `node --test` | 5/5 |
| `packages/obix-timer` (frozen fixture) `node --test` | 6/6 |
| `scripts/check-graph-rules.mjs` | all 23 architectural rules hold |
| `scripts/check-cycles.mjs` | acyclic; declared graph == canonical graph |
| `scripts/check-core-graph.mjs` §8 (`git diff --stat` of `scripts/graph.mjs`, `packages/obix-timer/`, `OBIX_VERSION`) | no diff vs HEAD |

## 7. `scripts/check-core-graph.mjs` — the graph gate

`node scripts/check-core-graph.mjs` -> **PASSED (1 warning)**. Enforces, against
the actual source + manifests:

1. exactly the ten `core/obix-core-<suffix>` dirs, names `@obinexusltd/obix-core-*`,
   no eleventh package.
2. every `core/*` `version` === `core/version.json` (`0.1.0`), independent of
   `OBIX_VERSION` (`0.2.1`) and `suite/SUITE_VERSION` (`0.3.0`).
3. internal deps pinned **exact** (`"0.1.0"`, no `^`/`~`).
4. declared internal deps ⊆ the allowed edge set:
   `capabilities:[]`, `modules:[capabilities]`, `filesystem:[capabilities]`,
   `scheduler:[capabilities]`, `streams:[capabilities]`, `diagnostics:[capabilities]`,
   `process:[capabilities,modules,streams]`, `workers:[capabilities,modules,scheduler]`,
   `native:[capabilities,modules]`, `web:[capabilities,scheduler]`.
5. every internal specifier **imported** in source is **declared** — import-aware
   (comment/string-safe: `import…from`, `export…from`, `import("literal")`). A
   computed `import(expr)` is flagged **only** when the expression itself builds
   an internal specifier — a module loader's `import(callerSpecifier)` is a
   warning, not an error (this is the single warning: `obix-core-modules/src/index.ts`).
6. acyclic (DFS).
7. after building each package with its **own** resolved `typescript/bin/tsc`
   (hermetic — `process.execPath` + resolved compiler, no `npx`, no global `tsc`),
   every declared `exports` target file exists; `sideEffects:false` on every manifest.
8. the frozen track (`scripts/graph.mjs`, `packages/obix-timer/`, `OBIX_VERSION`)
   is unchanged vs `HEAD` and the frozen graph gates still pass.

Wired into `scripts/ci.mjs` as the final gate
(`"core compatibility graph (10 obix-core-* packages)"`); the frozen gates before
it are untouched.

## 8. CI workflow — `.github/workflows/core-compatibility.yml` (authored, NOT an executed run)

Lanes, each a distinguishable job, no `continue-on-error` masking a required
failure:

| Job | Matrix | Proves |
|-----|--------|--------|
| `graph-gate` | ubuntu, node 24 | `check-core-graph.mjs` |
| `contract-node` | {ubuntu, windows, macos} × node {22, 24, 26} | build + all `core-*` + umbrella `node --test` |
| `contract-deno` | {ubuntu, windows, macos}, deno 2.9.6 | `deno test` per package |
| `contract-bun` | {ubuntu, windows, macos}, bun 1.4.2 | `bun test` per package |
| `packed-consumer` | {ubuntu, windows, macos}, node 24 | `core/fixtures/pack-and-verify.mjs` |
| `browser-chromium` | {ubuntu, windows}, node 24 | `npx playwright install chromium` + `dom.browser.mjs`. Firefox/WebKit deliberately absent. |
| `native-registry` | {ubuntu, windows, macos}, node 24 | `obix-core-native` registry/selection tests **only** + a step stating native execution is not qualified |
| `benchmark` | ubuntu, node 24 | `core/bench/run-bench.mjs`, uploads `last-run.json` |

Only the Node-26 / Deno-2.9.6 / Bun-1.4.2 **Windows** rows and the Chromium row
have actually been executed (in this session, locally). Every other matrix cell
is `not-tested` until a runner runs it.

## 9. Benchmark — `core/bench/run-bench.mjs` (measured this session)

Windows x64, Node 26.7.0, in-repo built `dist/` (no npm cache). n=60 light /
n=20 heavy. Raw samples + median/p95/min/max/stdev in `core/bench/last-run.json`.
**No thresholds are asserted** — the two baselines exist to show the noise floor
first.

| Metric | median | p95 | stdev | note |
|--------|--------|-----|-------|------|
| `baseline.emptyLoop` | 0.046 ms | 0.367 ms | 0.194 ms | in-process timing noise floor |
| `baseline.noopSpawn` (`node -e 0`) | 41.08 ms | 53.11 ms | 3.91 ms | spawn-based measurement noise floor |
| `cli.coldStart` (`obix --version`, spawned) | 53.63 ms | 80.86 ms | 9.32 ms | ~ noopSpawn + ~12 ms module load |
| `cli.warmDispatch` (`runCli()` in-process, warmed) | 0.405 ms | 0.875 ms | 0.154 ms | startup vs warmed cleanly separated |
| `streams.roundTrip1MiB` (`collectBytes(toReadableStream(…))`) | 0.969 ms | 3.358 ms | 0.540 ms | 1 MiB / 64 KiB chunks, checksum-verified each sample |
| `workers.sum64` (job through a real `worker_threads` pool) | 0.112 ms | 45.48 ms | 9.88 ms | p95 carries first-call worker warm-up |
| `filesystem.watchLatency` (write -> `onInvalidate`) | 15.61 ms | 16.12 ms | 0.333 ms | native recursive `fs.watch`, debounce 10 ms |

Every benchmark sample runs a correctness check (checksum / expected value /
event fired) before its timing is recorded.

## 10. Changed / added files (session 2)

Added:
- `core/obix-core-{modules,scheduler,streams,filesystem,process,workers,native,web}/src/**` (+ `test/**`, `README.md`, `docs/*.md`)
- `core/version.json`
- `runtime/obix/src/bin/obix.ts`, `runtime/obix/src/cli/{index,checks,registry,doctor-job}.ts`, `runtime/obix/test/cli.test.mjs`
- `scripts/check-core-graph.mjs`
- `core/fixtures/pack-and-verify.mjs`
- `core/bench/run-bench.mjs` (+ `last-run.json`)
- `.github/workflows/core-compatibility.yml`
- `docs/core-compatibility/*` (this file + architecture + migration)

Modified:
- `runtime/obix/package.json` (bin, `./cli` export, 10 deps), `runtime/obix/tsconfig.json` (`lib` DOM, `types: [node]`)
- `scripts/ci.mjs` (one appended gate)
- root `package.json` `workspaces` (`core/*`)

Untouched (frozen): `scripts/graph.mjs`, `packages/**` (incl. `obix-cli`,
`obix-timer`), `OBIX_VERSION`, `suite/**`.

## 11. Remaining blockers / next commands

Still `not-tested` in this environment (unchanged from session 1; each is a
matrix cell in the authored CI, not a code gap):

1. **Linux x64/glibc, macOS arm64** — win32 host only. POSIX path/signal/
   process-group-kill and Linux non-recursive `fs.watch` rows are authored only.
2. **Node 22 / Node 24 LTS** — host is Node 26.7.0; forward-only.
3. **Firefox / WebKit** — only Chromium is in the Playwright cache.
4. **Native execution** — no N-API provider, no compiled `.node` fixture, no
   verified `node-gyp` toolchain. Registry + selection + failure model are
   tested (15/15 x3 runtimes); a real native call is not. `@obinexusltd/node-polycall`
   remains a *candidate* bridge — `inspectNodePolycall()` reads its metadata
   without importing it; qualifying it needs a compiled artifact + toolchain.
5. **CI execution** — the workflow is authored; only the local Windows
   Node/Deno/Bun + Chromium lanes have actually run.

Next commands to close the remaining cells (run on the appropriate runner):

```
node scripts/check-core-graph.mjs
npm run ci
node core/fixtures/pack-and-verify.mjs
node core/bench/run-bench.mjs --out core/bench/last-run.json
node --test core/obix-core-web/test/browser/dom.browser.mjs
```
