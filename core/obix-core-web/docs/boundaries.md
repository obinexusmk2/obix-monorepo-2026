# The three web boundaries

| Entry | May touch `document` / `window` / `HTMLElement` / `customElements` | Imports |
|-------|--------------------------------------------------------------------|---------|
| `.` (portable root) | **no** | `obix-core-capabilities` |
| `/server` | **no** | `obix-core-capabilities` |
| `/dom` | **yes** — this is the only place | `obix-core-capabilities`, `obix-core-scheduler` |

A contract test reads the built `dist/index.js` and `dist/server.js` and fails if
either matches `customElements`, `HTMLElement`, `.innerHTML`, `new Worker`,
`document.<ident>` or `window.<ident>`. A feature probe (`typeof
(globalThis as any).document !== "undefined"`) is allowed — it cannot throw on a
server and reads nothing.

## Portable root

`inspectWebSupport()` returns `{ dom, domCapability, serverRenderer, suiteSSR }`
using only `obix-core-capabilities` and a `typeof` probe. `requireDom(op)` throws
`web/dom-required` when there is no `document` — the `/dom` functions call it
first.

## Server

`renderComponentToString(artifact, { renderer, state?, props? })` **delegates**
to the injected `renderer`. It has no renderer of its own. With no `renderer`
it throws `web/ssr-unsupported` — it never returns fabricated HTML.

`@obinexusltd/obix-adapter-ssr` already ships a real DOM-free
`renderToString(artifact, opts)`; inject that for frozen-track DOP components.
The 0.3.0 **suite** umbrella (`obixjs`) has no SSR — `describeSuiteSSR()` reports
`{ supported: false, reason }` and that is all it ever does.

## DOM

`defineElement(tag, opts)` is the sole `customElements.define` call.

- **Reconnect dedup.** `connectedCallback` returns early if a live handle already
  exists (element moved, not recreated). `disconnectedCallback` defers cleanup a
  microtask and only detaches if `!isConnected` — a same-tick move keeps the
  mount, so listeners/subscriptions are not rebound.
- **Single cleanup.** `attachWebHost`'s handle `detach()` is idempotent; the
  custom element calls it exactly once.
- **Initial attributes.** current observed-attribute values are folded into the
  artifact's initial state before the first paint (the upgrade-time
  `attributeChangedCallback` fires before the handle exists and is ignored).
- **Focus + caret.** the built-in painter snapshots `document.activeElement`'s
  child-index path and text selection, writes `el.innerHTML` (scoped to the
  element, not the container), then restores them. Markup identical to the last
  paint is skipped entirely.
- **Repaint coalescing.** with `coalesce: true` (or an injected `SchedulerAPI`),
  synchronous `update()` calls within a tick collapse to one paint via
  `obix-core-scheduler`; `detach()` cancels any pending repaint.

Verified in real Chromium (`test/browser/dom.browser.mjs`, Playwright 1.63).
Firefox and WebKit stay `not-tested` until a lane runs them.
