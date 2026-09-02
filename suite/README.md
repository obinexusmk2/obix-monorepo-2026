# OBIX suite — unscoped `obix-*`, version 0.3.0

Standard Web Components. **No `.obix` file, no compiler.** A component is a typed
`.ts` module + a `.html` template + a `.css` stylesheet — files a browser, a
bundler, and `tsc` understand directly.

Built **parallel** to the frozen 20-package `@obinexusltd/obix-*` graph in
[`../packages`](../packages), which is untouched (see
[`../docs/OBIX-1.0-LEVEL-0-...`](../docs)). This suite has its own version line
([`SUITE_VERSION`](SUITE_VERSION) = `0.3.0`) and its own build
(`node scripts/build-suite.mjs`).

| Package | Role |
|---|---|
| [`obix-core`](obix-core) | Runtime: data-oriented store, `{marker}` DOM binder, `ObixElement` Web Component base, `toFunc` / `toClass` projections, dev-time a11y audit. Zero deps. |
| [`obix-test`](obix-test) | Headless harness: virtual-clock `mountForTest`, `checkEquivalence`. Depends on `obix-core`. |
| [`obix`](obix) | Application suite + `obix` CLI (`create` / `dev` / `build` / `check`). Re-exports `obix-core`, namespaces `obix-test`. |

```bash
npm install
npm run build:suite
npm run test:suite
```

## Example

[`examples/timer`](examples/timer) — the frozen `Timer.obix` fixture rebuilt as a
standard Web Component (`Timer.ts` + `Timer.html` + `Timer.css`), with its six
behavioural cases re-expressed against `obix-test`.

## Architecture

[`../docs/OBIX-SUITE-0.3.0-DRAFT.md`](../docs/OBIX-SUITE-0.3.0-DRAFT.md).
