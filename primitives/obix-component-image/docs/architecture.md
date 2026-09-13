# Architecture — `@obinexusltd/obix-component-image`

## DOP contract

Same `{ name: "ObixImage", state, actions, render }` shape as every primitive in this monorepo. `render(state)` is a pure function — it never reads `loaded`/`errored` to change its output; those two fields exist purely as state for *your* application logic (e.g. showing your own placeholder while `loaded` is false) rather than being reflected in the emitted `<img>` markup.

## Validation at construction, not at render

`createImage` validates `src`/`alt` once, at construction time (`throw` if missing). `render` itself performs no validation — it trusts the `ImageState` it's given, including states produced via `overrides` in `renderImage`. This keeps `render` a total, always-succeeding function, with the fail-fast behaviour concentrated in one place.

## `dim()` — numeric-or-string dimensions

`width`/`height` accept either a `string` (used as-is, so you can pass units) or a `number` (stringified with no unit — matching the native `<img width>`/`<img height>` attributes, which are unitless pixel values per the HTML spec). This mirrors the platform's own attribute semantics rather than inventing a new convention.

## Zero dependencies

`src/index.ts` imports only `./types.js`; escaping and dimension coercion are local helpers, not external utilities.
