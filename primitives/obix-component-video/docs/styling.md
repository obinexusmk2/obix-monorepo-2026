# Styling — `@obinexusltd/obix-component-video`

No CSS is shipped and no wrapper element is rendered — `render()` produces a `<video>` element (plus an optional transcript `<p>` after it). There is no `obix-video` class on the `<video>` itself.

## Emitted classes

| Class | When |
|---|---|
| `obix-video__transcript` | Wraps the "Read transcript" link, only when `transcript` is set. |

## Example stylesheet skeleton

```css
video { max-width: 100%; border-radius: 6px; background: #000; }
.obix-video__transcript { margin-top: 0.5em; font-size: 0.9rem; }
.obix-video__transcript a { color: var(--obix-link-color, #2563eb); }
```

If you want a consistent hook on the `<video>` element itself, wrap the rendered output:

```html
<div class="video-frame" style="aspect-ratio: 16 / 9">
  <!-- render() output goes here -->
</div>
```
