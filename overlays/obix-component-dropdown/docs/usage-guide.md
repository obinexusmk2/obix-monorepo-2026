# Usage Guide — `@obinexusltd/obix-component-dropdown`

## Install

```bash
npm install @obinexusltd/obix-component-dropdown
```

Zero runtime dependencies.

## Quick start

```ts
import { createDropdown } from "@obinexusltd/obix-component-dropdown";

let dropdown = createDropdown({
  trigger: { label: "Actions" },
  items: [{ label: "Rename", action: "rename" }, { label: "Delete", action: "delete" }],
});
let state = dropdown.state;

function render() { document.querySelector("#slot")!.innerHTML = dropdown.render(state); }
function toggle() { state = dropdown.actions.toggle(state); render(); }
```

## Keyboard navigation

`focusNext`/`focusPrev` skip dividers and disabled items automatically and wrap around at either end — wire arrow keys to them:

```ts
document.addEventListener("keydown", (e) => {
  if (!state.isOpen) return;
  if (e.key === "ArrowDown") { state = dropdown.actions.focusNext(state); render(); }
  if (e.key === "ArrowUp") { state = dropdown.actions.focusPrev(state); render(); }
  if (e.key === "Escape") { state = dropdown.actions.close(state); render(); }
});
```

`aria-activedescendant` is set automatically on the menu to whichever item is currently focused (see [accessibility.md](./accessibility.md)) — you don't need to move real DOM focus for the announcement to work, though you may still want to for consistency with mouse users.

## Dividers and disabled items

```ts
createDropdown({
  trigger: { label: "More" },
  items: [
    { label: "Share" },
    { divider: true },
    { label: "Archive", disabled: true },
    { label: "Delete" },
  ],
});
```

`focusNext`/`focusPrev`/`open` will never land on the divider or the disabled item — they're skipped transparently.

## Hover-activated menus

```ts
createDropdown({ trigger: { label: "Menu" }, items: [...], activateOn: "hover" });
// renders data-activate-on="hover" — wire mouseenter/mouseleave yourself
```

See [api-reference.md](./api-reference.md) for the full config and [accessibility.md](./accessibility.md) for the ARIA menu pattern this implements.
