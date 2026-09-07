# @obinexusltd/obix-core-web

Portable web contracts for OBIX with explicit **`/dom`** and **`/server`**
boundaries around the *existing* OBIX renderer. The portable root touches no DOM
global and no DOM type — importing it on a server is safe.

## The problem it owns

Web support splits cleanly in three: a **portable** surface that only inspects
capability, a **server** surface that renders to a string, and a **browser**
surface that mounts into the DOM and registers custom elements. Mixing them —
importing a DOM type into server code, calling `customElements.define` at module
load, fabricating HTML when no server renderer exists — is the bug. This package
keeps the three apart and delegates the actual rendering/mounting to code that
is already verified.

## API

```ts
// portable root — no DOM
import { inspectWebSupport, describeSuiteSSR, requireDom, CompatError } from "@obinexusltd/obix-core-web";
// server — DOM-free, injected renderer
import { renderComponentToString, suiteServerRendering } from "@obinexusltd/obix-core-web/server";
// browser only
import { attachWebHost, detachWebHost, defineElement } from "@obinexusltd/obix-core-web/dom";
```

| Entry | Export | Description |
|-------|--------|-------------|
| `.` | `inspectWebSupport({ serverRenderer? })` | `{ dom, domCapability, serverRenderer, suiteSSR }` — **no DOM access**. |
| `.` | `describeSuiteSSR()` | `{ supported: false, reason }` — the 0.3.0 suite (`obixjs`) has no SSR; it is deferred upstream. Reported, never faked. |
| `.` | `requireDom(op)` | Throws `web/dom-required` off a window context. |
| `/server` | `renderComponentToString(artifact, { renderer, state?, props? })` | Delegates to the **injected** `renderer`. With no renderer → `web/ssr-unsupported`. Never invents markup. |
| `/server` | `suiteServerRendering` | `= describeSuiteSSR()`. |
| `/dom` | `attachWebHost(el, artifact, { adapter?, coalesce? })` | Mount via an injected adapter, or a built-in string paint that **preserves focus + caret** and repaints only on change. `coalesce` batches `update()` bursts through `@obinexusltd/obix-core-scheduler`. |
| `/dom` | `defineElement(tag, { create, adapter?, coalesce?, observedAttributes? })` | The **only** `customElements.define` in the package. Reconnect-safe, single cleanup on disconnect, folds initial attributes into state. |

## Example (JavaScript) — server, with the frozen SSR adapter injected

```js
import { renderComponentToString } from "@obinexusltd/obix-core-web/server";
import { renderToString } from "@obinexusltd/obix-adapter-ssr"; // the existing DOM-free renderer

const counter = { name: "counter", state: { n: 3 }, render: (s) => `<p>n=${s?.n ?? 0}</p>` };

const html = renderComponentToString(counter, { renderer: renderToString, state: { n: 3 } });
// with no `renderer:` -> throws CompatError { code: "web/ssr-unsupported" }
```

## Example (TypeScript) — browser custom element

```ts
import { defineElement } from "@obinexusltd/obix-core-web/dom";

defineElement("acme-counter", {
  observedAttributes: ["n"],
  coalesce: true, // collapse an attribute burst into one repaint
  create: () => ({
    state: { n: 0 },
    actions: { attributeChanged: (s, name, v) => (name === "n" ? { ...s, n: Number(v) } : s) },
    render: (s: { n: number }) => `<button>n=${s.n}</button>`,
  }),
});
```

## Host support (verified 2026-09-07)

| Surface | Status |
|---------|--------|
| portable root + `/server` imported with **every** DOM global absent | ✅ tested — Node 26.7.0 / Deno 2.9.6 / Bun 1.4.2, Win x64 |
| built `dist/index.js` + `dist/server.js` contain no DOM usage; one `customElements.define` total (in `dist/dom.js`) | ✅ tested |
| `/server` refuses to fabricate HTML; honours an injected renderer | ✅ tested |
| `/dom` connect/disconnect/**reconnect** dedup, single define, focus + caret across repaint, repaint coalescing | ✅ tested — real **Chromium** (Playwright 1.63, Windows) |
| Firefox / WebKit | ❌ **not-tested** until a lane runs them |
| suite (`obixjs`) SSR | explicitly **unsupported** (deferred in `OBIX-SUITE-0.3.0-DRAFT`) |

## Fallbacks

- No injected mount adapter → a minimal built-in painter: `el.innerHTML` scoped
  to the element, written **only when the markup changed**, with focus + text
  selection snapshotted and restored around the write.
- No injected server renderer → **no fallback**; `web/ssr-unsupported` is thrown.
  The suite SSR situation is reported, never substituted with generated markup.
- `coalesce` absent → `update()` paints synchronously.

## Errors

`CompatError`: `web/dom-required` (a `/dom` entrypoint used with no `document`)
and `web/ssr-unsupported` (`renderComponentToString` with no `renderer`, or an
artifact with no `render`).

## Boundary

No renderer, no reactivity system, no component library. It composes
`@obinexusltd/obix-core-capabilities` and `@obinexusltd/obix-core-scheduler`
only; the DOM mount adapter and the string renderer are **injected**.

MIT — OBINexus Computing
