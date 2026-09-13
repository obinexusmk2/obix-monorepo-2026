# API Reference — `@obinexusltd/obix-game-pong`

## `createPong(config?: PongConfig): DOPComponent<PongState>`

Builds a fresh game artifact — pure data plus pure functions, no DOM.

```ts
import { createPong } from "@obinexusltd/obix-game-pong";

const pong = createPong({ winningScore: 5 });
pong.render(pong.state); // an SVG string
```

## `PongConfig`

| Field | Type | Default | Notes |
|---|---|---|---|
| `width` | `number` | `800` | Court width in px. |
| `height` | `number` | `450` | Court height in px. |
| `paddleWidth` | `number` | `16` | |
| `paddleHeight` | `number` | `90` | |
| `paddleSpeed` | `number` | `480` | px/second at a full `movePaddle` delta. |
| `ballRadius` | `number` | `10` | |
| `ballSpeed` | `number` | `320` | px/second at serve. |
| `ballSpeedIncrement` | `number` | `1.08` | Multiplier applied to ball speed on every paddle hit. |
| `maxBallSpeed` | `number` | `900` | Hard cap regardless of how long a rally runs. |
| `winningScore` | `number` | `11` | First side to reach this wins. |

Paddles sit `24px` in from each edge (not configurable) and start vertically centered.

## `PongState`

`width`, `height`, `paddleSpeed`, `initialBallSpeed`, `ballSpeedIncrement`, `maxBallSpeed`,
`winningScore` (all resolved from config), plus:

| Field | Type | Notes |
|---|---|---|
| `left`, `right` | `PaddleState` | `{ x, y, width, height, score }` |
| `ball` | `BallState` | `{ x, y, vx, vy, radius }` |
| `status` | `"serving" \| "playing" \| "paused" \| "gameOver"` | |
| `winner` | `"left" \| "right" \| null` | Set only once `status === "gameOver"`. |
| `rally` | `number` | Consecutive paddle hits since the last serve; resets to `0` on every score. |

## Actions

All pure `(state, ...args) => newState`. Available on `pong.actions` and individually exported.

| Action | Signature | Behaviour |
|---|---|---|
| `movePaddle` | `(s, side: Side, delta: number) => s` | Moves a paddle by `delta` px, clamped to the court. No-op once `status === "gameOver"`. |
| `step` | `(s, dtSeconds: number) => s` | Advances the ball one physics tick. No-op unless `status === "playing"`. See [physics.md](./physics.md). |
| `serve` | `(s, towards: Side, angle?: number) => s` | Launches the ball from center toward `towards`, `angle` (radians, clamped to ±60°) steering it off-horizontal. Sets `status: "playing"`. |
| `pause` | `(s) => s` | `"playing" → "paused"`; no-op otherwise. |
| `resume` | `(s) => s` | `"paused" → "playing"`; no-op otherwise. |
| `reset` | `(s) => s` | Zeroes both scores, re-centers the ball, returns to `"serving"`. |

## `renderPong(state: PongState, assets?: PongAssets): string`

Returns a deterministic SVG string for `state`. Same state + same assets always produces the exact same string — see [testing.md](./testing.md).

## `describePong(state: PongState): string`

A one-line human-readable summary (`"Left 3, right 2. In play."`) intended for an `aria-live` region, not for display in the game itself.

## `mountPong(container: HTMLElement, options?: MountOptions): PongController`

The only DOM-touching entry point. See [usage-guide.md](./usage-guide.md) and [accessibility.md](./accessibility.md).

```ts
interface MountOptions {
  config?: PongConfig;
  assets?: PongAssets | string | URL;   // resolved base, or a pre-resolved map
  controls?: { left?: KeyPair; right?: KeyPair };
  serveKey?: string;                     // default "Space"
  onStateChange?: (state: PongState) => void;
}
interface PongController {
  getState(): PongState;
  dispatch(action: keyof DOPComponent<PongState>["actions"], ...args: unknown[]): void;
  destroy(): void;
}
```

## Assets

`PONG_ASSET_FILES`, `PONG_ASSETS`, `resolveAssets(baseUrl)`, `PONG_ASSET_CREDIT`, `PONG_FONT` — see [usage-guide.md](./usage-guide.md) for how to point them at your own hosting.

## Physics helpers

`bounceOffWalls`, `ballOverlapsPaddle`, `resolvePaddleHit`, `whoConceded`, `movePaddleWithin`, `integrateBall`, `speedOf`, `clamp` — exported individually for anyone who wants to build a different action set on the same primitives. See [physics.md](./physics.md).

## Exported types

`Side`, `GameStatus`, `BallState`, `PaddleState`, `PongConfig`, `PongState`, `Action<S>`, `DOPComponent<S>`, `PongAssets`, `KeyPair`, `MountOptions`, `PongController`.
