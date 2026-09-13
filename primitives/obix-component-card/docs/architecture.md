# Architecture — `@obinexusltd/obix-component-card`

## DOP contract

Same shape as every `obix-component-*` primitive:

```ts
interface DOPComponent<S> {
  name: string;       // "ObixCard"
  state: S;            // CardState
  actions: Record<string, Action<S>>;
  render: (state: S) => string;
}
```

`state` is derived once from `CardConfig` at `createCard()` time. All four actions (`startLoading`, `finishLoading`, `setDimensions`, `updateContent`) are pure — each returns a new object via `{ ...s, ... }` rather than mutating `s`.

## The skeleton branch in `render`

`render` is a single pure function, but it has two distinct output shapes gated on `showSkeleton`:

```
showSkeleton === true  → <article aria-busy="true"><div class="obix-card__skeleton" aria-hidden></div></article>
showSkeleton === false → <article>[figure?][heading?][body?]</article>
```

This is still a pure function of state — for the same `CardState`, the same branch and the same markup are produced every time. The branch exists so a consumer never has to special-case "is this card still loading" outside of the artifact: the state alone determines what `render` returns.

## Why `content` isn't escaped but `title` is

`title` is always plain visible text, so it is always escaped. `content` is explicitly documented as trusted HTML (see `CardConfig.content` in [api-reference.md](./api-reference.md)) so callers can compose richer bodies (lists, nested elements, pre-rendered sub-components) — the trade-off is that sanitization becomes the caller's responsibility, the same trust boundary `obix-component-modal`'s `content` field uses.

## Zero dependencies

`src/index.ts` imports only `./types.js`. The escaping helper is duplicated locally rather than pulled from a shared package — see the button package's [architecture.md](../../obix-component-button/docs/architecture.md) for why every primitive vendors this instead of sharing it.
