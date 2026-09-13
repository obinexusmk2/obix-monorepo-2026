# Usage Guide — `@obinexusltd/obix-component-card`

## Install

```bash
npm install @obinexusltd/obix-component-card
```

Zero runtime dependencies.

## Quick start

```ts
import { createCard } from "@obinexusltd/obix-component-card";

const card = createCard({
  title: "Q3 report",
  content: "<p>Revenue up 12%.</p>",
  image: { src: "/report.png", alt: "" },
});
document.querySelector("#slot")!.innerHTML = card.render(card.state);
```

## Skeleton loading

Start a card in a loading state, fetch content, then finish:

```ts
let card = createCard({ title: "Profile", loading: true });
render(card.render(card.state)); // skeleton only — see architecture.md

const bio = await fetchBio();
const state = card.actions.finishLoading(card.state, `<p>${bio}</p>`);
render(card.render(state));
```

While `showSkeleton` is true, `render()` ignores `title`/`content`/`image` entirely and emits only the skeleton markup — set content before calling `finishLoading`, not before.

## Explicit dimensions (CLS prevention)

```ts
createCard({
  title: "Chart",
  width: "320px",
  aspectRatio: "16 / 9",
});
```

Reserving space up front (via `width`/`height`/`aspectRatio`) avoids layout shift when `content` (which may include images or charts) loads in.

## Interactive cards

```ts
createCard({ title: "Open project", interactive: true });
// renders <article class="obix-card obix-card--interactive" ...>
```

`interactive` only changes the class name — wire your own click handling in the consuming app; this package renders markup, not behaviour.

See [api-reference.md](./api-reference.md) for the full field list and [accessibility.md](./accessibility.md) for what `aria-busy` and image `alt` requirements mean here.
