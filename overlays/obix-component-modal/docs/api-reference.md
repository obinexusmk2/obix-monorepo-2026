# API Reference — `@obinexusltd/obix-component-modal`

## `createModal(config: ModalConfig): DOPComponent<ModalState>`

Throws `TypeError` if `title` is missing/empty.

```ts
import { createModal } from "@obinexusltd/obix-component-modal";

const modal = createModal({
  title: "Delete item?",
  content: "<p>This cannot be undone.</p>",
  actions: [{ label: "Cancel", action: "cancel" }, { label: "Delete", variant: "danger", action: "confirm" }],
});
modal.render(modal.state); // "" while closed
```

## `renderModal(config: ModalConfig, overrides?: Partial<ModalState>): string`

One-shot create + render.

## `ModalConfig`

| Field | Type | Default | Notes |
|---|---|---|---|
| `title` | `string` | — | **Required.** Linked via `aria-labelledby`. |
| `content` | `string` | `""` | Trusted HTML — not escaped. |
| `open` | `boolean` | `false` | Initial `isOpen`. |
| `closeOnEscape` | `boolean` | `true` | Emitted as `data-close-on-escape`; **you** wire the Escape key handler. |
| `closeOnBackdropClick` | `boolean` | `true` | Emitted as `data-close-on-backdrop`; **you** wire the click handler. |
| `size` | `ModalSize` | `"md"` | `"sm" \| "md" \| "lg"` |
| `centered` | `boolean` | `true` | Adds `obix-modal--centered`. |
| `backdrop` | `ModalBackdrop` | `"dark"` | `"dark" \| "light" \| "blur"` — emitted as `data-backdrop`. |
| `actions` | `ModalAction[]` | `[]` | Footer buttons. |
| `id` | `string` | `"obix-modal"` | DOM id root; **set a unique value per instance** if you render more than one modal type. |

## `ModalAction`

```ts
interface ModalAction {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  action?: string; // emitted as data-action; wire the handler yourself
}
```

## `ModalState`

`ModalConfig`'s resolved fields, with `open` renamed to `isOpen`.

## Actions

| Action | Signature | Behaviour |
|---|---|---|
| `open` | `(s) => s` | `isOpen: true`. |
| `close` | `(s) => s` | `isOpen: false`. |
| `toggle` | `(s) => s` | Flips `isOpen`. |

## Render behaviour

`render(state)` returns `""` (empty string) whenever `isOpen` is `false` — nothing is mounted to the DOM while closed. See [architecture.md](./architecture.md) for why this matters for focus management.

## Exported types

`Action<S>`, `DOPComponent<S>`, `ModalAction`, `ModalBackdrop`, `ModalConfig`, `ModalSize`, `ModalState`.
