# obix-spec

**Canonical types + structural contracts for OBIX 1.0. Zero runtime dependencies.**

```bash
npm install obix-spec
```

## Purpose

`obix-spec` is the single source of truth for every OBIX interface. Nothing else
in the family redefines `DOPArtifact`, `ActionSignature`, `BindingDescriptor`,
`EffectDescriptor`, `A11yModel`, `TransitionMeta`, `ValidationResult`, … — they
import from here. This is the fix for *Problem 12 — TypeScript declaration drift*:
the types are plain TypeScript source, `.d.ts` is emitted from it, and there is no
separate IDL generator.

## Dependency role

Bottom of the graph. Depends on **nothing**. Imported (types-only, mostly) by
all 19 other packages.

## Level 0 status

✅ Complete. The type surface covers the full Level 0 pipeline; a few fields
(`DOPArtifact.template`, `.style`, `.a11y`) are optional and only populated once
the compiler runs.

## Public API

| Export | Kind | Notes |
|---|---|---|
| `SPEC_VERSION` | `"0.2.1"` | the frozen language revision |
| `LEVEL` | `0` | implementation milestone |
| `createScopeToken(name, sourcePath?)` | fn | the **one** scope-token function (Problem 10) |
| `SCOPE_ATTR` | `"data-obix-scope"` | attribute the token is applied through |
| `validateObixAST(ast)` | fn | the parser seal (Problem 7) — structural, not cryptographic |
| `validateArtifactShape(artifact)` | fn | runtime shape check for a `DOPArtifact` |
| `UnsupportedFeatureError` | class | `{ feature, requiredLevel, currentLevel }` |
| `DIAGNOSTIC_CODES` | frozen map | stable `OBIX-<area><nnn>` codes |
| *types* | — | `DOPArtifact`, `ActionFn`, `DerivedFn`, `ActionSignature`, `DerivedSignature`, `TemplateDescriptor`, `TemplateNode`, `BindingDescriptor`, `EventDescriptor`, `EffectDescriptor`, `A11yModel`, `TransitionMeta`, `ActionTrace`, `SourceSpan`, `Diagnostic`, `ValidationResult`, `ValidationDescriptor`, `DopIR`, `EmitMode`, … |

## Relationship to DOP IR

`obix-spec` defines the **shape** of the canonical DOP IR (`DopIR`) and of the
runnable `DOPArtifact`. It contains no logic that builds or projects them — that
is `obix-ir` and the adapters. Data first: the types describe data, not paradigm.
