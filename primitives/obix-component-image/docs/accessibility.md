# Accessibility — `@obinexusltd/obix-component-image`

## `alt` is mandatory, even when empty

`createImage` throws unless `alt` is a `string` — there is no default value. This is deliberate: an image author must make an explicit choice between:

- A meaningful description (`alt: "Team standing outside the office"`), or
- An explicit empty string (`alt: ""`) declaring the image decorative.

There is no silent "no alt provided" path.

## `role="presentation"` for decorative images

When `alt === ""`, `render()` adds `role="presentation"` to the `<img>`:

```html
<img src="/divider.svg" alt="" loading="lazy" decoding="auto" role="presentation">
```

This reinforces (for assistive tech and for tooling) that the image was intentionally marked decorative rather than accidentally left without a description.

## Lazy loading and content shift

`loading="lazy"` is the default. Combine it with `aspectRatio` or explicit `width`/`height` so the reserved space doesn't collapse before the image loads — an image with `loading="lazy"` and no reserved dimensions is a common source of layout shift once it scrolls into view.

## What this component does not do

It does not generate `alt` text, does not validate that `alt` is *meaningful* (only that it's a string), and does not manage focus or keyboard interaction — an `<img>` is not natively interactive, and this component does not add any.
