# OBIX Suite — 0.3.0 Draft

| | |
|---|---|
| Document | Unscoped `obix-*` application-suite architecture |
| Status | Draft — Level 0, parallel track |
| Relationship to OBIX 1.0 | **Does not supersede** `OBIX-1.0-LEVEL-0-PACKAGE-ARCHITECTURE-REVISION-DRAFT-0.2.2-CANDIDATE.md`. The frozen twenty packages in `packages/` keep their behaviour; only names changed this pass — see §7 (de-scoped `@obinexusltd/obix-*` → `obix-*`, `obix-test` → `obix-equivalence`, `obix-adapter-functional` → `obix-adapter-func`). |
| Version line | `suite/SUITE_VERSION` = `0.3.0`, independent of `OBIX_VERSION` (`0.2.1`) |
| Author | OBINexus Computing — Nnamdi Michael Okpala |

---

## 1. Why a parallel track

OBIX 1.0 Level 0 compiles a bespoke single-file `PascalCaseComponent.obix`
(`<style>` / `<template>` / `<script>`) into a canonical DOP IR that is projected
into six paradigms and checked against an independent oracle. It is frozen and it
works — but the custom file format, the parser, and the compiler are the parts
that cost the most to maintain, and the review that produced draft 0.2.2 already
recorded that the twenty-package graph traded coupling for surface.

The **suite** keeps the ideas that pay for themselves and drops the machinery:

| Kept | Dropped |
|---|---|
| Data-oriented state — plain data, pure `action(state, payload, props)` | The `.obix` file format |
| Derived values as pure projections | The parser + AST + structural-seal validation |
| Declarative self-quiescing effects (`{ every, while, dispatch }`) | The compiler + ES6 emitter + emit modes |
| Accessibility as correctness (FUD mitigation) | Six paradigm adapters + the meta-circular-safe oracle graph |
| The function ⇄ class "data-oriented adapter" duality | Lockstep versioning across twenty packages |
| Independent-fold equivalence checking | The scope-token CSS hashing (shadow DOM scopes for free) |

Authoring is now **standard Web Components**: a `.ts` module, a `.html` template,
a `.css` stylesheet — files a browser, a bundler and `tsc` accept directly.

---

## 2. Packages (three)

`A → B` means A declares B in `dependencies`.

```
obix-core   → (nothing)
obix-test   → obix-core
obix        → obix-core, obix-test, esbuild
```

| Package | Internal modules | Public surface |
|---|---|---|
| **`obix-core`** | `spec` · `store` · `dom` · `a11y` · `project` · `element` | `ComponentDef` + types, `createStore`, `bindRoot` / `buildScope` / `resolvePath` / `parseTemplate` / `adoptStyles`, `auditHtml` / `auditRoot`, `toFunc` / `toClass`, `defineElement` / `makeElementClass` |
| **`obix-test`** | `virtual-clock` · `mount` · `equivalence` | `createVirtualClock`, `mountForTest`, `checkEquivalence` |
| **`obix`** | `bin/obix` · `cli/{create,dev,build,check}` · `templates/app` | `export * from "obix-core"`, `export * as Test`, `create` / `dev` / `build` / `check`, the `obix` binary |

Rules (informal — enforced by review, not a CI gate at this size):

1. `obix-core` depends on nothing and touches no Node built-in — it is browser runtime.
2. `obix-test` depends only on `obix-core`.
3. Only `obix` depends on `esbuild` and Node built-ins (`http`, `fs`, `child_process`).
4. The equivalence reference fold in `obix-test` calls `def.actions[name]` directly — it does not go through `createStore`, `toFunc`, or `toClass`.

Every package ships a `README.md`; all three are `type: module`, `sideEffects: false`,
`private: false`, `publishConfig.access: "public"`, version `0.3.0`. `obix-core` and
`obix-test` publish under those names; the umbrella package (`suite/obix/`) publishes as
**`obixjs`** — npm's name-similarity filter rejects the bare `obix`. Its `bin` is still
`obix`, so the CLI command is unchanged.

---

## 3. The component model

```ts
interface ComponentDef<S, P> {
  tag: string;                         // hyphenated custom-element name
  state: S;                            // initial plain-data state
  props?: P;                           // defaults; per-instance from attributes
  actions?: Record<string, (state: S, payload: unknown, props: P) => S>;
  derived?: Record<string, (state: S, props: P) => unknown>;
  effects?: Record<string, { every: number; while?: (s: S, p: P) => boolean; dispatch: string; payload?: unknown }>;
  template?: string | URL;             // inline, or new URL("./X.html", import.meta.url)
  styles?: string | URL;
  observedAttributes?: (keyof P & string)[];
}
```

- **Actions are pure.** Return the same reference for a no-op — the store then
  skips notification and does not bump `revision`.
- **`createStore(def, opts)`** returns `{ state, props, revision, lifecycle,
  dispatch, derived, select, subscribe, revisions, undo, halt, resume, destroy }`.
  Retained history powers `undo`; the effect scheduler re-checks `while` after
  every tick *and* every dispatch and clears its own interval — ported verbatim
  from the frozen `obix-effects` (Draft 0.2.1 Problem 9). `opts.scheduler`
  injects virtual time.
- **`defineElement(def)`** registers a real custom element: open shadow root,
  adopted stylesheet, template cloned once, bindings wired to the store,
  `obix:created | updated | halted | destroyed` `CustomEvent`s, and a dev-time
  `auditRoot` pass logged to the console.

### Template binding grammar

`.html` is plain markup. Scanned once on mount, refreshed on every store change:

| Marker | Effect |
|---|---|
| `{dotted.path}` | text, resolved against `derived` ▸ `state` ▸ `props` (+ `state.` / `props.` / `derived.` namespaces) |
| `data-on-<event>="Action"` | `store.dispatch("Action")` on that DOM event |
| `data-bind-<attr>="path"` | attribute from state — boolean attrs toggled, others set/removed |
| `data-if="path"` | toggle `element.hidden` from a truthy check |

No expression language, no `.obix` directives. Loops / keyed lists are **deferred**
(§6), matching the frozen Level 0 template subset.

### `.obix` → suite mapping

| `Timer.obix` | suite |
|---|---|
| `<script> const state / props / actions / derived / effects` | the `ComponentDef` object |
| `<template> {expr}` | `{expr}` (unchanged) |
| `<template> on:click="Start"` | `data-on-click="Start"` |
| `<template> disabled="{cannotStart}"` | `data-bind-disabled="cannotStart"` |
| `<template> obix:if="finished"` | `data-if="finished"` |
| `<style> .Timer { … }` (scope-token hashed) | `Timer.css` (shadow DOM scope) |

Worked example: [`../suite/examples/timer`](../suite/examples/timer).

---

## 4. Tooling — the `obix` CLI

| Command | Behaviour |
|---|---|
| `obix create <dir>` | Copy `dist/templates/app/` (an `index.html` + `styles.css` + `src/components/Counter.{ts,html,css}` app), substituting `__APP_NAME__`. |
| `obix dev [--port]` | Static file server; `*.ts` transpiled per-request with `esbuild.transform` (no bundle); `obix-core` resolved through an injected `<script type="importmap">`; browser live-reloads over SSE on any source change. |
| `obix build [--outdir]` | `esbuild.build` each `<script type="module">` in `index.html` (bundle, `format: esm`, hashed names); component `new URL("./x.html", import.meta.url)` assets are copied by the `file` loader and keep working via `fetch`; stylesheet `<link>`s copied; HTML rewritten. |
| `obix check [--no-types]` | `auditHtml` over every `*.html`; then `tsc --noEmit` when a `tsconfig.json` and a local `typescript` exist. Non-zero exit on any a11y **error** or type error. |

`new URL("./x.html", import.meta.url)` is the one asset convention — it needs no
loader plugin, type-checks as a plain `URL`, works when served raw (`obix dev`,
any static host, `file://`) and when bundled (`obix build`).

---

## 5. Verification

- `npm run build:suite` — `tsc -p` for `obix-core` → `obix-test` → `obix`, then
  `obix/src/templates` is copied into `obix/dist/templates`.
- `npm run test:suite` — `node --test` across all three packages plus
  `suite/examples/timer`. Covers: store purity / no-op / history / undo,
  effect quiescence under virtual time, the `{marker}` binder (fake DOM),
  `auditHtml`, `toFunc` ⇄ `toClass` lockstep, `checkEquivalence`, the six frozen
  Timer behavioural cases, and `obix create` / `build` / `check` end to end.
- Frozen graph unaffected: `npm run ci` stays green.

---

## 6. Deferred

- **Polyglot service calls.** An OBIX app calling out to services written in
  other languages, over **LibPolyCall** (`libpolycall-v1/` on disk) — including a
  `networks.hobix`-style manifest declaring cross-language service dependencies.
  Nothing in this draft; the substrate is checked in but unused here.
- **SSR / declarative shadow DOM** — a DOM-free `renderToString` for `ObixElement`.
- **Template loops / keyed lists** — `data-for`, list diffing.
- **`obix-state-minimizer` reuse** — the existing partition-refinement FSM
  minimiser (`runtime/obix-state-minimizer`, v1.0.0) as an optional `obix check`
  analysis.
- **Richer `obix create` templates** — routing, forms, a Node server target.
- **Publish workflow** for the unscoped names, and a migration guide from
  `.obix` components.

---

## 7. Frozen-graph changes in this pass

Sanctioned edits to `packages/` (metadata / names only — no behaviour change,
`npm run ci` stays green):

1. **`obix-adapter-functional` → `obix-adapter-func`** — directory + `package.json`
   name. The export `toFunctional` is unchanged.
2. **Full de-scope: `@obinexusltd/obix-*` → bare `obix-*`** so the packages
   publish unscoped. `scripts/graph.mjs` `SCOPE` is now `""`; `pkgName(short)`
   returns the bare name; every `package.json` `name`/`dependencies`, every
   `import`, every gate script (`check-obix-versions`, `check-a11y-required`,
   `check-ssr-purity`, `_lib.internalDeps`) and both docs were rewritten by a
   mechanical pass.
3. **`@obinexusltd/obix-test` → `obix-equivalence`** (directory
   `packages/obix-test` → `packages/obix-equivalence`) to free the bare
   `obix-test` name for this suite's headless harness. Its role and subpath
   exports (`./equivalence`, `./behavioural`, `./contracts`, `./virtual-time`)
   are unchanged.

This reverses draft 0.2.2 §Problem 3 ("REJECT scope de-scoping as a blocker"),
which itself noted a re-scope would be "a one-constant change plus a workspace
re-link" — which is what this was.

---

**OBINexus Computing — Nnamdi Michael Okpala**
