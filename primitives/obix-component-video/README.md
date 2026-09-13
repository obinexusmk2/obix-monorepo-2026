# @obinexusltd/obix-component-video

**The `ObixVideo` primitive** — an accessible media player with native
`<track>` captions, a transcript link, and keyboard controls.

Split out of `@obinexusltd/obix-component-primitives` as an independent package.

```bash
npm install @obinexusltd/obix-component-video
```

> **Zero dependencies.** Data-Oriented: `{ name, state, actions, render }`.
> Actions are pure `(state, …args) => newState`; `render(state)` is deterministic
> HTML. Spec: `docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md` § ObixVideo.

## API

```ts
import { createVideo, renderVideo } from "@obinexusltd/obix-component-video";

renderVideo({
  src: "/intro.mp4",
  poster: "/intro-poster.jpg",
  width: 800,
  height: 450,
  tracks: [
    { kind: "captions", src: "/intro-en.vtt", srcLang: "en", label: "English" },
    { kind: "captions", src: "/intro-es.vtt", srcLang: "es", label: "Spanish" },
  ],
  transcript: "/intro-transcript.txt",
  ariaLabel: "Product introduction video",
});
// <video width="800" height="450" poster="/intro-poster.jpg"
//        aria-label="Product introduction video" controls>
//   <source src="/intro.mp4" type="video/mp4">
//   <track kind="captions" src="/intro-en.vtt" srclang="en" label="English">
//   <track kind="captions" src="/intro-es.vtt" srclang="es" label="Spanish">
//   <p>Your browser does not support HTML5 video. <a href="/intro.mp4">Download the video</a>.</p>
// </video>
// <p class="obix-video__transcript"><a href="/intro-transcript.txt">Read transcript</a></p>
```

### `createVideo(config)`

| config | type | default |
|---|---|---|
| `src` | `string` | **required** |
| `poster` | `string` | — |
| `controls` | `boolean` | `true` |
| `autoplay` | `boolean` | `false` (forces `muted`) |
| `muted` / `loop` | `boolean` | `false` |
| `width` / `height` | `string \| number` | — |
| `tracks` | `{ kind, src, srcLang, label, default? }[]` | `[]` |
| `transcript` | `string` (text or URL) | — |
| `ariaLabel` | `string` | `"Video"` |

### Actions — `video.actions.*(state, …args) → VideoState`

`play` · `pause` · `setVolume(state, 0..1)` (0 ⇒ muted) · `seek(state, seconds)` · `enableCaptions(state, lang)`

## Accessibility

- Native `<track>` caption/subtitle/description support · transcript link for
  deaf / hard-of-hearing users · `autoplay` always muted · `<a>` download
  fallback · all attribute values HTML-escaped

## Related primitives

`@obinexusltd/obix-component-`[`button`](../obix-component-button) ·
[`card`](../obix-component-card) ·
[`image`](../obix-component-image) ·
[`link`](../obix-component-link)
