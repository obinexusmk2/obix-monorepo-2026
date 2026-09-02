# obix-core

**The OBIX suite runtime.** Zero dependencies. Standard Web Components — no `.obix`
file, no compiler, no virtual DOM.

```bash
npm install obix-core
```

A component is a plain object authored in standard TypeScript, paired with a
standard `.html` template and `.css` stylesheet:

```ts
import { defineElement, type ComponentDef } from "obix-core";

interface CounterState { count: number }
interface CounterProps { step: number }

export const Counter: ComponentDef<CounterState, CounterProps> = {
  tag: "x-counter",
  props: { step: 1 },
  state: { count: 0 },
  actions: {
    Inc: (s, _p, p) => ({ ...s, count: s.count + p.step }),
    Dec: (s, _p, p) => ({ ...s, count: s.count - p.step }),
  },
  derived: { label: (s) => `Count: ${s.count}` },
  template: new URL("./Counter.html", import.meta.url),
  styles: new URL("./Counter.css", import.meta.url),
};

defineElement(Counter);
```

```html
<!-- Counter.html -->
<div class="counter">
  <output>{label}</output>
  <button type="button" data-on-click="Dec" aria-label="decrement">−</button>
  <button type="button" data-on-click="Inc" aria-label="increment">+</button>
</div>
```

## Template binding grammar

Scanned once on mount, refreshed on every store change:

| Marker | Effect |
|---|---|
| `{dotted.path}` | text interpolation against `derived` ▸ `state` ▸ `props` (also `state.` / `props.` / `derived.` namespaces) |
| `data-on-<event>="Action"` | `store.dispatch("Action")` on that DOM event |
| `data-bind-<attr>="path"` | set the attribute from state; boolean attrs (`disabled`, `hidden`, …) toggled |
| `data-if="path"` | toggle the element's `hidden` from a truthy check |

Loops / keyed lists are deferred (Level 0), matching the frozen OBIX 1.0 subset.

## Exports

- **State** — `createStore(def, opts)` → `{ state, props, dispatch, derived, select, subscribe, revisions, undo, halt, resume, destroy }`. Pure actions, referential no-op detection, retained history, and a self-clearing effect scheduler (`{ every, while, dispatch }`).
- **DOM** — `bindRoot`, `buildScope`, `resolvePath`, `parseTemplate`, `adoptStyles`.
- **Element** — `defineElement(def)`, `makeElementClass(def)`. Open shadow root, adopted stylesheet, `obix:created|updated|halted|destroyed` events, dev-time a11y audit.
- **Projections** — `toFunc(def)` (reduce / replay / create closure) and `toClass(def)` (generated OOP class). The "function ⇄ class" data-oriented adapter, without a compiler.
- **Accessibility** — `auditHtml(string)` (used by `obix check`) and `auditRoot(root)` (dev): unknown role / ARIA attribute, invalid `aria-live`, `<a>` without `href`, missing accessible name, heading-level skips, bad `tabindex`.

## Status

Level 0. Paired with [`obix-test`](../obix-test) for headless verification and
bundled by [`obix`](../obix).
