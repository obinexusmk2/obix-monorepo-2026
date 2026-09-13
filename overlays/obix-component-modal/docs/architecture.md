# Architecture — `@obinexusltd/obix-component-modal`

## DOP contract

`{ name: "ObixModal", state, actions, render }` — the same shape every `obix-component-*` package uses. `render` here is notable for having a true early-return branch: `if (!s.isOpen) return "";` — the *entire* render output collapses to nothing rather than a hidden-but-present element.

## Behaviour is expressed as data attributes, not code

`closeOnEscape` and `closeOnBackdropClick` are rendered as `data-close-on-escape` / `data-close-on-backdrop` rather than this package attaching `keydown`/`click` listeners itself. This keeps the package DOM-free and dependency-free — it never touches `document`/`window` — while still letting a consuming app read the *configured intent* off the rendered markup instead of threading the original `ModalConfig` through separately. See [usage-guide.md](./usage-guide.md) for the listener code this implies you write.

## Why actions are declarative data (`ModalAction[]`)

Footer buttons are described as `{ label, variant, action }` objects rather than passed as callback functions. A `DOPComponent`'s `render` must be a pure function of state — it cannot close over live callbacks and remain serializable/comparable the way the `obix-adapter-ssr` compliance checker requires (two states must produce byte-identical HTML). Encoding the action as a `data-action` string, resolved by the consumer's own event delegation, keeps `ModalState` (and therefore `render`'s output) plain data.

## Zero dependencies

`src/index.ts` imports only `./types.js`.
