# @obinexusltd/obix-styles

**Scoped CSS transformation for OBIX.**

```bash
npm install @obinexusltd/obix-styles
```

## Purpose

| Export | Role |
|---|---|
| `scopeCss(css, token)` | rewrite selectors so rules only match inside the component scope |
| `scopeComponentCss(name, css, path?)` | token + scope in one call |
| `createScopeToken` | re-exported from `obix-spec` — the **one** token function |
| `SCOPE_ATTR` | `"data-obix-scope"` |

The rightmost compound selector of every rule gets `[data-obix-scope="<token>"]`.
`@media` / `@supports` / `@container` blocks are recursed into; `@keyframes` and
`@font-face` are left untouched.

## Problem 10 — no token drift

`obix-styles`, the compiler, the native emitter and the SSR emitter **all** call
`obix-spec.createScopeToken`. This package never re-implements it.

## Dependency role

Depends only on `@obinexusltd/obix-spec`. Consumed by `obix-compiler`.

## Level 0 status

✅ Class / element / id / descendant / combinator selectors, media queries.
Deferred: SCSS, `:deep()` escapes, CSS nesting.
