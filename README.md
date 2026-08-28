# OBIX 1.0 — DOP-Native Component Language

> Draft 0.2.1 · Level 0 implementation · monorepo for the twenty `@obinexusltd/obix-*` public packages

OBIX compiles a single-file `PascalCaseComponent.obix` (with `<style>`, `<template>`,
`<script>`) into a **canonical DOP IR**, then projects that IR — without ever
re-deriving business logic — into Data, Functional, OOP, Reactive, Native and SSR
forms that are **provably equivalent** against an independent reference evaluator.

**DATA FIRST. PARADIGM SECOND.**

## The twenty packages

| # | Package | Role | Level 0 |
|---|---------|------|---------|
| 01 | [`@obinexusltd/obix-spec`](packages/obix-spec) | canonical types + structural contracts + `createScopeToken` | ✅ full |
| 02 | [`@obinexusltd/obix-ir`](packages/obix-ir) | `createDOP`, `applyAction`, freeze/diff helpers | ✅ full |
| 03 | [`@obinexusltd/obix-parser`](packages/obix-parser) | section scanner + strict OBIX template/script parse | ✅ full |
| 04 | [`@obinexusltd/obix-compiler`](packages/obix-compiler) | source → sections → AST → DOP IR → ES6 emit | ✅ Level 0 subset |
| 05 | [`@obinexusltd/obix-template`](packages/obix-template) | binding + event descriptor analysis (pure) | ✅ full |
| 06 | [`@obinexusltd/obix-styles`](packages/obix-styles) | scoped CSS transform (one canonical token) | ✅ full |
| 07 | [`@obinexusltd/obix-adapter-data`](packages/obix-adapter-data) | identity / data projection | ✅ full |
| 08 | [`@obinexusltd/obix-adapter-functional`](packages/obix-adapter-functional) | `reduce` / `replay` / `create` closure | ✅ full |
| 09 | [`@obinexusltd/obix-adapter-oop`](packages/obix-adapter-oop) | generated class projection | ✅ full |
| 10 | [`@obinexusltd/obix-adapter-reactive`](packages/obix-adapter-reactive) | subscribers + changedKeys + effects lifecycle | ✅ full |
| 11 | [`@obinexusltd/obix-adapter-native`](packages/obix-adapter-native) | DOM mount (the only DOM adapter) | ✅ Level 0 subset |
| 12 | [`@obinexusltd/obix-adapter-ssr`](packages/obix-adapter-ssr) | DOM-free `renderToString` | ✅ Level 0 subset |
| 13 | [`@obinexusltd/obix-runtime`](packages/obix-runtime) | browser binding runtime, ≤ 4 KB gzip | ✅ full |
| 14 | [`@obinexusltd/obix-effects`](packages/obix-effects) | scheduler primitives (`every` operational) | ✅ `every` only |
| 15 | [`@obinexusltd/obix-validator`](packages/obix-validator) | validation + **independent `referenceFold` oracle** | ✅ full |
| 16 | [`@obinexusltd/obix-test`](packages/obix-test) | adapter-equivalence orchestration + DSLs | ✅ full |
| 17 | [`@obinexusltd/obix-accessibility`](packages/obix-accessibility) | compile-time a11y analysis (mandatory compiler dep) | ✅ Level 0 subset |
| 18 | [`@obinexusltd/obix-cli`](packages/obix-cli) | `obixc build\|check\|test\|verify\|equivalence` | ✅ Level 0 subset |
| 19 | [`@obinexusltd/obix-language-server`](packages/obix-language-server) | diagnostics / completion / hover / definition | ✅ diagnostics |
| 20 | [`@obinexusltd/obix-timer`](packages/obix-timer) | frozen golden fixture (`Timer.obix`) | ✅ full |

All twenty share **one lockstep version** (`0.2.1`, from [`OBIX_VERSION`](OBIX_VERSION)).
All internal `@obinexusltd/obix-*` dependencies pin that **exact** version.

## Dependency direction (acyclic)

```
spec ─▶ ir ─▶ {parser, template, styles, effects}
                     │
      ┌──────────────┼─────────────────────────────┐
      ▼              ▼                              ▼
 validator      accessibility                   runtime
      │              │                              │
      └──────▶ compiler ◀────────────────────┐      │
                     │                       │      │
   {adapter-data, adapter-functional, adapter-oop} │
                     │           adapter-reactive ─┘
                     ▼                  │
                 adapter-ssr      adapter-native ─▶ runtime
                     │                  │
                     └──▶ test ◀────────┘
                            │
                    ┌───────┴────────┐
                    ▼                ▼
                   cli        language-server

timer ── leaf ── depends on spec, ir, 4 pure adapters; nothing depends on timer
```

Enforced by `npm run test:cycles` and `npm run check:graph`.

## Quick start

```bash
npm install
npm run build
npm run ci
```

`npm run ci` runs every acceptance gate: structure, names, versions, cycles,
graph rules, TypeScript declarations, adapter equivalence, Timer terminal
semantics, accessibility-required, runtime budget, SSR purity, `npm pack`.

## Documentation

- [`docs/OBIX-1.0-LEVEL-0-PACKAGE-ARCHITECTURE-REVISION-DRAFT-0.2.2-CANDIDATE.md`](docs/OBIX-1.0-LEVEL-0-PACKAGE-ARCHITECTURE-REVISION-DRAFT-0.2.2-CANDIDATE.md)
  — the architecture revision, the 14-problem review, and the package-graph verdict.
