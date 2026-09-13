# Usage Guide — `@obinexusltd/obix-component-video`

## Install

```bash
npm install @obinexusltd/obix-component-video
```

Zero runtime dependencies.

## Quick start

```ts
import { createVideo } from "@obinexusltd/obix-component-video";

const video = createVideo({ src: "/intro.mp4", poster: "/intro-poster.jpg" });
document.querySelector("#slot")!.innerHTML = video.render(video.state);
```

## Captions and a transcript

```ts
createVideo({
  src: "/lecture.mp4",
  tracks: [
    { kind: "captions", src: "/lecture.en.vtt", srcLang: "en", label: "English", default: true },
    { kind: "captions", src: "/lecture.es.vtt", srcLang: "es", label: "Español" },
  ],
  transcript: "/lecture-transcript.html",
});
```

Only the track whose `srcLang` matches `activeCaptions` (or the one marked `default`) gets the native `default` attribute; the rest are still present as selectable tracks. `descriptions` tracks are never marked `default` by `enableCaptions`/render logic, since they serve a different purpose (audio descriptions, not captions).

## Autoplay (correctly muted)

```ts
createVideo({ src: "/bg-loop.mp4", autoplay: true, loop: true, controls: false });
// state.muted is forced true even though `muted` wasn't passed — see accessibility.md
```

## Driving playback state

This package renders markup; it does not attach to a real `<video>` element. Wire your own event listeners and feed them back into the actions:

```ts
let state = video.state;
const el = document.querySelector("video")!;
el.addEventListener("play", () => { state = video.actions.play(state); });
el.addEventListener("pause", () => { state = video.actions.pause(state); });
el.addEventListener("volumechange", () => { state = video.actions.setVolume(state, el.volume); });
```

See [api-reference.md](./api-reference.md) for the full config and [accessibility.md](./accessibility.md) for the WCAG rationale behind the autoplay/mute/caption defaults.
