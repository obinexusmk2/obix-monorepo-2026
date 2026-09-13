# @obinexusltd/obix-component-image

**The `ObixImage` primitive** — a responsive image with lazy loading,
`aspect-ratio` (layout-shift prevention), and **enforced alt text**.

Split out of `@obinexusltd/obix-component-primitives` as an independent package.

```bash
npm install @obinexusltd/obix-component-image
```

> **Zero dependencies.** Data-Oriented: `{ name, state, actions, render }`.
> Actions are pure `(state, …args) => newState`; `render(state)` is deterministic
> HTML. Spec: `docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md` § ObixImage.

## API

```ts
import { createImage, renderImage } from "@obinexusltd/obix-component-image";

renderImage({
  src: "/hero.jpg",
  alt: "Hero banner showing product features",
  width: 1200,
  height: 600,
  aspectRatio: "16 / 9",
  srcSet: "/hero-small.jpg 600w, /hero-large.jpg 1200w",
  sizes: "(max-width: 600px) 100vw, 1200px",
});
// <img src="/hero.jpg" alt="Hero banner..." width="1200" height="600"
//      loading="lazy" decoding="auto" srcset="..." sizes="..."
//      style="aspect-ratio:16 / 9;object-fit:cover">
```

### `createImage(config)`

| config | type | default |
|---|---|---|
| `src` | `string` | **required** |
| `alt` | `string` | **required** (`""` ⇒ decorative, adds `role="presentation"`) |
| `width` / `height` | `string \| number` | — |
| `loading` | `"eager" \| "lazy"` | `"lazy"` |
| `decoding` | `"sync" \| "async" \| "auto"` | `"auto"` |
| `aspectRatio` | `string` | — |
| `objectFit` | `"contain" \| "cover" \| "fill"` | `"cover"` |
| `sizes` / `srcSet` | `string` | — |

### Actions — `img.actions.*(state, …args) → ImageState`

`setLoading(state, eager)` · `updateSrc(state, src)` · `updateAlt(state, alt)` · `onLoad` · `onError`

## Accessibility

- `alt` required and enforced · empty `alt` ⇒ `role="presentation"` for decorative images
- `aspect-ratio` prevents layout shift · lazy loading by default · all attribute values HTML-escaped

## Related primitives

`@obinexusltd/obix-component-`[`button`](../obix-component-button) ·
[`card`](../obix-component-card) ·
[`video`](../obix-component-video) ·
[`link`](../obix-component-link)
