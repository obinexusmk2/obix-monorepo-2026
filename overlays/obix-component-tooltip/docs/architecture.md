# Architecture — `@obinexusltd/obix-component-tooltip`

## DOP contract

`{ name: "ObixTooltip", state, actions, render }` — the shared contract described in the button package's [architecture.md](../../../primitives/obix-component-button/docs/architecture.md).

## Two sibling elements, linked by id — not nested

`render()` returns the trigger `<span>` and the tooltip `<div>` concatenated as siblings, connected only via `aria-describedby="${id}"` / `id="${id}"`. They are not nested (`<span><div>...</div></span>`) because a tooltip's positioning is typically relative to the *viewport* near the trigger, not constrained inside the trigger's own box — keeping them as siblings gives a consuming app's CSS/positioning logic (or a portal-style DOM move) room to place the tooltip anywhere without fighting the trigger's `overflow`/`position` context.

## Timing is data, not behaviour

`delay`/`closeDelay` are stored as plain numbers and rendered as `data-*` attributes; no `setTimeout` exists inside this package. This keeps `render` a pure function with no side effects and no hidden timers — exactly like `obix-component-modal`'s `data-close-on-escape` pattern, applied to timing instead of key/click handling.

## Zero dependencies

`src/index.ts` imports only `./types.js`.
