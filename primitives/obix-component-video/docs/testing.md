# Testing — `@obinexusltd/obix-component-video`

## Running the tests

```bash
npm test                     # from this package directory
npm run test:primitives      # from the monorepo root, across every primitive
```

## What `test/video.test.mjs` covers

- `src` is required.
- `render` emits `<video>` + `<source>` + one `<track>` per configured track + the no-HTML5-support fallback + the transcript link.
- `autoplay` forces `muted` (WCAG).
- MIME type derives correctly from the file extension.
- Actions are pure; `setVolume(0)` sets `muted: true`; `enableCaptions` updates `activeCaptions` without touching anything else.

## Adding a test

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createVideo } from "../dist/index.js";

test("webm source gets the right mime type", () => {
  const video = createVideo({ src: "/clip.webm" });
  assert.match(video.render(video.state), /type="video\/webm"/);
});
```
