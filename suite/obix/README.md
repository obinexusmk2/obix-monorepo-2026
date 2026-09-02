# obix

**The OBIX application suite.** One dependency for a whole app: re-exports the
[`obix-core`](../obix-core) runtime, namespaces [`obix-test`](../obix-test) under
`Test`, and ships the `obix` CLI.

```bash
npm install obix          # dev dependency; obix-core is the runtime dependency
npx obix create my-app
```

## CLI

| Command | What it does |
|---|---|
| `obix create <dir>` | Scaffold a standard HTML/CSS/TS Web Component app (`index.html`, `styles.css`, `src/components/*`). |
| `obix dev [--port n]` | Zero-bundle dev server: static files, on-the-fly `*.ts` transpile (esbuild `transform`), `obix-core` resolved via an injected import map, live reload over SSE. Default port `5173`. |
| `obix build [--outdir dir]` | esbuild-bundle every `<script type="module">` in `index.html`, hash the outputs into `<outdir>/assets/`, copy stylesheet links, rewrite the HTML. Component `new URL("./x.html", import.meta.url)` assets are copied and keep working via `fetch`. Default outdir `dist/`. |
| `obix check [--no-types]` | Accessibility audit (`obix-core.auditHtml`) of every `*.html`, then `tsc --noEmit` when a `tsconfig.json` and local `typescript` are present. Non-zero exit on any a11y error or type error. |

## Programmatic

```ts
import { defineElement, createStore, Test } from "obix";
import { build, check } from "obix";

await build({ cwd: "./my-app", outdir: "dist" });
```

`export * from "obix-core"` — every core export (`defineElement`, `createStore`,
`bindRoot`, `toFunc`, `toClass`, `auditHtml`, types …) is available from `obix`
too. `Test` is the full `obix-test` surface.

## No `.obix`

There is no OBIX file format and no compiler. A component is a `.ts` module (a
typed `ComponentDef` + `defineElement`), a `.html` template, and a `.css`
stylesheet — plain web files that a browser, a bundler, and `tsc` all understand
directly.

## Status

Level 0. Deferred: SSR / declarative shadow DOM, richer scaffold templates,
polyglot service calls (LibPolyCall) — see `docs/OBIX-SUITE-0.3.0-DRAFT.md`.
