# API Reference — `@obinexusltd/obix-component-video`

## `createVideo(config: VideoConfig): DOPComponent<VideoState>`

Throws `TypeError` if `src` is missing/empty.

```ts
import { createVideo } from "@obinexusltd/obix-component-video";

const video = createVideo({
  src: "/clip.mp4",
  tracks: [{ kind: "captions", src: "/clip.en.vtt", srcLang: "en", label: "English", default: true }],
  transcript: "/clip-transcript.html",
});
video.render(video.state);
```

## `renderVideo(config: VideoConfig, overrides?: Partial<VideoState>): string`

One-shot create + render.

## `VideoConfig`

| Field | Type | Default | Notes |
|---|---|---|---|
| `src` | `string` | — | **Required.** |
| `poster` | `string` | `""` | |
| `controls` | `boolean` | `true` | |
| `autoplay` | `boolean` | `false` | Forces `muted: true` — see [accessibility.md](./accessibility.md). |
| `muted` | `boolean` | `false` | `true` when `autoplay` is set, regardless of this value. |
| `loop` | `boolean` | `false` | |
| `width`, `height` | `string \| number` | `""` | Stringified as-is. |
| `tracks` | `VideoTrack[]` | `[]` | Copied (not referenced) into state. |
| `transcript` | `string` | `""` | Text or URL — rendered as a link when set. |
| `ariaLabel` | `string` | `"Video"` | |

## `VideoTrack`

```ts
interface VideoTrack {
  kind: "captions" | "subtitles" | "descriptions";
  src: string;      // VTT file URL
  srcLang: string;  // e.g. "en"
  label: string;    // e.g. "English"
  default?: boolean;
}
```

## `VideoState`

`VideoConfig`'s resolved fields, plus `playing`, `volume` (`1` initially), `currentTime` (`0` initially), and `activeCaptions` (the `srcLang` of the track marked `default`, or `null`).

## Actions

| Action | Signature | Behaviour |
|---|---|---|
| `play` | `(s) => s` | `playing: true`. |
| `pause` | `(s) => s` | `playing: false`. |
| `setVolume` | `(s, volume: number) => s` | Clamped to `[0, 1]`; `volume === 0` also sets `muted: true`. |
| `seek` | `(s, time: number) => s` | Clamped to `>= 0`. |
| `enableCaptions` | `(s, lang: string) => s` | Sets `activeCaptions` to `lang`. |

## MIME detection

`mimeFor(src)` inspects the file extension: `.webm` → `video/webm`, `.og[gv]` → `video/ogg`, everything else → `video/mp4`.

## Exported types

`Action<S>`, `DOPComponent<S>`, `TrackKind`, `VideoConfig`, `VideoState`, `VideoTrack`.
