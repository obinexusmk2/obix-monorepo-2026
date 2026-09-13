# Accessibility — `@obinexusltd/obix-component-dropdown`

## ARIA menu pattern

```html
<div class="obix-dropdown" data-activate-on="click">
  <button type="button" class="obix-dropdown__trigger" aria-label="Options"
          aria-haspopup="true" aria-expanded="false" aria-controls="obix-dropdown-menu">
    Options
  </button>
  <ul id="obix-dropdown-menu" role="menu" class="obix-dropdown-menu obix-dropdown-menu--bottom" hidden>
    <li role="menuitem" id="obix-dropdown-item-0"><button type="button" data-action="edit">Edit</button></li>
    <li role="separator" class="obix-dropdown-menu__divider"></li>
    <li role="menuitem" id="obix-dropdown-item-2"><button type="button" data-action="delete">Delete</button></li>
  </ul>
</div>
```

- The trigger carries `aria-haspopup="true"`, `aria-expanded` (reflecting `isOpen`), and `aria-controls` pointing at the menu's id.
- The menu is `role="menu"`; items are `role="menuitem"`; a divider is `role="separator"`.
- Disabled items get the `disabled` attribute and `aria-disabled="true"` on their inner `<button>`.

## `aria-activedescendant`, not real focus moves

While open, the menu carries `aria-activedescendant="${id}-item-${focusedIndex}"` pointing at whichever item is logically focused — this is the standard "focus stays on a container, activedescendant tracks the virtual selection" pattern for composite widgets, and it's why `focusNext`/`focusPrev` update `focusedIndex` rather than this package trying to call `.focus()` on a DOM node it doesn't have a reference to (it renders strings, not live elements).

## Skip-disabled navigation is built in, not optional

`focusNext`/`focusPrev`/`open`'s initial focus all route through the same `step()` helper, which never lands on a `divider` or `disabled` item. This means a consumer wiring arrow-key navigation gets correct behaviour "for free" — there is no way to accidentally focus an unselectable item through the public actions.

## What you must wire yourself

Real keyboard event listeners (arrow keys, Enter/Space to activate, Escape to close), and — if `activateOn: "hover"` — the corresponding pointer events. See [usage-guide.md](./usage-guide.md).
