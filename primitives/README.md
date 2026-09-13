# `primitives/` — the `@obinexusltd/obix-component-*` primitives

`@obinexusltd/obix-component-primitives` (Button, Card, Image, Video, Link) split
into **five independent, scoped, zero-dependency packages** — one primitive per
package, each publishable on its own.

| Package | Component | What it is |
|---|---|---|
| [`@obinexusltd/obix-component-button`](./obix-component-button) | `ObixButton` | clickable action trigger — loading, toggle, sizes, 48px touch target |
| [`@obinexusltd/obix-component-card`](./obix-component-card) | `ObixCard` | content container — explicit dimensions (CLS), loading skeleton |
| [`@obinexusltd/obix-component-image`](./obix-component-image) | `ObixImage` | responsive image — lazy loading, aspect-ratio, alt enforced |
| [`@obinexusltd/obix-component-video`](./obix-component-video) | `ObixVideo` | media player — native `<track>` captions, transcript link |
| [`@obinexusltd/obix-component-link`](./obix-component-link) | `ObixLink` | semantic anchor — external indicator, safe `rel` defaults |

Spec for every component: **`docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md`**
(§ Primitives). Category overview: `…PART1.md` § "The 30 Components Overview → Category 1".

## Shared contract

Each package exports `create<Name>(config)` and a `render<Name>(config, overrides?)`
one-liner. `create<Name>` returns the Data-Oriented component object from the docs:

```ts
interface DOPComponent<S> {
  name: string;                                   // "ObixButton", …
  state: S;                                       // derived from config
  actions: Record<string, (state: S, ...args) => S>;  // pure — never mutate input
  render: (state: S) => string;                   // deterministic accessible HTML
}
```

## Rules

- **Zero dependencies** — no `dependencies`, no `devDependencies`. Types are local
  to each package (`src/types.ts`); the ~6-line HTML escaper is inlined.
- **Independent** — no package imports another; no dependency on `@obinexusltd/obix`
  or the frozen `packages/` graph.
- **`src/` ships to npm** — `files: ["src","dist","README.md","LICENSE"]`, `exports` adds `"./src"`.
- **Accessibility is not optional** — WCAG 2.1 AA behaviours (touch targets, ARIA,
  captions, alt text, `rel` safety) are baked into `render`, not left to the caller.
- Parallel to `adapters/` and the frozen `packages/` graph — added to the root
  `workspaces`; nothing in `packages/` or its CI gates changes.

## Build & test

```bash
npm install
npm run build:primitives
npm run test:primitives
```
