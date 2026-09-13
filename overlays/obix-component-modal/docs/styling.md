# Styling — `@obinexusltd/obix-component-modal`

No CSS is shipped.

## Emitted classes

| Class | When |
|---|---|
| `obix-modal-backdrop` | Always (while open). |
| `obix-modal` | Always (while open). |
| `obix-modal--sm` / `--md` / `--lg` | One, from `size`. |
| `obix-modal--centered` | When `centered: true` (the default). |
| `obix-modal__title` | The `<h2>`. |
| `obix-modal__body` | Wraps `content`. |
| `obix-modal-actions` | Wraps the footer buttons, only when `actions` is non-empty. |
| `obix-button obix-button--{variant}` | Each footer button — reuses `obix-component-button`'s class convention. |

## Example stylesheet skeleton

```css
.obix-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center;
}
.obix-modal-backdrop[data-backdrop="light"] { background: rgba(255, 255, 255, 0.6); }
.obix-modal-backdrop[data-backdrop="blur"] { backdrop-filter: blur(4px); background: rgba(0,0,0,0.3); }

.obix-modal { background: #fff; border-radius: 8px; padding: 1.5em; max-height: 90vh; overflow: auto; }
.obix-modal--sm { width: 320px; }
.obix-modal--md { width: 480px; }
.obix-modal--lg { width: 720px; }

.obix-modal__title { margin: 0 0 0.5em; }
.obix-modal-actions { display: flex; justify-content: flex-end; gap: 0.5em; margin-top: 1.5em; }
```
