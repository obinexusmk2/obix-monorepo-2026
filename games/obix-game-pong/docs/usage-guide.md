# Usage Guide — `@obinexusltd/obix-game-pong`

## Install

```bash
npm install @obinexusltd/obix-game-pong
```

Zero runtime dependencies.

## Quickest start: `mountPong`

```html
<div id="game" aria-label="Pong game"></div>
<script type="module">
  import { mountPong } from "@obinexusltd/obix-game-pong";
  mountPong(document.getElementById("game"));
</script>
```

That's a full, playable game: default 800×450 court, `W`/`S` and `↑`/`↓`
paddles, `Space` to serve/pause/resume/restart, and an `aria-live` announcer
wired in automatically. See `examples/index.html` for a complete page
(neon styling + the Micro 5 font).

## Pointing at the art assets

`assets/images/*.png` ship inside the package. `mountPong`'s `assets` option
resolves the default filenames against a base URL — usually the package's
own `assets/` directory:

```ts
import { mountPong } from "@obinexusltd/obix-game-pong";

mountPong(document.getElementById("game"), {
  assets: new URL("../node_modules/@obinexusltd/obix-game-pong/assets/", import.meta.url),
});
```

If you're bundling, import the subpath directly instead and pass a resolved map:

```ts
import ball from "@obinexusltd/obix-game-pong/assets/images/ball.png";
import backgroundGrid from "@obinexusltd/obix-game-pong/assets/images/background-grid.png";
import paddleLeft from "@obinexusltd/obix-game-pong/assets/images/paddle-1.png";
import paddleRight from "@obinexusltd/obix-game-pong/assets/images/paddle-2.png";

mountPong(el, { assets: { ball, backgroundGrid, backgroundEmpty: backgroundGrid, paddleLeft, paddleRight } });
```

## Configuring the game

```ts
mountPong(document.getElementById("game"), {
  config: { width: 960, height: 540, winningScore: 21, ballSpeedIncrement: 1.05 },
});
```

## Remapping controls

```ts
mountPong(el, {
  controls: {
    left: { up: "KeyQ", down: "KeyA" },
    right: { up: "KeyP", down: "KeyL" },
  },
  serveKey: "Enter",
});
```

`KeyPair` values are [`KeyboardEvent.code`](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values) strings, not characters — this is layout-independent (`KeyW` is the key labeled W on a US layout regardless of the active input language).

## Driving the game programmatically

```ts
const controller = mountPong(el);
controller.dispatch("pause");
controller.getState().left.score;
controller.destroy(); // tears down listeners + the rAF loop
```

## Using the pure core without `mountPong`

If you're embedding this inside another rendering system (a game engine, a
different DOM diffing approach, a terminal renderer) skip `mountPong`
entirely and drive `createPong` yourself — see
[architecture.md](./architecture.md) for the full loop.

```ts
import { createPong } from "@obinexusltd/obix-game-pong";

const pong = createPong();
let state = pong.state;

function onFrame(dtSeconds: number) {
  state = pong.actions.step(state, dtSeconds);
  myRenderer.draw(pong.render(state));
}
```

## Server-side rendering

`renderPong`/`describePong` touch nothing but `state` — they run identically
in Node:

```ts
import { createPong, renderPong } from "@obinexusltd/obix-game-pong";

const { state } = createPong();
const html = renderPong(state); // safe to send as part of an SSR response
```
