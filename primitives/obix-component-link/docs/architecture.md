# Architecture — `@obinexusltd/obix-component-link`

## DOP contract

`{ name: "ObixLink", state, actions, render }` — the same shape as every primitive in this monorepo; see the button package's [architecture.md](../../obix-component-button/docs/architecture.md) for the general contract.

## Two independent decisions, kept separate

`LinkState` tracks `external` and `target` as two separate fields rather than deriving one from the other on every render. This is deliberate:

- `looksExternal(href)` is a heuristic run once (at construction, or in `updateHref`) — a pure function of the URL string.
- `external` is then just state — `setExternal` lets you override the heuristic's conclusion directly (e.g. a same-origin link to a different subdomain that you still want to badge as leaving the current app) without touching `href` or re-running detection.

## `computeAriaLabel` as a pure helper, not a state field

The accessible name is *computed at render time* from `label`/`external`/`target`/`download`/`ariaLabel` rather than stored as a `LinkState` field. This keeps the state minimal (no derived data duplicated in state) while guaranteeing the aria-label is always consistent with the current `external`/`download`/`target` combination — there's no way for it to go stale the way a cached derived field could.

## Zero dependencies

`src/index.ts` imports only `./types.js`; `esc()` and `looksExternal()` are local, self-contained functions.
