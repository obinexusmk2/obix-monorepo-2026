# @obinexusltd/obix-component-button

**The `ObixButton` primitive** — an accessible clickable action trigger with
loading states, toggle mode, three sizes, and a WCAG 2.5.5 **48×48px touch
target** enforced by default.

Split out of `@obinexusltd/obix-component-primitives` as an independent package.

```bash
npm install @obinexusltd/obix-component-button
```

> **Zero dependencies.** Data-Oriented: a component is `{ name, state, actions,
> render }`. Actions are pure `(state, …args) => newState`; `render(state)` is
> deterministic HTML. Spec:
> `docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md` § ObixButton.

## API

```ts
import { createButton, renderButton } from "@obinexusltd/obix-component-button";

const btn = createButton({ label: "Delete", variant: "danger", size: "md" });

btn.render(btn.state);
// <button class="obix-button obix-button--danger obix-button--md" type="button"
//         aria-label="Delete" style="min-width:48px;min-height:48px">Delete</button>

// pure transitions — btn.state is never mutated
const loading = btn.actions.setLoading(btn.state, true);
btn.render(loading); // + aria-busy="true" aria-disabled="true" + spinner span

// one-liner
renderButton({ label: "Save", loading: true });
```

### `createButton(config)`

| config | type | default |
|---|---|---|
| `label` | `string` | **required** |
| `variant` | `"primary" \| "secondary" \| "ghost" \| "danger"` | `"primary"` |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` |
| `disabled` / `loading` / `toggle` | `boolean` | `false` |
| `ariaLabel` | `string` | `label` |
| `ariaPressed` | `boolean` | `false` |
| `type` | `"button" \| "submit" \| "reset"` | `"button"` |

### Actions — `btn.actions.*(state, …args) → ButtonState`

`click` · `setLoading(state, loading)` · `toggle` · `setDisabled(state, disabled)` · `focus` · `blur`

## Accessibility (WCAG 2.1 AA)

- 48×48px minimum touch target (always emitted as inline `min-width` / `min-height`)
- `aria-label` always present · `aria-busy` while loading · `aria-disabled` when disabled
- `aria-pressed` for toggle buttons · user text HTML-escaped in `label` and `aria-label`

## Related primitives

`@obinexusltd/obix-component-`[`card`](../obix-component-card) ·
[`image`](../obix-component-image) ·
[`video`](../obix-component-video) ·
[`link`](../obix-component-link)
