# OBIX core-compatibility — migration notes

## What changes

### New: `core/` workspace group

- `core/obix-core-<suffix>/` × 10, published as `@obinexusltd/obix-core-<suffix>`.
- Added to root `package.json` `workspaces`: `"core/*"`.
- New single version source `core/version.json` (`0.1.0`). Does **not** touch
  `OBIX_VERSION` (`0.2.1`) or `suite/SUITE_VERSION` (`0.3.0`).
- New gate script `scripts/check-core-graph.mjs` (graph acyclicity, allowed
  edges, naming, exact internal pins, `sideEffects`, declaration emit). Wired
  into `scripts/ci.mjs` as an additional gate; the frozen gates are unchanged.

### Changed: `@obinexusltd/obix` (`runtime/obix`) — the amendment

`runtime/obix/package.json` gains, additively:

```jsonc
{
  "bin": { "obix": "./dist/bin/obix.js" },
  "exports": {
    ".":            { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./cli":        { "types": "./dist/cli/index.d.ts", "import": "./dist/cli/index.js" },
    "./src":        "./src/index.ts",
    "./package.json": "./package.json"
  },
  "dependencies": {
    "@obinexusltd/obix-adapter-data":     "0.3.0",
    "@obinexusltd/obix-adapter-func":     "0.3.0",
    "@obinexusltd/obix-adapter-oop":      "0.3.0",
    "@obinexusltd/obix-adapter-reactive": "0.3.0",
    "@obinexusltd/obix-adapter-ssr":      "0.3.0",

    "@obinexusltd/obix-core-capabilities": "0.1.0",
    "@obinexusltd/obix-core-modules":      "0.1.0",
    "@obinexusltd/obix-core-filesystem":   "0.1.0",
    "@obinexusltd/obix-core-process":      "0.1.0",
    "@obinexusltd/obix-core-scheduler":    "0.1.0",
    "@obinexusltd/obix-core-streams":      "0.1.0",
    "@obinexusltd/obix-core-workers":      "0.1.0",
    "@obinexusltd/obix-core-native":       "0.1.0",
    "@obinexusltd/obix-core-web":          "0.1.0",
    "@obinexusltd/obix-core-diagnostics":  "0.1.0"
  }
}
```

- `./dist/bin/obix.js` is a **shim** (`src/bin/obix.ts`, `#!/usr/bin/env node`):
  it imports `runCli` from `../cli/index.js` and sets
  `process.exitCode = await runCli(process.argv.slice(2))` — **not**
  `process.exit()`, so buffered stdout/stderr flush before the process ends
  (the `--json` document is always fully written). No other logic.
- `./dist/cli/index.js` is the **one** command implementation. It exports
  `runCli(argv, io?): Promise<number>` (with an optional injectable IO seam for
  tests) and an internal lazy provider registry
  (`src/cli/registry.ts`) of `() => import("@obinexusltd/obix-core-…")` thunks —
  `--help` / `--version` import **no** core package; `doctor` imports only
  `diagnostics` + what each check needs; the `/node` subpaths that spawn or start
  workers load only on `--deep` / `--require`.
- `runtime/obix/tsconfig.json` gains `"lib": ["ES2022","DOM","DOM.Iterable"]` and
  `"types": ["node"]` (the CLI uses `node:*` and Web types). The library sources
  do not depend on these additions.
- The `.` (library) export of `@obinexusltd/obix` is **unchanged** — same
  `index.js` / `index.d.ts`, same runtime composition API. Verified this session:
  `Object.keys(import("@obinexusltd/obix"))` is still exactly
  `ComplianceError, Data, Func, OOP, Reactive, SSR, checkCompliance, defineComponent`
  and the existing 5 `runtime/obix` tests still pass.

### Not changed

- The frozen `packages/*` graph (20 packages, `v0.2.1`), including
  **`obix-cli` / `obixc`**. `obixc` stays the compiler-orchestration binary.
- `suite/*` (`obixjs@0.3.0`, `obix-core@0.3.0`, `obix-test@0.3.0`).
- `.obix` language, canonical component types, action-fold semantics, state
  ownership, independent reference evaluation, mandatory accessibility gates.
- Existing application/browser imports gain **no** host-only execution deps —
  the `core/*` host code is imported only by `@obinexusltd/obix/cli`, lazily.

## Two binaries, on purpose

| Binary | Package | Purpose |
|--------|---------|---------|
| `obixc` | `obix-cli` (frozen `packages/*`, `0.2.1`) | Compile `.obix` → `.mjs` + IR, contract verify, equivalence. Unchanged. |
| `obix` | `@obinexusltd/obix` (`runtime/obix`, `0.3.x`) | Host compatibility + `doctor`, build/watch **orchestration** (delegates compilation to the project-local compiler via `obix-core-process`). New. |

`obix build` never re-implements compilation — it resolves and runs the
project-local `obixc` / `tsc` as a child process.

## Historical `CLI` re-export

Research §"Published packages" notes the *published* `@obinexusltd/obix@0.1.0`
`dist/index.js` **statically re-exported a `CLI`** alongside UI subsystems. This
checkout's `runtime/obix/src/index.ts` does **not** — **verified this session**,
the `.` export carries no `CLI` symbol, and this amendment does not add one to
`.` (the command lives at the `./cli` subpath instead). If a `CLI` re-export is
ever reintroduced on `.` it must be a **named** export that lazy-loads
(`export async function CLI(argv) { return (await import("./cli/index.js")).runCli(argv); }`),
so importing `@obinexusltd/obix` for its library API never pulls host code.
Removing/relocating a public `CLI` symbol is a **breaking change** and must ship
with a deprecation note in the umbrella README + a major/minor bump of
`@obinexusltd/obix`, not a silent deletion.

## Consumer-visible commands

```sh
npm exec --package=@obinexusltd/obix -- obix --help          # arg parsing only
npm exec --package=@obinexusltd/obix -- obix --version       # umbrella + core family
npm exec --package=@obinexusltd/obix -- obix doctor          # human report, stderr
npm exec --package=@obinexusltd/obix -- obix doctor --json   # one JSON doc, stdout
npm exec --package=@obinexusltd/obix -- obix doctor --deep   # + real spawn + worker
npm exec --package=@obinexusltd/obix -- obix doctor --require native   # exit 1 if unmet
```

Existing supported subcommands of `obixc` are retained on `obixc`. `obix`
subcommands that orchestrate the compiler forward to it.

## Verification of the amendment

`core/fixtures/pack-and-verify.mjs` is the proof: it `npm pack`s the ten core
packages + the amended umbrella, `npm install`s the tarballs into a clean
directory **outside** the workspace (adapters resolve from the public registry),
and asserts that `node_modules/.bin/obix` runs `obix doctor --json` to a single
`ok:true` document on Node, Deno and Bun, that every core entrypoint + `.d.ts`
loads, that a plain-JS and a separately type-checked TS consumer both work, and
that basic `doctor` opens no DOM and no native library. It **passed** this
session on Windows x64 / Node 26.7.0.

## Rollback

The amendment is additive to one manifest + one tsconfig + new `core/` dirs + one
new gate script. Rollback = revert `runtime/obix/package.json` and
`runtime/obix/tsconfig.json`, delete `runtime/obix/src/{bin,cli}` +
`runtime/obix/test/cli.test.mjs`, delete `core/`, remove the `check-core-graph`
gate line from `scripts/ci.mjs`, drop `"core/*"` from root `workspaces`. No
frozen-track or suite change to undo.
