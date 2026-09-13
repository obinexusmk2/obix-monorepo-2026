# Styling — `@obinexusltd/obix-component-tooltip`

No CSS is shipped.

## Emitted classes

| Class | When |
|---|---|
| `obix-tooltip-trigger` | The trigger `<span>`, always. |
| `obix-tooltip` | The tooltip `<div>`, always. |
| `obix-tooltip--top` / `--bottom` / `--left` / `--right` | One, from `placement`. |

## Example stylesheet skeleton

```css
.obix-tooltip-trigger { cursor: help; border-bottom: 1px dotted currentColor; }

.obix-tooltip {
  position: absolute;
  max-width: 240px;
  padding: 0.4em 0.7em;
  background: #1f2937;
  color: #fff;
  border-radius: 4px;
  font-size: 0.85rem;
}
.obix-tooltip[hidden] { display: none; }

.obix-tooltip--top    { bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); }
.obix-tooltip--bottom { top: calc(100% + 6px);    left: 50%; transform: translateX(-50%); }
.obix-tooltip--left   { right: calc(100% + 6px);  top: 50%;  transform: translateY(-50%); }
.obix-tooltip--right  { left: calc(100% + 6px);   top: 50%;  transform: translateY(-50%); }
```

Since the trigger and tooltip render as siblings (see [architecture.md](./architecture.md)), wrap them in a `position: relative` container for the placement rules above to anchor correctly:

```css
.obix-tooltip-wrap { position: relative; display: inline-block; }
```
