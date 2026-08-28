# @obinexusltd/obix-language-server

**Editor intelligence for `.obix` files.**

```bash
npm install @obinexusltd/obix-language-server
```

## API

| Export | Role |
|---|---|
| `diagnostics(source, uri?)` | parse + semantic + a11y diagnostics (straight from `obix-compiler`) |
| `completions(source, position)` | context-aware: actions after `on:`, state/derived/prop inside `{ … }`, `aria-*` in tags |
| `hover(source, position)` | classify the identifier under the cursor |
| `definition(source, position)` | locate a symbol's declaration in `<script>` |
| `documentSymbols(source)` | outline: template root, binding/event counts, symbol lists |

## Design

Thin. The compiler and parser are the source of truth for diagnostics; this
package adds only cursor-position logic. No LSP JSON-RPC transport is bundled at
Level 0 — an editor shell wires these pure functions to its protocol.

## Dependency role

`obix-spec`, `obix-parser`, `obix-template`, `obix-compiler`. Nothing depends on
it.

## Level 0 status

✅ `diagnostics` is complete (compiler-backed). `completions` / `hover` /
`definition` cover the Level 0 symbol surface.
