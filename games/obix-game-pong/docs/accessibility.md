# Accessibility — `@obinexusltd/obix-game-pong`

Real-time twitch gameplay has hard accessibility limits — there is no fully
equivalent screen-reader experience for "track a moving ball and react in
under 200ms." This package mitigates what it reasonably can rather than
claiming full parity.

## Keyboard-first controls

Both paddles are keyboard-controlled by default (`W`/`S` and `↑`/`↓`) — the
game is never mouse-only. `mountPong`'s `controls` option remaps either
paddle to any `KeyboardEvent.code`, e.g. for one-handed play or a
different physical layout; see [usage-guide.md](./usage-guide.md).

## The `aria-live` announcer

`mountPong` creates a visually-hidden `role="status"` / `aria-live="polite"`
element alongside the game and updates it — via the pure
`describePong(state)` — whenever the *announced summary text actually
changes* (a score, a status transition), never on every animation frame.
A screen reader user gets "Left 3, right 2. In play." the moment a point is
scored, without a firehose of per-frame position updates drowning out
everything else on the page.

## `role="img"` + a live `aria-label` on the SVG

`renderPong` sets `role="img"` and a full `describePong(state)` string as
the SVG's own `aria-label`, so even without the separate live region, the
game element itself always exposes an accurate current-state description
to assistive tech that inspects it directly.

## Status is never conveyed by color alone

The center overlay ("Press Space to serve", "Paused", "{side} player
wins") is real text, not a color or icon change — every status transition
is legible without color vision, and is included in the `describePong`
summary that drives the live region.

## Reduced motion

This package does not currently branch on `prefers-reduced-motion`; the
core gameplay loop is continuous ball motion, which cannot be meaningfully
paused without changing the game. If you need a reduced-motion mode,
`pause()` is a real, pure action — you can wire a "reduce motion" toggle in
your own page that calls `controller.dispatch("pause")` and hides the game
area, using [`mountPong`'s `onStateChange`](./api-reference.md) to know
when it's safe to do so.

## Focus management

`mountPong` gives the container a `tabindex` (if it doesn't already have
one) so it's keyboard-reachable, and applies `:focus-visible` styling in
the example stylesheet — but the surrounding page is responsible for a
sensible tab order (e.g. not trapping focus inside the game).

## Color and contrast

The default renders use `currentColor` for the net line and CSS custom
properties are the intended theming hook for score/overlay text color
(see `examples/styles.css`) — pick a foreground color with sufficient
contrast against whichever background art (`backgroundGrid` or
`backgroundEmpty`) you use.
