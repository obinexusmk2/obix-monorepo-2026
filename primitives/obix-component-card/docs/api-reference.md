# API Reference — `@obinexusltd/obix-component-card`

## `createCard(config?: CardConfig): DOPComponent<CardState>`

Builds a card artifact. All fields are optional — `createCard()` and `createCard({})` are both valid and produce an empty card.

```ts
import { createCard } from "@obinexusltd/obix-component-card";

const card = createCard({ title: "Hello", content: "<p>World</p>" });
card.render(card.state);
```

## `renderCard(config?: CardConfig, overrides?: Partial<CardState>): string`

One-shot create + render.

## `CardConfig`

| Field | Type | Default | Notes |
|---|---|---|---|
| `title` | `string` | `""` | Rendered as `<h3>`, HTML-escaped. |
| `content` | `string` | `""` | Rendered as trusted HTML inside `.obix-card__body` — **not** escaped. |
| `interactive` | `boolean` | `false` | Adds `obix-card--interactive`. |
| `image` | `CardImage \| undefined` | `null` | `{ src, alt }` — rendered as a `<figure><img></figure>`. |
| `loading` | `boolean` | `false` | Starts the card in skeleton mode. |
| `width`, `height` | `string` | `"100%"`, `"auto"` | Applied via inline `style`. |
| `minWidth`, `minHeight` | `string` | `""` | Applied via inline `style` when set. |
| `aspectRatio` | `string` | `""` | e.g. `"16 / 9"` — CLS prevention. |

## `CardState`

`CardConfig`'s resolved fields, plus:

| Field | Type | Notes |
|---|---|---|
| `showSkeleton` | `boolean` | Mirrors `loading` initially; toggled by actions. |
| `loadingProgress` | `number` | `0` while loading, `100` once finished — informational, not rendered. |
| `contentReady` | `boolean` | `false` while loading. |

## `CardImage`

```ts
interface CardImage { src: string; alt: string; }
```

## Actions

| Action | Signature | Behaviour |
|---|---|---|
| `startLoading` | `(s) => s` | Enters skeleton mode: `loading: true`, `showSkeleton: true`, `contentReady: false`, `loadingProgress: 0`. |
| `finishLoading` | `(s, content: string) => s` | Sets `content`, exits skeleton mode, `loadingProgress: 100`. |
| `setDimensions` | `(s, width: string, height: string) => s` | Updates `width`/`height` only. |
| `updateContent` | `(s, content: string) => s` | Replaces `content`, sets `contentReady: true` (does not touch loading flags). |

## Exported types

`Action<S>`, `CardConfig`, `CardImage`, `CardState`, `DOPComponent<S>`.
