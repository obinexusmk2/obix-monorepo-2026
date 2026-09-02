# obix-template

**Pure semantic template analysis for OBIX.**

```bash
npm install obix-template
```

## Purpose

| Export | Role |
|---|---|
| `analyzeBindings(root)` | `BindingDescriptor[]` — text / attr / bool / aria / conditional, each with a child-index `path` |
| `analyzeEvents(root)` | `EventDescriptor[]` — every `on:event="Action"` |
| `analyzeTemplate(root)` | `TemplateDescriptor` = root + bindings + events |
| `extractDependencies(expr)` | root identifier(s) an expression reads |
| `resolveBinding(expr, scope)` | evaluate an identifier / dotted path against a flat scope |
| `bindingScope(state, props, derived)` | build that flat scope (derived > state > props) |

## Constraints

- **No JavaScript parsing.** Level 0 binding expressions are identifiers or
  dotted paths.
- **No DOM.** Returns plain descriptors; `obix-adapter-native` and
  `obix-adapter-ssr` decide what to do with them.

## Dependency role

Depends only on `obix-spec`. Consumed by `obix-compiler`,
`obix-accessibility` and `obix-language-server`.

## Level 0 status

✅ Complete for the Level 0 binding set.
