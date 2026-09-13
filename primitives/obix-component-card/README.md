# @obinexusltd/obix-component-card

**The `ObixCard` primitive** — a content container that takes **explicit
dimensions** to prevent Cumulative Layout Shift (CLS), with a loading skeleton
for graceful data fetches.

Split out of `@obinexusltd/obix-component-primitives` as an independent package.

```bash
npm install @obinexusltd/obix-component-card
```

> **Zero dependencies.** Data-Oriented: `{ name, state, actions, render }`.
> Actions are pure `(state, …args) => newState`; `render(state)` is deterministic
> HTML. Spec: `docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md` § ObixCard.

## API

```ts
import { createCard, renderCard } from "@obinexusltd/obix-component-card";

renderCard({
  title: "Product",
  content: "<p>Premium widget</p>",     // trusted HTML — not escaped
  image: { src: "/product.jpg", alt: "Product image" },
  width: "300px",
  height: "400px",
});
// <article class="obix-card" style="width:300px;height:400px">
//   <figure class="obix-card__media"><img src="/product.jpg" alt="Product image"></figure>
//   <h3 class="obix-card__title">Product</h3>
//   <div class="obix-card__body"><p>Premium widget</p></div>
// </article>

// loading → skeleton, then swap in content (pure transition)
let card = createCard({ width: "300px", height: "400px", loading: true });
const done = card.actions.finishLoading(card.state, "<p>Loaded</p>");
card.render(done);
```

### `createCard(config)`

| config | type | default |
|---|---|---|
| `title` | `string` | `""` |
| `content` | `string` (trusted HTML) | `""` |
| `interactive` | `boolean` | `false` |
| `image` | `{ src, alt }` | — |
| `loading` | `boolean` | `false` |
| `width` / `height` / `minWidth` / `minHeight` / `aspectRatio` | `string` | `width:"100%"` |

### Actions — `card.actions.*(state, …args) → CardState`

`startLoading` · `finishLoading(state, contentHtml)` · `setDimensions(state, width, height)` · `updateContent(state, contentHtml)`

## Accessibility

- Explicit dimensions prevent CLS · loading skeleton is `aria-hidden` and the
  card is `aria-busy` · image `alt` required · semantic `<article>` / `<figure>`
- `title` is HTML-escaped; `content` is treated as trusted HTML by design

## Related primitives

`@obinexusltd/obix-component-`[`button`](../obix-component-button) ·
[`image`](../obix-component-image) ·
[`video`](../obix-component-video) ·
[`link`](../obix-component-link)
