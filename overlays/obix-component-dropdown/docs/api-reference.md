# API Reference — `@obinexusltd/obix-component-dropdown`

## `createDropdown(config: DropdownConfig): DOPComponent<DropdownState>`

Throws `TypeError` if `trigger.label` is missing or `items` is not an array.

```ts
import { createDropdown } from "@obinexusltd/obix-component-dropdown";

const dropdown = createDropdown({
  trigger: { label: "Options" },
  items: [
    { label: "Edit", action: "edit" },
    { divider: true },
    { label: "Delete", action: "delete" },
  ],
});
dropdown.render(dropdown.state);
```

## `renderDropdown(config: DropdownConfig, overrides?: Partial<DropdownState>): string`

One-shot create + render.

## `DropdownConfig`

| Field | Type | Default | Notes |
|---|---|---|---|
| `trigger` | `DropdownTrigger` | — | **Required.** `{ label, icon? }`. |
| `items` | `DropdownItem[]` | — | **Required** (may be empty). |
| `placement` | `DropdownPlacement` | `"bottom"` | `"top" \| "bottom" \| "left" \| "right"` |
| `activateOn` | `DropdownActivateOn` | `"click"` | `"click" \| "hover"` — emitted as `data-activate-on`; you wire the listener. |
| `closeOnClick` | `boolean` | `true` | Whether `selectItem` also closes the menu. |
| `ariaLabel` | `string` | `trigger.label` | |
| `open` | `boolean` | `false` | Initial `isOpen`. |
| `id` | `string` | `"obix-dropdown"` | DOM id root; set a unique value per instance. |

## `DropdownItem`

```ts
interface DropdownItem {
  label?: string;
  action?: string;   // emitted as data-action; wire the handler yourself
  disabled?: boolean;
  divider?: boolean;  // renders <li role="separator">, ignores other fields
}
```

## `DropdownState`

`DropdownConfig`'s resolved fields (`open` renamed to `isOpen`), plus `focusedIndex: number` (`-1` when nothing is focused).

## Actions

| Action | Signature | Behaviour |
|---|---|---|
| `open` | `(s) => s` | Opens; focuses the first selectable item. |
| `close` | `(s) => s` | Closes; resets `focusedIndex` to `-1`. |
| `toggle` | `(s) => s` | Opens or closes, matching `open`/`close` semantics. |
| `selectItem` | `(s, index) => s` | No-op on a divider/disabled item; otherwise sets `focusedIndex` and closes if `closeOnClick`. |
| `focusItem` | `(s, index) => s` | No-op unless the target item is selectable. |
| `focusNext` | `(s) => s` | Moves to the next selectable item, wrapping around, skipping dividers/disabled items. |
| `focusPrev` | `(s) => s` | Same as `focusNext`, in reverse. |

## Exported types

`Action<S>`, `DOPComponent<S>`, `DropdownActivateOn`, `DropdownConfig`, `DropdownItem`, `DropdownPlacement`, `DropdownState`, `DropdownTrigger`.
