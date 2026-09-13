# Accessibility — `@obinexusltd/obix-component-card`

## Loading state

While `showSkeleton` is true, the rendered `<article>` carries `aria-busy="true"` and contains a single `<div class="obix-card__skeleton" aria-hidden="true">` — the skeleton placeholder is decorative and hidden from assistive technology rather than being announced as empty content.

```html
<article class="obix-card" aria-busy="true">
  <div class="obix-card__skeleton" aria-hidden="true"></div>
</article>
```

## Images

`CardImage.alt` is passed straight to `render()`'s `<img alt="...">` with no default and no validation — unlike `obix-component-image`, this package does not enforce that `alt` is provided or type-check it beyond `CardImage`'s declared `string` type. If you're loading images dynamically, validate `alt` yourself before constructing the `CardConfig`, or delegate to `@obinexusltd/obix-component-image` for images that need `createImage`'s required-`alt` enforcement.

## Title escaping, content trust

`title` is HTML-escaped (`esc()`) before being placed in the DOM. `content`, by contrast, is inserted as **trusted HTML** — it is the caller's responsibility to sanitize any content that originates from user input before passing it to `CardConfig.content`. Never pass unsanitized user text directly as `content`; escape it yourself or use a sanitizer first.

## Interactive cards and focus

Setting `interactive: true` only adds the `obix-card--interactive` class — it does not add `tabindex`, `role="button"`, or a keyboard handler. If the whole card is meant to be a single activation target, add the appropriate `role`/`tabindex`/keyboard handling in your own markup wrapper; this component does not assume a card is a button.
