# API Reference — `@obinexusltd/obix-component-button`

## `createButton(config: ButtonConfig): DOPComponent<ButtonState>`

Builds a button artifact. Throws `TypeError` if `config.label` is missing or empty.

```ts
import { createButton } from "@obinexusltd/obix-component-button";

const button = createButton({ label: "Save" });
button.render(button.state); // '<button class="obix-button obix-button--primary obix-button--md" ...>Save</button>'
```

Returns `{ name: "ObixButton", state, actions, render }` — see [architecture.md](./architecture.md) for the shape.

## `renderButton(config: ButtonConfig, overrides?: Partial<ButtonState>): string`

One-shot helper: creates a button and renders it immediately, optionally overriding fields on top of the derived initial state.

```ts
renderButton({ label: "Delete" }, { variant: "danger", disabled: true });
```

## `ButtonConfig`

| Field | Type | Default | Notes |
|---|---|---|---|
| `label` | `string` | — | **Required.** Visible text. |
| `variant` | `ButtonVariant` | `"primary"` | `"primary" \| "secondary" \| "ghost" \| "danger"` |
| `size` | `ButtonSize` | `"md"` | `"sm" \| "md" \| "lg"` |
| `disabled` | `boolean` | `false` | Forced `true` while `loading`. |
| `loading` | `boolean` | `false` | Shows the spinner, sets `aria-busy`. |
| `toggle` | `boolean` | `false` | Enables `actions.toggle` / `aria-pressed`. |
| `ariaLabel` | `string` | `label` | Accessible name override. |
| `ariaPressed` | `boolean` | `false` | Initial pressed state (toggle buttons). |
| `type` | `ButtonType` | `"button"` | `"button" \| "submit" \| "reset"` |

## `ButtonState`

Everything in `ButtonConfig` resolved to a concrete value, plus:

| Field | Type | Notes |
|---|---|---|
| `touched` | `boolean` | Set by `click` / `blur`. |
| `focused` | `boolean` | Set by `focus` / `blur`. |
| `minWidth`, `minHeight` | `string` | Always `"48px"` — the WCAG 2.5.5 touch target, not configurable. |

## Actions

All actions are pure: `(state, ...args) => newState`. None mutate their input.

| Action | Signature | Behaviour |
|---|---|---|
| `click` | `(s) => s` | No-op while `disabled`/`loading`; otherwise sets `touched: true`. |
| `setLoading` | `(s, isLoading: boolean) => s` | Sets `loading` and forces `disabled` while loading. |
| `toggle` | `(s) => s` | No-op unless `toggle: true` and enabled; flips `ariaPressed`. |
| `setDisabled` | `(s, isDisabled: boolean) => s` | Loading always implies disabled. |
| `focus` | `(s) => s` | Sets `focused: true`. |
| `blur` | `(s) => s` | Sets `focused: false`, `touched: true`. |

## Exported types

`Action<S>`, `ButtonConfig`, `ButtonSize`, `ButtonState`, `ButtonType`, `ButtonVariant`, `DOPComponent<S>`.
