# @obinexusltd/obix-component-dropdown

**The `ObixDropdown` overlay** — a menu / picker: `role="menu"`,
`aria-haspopup` + `aria-expanded` on the trigger, `aria-activedescendant` for the
focused item, and pure keyboard-navigation transitions that skip dividers and
disabled items.

Split out of `@obinexusltd/obix-component-overlays` as an independent package.

```bash
npm install @obinexusltd/obix-component-dropdown
```

> **Zero dependencies.** Data-Oriented: `{ name, state, actions, render }`.
> Actions are pure `(state, …args) => newState`; `render(state)` is deterministic
> HTML. Spec: `docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md` § ObixDropdown.
> (The doc lists `trigger` twice; here the trigger button is `trigger` and the
> interaction is `activateOn`.)

## API

```ts
import { createDropdown, renderDropdown } from "@obinexusltd/obix-component-dropdown";

const menu = createDropdown({
  trigger: { label: "Account", icon: "👤" },
  items: [
    { label: "Profile", action: "profile" },
    { label: "Settings", action: "settings" },
    { divider: true },
    { label: "Sign Out", action: "logout" },
  ],
  ariaLabel: "User menu",
  id: "user-menu",
});

menu.render(menu.actions.open(menu.state));
// <div class="obix-dropdown" data-activate-on="click">
//   <button type="button" class="obix-dropdown__trigger" aria-label="User menu"
//           aria-haspopup="true" aria-expanded="true" aria-controls="user-menu-menu">
//     Account <span class="obix-dropdown__icon" aria-hidden="true">👤</span></button>
//   <ul id="user-menu-menu" role="menu" class="obix-dropdown-menu obix-dropdown-menu--bottom"
//       aria-activedescendant="user-menu-item-0">
//     <li role="menuitem" id="user-menu-item-0" class="is-focused"><button type="button" data-action="profile">Profile</button></li>
//     …
//     <li role="separator" class="obix-dropdown-menu__divider"></li>
//     <li role="menuitem" id="user-menu-item-3"><button type="button" data-action="logout">Sign Out</button></li>
//   </ul>
// </div>
```

### `createDropdown(config)`

| config | type | default |
|---|---|---|
| `trigger` | `{ label, icon? }` | **required** |
| `items` | `{ label?, action?, disabled?, divider? }[]` | **required** |
| `placement` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"` |
| `activateOn` | `"click" \| "hover"` | `"click"` |
| `closeOnClick` | `boolean` | `true` |
| `ariaLabel` | `string` | `trigger.label` |
| `open` | `boolean` | `false` |
| `id` | `string` | `"obix-dropdown"` — set a unique value per instance |

### Actions — `dropdown.actions.*(state, …args) → DropdownState`

`open` · `close` · `toggle` · `selectItem(state, index)` · `focusItem(state, index)` · `focusNext` · `focusPrev`

`open` / `focusNext` / `focusPrev` land on the next **selectable** item (dividers
and `disabled` items are skipped, navigation wraps).

## Accessibility

- `role="menu"` + `role="menuitem"` / `role="separator"` · `aria-haspopup` +
  `aria-expanded` + `aria-controls` on the trigger · `aria-activedescendant` for
  the focused item · `hidden` on the closed menu · disabled items get
  `disabled` + `aria-disabled="true"` · all text HTML-escaped

## Related overlays

`@obinexusltd/obix-component-`[`modal`](../obix-component-modal) ·
[`tooltip`](../obix-component-tooltip)
