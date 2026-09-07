import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  describeSuiteSSR,
  inspectWebSupport,
  requireDom,
  CompatError,
} from "../dist/index.js";
import {
  renderComponentToString,
  suiteServerRendering,
  describeSuiteSSR as ssrFromServer,
} from "../dist/server.js";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const read = (f) => readFileSync(new URL(f, new URL("../dist/", import.meta.url)), "utf8");

// A frozen-track DOP artifact (name/state/actions/render).
const counter = {
  name: "counter",
  state: { n: 2 },
  actions: { inc: (s) => ({ ...s, n: s.n + 1 }) },
  render: (s) => `<p>n=${s?.n ?? 0}</p>`,
};

// ── portable root: no DOM anywhere, import must not throw ────────────────────
test("portable root imported with every DOM global absent does not throw and exposes its API", async () => {
  const saved = {};
  for (const k of ["document", "window", "HTMLElement", "customElements", "Element", "navigator"]) {
    saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    // eslint-disable-next-line no-undef
    if (saved[k]) delete globalThis[k];
  }
  try {
    const mod = await import("../dist/index.js?fresh=" + Date.now());
    assert.equal(typeof mod.inspectWebSupport, "function");
    assert.equal(typeof mod.describeSuiteSSR, "function");
    assert.equal(typeof mod.requireDom, "function");
    assert.equal(typeof mod.CompatError, "function");
    const srv = await import("../dist/server.js?fresh=" + Date.now());
    assert.equal(typeof srv.renderComponentToString, "function");
    assert.equal(srv.suiteServerRendering.supported, false);
  } finally {
    for (const [k, d] of Object.entries(saved)) if (d) Object.defineProperty(globalThis, k, d);
  }
});

// ── built-output purity: DOM stays out of portable / server ─────────────────
test("dist/index.js and dist/server.js contain no DOM usage (probes via globalThis are allowed)", () => {
  const forbidden = [
    /\bcustomElements\b/,
    /\bHTMLElement\b/,
    /\bHTMLInputElement\b/,
    /\.innerHTML\b/,
    /\bnew Worker\b/,
    /\bdocument\.[A-Za-z]/, // `document.createElement(...)`  (NOT `g.document` typeof probe)
    /\bwindow\.[A-Za-z]/,
    /\.addEventListener\b/,
  ];
  for (const f of ["index.js", "server.js"]) {
    const src = read(f);
    for (const re of forbidden) {
      assert.ok(!re.test(src), `dist/${f} must not match ${re}`);
    }
  }
});

test("dist/dom.js is the only module that registers a custom element (exactly one define call)", () => {
  const dom = read("dom.js");
  const defines = (dom.match(/customElements\.define\s*\(/g) || []).length;
  assert.equal(defines, 1, "exactly one customElements.define in the whole package");
  assert.equal((read("index.js").match(/customElements\.define\s*\(/g) || []).length, 0);
  assert.equal((read("server.js").match(/customElements\.define\s*\(/g) || []).length, 0);
  // dom.js does use DOM — that is its job.
  assert.match(dom, /extends HTMLElement/);
});

test("dist/index.d.ts and dist/server.d.ts do not surface a DOM lib type", () => {
  for (const f of ["index.d.ts", "server.d.ts"]) {
    const dts = read(f);
    for (const re of [/\bHTMLElement\b/, /\bElement\b(?!ary)/, /\bNode\b(?!Next)/, /\bcustomElements\b/]) {
      assert.ok(!re.test(dts), `dist/${f} must not expose ${re}`);
    }
  }
});

// ── server: nothing is fabricated ──────────────────────────────────────────
test("renderComponentToString without an injected renderer throws web/ssr-unsupported (no fabricated HTML)", () => {
  let err;
  try {
    renderComponentToString(counter);
  } catch (e) {
    err = e;
  }
  assert.ok(err instanceof CompatError, "throws a CompatError");
  assert.equal(err.code, "web/ssr-unsupported");
  assert.equal(err.package, "obix-core-web");
  assert.match(err.reason, /server-side rendering|renderer/i);
});

test("renderComponentToString delegates verbatim to the injected renderer", () => {
  let seen;
  const renderer = (artifact, opts) => {
    seen = { artifact, opts };
    return `<counter>${artifact.render(opts?.state)}</counter>`;
  };
  const html = renderComponentToString(counter, { renderer, state: { n: 7 }, props: { id: "c1" } });
  assert.equal(html, "<counter><p>n=7</p></counter>");
  assert.equal(seen.artifact, counter);
  assert.deepEqual(seen.opts, { state: { n: 7 }, props: { id: "c1" } });
});

test("renderComponentToString rejects an artifact with no render()", () => {
  assert.throws(
    () => renderComponentToString({ name: "x" }, { renderer: () => "nope" }),
    (e) => e instanceof CompatError && e.code === "web/ssr-unsupported" && /render\(\)/.test(e.reason),
  );
});

test("suite SSR is reported unsupported, consistently, from both entrypoints", () => {
  const a = describeSuiteSSR();
  const b = ssrFromServer();
  assert.equal(a.supported, false);
  assert.equal(b.supported, false);
  assert.equal(suiteServerRendering.supported, false);
  assert.ok(a.reason.length > 20 && /defer/i.test(a.reason));
  assert.deepEqual(a, b);
});

// ── inspectWebSupport: no DOM access, honest fields ────────────────────────
test("inspectWebSupport reports no DOM on this non-browser runtime without touching the DOM", () => {
  const s = inspectWebSupport();
  assert.equal(s.dom, false);
  assert.ok(["available", "unavailable", "denied", "unknown"].includes(s.domCapability));
  assert.equal(s.serverRenderer, false);
  assert.equal(s.suiteSSR.supported, false);

  const withRenderer = inspectWebSupport({ serverRenderer: () => "" });
  assert.equal(withRenderer.serverRenderer, true);
});

// ── requireDom / /dom entrypoint behaviour off a window ────────────────────
test("requireDom throws web/dom-required when there is no document", () => {
  assert.throws(
    () => requireDom("someBrowserOp"),
    (e) => e instanceof CompatError && e.code === "web/dom-required" && e.operation === "someBrowserOp",
  );
});

test("importing dist/dom.js off a browser is safe; calling its functions throws web/dom-required", async () => {
  // No custom-element class is evaluated at import time (it lives inside defineElement).
  const dom = await import("../dist/dom.js?fresh=" + Date.now());
  assert.equal(typeof dom.attachWebHost, "function");
  assert.equal(typeof dom.defineElement, "function");
  assert.equal(typeof dom.detachWebHost, "function");

  assert.throws(
    () => dom.attachWebHost({}, counter),
    (e) => e instanceof CompatError && e.code === "web/dom-required",
  );
  assert.throws(
    () => dom.defineElement("obix-x-counter", { create: () => counter }),
    (e) => e instanceof CompatError && e.code === "web/dom-required",
  );
});

// ── boundary note: real DOM lifecycle is a browser lane ────────────────────
test("DOM LIFECYCLE (connect/disconnect/reconnect, duplicate-listener, focus) — exercised in test/browser/dom.browser.mjs", () => {
  // connect/disconnect/reconnect dedup, single customElements.define, focus +
  // caret preservation across repaint, and repaint coalescing are verified in
  // real Chromium by test/browser/dom.browser.mjs (run separately). Other
  // browser engines remain not-tested until executed. See
  // docs/core-compatibility/implementation-status.md.
  assert.ok(DIST.endsWith("dist/") || DIST.endsWith("dist\\"));
});
