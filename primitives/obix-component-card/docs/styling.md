# Styling — `@obinexusltd/obix-component-card`

No CSS is shipped. Classes and structure only.

## Emitted classes

| Class | When |
|---|---|
| `obix-card` | Always. |
| `obix-card--interactive` | When `interactive: true`. |
| `obix-card__skeleton` | While `showSkeleton` is true (replaces all other content). |
| `obix-card__media` | Wraps the `<figure><img>` when `image` is set. |
| `obix-card__title` | The `<h3>`, when `title` is non-empty. |
| `obix-card__body` | Wraps `content`, when non-empty. |

## Inline styles set by `render`

`width`, `height` (skipped if `"auto"`), `minWidth`, `minHeight`, and `aspectRatio` are combined into a single inline `style` attribute — there is no corresponding CSS class for these; they are per-instance dimensions, not shared theme values.

## Example stylesheet skeleton

```css
.obix-card {
  display: block;
  border-radius: 8px;
  overflow: hidden;
  background: var(--obix-card-bg, #fff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.obix-card--interactive { cursor: pointer; }
.obix-card--interactive:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); }

.obix-card__media img { display: block; width: 100%; height: 100%; object-fit: cover; }
.obix-card__title { margin: 0.75em 1em 0; font-size: 1.1rem; }
.obix-card__body { padding: 0.5em 1em 1em; }

.obix-card__skeleton {
  width: 100%;
  height: 100%;
  min-height: 8rem;
  background: linear-gradient(90deg, #eee 25%, #f5f5f5 37%, #eee 63%);
  background-size: 400% 100%;
  animation: obix-shimmer 1.4s ease infinite;
}
@keyframes obix-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
```
