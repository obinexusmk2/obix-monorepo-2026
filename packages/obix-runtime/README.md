# obix-runtime

**The OBIX browser binding runtime — and nothing else.**

```bash
npm install obix-runtime
```

## Purpose

| Export | Role |
|---|---|
| `bindText(node, read)` | element text content |
| `bindAttr(el, name, read)` | string/number attribute (`null`/`false` removes) |
| `bindBool(el, name, read)` | boolean attribute |
| `bindAria(el, name, read)` | `aria-*` attribute (booleans → `"true"`/`"false"`) |
| `bindPresence(el, anchor, read)` | `obix:if` show/hide of a single element |
| `bindEvent(el, type, handler)` | `addEventListener` + cleanup |
| `createBindingGroup()` | flush a set of updaters after each transition |

## What is NOT here

No business logic. No component model. No VDOM. No router. No dependency
injection. No store framework. Those never belong in a 4 KB runtime.

## Size budget (Problem 2)

The **tree-shaken bundle** of the helpers a component imports must be
`<= 4 KB` minified + gzipped; the Timer inline helper subset must be `<= 6 KB`.
Enforced by `scripts/check-runtime-budget.mjs` — measured on the bundle, never
on npm wrapper text. Package boundaries (`obix-runtime` vs `obix-effects`) do not
change the emitted size.

## Dependency role

**Zero dependencies** — not even `obix-spec` at runtime. Consumed only by
`obix-adapter-native`. Never imported by SSR.

## Level 0 status

✅ Complete for the Level 0 binding set.
