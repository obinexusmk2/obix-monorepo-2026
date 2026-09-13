# `overlays/` — the `@obinexusltd/obix-component-*` overlays

`@obinexusltd/obix-component-overlays` (Modal, Dropdown, Tooltip) split into
**three independent, scoped, zero-dependency packages** — one overlay per
package, each publishable on its own. Same shape as the `primitives/` group.

| Package | Component | What it is |
|---|---|---|
| [`@obinexusltd/obix-component-modal`](./obix-component-modal) | `ObixModal` | dialog — `role="dialog"`, `aria-modal`, escape / backdrop close hooks |
| [`@obinexusltd/obix-component-dropdown`](./obix-component-dropdown) | `ObixDropdown` | menu / picker — `role="menu"`, `aria-expanded`, keyboard nav |
| [`@obinexusltd/obix-component-tooltip`](./obix-component-tooltip) | `ObixTooltip` | hover / focus info — `role="tooltip"`, `aria-describedby` |

Spec: **`docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md`** § Overlays.
The pre-existing `overlays/obix-component-overlays/` (an embedded git checkout
that re-exports from `@obinexusltd/obix`) is left untouched and is **not** a
workspace member.

## Shared contract

Each package exports `create<Name>(config)` and a `render<Name>(config, overrides?)`
one-liner. `create<Name>` returns the Data-Oriented component object:

```ts
interface DOPComponent<S> {
  name: string;                                       // "ObixModal", …
  state: S;
  actions: Record<string, (state: S, ...args) => S>;  // pure — never mutate input
  render: (state: S) => string;                       // deterministic accessible HTML
}
```

Overlays are **presentational** — `render` emits the correct roles, ARIA wiring,
and `data-*` hooks (`data-close-on-escape`, `data-activate-on`, `data-close-delay`,
`data-action`), but the focus trap, timers and event handlers are the
consumer's to wire.

## Rules

- **Zero dependencies** — no `dependencies`, no `devDependencies`. Types local to
  each package; the HTML escaper is inlined.
- **Independent** — no package imports another; no dependency on `@obinexusltd/obix`.
- **`src/` ships to npm** — `files: ["src","dist","README.md","LICENSE"]`, `exports` adds `"./src"`.
- Added to the root `workspaces` as three explicit entries (not an `overlays/*`
  glob, so the embedded `obix-component-overlays` is skipped). Frozen `packages/`
  graph and its CI gates unchanged.

## Build & test

```bash
npm install
npm run build:overlays
npm run test:overlays
```
