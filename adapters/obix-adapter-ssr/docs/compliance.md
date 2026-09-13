# Compliance — `@obinexusltd/obix-adapter-ssr`

## What "compliance" means

For a given artifact and action trace, **every projection must render identical HTML and reach identical state**. `compliance()` builds a checker that proves this automatically instead of relying on each adapter's own tests to happen to agree.

## `compliance(projections: Projections)`

Returns `checkCompliance(artifact, trace?, opts?): ComplianceReport`, which:

1. Computes the **reference**: folds `trace` through `Projections.Data.replay`, then renders that state with `Projections.SSR.renderToString` (this package's own `renderToString`, in practice).
2. Independently drives the **same trace** through `data`, `func`, `oop`, `reactive`, and `ssr` (itself), collecting each one's final HTML and state.
3. Compares every row's `html`/`state` against the reference (`html === refHtml`, and a structural `deepEqual` for state — not reference equality, since each projection produces its own object).
4. Returns a `ComplianceReport`; throws `ComplianceError` if any row disagrees.

```ts
interface ComplianceRow { projection: string; html: string; state: unknown; htmlOk: boolean; stateOk: boolean; }
interface ComplianceReport {
  component: string;
  reference: { html: string; state: unknown };
  rows: ComplianceRow[]; // always ["data", "func", "oop", "reactive", "ssr"], in that order
  ok: boolean;
}
```

## `ComplianceError`

```ts
class ComplianceError extends Error {
  readonly component: string;
  readonly report: ComplianceReport;
}
```

The error message names exactly which projections diverged (e.g. `"[obix] Counter: projections disagree — oop diverge from ssr"`), and the full `report` is attached to the error object for programmatic inspection.

## Why `deepEqual` for state but `===` for HTML

HTML is a string — rendering the same state through the same `render` function must produce the exact same string, so reference/value equality (`===`) is the right (and strictest) check. State, on the other hand, is a fresh object per projection (each one clones/constructs its own copy) — comparing by reference would always fail even when every field matches, so `compliance` uses a structural `deepEqual` instead.

## Wiring it for real use

`obix-adapter-ssr` never imports the other four projections (see [architecture.md](./architecture.md)) — the `Projections` object must be supplied by the caller. In this monorepo, that wiring lives in `@obinexusltd/obix` (the umbrella package), which imports all five and re-exports a bound `checkCompliance`. See [testing.md](./testing.md) for how this package's own test supplies inline stub projections instead, to avoid a circular/sibling import from the adapter's tests.
