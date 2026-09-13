# API Reference — `@obinexusltd/obix-component-image`

## `createImage(config: ImageConfig): DOPComponent<ImageState>`

Throws `TypeError` if `src` is missing/empty, or if `alt` is not a string (pass `alt: ""` explicitly for decorative images — omitting it entirely is an error, by design).

```ts
import { createImage } from "@obinexusltd/obix-component-image";

const img = createImage({ src: "/hero.jpg", alt: "Team photo", aspectRatio: "16 / 9" });
img.render(img.state);
```

## `renderImage(config: ImageConfig, overrides?: Partial<ImageState>): string`

One-shot create + render.

## `ImageConfig`

| Field | Type | Default | Notes |
|---|---|---|---|
| `src` | `string` | — | **Required.** |
| `alt` | `string` | — | **Required.** `""` explicitly marks the image decorative. |
| `width`, `height` | `string \| number` | `""` | Numbers are stringified as-is (no unit appended). |
| `loading` | `ImageLoading` | `"lazy"` | `"eager" \| "lazy"` |
| `decoding` | `ImageDecoding` | `"auto"` | `"sync" \| "async" \| "auto"` |
| `aspectRatio` | `string` | `""` | e.g. `"16 / 9"` — layout-shift prevention. |
| `objectFit` | `ImageObjectFit` | `"cover"` | `"contain" \| "cover" \| "fill"` |
| `sizes` | `string` | `""` | Passed through to the `sizes` attribute. |
| `srcSet` | `string` | `""` | Passed through to the `srcset` attribute. |

## `ImageState`

`ImageConfig`'s resolved fields, plus `loaded: boolean` and `errored: boolean` (both `false` initially; not reflected in `render()` output — see [architecture.md](./architecture.md)).

## Actions

| Action | Signature | Behaviour |
|---|---|---|
| `setLoading` | `(s, eager: boolean) => s` | Sets `loading` to `"eager"` or `"lazy"`. |
| `updateSrc` | `(s, src: string) => s` | Replaces `src`, resets `loaded`/`errored` to `false`. |
| `updateAlt` | `(s, alt: string) => s` | Replaces `alt` only. |
| `onLoad` | `(s) => s` | `loaded: true`, `errored: false`. |
| `onError` | `(s) => s` | `loaded: false`, `errored: true`. |

## Exported types

`Action<S>`, `DOPComponent<S>`, `ImageConfig`, `ImageDecoding`, `ImageLoading`, `ImageObjectFit`, `ImageState`.
