# @obinexusltd/obix-adapter-ssr

**The SSR projection — and the compliance reference for `@obinexusltd/obix`.**

Two jobs:

1. **Server-side render** a DOP component to an HTML string. DOM-free by
   construction — the source mentions no `window`, `document`, `Element`,
   `Node` or `addEventListener` (there is a test that greps for them).
2. **Define compliance.** For a given action trace, the string this projection
   renders is the reference that `data`, `func`, `oop` and `reactive` must match,
   byte for byte, and the state they must reach.

```bash
npm install @obinexusltd/obix-adapter-ssr
```

> **Zero dependencies.** Shared reducer vendored in `src/dop.ts`. The other four
> projections are **injected** into `compliance()`, never imported.

## API

```ts
import { renderToString, renderTrace, renderDocument } from "@obinexusltd/obix-adapter-ssr";

renderToString(Counter);                              // '<button aria-label="count: 0">0</button>'
renderToString(Counter, { state: { count: 7 } });     // '...>7</button>'
renderTrace(Counter, [["inc"], ["inc"], ["inc"]]);    // fold then render → '...>3</button>'

const doc = renderDocument(Counter, { trace: [["inc"], ["inc"]] });
// { name: "Counter", html: "...>2</button>", state: { count: 2 } }  ← dynamo-style payload
```

| Export | Purpose |
|---|---|
| `renderToString(c, opts?)` | render a state to HTML (no DOM) |
| `renderTrace(c, trace, opts?)` | fold the trace, then render — the "final frame" |
| `renderDocument(c, opts?)` | `{ name, html, state }` server payload for hydration |
| `toView(c, opts?)` | the render view (`state` + `props` + `derived`) without rendering |
| `compliance(projections)` | → `checkCompliance(c, trace?, opts?)` |
| `ComplianceError` | thrown by `checkCompliance` with a per-projection `report` |

## Compliance

```ts
import { compliance } from "@obinexusltd/obix-adapter-ssr";
import * as Data from "@obinexusltd/obix-adapter-data";
import * as Func from "@obinexusltd/obix-adapter-func";
import * as OOP from "@obinexusltd/obix-adapter-oop";
import * as Reactive from "@obinexusltd/obix-adapter-reactive";
import * as SSR from "@obinexusltd/obix-adapter-ssr";

const checkCompliance = compliance({ Data, Func, OOP, Reactive, SSR });

const report = checkCompliance(Counter, [["inc"], ["inc"], ["inc"]]);
// report.ok === true
// report.rows: one per projection, each { html, state, htmlOk, stateOk }
// throws ComplianceError if any projection's html or state diverges from ssr
```

`@obinexusltd/obix` wires this for you and re-exports it as `checkCompliance`.
See `OBIX_JSX_ADAPTER_ARCHITECTURE.md` — "Paradigm Agnostic" — and the dynamo
"server-side compliant" bundler POC this projection's document payload echoes.
