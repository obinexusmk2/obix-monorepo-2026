# Architecture — `@obinexusltd/obix-component-video`

## DOP contract

`{ name: "ObixVideo", state, actions, render }` — see the button package's [architecture.md](../../obix-component-button/docs/architecture.md) for the shared contract every primitive follows.

## Derived state computed once, at construction

`defaultCaption` (which track's `srcLang` should be `activeCaptions` initially) is computed once inside `createVideo`, from `config.tracks`, and stored directly into `VideoState.activeCaptions` — it is not recomputed on every render. This mirrors the pattern in `obix-component-card` (skeleton branch) and `obix-component-link` (`computeAriaLabel`): expensive-to-explain-but-cheap-to-compute derivations either happen once at construction (here) or purely at render time (link's aria-label) — never cached in a way that could silently drift from the state it was derived from.

## `mimeFor` and `clamp` — small vendored helpers

Rather than depending on a media-type library, `mimeFor` handles exactly the three extensions this package's own tests exercise (`.mp4`, `.webm`, `.ogg`/`.ogv`), defaulting to `video/mp4`. `clamp` is a two-line numeric helper used by `setVolume`/`seek`. Both are intentionally minimal — see [testing.md](./testing.md) for what's covered — rather than pulling in a general-purpose MIME-sniffing dependency for a handful of known cases.

## Zero dependencies

`src/index.ts` imports only `./types.js`.
