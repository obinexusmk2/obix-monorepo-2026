# Styling — `@obinexusltd/obix-component-image`

No CSS is shipped, and no wrapper element is rendered — `render()` produces a single `<img>` tag. There is no `obix-image` class to hook; style the `<img>` element directly via its `src`/attributes or wrap it yourself.

## Inline styles set by `render`

`aspectRatio` and `objectFit` are combined into one inline `style` attribute:

```html
<img src="..." alt="..." style="aspect-ratio:16 / 9;object-fit:cover" ...>
```

If you'd rather control these via a stylesheet (e.g. to change `object-fit` responsively), wrap the rendered `<img>` in your own container and override with a higher-specificity rule or `!important`, or omit `aspectRatio`/`objectFit` from the config and set them entirely in CSS instead — `render()` only emits the inline style when a value is actually configured (empty strings are filtered out).

## Suggested wrapper for a placeholder

```css
.obix-image-wrap {
  position: relative;
  overflow: hidden;
  background: #eee; /* shows through until the image paints */
}
.obix-image-wrap img { display: block; width: 100%; height: 100%; }
```

```html
<div class="obix-image-wrap" style="aspect-ratio: 16 / 9">
  <!-- render() output goes here -->
</div>
```
