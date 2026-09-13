# Usage Guide — `@obinexusltd/obix-component-image`

## Install

```bash
npm install @obinexusltd/obix-component-image
```

Zero runtime dependencies.

## Quick start

```ts
import { createImage } from "@obinexusltd/obix-component-image";

const img = createImage({ src: "/product.jpg", alt: "Blue running shoe" });
document.querySelector("#slot")!.innerHTML = img.render(img.state);
```

## Decorative images

`alt` is required by the type system and at runtime — there is no implicit default. For purely decorative images, pass an explicit empty string so the intent is visible in the config, not accidental:

```ts
createImage({ src: "/divider.svg", alt: "" });
// render() adds role="presentation" automatically when alt === ""
```

## Preventing layout shift

Supply `aspectRatio` (and/or `width`/`height`) so the browser reserves space before the image loads:

```ts
createImage({ src: "/banner.jpg", alt: "Sale banner", aspectRatio: "21 / 9", objectFit: "cover" });
```

## Responsive images

```ts
createImage({
  src: "/photo-800.jpg",
  alt: "Mountain lake",
  srcSet: "/photo-400.jpg 400w, /photo-800.jpg 800w, /photo-1600.jpg 1600w",
  sizes: "(min-width: 800px) 800px, 100vw",
});
```

## Tracking load / error state

`loaded`/`errored` are plain state fields you update from real DOM events yourself — this package doesn't attach listeners:

```ts
let state = img.state;
const el = document.querySelector("img")!;
el.addEventListener("load", () => { state = img.actions.onLoad(state); });
el.addEventListener("error", () => { state = img.actions.onError(state); });
```

See [api-reference.md](./api-reference.md) for the full config surface and [accessibility.md](./accessibility.md) for the `alt`/`role="presentation"` rules.
