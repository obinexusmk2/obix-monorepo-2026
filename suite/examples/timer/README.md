# Timer example

The frozen OBIX 1.0 `Timer.obix` golden fixture
([`../../../packages/obix-timer/fixture/Timer.obix`](../../../packages/obix-timer/fixture/Timer.obix)),
rebuilt as a standard Web Component.

| `Timer.obix` section | here |
|---|---|
| `<script>` | [`Timer.ts`](Timer.ts) — a typed `ComponentDef` + `defineElement` |
| `<template>` | [`Timer.html`](Timer.html) — runtime `{marker}` / `data-on-*` / `data-bind-*` / `data-if` |
| `<style>` | [`Timer.css`](Timer.css) — scoped by shadow DOM |
| `Timer.test.obix` | [`Timer.test.mjs`](Timer.test.mjs) — the same six cases via `obix-test` |

## Run it

```bash
# from the monorepo root, after `npm install && npm run build:suite`
node --test suite/examples/timer/Timer.test.mjs

# or serve it
node suite/obix/dist/bin/obix.js dev --port 5173   # then open http://localhost:5173
node suite/obix/dist/bin/obix.js build --outdir /tmp/timer-dist
node suite/obix/dist/bin/obix.js check
```

## Parity

`Start → Tick → Tick → Stop` ⇒ `{ seconds: 2, running: false }`.
Terminal `Start → Tick×8` (`limitSeconds 5`) ⇒ `{ seconds: 5, running: false }`,
`finished = true`, `statusLabel = "Finished"` — identical to the frozen fixture,
and the `tick` effect quiesces on its own once `running` goes false.
