# Styling — `@obinexusltd/obix-component-dropdown`

No CSS is shipped.

## Emitted classes

| Class | When |
|---|---|
| `obix-dropdown` | Always. |
| `obix-dropdown__trigger` | The trigger `<button>`. |
| `obix-dropdown__icon` | Only when `trigger.icon` is set. |
| `obix-dropdown-menu` | The `<ul>`. |
| `obix-dropdown-menu--top` / `--bottom` / `--left` / `--right` | One, from `placement`. |
| `obix-dropdown-menu__divider` | Each divider `<li>`. |
| `is-focused` | On the `<li>` matching `focusedIndex`. |

## Example stylesheet skeleton

```css
.obix-dropdown { position: relative; display: inline-block; }
.obix-dropdown-menu {
  position: absolute; min-width: 10rem; margin: 0; padding: 0.25rem 0;
  list-style: none; background: #fff; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.obix-dropdown-menu--bottom { top: 100%; left: 0; }
.obix-dropdown-menu--top { bottom: 100%; left: 0; }
.obix-dropdown-menu[hidden] { display: none; }

.obix-dropdown-menu li[role="menuitem"] button {
  display: block; width: 100%; text-align: left; padding: 0.4rem 0.9rem;
  border: none; background: none; cursor: pointer;
}
.obix-dropdown-menu li.is-focused button { background: var(--obix-hover-bg, #f3f4f6); }
.obix-dropdown-menu li[role="menuitem"] button[disabled] { opacity: 0.5; cursor: not-allowed; }
.obix-dropdown-menu__divider { height: 1px; margin: 0.25rem 0; background: #e5e7eb; }
```
