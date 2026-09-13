# Usage Guide — `@obinexusltd/obix-adapter-ssr`

## Install

```bash
npm install @obinexusltd/obix-adapter-ssr
```

Zero runtime dependencies. DOM-free by construction — safe to import in a server (Node) process with no browser globals available.

## Rendering on the server

```ts
import { renderToString } from "@obinexusltd/obix-adapter-ssr";
import { createButton } from "@obinexusltd/obix-component-button";

const html = renderToString(createButton({ label: "Save" }) as any);
// send `html` as part of the server response
```

## Folding a request's actions before rendering

```ts
import { renderTrace } from "@obinexusltd/obix-adapter-ssr";

const trace = [["inc"], ["inc"], ["inc"]] as const;
const html = renderTrace(Counter, trace);
```

## Hydration payloads

```ts
import { renderDocument } from "@obinexusltd/obix-adapter-ssr";

const doc = renderDocument(Counter, { trace: [["inc"], ["inc"]] });
// respond with doc.html, and embed doc.state as JSON for the client to hydrate from:
// <script>window.__STATE__ = ${JSON.stringify(doc.state)}</script>
```

The client then constructs its own projection (e.g. `toReactive(Counter)({ state: window.__STATE__ })`) starting from the exact state the server rendered — no need to replay the trace again on the client.

## Verifying every projection agrees

```ts
import { compliance } from "@obinexusltd/obix-adapter-ssr";
// wire real Data/Func/OOP/Reactive/SSR modules — see compliance.md
const checkCompliance = compliance({ Data, Func, OOP, Reactive, SSR: { renderToString } });
checkCompliance(Counter, [["inc"], ["inc"]]); // throws ComplianceError if any projection disagrees
```

See [api-reference.md](./api-reference.md) for the full function list and [compliance.md](./compliance.md) for what "agrees" means precisely.
