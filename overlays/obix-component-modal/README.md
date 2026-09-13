# @obinexusltd/obix-component-modal

**The `ObixModal` overlay** — an accessible dialog: `role="dialog"`,
`aria-modal="true"`, title linked via `aria-labelledby`, and configurable
escape / backdrop-click close (emitted as `data-*` hooks — you wire the focus
trap and handlers).

Split out of `@obinexusltd/obix-component-overlays` as an independent package.

```bash
npm install @obinexusltd/obix-component-modal
```

> **Zero dependencies.** Data-Oriented: `{ name, state, actions, render }`.
> Actions are pure `(state) => newState`; `render(state)` is deterministic HTML —
> the **empty string while closed**. Spec:
> `docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md` § ObixModal.

## API

```ts
import { createModal, renderModal } from "@obinexusltd/obix-component-modal";

const modal = createModal({
  title: "Confirm Deletion",
  content: "<p>This action cannot be undone.</p>",   // trusted HTML
  closeOnBackdropClick: false,
  id: "delete-modal",
  actions: [
    { label: "Cancel", variant: "secondary", action: "cancel" },
    { label: "Delete", variant: "danger", action: "confirm" },
  ],
});

modal.render(modal.actions.open(modal.state));
// <div class="obix-modal-backdrop" data-backdrop="dark" data-close-on-backdrop="false">
//   <div class="obix-modal obix-modal--md obix-modal--centered" role="dialog"
//        aria-modal="true" aria-labelledby="delete-modal-title" data-close-on-escape="true">
//     <h2 id="delete-modal-title" class="obix-modal__title">Confirm Deletion</h2>
//     <div class="obix-modal__body"><p>This action cannot be undone.</p></div>
//     <div class="obix-modal-actions">
//       <button type="button" class="obix-button obix-button--secondary" data-action="cancel">Cancel</button>
//       <button type="button" class="obix-button obix-button--danger" data-action="confirm">Delete</button>
//     </div>
//   </div>
// </div>
```

### `createModal(config)`

| config | type | default |
|---|---|---|
| `title` | `string` | **required** |
| `content` | `string` (trusted HTML) | `""` |
| `open` | `boolean` | `false` |
| `closeOnEscape` / `closeOnBackdropClick` | `boolean` | `true` |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` |
| `centered` | `boolean` | `true` |
| `backdrop` | `"dark" \| "light" \| "blur"` | `"dark"` |
| `actions` | `{ label, variant?, action? }[]` | `[]` |
| `id` | `string` | `"obix-modal"` — set a unique value per instance |

### Actions — `modal.actions.*(state) → ModalState`

`open` · `close` · `toggle`

## Accessibility

- `role="dialog"` + `aria-modal="true"` · title linked via `aria-labelledby` ·
  `data-close-on-escape` / `data-close-on-backdrop` hooks for your focus-trap /
  return-focus logic · `title` HTML-escaped, `content` is trusted HTML by design

## Related overlays

`@obinexusltd/obix-component-`[`dropdown`](../obix-component-dropdown) ·
[`tooltip`](../obix-component-tooltip)
