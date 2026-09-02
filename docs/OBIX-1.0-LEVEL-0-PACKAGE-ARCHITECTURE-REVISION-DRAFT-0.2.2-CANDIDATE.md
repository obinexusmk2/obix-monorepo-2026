# OBIX 1.0 — Level 0 Package Architecture Revision
## Draft 0.2.2 Candidate

| | |
|---|---|
| Document | Level 0 Package Architecture Revision |
| Supersedes | *OBIX 1.0 Draft 0.2.1 Package Architecture & Problem Analysis* (28 Aug 2026) |
| Amends | Draft 0.2.1 Amendment §C, AM-1.1, AM-5.1–5.5; incorporates Addendum A (Timer terminal semantics) |
| Date | 28 August 2026 |
| Author | OBINexus Computing — Nnamdi Michael Okpala |
| Status | Candidate — implemented, CI-green, pending freeze sign-off |
| Language / fixture status | **FROZEN** (Level 0). This document does not change the language. |

---

## 1. Executive decision

The frozen OBIX language is implemented as **exactly twenty public npm packages** under the
`obix-*` family, developed in one npm-workspaces monorepo, released in
**lockstep** at a single version (`0.2.1`, from the `OBIX_VERSION` file).

The 0.2.1 problem analysis recommended *"do not freeze the package graph"* on the strength of
four open critical/high problems (1 — equivalence meta-circularity, 2 — runtime budget, 4 —
version skew, 5 — optional accessibility). **All four are now closed and each is guarded by a
CI acceptance gate.** The remaining ten problems are either resolved, reduced to Level-1
scope, or rejected as non-blocking. The package **count** was never the risk; the **coupling**
was, and the coupling is now enforced structurally (an acyclic dependency graph checked in CI)
rather than by convention.

Two points of method:

* **Distribution boundaries and module boundaries are different things.** Twenty *distribution*
  units is a governance decision. What makes the graph safe is that the *module* boundaries
  inside it are strict: one canonical type package, one shared execution primitive, one
  independent semantic oracle strictly below the adapters, one scope-token function.
* **We did not accept every mitigation the draft proposed.** Splitting `obix-validator` into
  two packages, splitting `obix-equivalence` into two, adding a `quiesces` language feature, shipping
  unscoped mirror packages, and relying on `package.json` `"browser"` field substitution were
  all **rejected** — each adds surface or hides a dependency rather than removing a coupling.

**Verdict (see §25): FREEZE PACKAGE GRAPH.**

### 1.1 On the minimal-surface question

The primary review question asked which boundaries are *necessary*. Answered on engineering
grounds alone, a smaller distribution surface is defensible: `obix`, `obix-compiler`,
`obix-runtime`, `obix-equivalence` (+ optionally `obix-spec`) as public packages, with parser,
semantic analyser, CSS scoper, accessibility analyser, adapters and the reference evaluator as
**private workspace modules**. That design and the twenty-package design provide the *same*
separation of concerns.

The project has fixed the distribution surface at twenty public packages as a governance and
ecosystem decision (independent installability of `obix-parser`,
`obix-adapter-*`, etc.). This document therefore takes twenty as a constraint and
concentrates on making every boundary in that graph load-bearing. Where a package is public
only because the count requires it (`obix-adapter-ssr`, `obix-language-server` are minimal at
Level 0), that is stated plainly in §18.

---

## 2. Review of all 14 identified problems

Each entry: the diagnosis verdict, then the **as-built** solution (which is sometimes *not*
the mitigation the 0.2.1 draft proposed).

### Problem 1 — Adapter-equivalence meta-circular dependency — **ACCEPT**

The diagnosis is correct: if the packages that prove correctness are the packages under
proof, a symmetric bug passes silently.

**As-built solution — an independent oracle, not a package split.**
`obix-validator` owns `referenceFold(artifact, initialState, props, trace)`.
It depends on `obix-spec` and `obix-ir` **only** — it imports no adapter, and it does not call
`obix-ir.applyAction` or `obix-ir.replayTrace`. It re-implements the fold directly:

```
let current = initialState
for each [name, payload] in trace:
    current = artifact.actions[name](current, payload, props)   // canonical, direct
```

`obix-equivalence` imports the four pure adapters and compares **each** projection to the
oracle, step by step, for state / render / validation. Adapters are never compared only to
each other. The oracle and the adapters share no code, so a bug in the shared adapter
primitive cannot also be in the thing that judges it.

*Rejected mitigation:* splitting `obix-validator` into `-core` + `-equivalence`. It adds a
package and does not improve isolation beyond "the oracle imports no adapter", which a single
package already guarantees and CI enforces (a source scan + a `package.json` dependency
assertion in `obix-validator`'s test).

**Gate:** GATE 5 (`scripts/run-equivalence.mjs`) + `obix-validator` self-tests.

### Problem 2 — 4 KB runtime budget threatened by package boundaries — **MODIFY**

The premise is real for `--runtime=inline` (per-component wrapper overhead) but not for
`linked`, and the proposed fix (merge `obix-runtime` + `obix-effects`) is not taken —
`obix-effects` remains its own public package.

**As-built solution — budget the bundle, not the wrapper.**
`obix-runtime` has **zero dependencies**, `"sideEffects": false`, and every DOM
access lives inside a function body (importing the module runs no DOM code). The budget is
measured by `scripts/check-runtime-budget.mjs`: esbuild-bundle → minify → gzip.

Measured now: **runtime core 473 B / 4096 B; Timer inline-helper subset 376 B / 6144 B** —
~88 % headroom. `obix-effects` is pulled only by the reactive adapter's *effects* path; the
Timer inline subset does not include it.

**Gate:** GATE 8.

### Problem 3 — `@obinexusltd` scope / distribution lock-in — **REJECT (as a blocker)** — *later reversed*

The scope was, at the time of this draft, an intentional governance decision. It was defined in
exactly one place in tooling (`scripts/graph.mjs` `SCOPE`), so a re-scope was a one-constant
change plus a workspace re-link, not an edit to twenty import graphs — and that is exactly what
was later done. **Post-0.2.2 the packages were de-scoped to bare `obix-*`** (`SCOPE = ""`),
`@obinexusltd/obix-test` was renamed `obix-equivalence` to free the bare name for the
0.3.0 suite, and every internal import was rewritten by a mechanical pass. Every package is
still MIT, `publishConfig.access: "public"`, and carries `repository.directory`. Not a Level 0
architectural risk either way.

### Problem 4 — Version synchronisation across twenty packages — **ACCEPT**

**As-built solution — lockstep, enforced.**
One `OBIX_VERSION` file at the repo root. All twenty `package.json` `version` fields equal it.
Every internal `obix-*` dependency pins the **exact** version — no `^`, `~`, `>=`,
`*`, or `workspace:*`. `scripts/check-obix-versions.mjs` fails CI with **`OBIX-C011`** on any
drift, in either `version` or any dependency spec. A lighter mechanism than a published
`obix-versions.json` matrix; the file + the check are the matrix.

**Gate:** GATE 3.

### Problem 5 — Accessibility becoming optional because it is separate — **ACCEPT**

**As-built solution — Design B behaviour via Design A packaging.**
`obix-accessibility` stays a separate public package (keeps the twenty-graph and
lets other tooling consume a11y analysis), **but** `obix-compiler` declares it as
a **normal `dependencies` entry** — not `peerDependencies`, not `optionalDependencies`.
`analyzeA11y` runs *before* emit; `hasBlockingA11yError(diagnostics)` makes `compile()` return
`{ ok: false }` with **no `code`**. There is no `--no-a11y` switch in the CLI and no option on
`compile()` that skips it. Public experience: `npm install obix-compiler` ⇒
accessibility checks are present.

**Gate:** GATE 7 (`scripts/check-a11y-required.mjs`) — asserts the dependency kind, that the
built compiler bundle transitively contains `obix-accessibility`, and that a template with an
invalid `aria-live` yields `ok:false` + an `OBIX-A*` diagnostic + no code.

### Problem 6 — Inline runtime duplication — **MODIFY**

Diagnosis accepted; Level 0 does not need the remedy. `EmitMode` is
`"linked" | "bare" | "inline" | "shared-inline"`. `linked` and `bare` are implemented.
`inline` and `shared-inline` are **scaffolded, not faked** — requesting them throws
`UnsupportedFeatureError(feature, requiredLevel: 1)`. Chunk-boundary markers for
`shared-inline` are a Level 1 item (§19).

### Problem 7 — Strict template grammar not sealed across the parser boundary — **ACCEPT (mechanism MODIFIED)**

**As-built solution — structural validation is the seal.**
`obix-spec.validateObixAST(ast)` is the gate. `obix-parser` runs it after parsing; `obix-compiler`
runs it again on whatever AST it is handed (first- or third-party). A parser that emits a
malformed tree is rejected before semantic analysis. No signatures, no cryptography —
"conformance seal" means *semantic structural validation* (Draft 0.2.1's `OBIX-F020` maps to
`OBIX-P*` / `OBIX-S005` here).

### Problem 8 — Props threading invariant spread across adapters — **ACCEPT**

**As-built solution — one primitive, tested once.**
`obix-ir.applyAction(artifact, state, actionName, payload, props)` is the single place any
adapter invokes a business action, always as `actions[name](state, payload, props)`. Data,
Functional, OOP, Reactive and Native all route through it. It is unit-tested in `obix-ir`.

*Rejected mitigation:* "generate the adapter call sites from the compiler." That produces four
copies of adapter source per compiled component — explicitly disallowed. One shared primitive
+ one independent oracle (Problem 1) gives shared semantics *and* independent verification.

### Problem 9 — Effect quiescence coupled to component semantics — **MODIFY (the diagnosis)**

The scheduler does **not** need Model A / Model B knowledge. `obix-effects`
re-evaluates the declared `while(state, props)` predicate after each tick and clears its own
interval when the predicate is false. Component actions decide when that happens.

Two consequences: (a) **No `quiesces` language feature** — Addendum A withdrew the compound
`while` predicate, and adding a hint would re-introduce the coupling it removed. (b) The
scheduler **arms every registered interval unconditionally** and the tick callback self-clears;
an effect armed before its start condition becomes true still runs. Timer's
`while: ({ running }) => running` quiesces by itself once `Tick` sets `running: false` at the
limit (Addendum A, Model B refined).

### Problem 10 — CSS scope token drift — **ACCEPT**

**As-built solution.** `createScopeToken(componentName, sourcePath?)` (FNV-1a/32, hex,
deterministic, dependency-free) lives in `obix-spec`. `obix-styles`, `obix-compiler`, the
native emitter and the SSR emitter all import that one function; `obix-styles` re-exports it so
there is a single import site. A test asserts
`obix-styles.createScopeToken === obix-spec.createScopeToken`.

### Problem 11 — Test DSL mixing runtime and contract concerns — **MODIFY**

Diagnosis accepted (the graph is heavy); the fix is **not a 21st package**. `obix-equivalence`
is one package with internal modules `src/equivalence/`, `src/behavioural/`, `src/contracts/`,
`src/virtual-time/`, surfaced as **subpath exports**
(`obix-equivalence/behavioural`, …) so a browser bundler can later pull only the light
part. Virtual time is `obix-effects.createVirtualClock` (already in the graph via the reactive
adapter), not a re-implementation.

### Problem 12 — TypeScript declaration drift — **ACCEPT**

**As-built solution.** `obix-spec` is the one canonical type source; every other
package imports `DOPArtifact`, `ActionSignature`, `DerivedSignature`, `TemplateDescriptor`,
`BindingDescriptor`, `EffectDescriptor`, `A11yModel`, `TransitionMeta`, `ValidationResult`,
`DopIR`, … from it and **redefines none of them**. `.d.ts` is emitted from that TypeScript
source (`declaration: true`). **No IDL generator** — it would not reduce maintenance at this
size, and the dependency graph already forces every package through `obix-spec`.

### Problem 13 — Golden fixture is both test and distribution — **ACCEPT (form MODIFIED)**

`obix-timer` remains public. Fixture identity is **separate metadata inside the
package**: `FIXTURE_VERSION = "draft-0.2.1-addendum-a"`, `FIXTURE_CHECKSUM` (sha256 of the
LF-normalised `Timer.obix`), an immutable snapshot directory
`fixtures/draft-0.2.1-addendum-a/` with its own `CHECKSUM`, and a git tag at the freeze point.
The npm `version` follows lockstep OBIX; the *fixture* is identified by tag + spec version +
checksum, never by ordinary product semver. `verifyFixture()` and a test recompute and assert
the checksum. `obix-timer` is a **leaf** — the cycle checker enforces that nothing depends on
it.

### Problem 14 — SSR accidentally pulling DOM code — **ACCEPT**

**As-built solution — a graph property, not a `package.json` trick.**
`obix-adapter-ssr` depends on `obix-spec` and `obix-ir` **only**; it may not
depend on `obix-runtime`, `obix-adapter-native` or `obix-adapter-reactive`. Its tsconfig has
**no `DOM` lib**, so DOM identifiers do not even type-check there. `scripts/check-ssr-purity.mjs`
(GATE 9) esbuild-bundles it for a neutral platform and fails on any `window` / `document` /
`HTMLElement` / `Element.prototype` / `addEventListener` token or any forbidden transitive
import. No `"browser": "./empty.js"` substitution anywhere.

### 2.1 Summary table

| # | Problem | Verdict | Mechanism (as built) | Gate |
|---|---|---|---|---|
| 1 | Equivalence meta-circularity | ACCEPT | `referenceFold` oracle in `obix-validator`, zero adapter imports | 5 |
| 2 | Runtime budget vs boundaries | MODIFY | budget the tree-shaken bundle; runtime is 0-dep | 8 |
| 3 | Scope lock-in | REJECT (blocker) | governance decision; single `SCOPE` constant | — |
| 4 | Version skew | ACCEPT | `OBIX_VERSION` + exact pins + `OBIX-C011` | 3 |
| 5 | Optional accessibility | ACCEPT | normal `dependencies` edge compiler→a11y; no `--no-a11y` | 7 |
| 6 | Inline duplication | MODIFY | modes typed; `inline`/`shared-inline` throw at Level 0 | — |
| 7 | Parser strictness | ACCEPT (mech.) | `validateObixAST` structural seal, run twice | 1,11 |
| 8 | Props threading | ACCEPT | one `applyAction` primitive, tested in `obix-ir` | 5 |
| 9 | Effect quiescence | MODIFY (dx) | scheduler re-checks `while`; no `quiesces` feature | 6 |
| 10 | Scope token drift | ACCEPT | `createScopeToken` in `obix-spec`, one import site | pkg tests |
| 11 | Test DSL weight | MODIFY | one package, internal modules + subpath exports | — |
| 12 | TS declaration drift | ACCEPT | `obix-spec` sole type source; no IDL generator | 1,10 |
| 13 | Fixture mutability | ACCEPT (form) | `FIXTURE_VERSION`/`FIXTURE_CHECKSUM` + git tag + snapshot | 6 |
| 14 | SSR pulls DOM | ACCEPT | graph separation + no DOM lib + bundle scan | 9 |

---

## 3. Accepted / rejected / modified — at a glance

* **ACCEPT (diagnosis stands, solved):** 1, 4, 5, 8, 10, 12, 14
* **ACCEPT (diagnosis stands, mechanism changed from the draft):** 7, 13
* **MODIFY (diagnosis narrowed or re-framed):** 2, 6, 9, 11
* **REJECT as a blocker:** 3

**Draft mitigations explicitly not adopted:** split `obix-validator` (P1); merge
`obix-runtime`+`obix-effects` (P2); unscoped mirror packages (P3); `obix-versions.json` as a
separate artifact (P4 — replaced by the `OBIX_VERSION` file + check); generate adapter call
sites from the compiler (P8); `quiesces` hint (P9); split `obix-equivalence` (P11); IDL/code
generator for `.d.ts` (P12); `"browser"` field substitution for SSR purity (P14).

---

## 4. Revised public package list

All twenty are `private: false`, `publishConfig.access: "public"`, `type: "module"`,
`sideEffects: false`, `version` = `0.2.1`, `engines.node` `>=20.11.0`.

| # | Package | One-line purpose | Level 0 depth |
|---|---------|------------------|---------------|
| 01 | `obix-spec` | canonical types, structural contracts, `createScopeToken`, `validateObixAST` | full |
| 02 | `obix-ir` | `createDOP`, `applyAction`, freeze/diff helpers | full |
| 03 | `obix-parser` | section scanner + strict template/script parse + `validateObixAST` | full (Level 0 grammar) |
| 04 | `obix-compiler` | source → AST → DOP IR → ES6 emit; **hard** a11y dep | Level 0 subset |
| 05 | `obix-template` | binding + event descriptor analysis (pure) | full |
| 06 | `obix-styles` | scoped CSS transform (one canonical token) | full (no SCSS) |
| 07 | `obix-adapter-data` | identity / data projection | full |
| 08 | `obix-adapter-func` | `reduce` / `replay` / `create` closure | full |
| 09 | `obix-adapter-oop` | generated class projection | full |
| 10 | `obix-adapter-reactive` | subscribers + `changedKeys` + effects lifecycle | full |
| 11 | `obix-adapter-native` | DOM mount (the only DOM adapter) | Level 0 subset |
| 12 | `obix-adapter-ssr` | DOM-free `renderToString` | minimal (renderToString only) |
| 13 | `obix-runtime` | browser binding runtime, ≤ 4 KB gzip | full |
| 14 | `obix-effects` | scheduler primitives (`every` operational) | `every` only |
| 15 | `obix-validator` | validation + **independent `referenceFold` oracle** | full |
| 16 | `obix-equivalence` | adapter-equivalence orchestration + DSL parsers | full |
| 17 | `obix-accessibility` | compile-time a11y analysis (mandatory compiler dep) | Level 0 subset |
| 18 | `obix-cli` | `obixc build\|check\|test\|verify\|equivalence` | Level 0 subset |
| 19 | `obix-language-server` | diagnostics / completion / hover / definition | diagnostics complete, rest minimal |
| 20 | `obix-timer` | frozen golden fixture | full, frozen |

---

## 5. Revised private / internal workspace list

**None.** Under the fixed twenty-public-package constraint there are no separately-versioned
private workspace packages. "Internal boundaries" are realised as **source modules inside the
public packages**, e.g.:

```
obix-parser/src/{scan-sections,parse-template,parse-script,parse-styles}.ts
obix-compiler/src/{compile,ir,emit}.ts
obix-equivalence/src/{equivalence,behavioural,contracts,virtual-time}/
obix-adapter-reactive/src/… (effects lifecycle isolated from the pure dispatch path)
```

Repo tooling that is *not* published lives at the root and is not a package:

```
scripts/   OBIX_VERSION   tsconfig.base.json   docs/
```

*(Had the surface not been fixed at twenty, the private list would have held: `parser`,
`semantic-analyser`, `css-scoper`, `accessibility-analyser`, `adapters` (as one module),
`reference-evaluator`, `emit`, `dsl` — see §1.1. That option is documented but not taken.)*

---

## 6. Exact dependency graph

`A → B` means *A declares B in `dependencies`* (exact-version pin). This is the entire internal
edge set; it is the canonical graph in `scripts/graph.mjs` and CI asserts the `package.json`
files match it exactly.

```
obix-spec        → (nothing)
obix-runtime     → (nothing)

obix-ir          → obix-spec
obix-parser      → obix-spec
obix-template    → obix-spec
obix-styles      → obix-spec
obix-effects     → obix-spec

obix-validator   → obix-spec, obix-ir
obix-accessibility → obix-spec, obix-template

obix-adapter-data       → obix-spec, obix-ir
obix-adapter-func → obix-spec, obix-ir
obix-adapter-oop        → obix-spec, obix-ir
obix-adapter-reactive   → obix-spec, obix-ir, obix-effects
obix-adapter-ssr        → obix-spec, obix-ir
obix-adapter-native     → obix-spec, obix-ir, obix-adapter-reactive, obix-runtime

obix-compiler    → obix-spec, obix-ir, obix-parser, obix-template, obix-styles,
                   obix-accessibility, obix-validator

obix-equivalence        → obix-spec, obix-ir, obix-validator,
                   obix-adapter-data, obix-adapter-func,
                   obix-adapter-oop, obix-adapter-reactive

obix-cli             → obix-compiler, obix-equivalence, obix-validator
obix-language-server → obix-spec, obix-parser, obix-template, obix-compiler

obix-timer       → obix-spec, obix-ir,
                   obix-adapter-data, obix-adapter-func,
                   obix-adapter-oop, obix-adapter-reactive
```

Topological order (Kahn, deterministic tie-break by name), as printed by
`scripts/check-cycles.mjs`:

```
obix-runtime → obix-spec → obix-effects → obix-ir → obix-adapter-data →
obix-adapter-func → obix-adapter-oop → obix-adapter-reactive →
obix-adapter-native → obix-adapter-ssr → obix-parser → obix-styles →
obix-template → obix-accessibility → obix-timer → obix-validator →
obix-compiler → obix-language-server → obix-equivalence → obix-cli
```

**Cycles: 0.** (`scripts/check-cycles.mjs`, GATE 4.)

---

## 7. Dependency-direction rules

Machine-checked by `scripts/check-graph-rules.mjs` against the real `package.json` files (23
rules, all currently pass):

1. `obix-spec` depends on nothing.
2. `obix-runtime` has no semantic/compiler dependency (zero deps).
3. `obix-ir` does not depend on `obix-compiler`.
4. `obix-parser` depends on **no adapter**.
5. `obix-validator` depends on **no adapter**, and not on `obix-equivalence`.
6. **No adapter** depends on `obix-validator`, `obix-equivalence`, or `obix-compiler`.
7. `obix-runtime` does not depend on `obix-compiler`.
8. `obix-effects` does not depend on `obix-adapter-reactive`.
9. `obix-adapter-ssr` does not depend on `obix-adapter-native`, `obix-runtime`, or
   `obix-adapter-reactive`.
10. `obix-accessibility` does not depend on `obix-compiler`; `obix-compiler` **does** depend on
    `obix-accessibility` and on `obix-validator`.
11. `obix-equivalence` depends on the four **pure** adapters and **not** on `obix-adapter-native`.
12. `obix-cli` depends on `obix-compiler` and `obix-equivalence`.
13. `obix-language-server` depends on `obix-parser` and `obix-compiler`.
14. `obix-timer` is a **leaf**: nothing depends on it, and it is never a dependency of the
    compiler, runtime, or any adapter.
15. Accessibility analysis occurs **before** emit.
16. The reference evaluator (`referenceFold`) does not depend on any adapter.

Direction summary: `spec/types → parser → semantic compiler → DOP artifact → adapters/runtime`,
with `test/equivalence` allowed to depend on adapters but never the reverse.

---

## 8. Independent reference evaluator design

**Owner:** `obix-validator` (deps: `obix-spec`, `obix-ir` — **below** the
adapters in the graph).

```ts
referenceFold(artifact, initialState, props, trace) → {
  finalState,                 // state after the whole trace
  history:     S[],           // history[0] = initialState; history[i] = after trace[i-1]
  renders:     (string|undefined)[],      // artifact.render(history[i], props), if present
  validations: (ValidationResult|undefined)[]  // artifact.validate(history[i], props)
}
```

Constraints, enforced by a source scan and a `package.json` assertion in the package's own
tests:

* imports **no** `obix-adapter-*`;
* calls **no** `obix-ir.applyAction`, **no** `obix-ir.replayTrace`, **no**
  `toData/toFunctional/toOOP/toReactive`;
* folds by invoking `artifact.actions[name](current, payload, props)` directly.

The duplication of the fold is deliberate — it is the whole mechanism. The validator **defines
the expected result**; `obix-equivalence` tests the adapters against it.

---

## 9. Adapter Equivalence architecture

**Owner of the shared execution primitive:** `obix-ir`.

```ts
applyAction(artifact, state, actionName, payload, props)
  → artifact.actions[actionName](state, payload, props)   // the ONLY adapter-side invocation shape
```

Every adapter (`data`, `functional`, `oop`, `reactive`, `native`) routes transitions through
`applyAction`. No adapter threads arguments differently; there is never a second implementation
of an action; the compiler never emits four copies of adapter source.

**Owner of the orchestration:** `obix-equivalence`.

```
expected = obix-validator.referenceFold(artifact, initialState, props, trace)

for adapter in { Data, Functional, Functional.create, OOP, Reactive }:
    run adapter step by step over `trace`
    assert  adapter.state[i]      ≅ expected.history[i]        for every i
    assert  adapter.render[i]     ≅ expected.renders[i]        for every i   (where render exists)
    assert  adapter.validate[i]   ≅ expected.validations[i]    for every i   (where validate exists)

report { equivalent, stepWise, renderEqual, validationEqual, expected, oracleHistory, perAdapter, divergences }
```

Verified now (`scripts/run-equivalence.mjs`, GATE 5):

* `Start → Tick → Tick → Stop` ⇒ `{ seconds: 2, running: false }` — all five projections
  step-wise / render / validation equivalent to the oracle.
* Terminal `Start → Tick×8` (`limitSeconds 5`) ⇒ `{ seconds: 5, running: false }`,
  `finished = true`, `cannotStart = true`, `statusLabel = "Finished"` — equivalent.

The compiler's own emitted Timer module is run through the same `checkEquivalence` in
`obix-compiler`'s tests — the *compiled* artifact, not just the hand-written `TimerDOP`.

---

## 10. Runtime package design

**One runtime package** (`obix-runtime`) with internal modules only conceptually
(the Level 0 surface is small enough to be one file). Public surface:

```
bindText · bindAttr · bindBool · bindAria · bindPresence · bindEvent · createBindingGroup
```

Rules: no business logic, no component model, no VDOM, no router, no DI, no store. Zero
dependencies (not even `obix-spec` at runtime — local minimal types). `"sideEffects": false`.
Every DOM access is inside a function body, so an unused helper is fully tree-shaken.

`obix-effects` is a **separate** package (not merged): scheduler + `every` +
`createVirtualClock`. It is not on the runtime's critical path — only the reactive adapter's
effects lifecycle imports it. `after` / `on` throw `UnsupportedFeatureError` at Level 0.

Budget enforcement: `scripts/check-runtime-budget.mjs` (GATE 8) esbuild-bundles → minifies →
gzips. Thresholds: runtime core ≤ 4096 B; Timer inline helper subset ≤ 6144 B. **Current:
473 B and 376 B.**

---

## 11. Accessibility integration strategy

**Design chosen: a hybrid of A and B.** `obix-accessibility` is a separate public
package (Design A packaging) that is a **mandatory, non-optional `dependencies` edge** of the
compiler (Design B behaviour).

* `obix-compiler` → `obix-accessibility` is a normal dependency (not `peer`, not `optional`).
* `analyzeA11y(templateDescriptor)` runs after binding analysis and **before** emit.
* `hasBlockingA11yError(diagnostics)` (any `severity: "error"` `OBIX-A*`) ⇒ `compile()` returns
  `{ ok: false }` with **no `code`**.
* No `--no-a11y` in `obixc`; no `skipA11y`-style option on `compile()`.
* Level 0 checks: `aria-live` validity, "will this live region ever announce?", `tabindex`
  sanity, accessible names on interactive elements, `<a>`-without-`href`, heading-hierarchy
  skips, unknown `role` / `aria-*`.
* **No runtime `announce()`** in this package — live-region updates are ordinary
  `obix-runtime` bindings.

`npm install obix-compiler` ⇒ accessibility checks are present. Guaranteed by
GATE 7, which also proves the compiler bundle transitively contains the package.

---

## 12. Parser / AST validation boundary

```
source
  → obix-parser.scanSections        (tolerates all top-level whitespace; flags duplicates)
  → obix-parser.parseTemplate       (strict OBIX grammar over a semantic-HTML vocabulary)
  → obix-parser.parseScript         (structural extraction of state/props/actions/derived/effects
                                     — NO JavaScript expression parsing)
  → obix-spec.validateObixAST(ast)  ← THE SEAL (structural, not cryptographic)
  → semantic AST → …
```

`validateObixAST` checks: PascalCase component name; `<template>` + `<script>` present; a
single root element; known node kinds; tag names in the Level 0 vocabulary; interpolation
expressions are identifiers / dotted paths; `on:` events name action identifiers; `script`
exposes `actionNames[]`. It returns violations, never throws. `obix-compiler` re-runs it on
whatever AST it is handed, so a third-party parser cannot feed a malformed tree past stage 2.
"Conformance seal" = this function. No signatures unless a concrete need arises (none at
Level 0).

---

## 13. Canonical type ownership

**Source of truth:** TypeScript source in `obix-spec` (`src/types.ts` +
`src/diagnostics.ts` + `src/version.ts` + `src/scope-token.ts`). `.d.ts` is emitted from it
(`declaration: true`, `declarationMap: true`).

Single definition of: `DOPArtifact`, `ActionFn`, `DerivedFn`, `ActionSignature`,
`DerivedSignature`, `EffectDescriptor`, `TemplateDescriptor`, `TemplateNode`,
`BindingDescriptor`, `EventDescriptor`, `A11yModel`, `TransitionMeta`, `ActionTrace`,
`SourceSpan`, `Diagnostic`, `ValidationResult`, `ValidationDescriptor`, `DopIR`, `EmitMode`,
`ObixAST`, `ObixScriptModel`, plus `SPEC_VERSION`, `LEVEL`, `DIAGNOSTIC_CODES`,
`UnsupportedFeatureError`, `createScopeToken`, `SCOPE_ATTR`.

No package redefines these; each imports them. **No IDL, no JSON Schema, no code generator** —
smallest system that keeps runtime validation (`validateObixAST`, `validateArtifactShape`) and
TS declarations aligned, because they are literally the same source.

---

## 14. Unified versioning strategy

* **`OBIX_VERSION`** (repo root, plain text) — the one version line. Currently `0.2.1`.
* All twenty `package.json` `version` fields = `OBIX_VERSION`.
* Every internal `obix-*` dependency = the **exact** `OBIX_VERSION` string. No
  ranges, no `*`, no `workspace:*`. npm workspaces still links locally because the local
  version satisfies an exact match.
* `.npmrc` sets `save-exact=true`.
* `scripts/check-obix-versions.mjs` (GATE 3) fails with **`OBIX-C011`** on any `version` drift
  or any non-exact / mismatched internal dependency spec.
* Releases are lockstep: bump `OBIX_VERSION`, run a rewrite across the twenty `package.json`
  files, `npm run ci`, then `scripts/publish-all.mjs --yes` (dependency-safe order).
* Public packages: all twenty. Private packages: none. No npm release is created for a folder
  that is not a package (`scripts/`, `docs/`).

---

## 15. Golden fixture location / version strategy

* **Location:** inside `obix-timer` —
  `packages/obix-timer/fixture/{Timer.obix, Timer.test.obix, Timer.obix.test}` (the working
  copy) and `packages/obix-timer/fixtures/draft-0.2.1-addendum-a/` (the **immutable snapshot**
  + `CHECKSUM`).
* **Identity (not product semver):**
  * `FIXTURE_VERSION = "draft-0.2.1-addendum-a"`
  * `FIXTURE_CHECKSUM = sha256(LF-normalised Timer.obix)` — currently
    `d0d7166c3ba19c45f84d0642cc1a19a1a5427d2d4957281d515038cf9e1b023c`
  * a **git tag** at the freeze point (`fixture/draft-0.2.1-addendum-a`)
* **npm `version`:** follows lockstep OBIX (`0.2.1`) like every other package. A future
  non-fixture change bumps the npm version without touching `FIXTURE_VERSION` /
  `FIXTURE_CHECKSUM`.
* `verifyFixture()` + `computeFixtureChecksum()` are exported; a package test recomputes and
  asserts. `.gitattributes` pins `*.obix` / `*.test` to `eol=lf` so the checksum is
  platform-stable.
* **Leaf guarantee:** nothing in compiler / runtime / adapters depends on `obix-timer`
  (graph rule 14).

---

## 16. SSR dependency-purity strategy

* **Graph:** `obix-adapter-ssr` → `obix-spec`, `obix-ir` only. Forbidden edges:
  `obix-runtime`, `obix-adapter-native`, `obix-adapter-reactive` (graph rule 9).
* **Types:** its tsconfig omits the `DOM` lib, so `window`/`document`/`HTMLElement`/`Element`/
  `Node` do not type-check in that package.
* **Bundle scan:** `scripts/check-ssr-purity.mjs` (GATE 9) esbuild-bundles it `platform:
  "neutral"` and fails on any `window` / `document` / `HTMLElement` / `Element.prototype` /
  `addEventListener` / `customElements` / `MutationObserver` token, or any transitive input
  from a forbidden package. A package-source test repeats the token scan on `dist/index.js`.
* **No `package.json` tricks** — no `"browser"` field, no conditional `"node"`/`"browser"`
  exports pointing at an empty module. Purity is structural.
* **Placement:** SSR lives in its own public package (`obix-adapter-ssr`), *not* folded into
  `obix-compiler` emitters or a top-level `obix` — so a Node-only consumer imports it without
  the compiler graph. Level 0 exposes `renderToString` only; `renderToStream` throws
  `UnsupportedFeatureError(…, 1)`.

---

## 17. Runtime size-budget enforcement

`scripts/check-runtime-budget.mjs`, wired into `npm run ci` as GATE 8:

1. esbuild-bundle `packages/obix-runtime/dist/index.js` (`bundle`, `minify`, `format: esm`,
   `platform: browser`, `treeShaking: true`), gzip level 9 → assert **≤ 4096 B**.
2. Bundle only the Timer-relevant helpers (`bindText`, `bindAttr`, `bindBool`, `bindAria`,
   `bindEvent`, `createBindingGroup`) → assert **≤ 6144 B** (the "simple Timer inline helper
   subset" from Problem 2).

Measured at time of writing: **473 B** and **376 B**. The measurement is on the *bundle*, never
on npm wrapper text; keeping `obix-effects` a separate package does not change either number.

---

## 18. Level 0 implementation packages only

Operational at Level 0 (real code, not stubs):

```
obix-spec  obix-ir  obix-parser  obix-template  obix-styles  obix-compiler
obix-adapter-data  obix-adapter-func  obix-adapter-oop  obix-adapter-reactive
obix-adapter-native  obix-runtime  obix-effects(every)  obix-validator  obix-equivalence
obix-accessibility  obix-cli  obix-timer
```

Minimal but building and exercised by tests:

* `obix-adapter-ssr` — DOM-free `renderToString` only.
* `obix-language-server` — `diagnostics()` is complete (compiler-backed); `completions` /
  `hover` / `definition` cover the Level 0 symbol surface; no LSP JSON-RPC transport bundled.

Every Level-1 entry point that exists as a typed API throws
`UnsupportedFeatureError { feature, requiredLevel, currentLevel }` rather than returning a
plausible-but-wrong result: `obix-effects.after/on`, `obix-adapter-ssr.renderToStream`,
`obix-compiler` emit modes `inline` / `shared-inline`.

---

## 19. Level 1 deferred modules

Deferred, and **not** given packages of their own now:

* template: loops, slots, composition, mixed (partial) attribute interpolation
* `obix-adapter-native`: hydration, keyed lists
* `obix-adapter-ssr`: streaming, hydration markers, critical-CSS extraction — full SSR
* `obix-styles`: SCSS
* `obix-effects`: `after`, `on`
* `obix-compiler`: `inline` / `shared-inline` emit + bundler chunk-boundary markers
* `obix-accessibility`: the full accessibility-contract runner
* `obix-equivalence`: a browser-only lightweight sub-bundle (the subpath exports already carve the
  seam)
* async requests, OBIXverse, Gradle / mobile packaging, legacy mass migration

Tiny internal APIs added now purely to avoid a future breaking change: `EmitMode` (all four
values typed); `DOPArtifact.template` / `.style` / `.a11y` optional fields;
`EffectDescriptor.kind` covering `after` / `on`; `obix-equivalence` subpath exports.

---

## 20. package.json workspace example

Root:

```json
{
  "name": "obix-monorepo",
  "version": "0.2.1",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "engines": { "node": ">=20.11.0" },
  "scripts": {
    "build": "node scripts/build-all.mjs",
    "test": "node scripts/run-tests.mjs",
    "test:equivalence": "node scripts/run-equivalence.mjs",
    "test:cycles": "node scripts/check-cycles.mjs",
    "test:runtime-budget": "node scripts/check-runtime-budget.mjs",
    "test:ssr-purity": "node scripts/check-ssr-purity.mjs",
    "check:versions": "node scripts/check-obix-versions.mjs",
    "pack:dry-run": "node scripts/pack-report.mjs",
    "ci": "node scripts/ci.mjs"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "esbuild": "^0.24.2",
    "typescript": "^5.7.2"
  }
}
```

A leaf package (`obix-adapter-func`):

```json
{
  "name": "obix-adapter-func",
  "version": "0.2.1",
  "type": "module",
  "private": false,
  "sideEffects": false,
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": { "build": "tsc -p tsconfig.json" },
  "dependencies": {
    "obix-spec": "0.2.1",
    "obix-ir": "0.2.1"
  },
  "publishConfig": { "access": "public" },
  "engines": { "node": ">=20.11.0" }
}
```

The CLI adds `"bin": { "obixc": "./dist/bin/obixc.js" }`. `obix-equivalence` adds subpath exports
(`./equivalence`, `./behavioural`, `./contracts`, `./virtual-time`). `obix-timer` adds
`"fixture"` and `"fixtures"` to `files` and an `"./Timer.obix"` export.

---

## 21. Root directory tree

```
obix/                                  ← monorepo root (npm workspace)
├── OBIX_VERSION                        ← "0.2.1" — the one version line
├── package.json                        ← private root, workspaces: packages/*
├── package-lock.json                   ← single lockfile
├── tsconfig.base.json                  ← NodeNext, ES2022, no DOM lib by default
├── tsconfig.json                       ← solution file (editor aggregate)
├── .npmrc                              ← save-exact=true
├── .gitattributes                      ← *.obix / *.test → eol=lf
├── .gitignore
├── LICENSE                             ← MIT
├── README.md
├── docs/
│   └── OBIX-1.0-LEVEL-0-PACKAGE-ARCHITECTURE-REVISION-DRAFT-0.2.2-CANDIDATE.md   ← this file
├── scripts/
│   ├── graph.mjs                       ← canonical graph + RULES + topoSort + findCycles
│   ├── _lib.mjs · mini-dom.mjs
│   ├── build-all.mjs · run-tests.mjs · clean.mjs · ci.mjs
│   ├── check-package-structure.mjs     ← GATE 1,2,10,12
│   ├── check-obix-versions.mjs         ← GATE 3 / OBIX-C011
│   ├── check-cycles.mjs                ← GATE 4
│   ├── check-graph-rules.mjs           ← direction rules
│   ├── run-equivalence.mjs             ← GATE 5
│   ├── run-timer-terminal.mjs          ← GATE 6
│   ├── check-a11y-required.mjs         ← GATE 7
│   ├── check-runtime-budget.mjs        ← GATE 8
│   ├── check-ssr-purity.mjs            ← GATE 9
│   ├── pack-report.mjs                 ← GATE 11,12
│   └── publish-all.mjs                 ← guarded; never run by CI
└── packages/
    ├── obix-spec/          {package.json, tsconfig.json, README.md, src/**, test/*.test.mjs}
    ├── obix-ir/            …
    ├── obix-parser/        …
    ├── obix-compiler/      …
    ├── obix-template/  obix-styles/
    ├── obix-adapter-data/  …-functional/  …-oop/  …-reactive/  …-native/  …-ssr/
    ├── obix-runtime/  obix-effects/
    ├── obix-validator/  obix-equivalence/  obix-accessibility/
    ├── obix-cli/  obix-language-server/
    └── obix-timer/         {…, fixture/, fixtures/draft-0.2.1-addendum-a/}
```

(A pre-existing unrelated category-folder checkout — `bindings/`, `runtime/`, `cli/`, … — sits
alongside on disk and is `.gitignore`d out of this repository; it is untouched.)

---

## 22. CI acceptance gates

`npm run ci` runs these in order and stops at the first failure. Current status: **all green.**

| Gate | Check | Script | Status |
|---|---|---|---|
| build | 20/20 packages compile (topological) | `build-all.mjs` | ✅ |
| GATE 1 | all 20 package directories exist | `check-package-structure.mjs` | ✅ |
| GATE 2 | all 20 named `obix-*` | `check-package-structure.mjs` | ✅ |
| GATE 3 | all 20 at one version; internal deps pinned exact (`OBIX-C011`) | `check-obix-versions.mjs` | ✅ |
| GATE 4 | zero dependency cycles; declared graph = canonical graph | `check-cycles.mjs` | ✅ |
| — | 23 dependency-direction rules | `check-graph-rules.mjs` | ✅ |
| — | 88 unit / package tests across 20 files | `run-tests.mjs` | ✅ |
| GATE 5 | adapter equivalence vs independent `referenceFold`, step-wise + render + validation | `run-equivalence.mjs` | ✅ |
| GATE 6 | Timer terminal semantics = Model B refined (Addendum A) | `run-timer-terminal.mjs` | ✅ |
| GATE 7 | compiler cannot build without a11y; a11y error blocks emit; no `--no-a11y` | `check-a11y-required.mjs` | ✅ |
| GATE 8 | runtime tree-shaken bundle ≤ 4 KB gzip (473 B); Timer subset ≤ 6 KB (376 B) | `check-runtime-budget.mjs` | ✅ |
| GATE 9 | SSR bundle: no DOM globals, no forbidden transitive import | `check-ssr-purity.mjs` | ✅ |
| GATE 10 | every package emits `dist/index.d.ts` | `check-package-structure.mjs` | ✅ |
| GATE 11 | `npm pack --dry-run` succeeds for every package | `pack-report.mjs` | ✅ |
| GATE 12 | no tarball ships `src/`, `test/`, `node_modules/`, `*.tsbuildinfo` | `pack-report.mjs` | ✅ |

---

## 23. Migration mapping from the current 20-package proposal

The distribution units are **unchanged** (same twenty names). What changed is coupling and
metadata.

| 0.2.1 draft item | 0.2.2 candidate |
|---|---|
| `SPEC_VERSION = "1.0.0-draft.0.2.1"` | `SPEC_VERSION = "0.2.1"`; one `OBIX_VERSION` file drives all 20 |
| Independent per-package versions / compatibility matrix (`obix-versions.json`) | lockstep; exact internal pins; `OBIX-C011` gate; no separate matrix artifact |
| `obix-validator` imports all adapters for `checkEquivalence` | `obix-validator` imports **no** adapter; owns `referenceFold` (the oracle); `obix-equivalence` owns `checkEquivalence` and imports the adapters |
| Proposed `obix-validator-core` + `obix-validator-equivalence` split | **not done** — one `obix-validator` |
| Proposed `obix-equivalence-runtime` + `obix-equivalence-contract` split | **not done** — one `obix-equivalence` with internal modules + subpath exports |
| `obix-accessibility` as compiler dep (kind unspecified) / `--no-a11y` conceivable | **normal `dependencies`** edge; `analyzeA11y` before emit; no `--no-a11y`; GATE 7 |
| `announce()` runtime helper in `obix-accessibility` | **removed**; live regions are ordinary `obix-runtime` bindings |
| `generateScopeToken` in `obix-styles` | **moved to `obix-spec`** as `createScopeToken`; `obix-styles` re-exports it |
| `createDOP` exported from `obix-runtime` | `createDOP` is in `obix-ir`; `obix-runtime` has **zero deps** and no artifact factory |
| `obix-runtime` depends on `obix-ir` | `obix-runtime` depends on **nothing** |
| `obix-adapter-ssr` depends on `obix-template` | depends on `obix-spec`, `obix-ir` only (tighter; still DOM-free) |
| SSR purity via `"browser"` / conditional exports | **graph separation + no DOM lib + bundle scan** (GATE 9) |
| Effect `quiesces: 'auto'|'manual'|'never'` hint | **not added**; scheduler re-checks `while`; compound predicate stays withdrawn |
| `obix-timer` versioned like any package; "freeze" ambiguous | npm `version` lockstep **plus** `FIXTURE_VERSION` + `FIXTURE_CHECKSUM` + immutable snapshot + git tag |
| `obix-timer` depends on `obix-adapter-native` + `obix-adapter-ssr` | depends on `obix-spec`, `obix-ir` + the four **pure** adapters only (stays a leaf; lighter) |
| Parser conformance seal `OBIX-F020` | `obix-spec.validateObixAST`, run by parser **and** compiler; codes `OBIX-P*` / `OBIX-S005` |
| `.d.ts` generated from an IDL schema | **not built**; `obix-spec` TS source is the single source; `.d.ts` emitted from it |
| Recommendation: *do not freeze the package graph* | **freeze** — Problems 1, 2, 4, 5 are closed and each gated (§25) |

No consumer-visible API of the DOP IR, the action signature, the adapters, or Adapter
Equivalence changed.

---

## 24. Risks still unresolved

1. **Level-1 emit modes unproven.** `inline` / `shared-inline` are typed and throw; the
   chunk-boundary contract with bundlers is undesigned. Risk that the eventual design forces a
   change to `emitModule`'s output shape. *Mitigation:* `EmitMode` already reserves the names;
   emitted modules are plain ESM with named + default exports, which is the most bundler-neutral
   shape.
2. **`parseScript` is structural, not a real JS parser.** It brace-matches top-level `const`
   declarations and re-emits the `<script>` verbatim. A component whose `<script>` uses unusual
   top-level forms (IIFEs, destructuring exports, TS syntax) is outside Level 0. *Mitigation:*
   the strict Level 0 subset is documented; a real parser (e.g. acorn) is a contained Level-1
   swap behind the same `ObixScriptModel`.
3. **`obix-language-server` has no transport.** It exposes pure functions; an editor extension
   must wire them to LSP JSON-RPC. Until that exists the package is "real but unused".
4. **Native adapter has no real-DOM integration test in CI.** It is tested against a minimal
   DOM shim (`scripts/mini-dom.mjs`). A `jsdom`/browser test is deferred with hydration to
   Level 1.
5. **`esbuild` is a build-time dependency of the gates.** GATE 8 and GATE 9 need it. It is a
   single dev dependency, pinned, `allowScripts`-approved for reproducibility; if it were
   unavailable the size/purity gates could not run (the graph rule for SSR still would).
6. **Scope re-hosting is documented but untested.** Problem 3 is rejected as a blocker; a real
   fork to a different scope has not been exercised end to end.
7. **`obixc test` executes behavioural DSL only through the reactive projection + virtual
   clock.** Contract (`.obix.test`) execution beyond parsing is Level 1; `obixc verify`
   currently parses the contract and surfaces the a11y model but does not run invariants.

None of these blocks the Level 0 milestone or the DOP IR contract.

---

## 25. Final verdict

### FREEZE PACKAGE GRAPH

The twenty-package `obix-*` graph is:

* **acyclic** and identical to the canonical graph in `scripts/graph.mjs` (GATE 4);
* **lockstep-versioned** with exact internal pins and an `OBIX-C011` gate (GATE 3);
* **accessibility-mandatory** — a normal compiler dependency with no bypass (GATE 7);
* **independently verified** — `referenceFold` sits below the adapters, imports none of them,
  and every projection is checked against it step-wise for state, render and validation
  (GATE 5), including the *compiled* Timer artifact;
* **within the runtime budget** — 473 B against 4096 B (GATE 8);
* **structurally SSR-pure** — no DOM in the graph, the types, or the bundle (GATE 9);
* **faithful to the frozen fixture** — Timer terminal semantics match Addendum A Model B
  refined, identified by `FIXTURE_VERSION` + `FIXTURE_CHECKSUM` + snapshot + tag (GATE 6).

The 0.2.1 analysis withheld a freeze pending Problems 1, 2, 4 and 5. All four are resolved and
each has a CI gate that fails the build on regression. The unresolved items in §24 are Level-1
scope, not Level-0 blockers.

**There are no blockers. Freeze.**

---

**OBINexus Computing — Nnamdi Michael Okpala — 28 August 2026**
