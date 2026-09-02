# obix-adapter-ssr

**The SSR projection — DOM-free `renderToString`.**

```bash
npm install obix-adapter-ssr
```

## API

| Export | Level 0 |
|---|---|
| `renderToString(artifact, { state?, props? })` | ✅ returns an HTML string |
| `renderToStream()` | ❌ throws `UnsupportedFeatureError` (Level 1) — never a silent no-op |

Renders from `artifact.render(state, props)` when present, otherwise walks the
`artifact.template` descriptor. The scope token (from `obix-spec.createScopeToken`
via `artifact.style.token`) is applied as `data-obix-scope`.

## Purity (Problem 14)

This package **structurally cannot** be DOM-coupled:

- its only dependencies are `obix-spec` and `obix-ir`;
- it may not depend on `obix-runtime`, `obix-adapter-native` or
  `obix-adapter-reactive`;
- `scripts/check-ssr-purity.mjs` (GATE 9) bundles it for a neutral platform and
  fails if the bundle contains `window` / `document` / `HTMLElement` /
  `addEventListener` or transitively pulls a forbidden package.

## Dependency role

`obix-spec` + `obix-ir`. A leaf on the server side.

## Level 0 status

✅ `renderToString`. Full SSR (hydration markers, streaming, slot/loop output) is
deferred to Level 1.
