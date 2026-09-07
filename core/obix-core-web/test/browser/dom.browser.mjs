/**
 * Real-Chromium lifecycle contract for @obinexusltd/obix-core-web/dom.
 *
 * Verifies, in an actual browser engine:
 *   - customElements.define happens exactly once; a second defineElement is a no-op
 *   - connectedCallback mounts and paints
 *   - a same-tick move (disconnect -> reconnect) keeps the mount (no double mount,
 *     no destroy) — the anti-double-subscribe guard
 *   - a real disconnect runs destroy exactly once
 *   - focus + caret survive a repaint (no blind container replacement)
 *   - repaint coalescing: an attribute burst yields ONE adapter update with the
 *     final state (and N updates when coalescing is off)
 *
 * Chromium only. Other engines stay not-tested until executed. If Playwright or a
 * Chromium binary cannot be found/launched, the test SKIPS (browser lane =
 * not-tested) rather than failing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const CORE_DIR = fileURLToPath(new URL("../../../", import.meta.url)); // …/core/

// ── locate Playwright + a Chromium executable ──────────────────────────────
function findPlaywrightEntry() {
  if (process.env.PLAYWRIGHT_MODULE && existsSync(process.env.PLAYWRIGHT_MODULE)) return process.env.PLAYWRIGHT_MODULE;
  try {
    return require.resolve("playwright");
  } catch {
    /* fall through */
  }
  const roots = [
    join(homedir(), "AppData", "Local", "npm-cache", "_npx"),
    (() => {
      try {
        return require("node:child_process").execSync("npm root -g", { encoding: "utf8" }).trim();
      } catch {
        return "";
      }
    })(),
  ].filter(Boolean);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const entries = statSync(root).isDirectory() ? readdirSync(root) : [];
    const bases = root.endsWith("_npx") ? entries.map((e) => join(root, e, "node_modules", "playwright")) : [join(root, "playwright")];
    for (const b of bases) {
      for (const f of ["index.mjs", "index.js"]) {
        if (existsSync(join(b, f))) return join(b, f);
      }
    }
  }
  return null;
}

function findChromiumExe() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXE && existsSync(process.env.PLAYWRIGHT_CHROMIUM_EXE)) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXE;
  }
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), "AppData", "Local", "ms-playwright");
  if (!existsSync(base)) return null;
  const dirs = readdirSync(base);
  // prefer the headless shell (smaller, launches cleanly in CI-style shells)
  const patterns = [
    { dir: /^chromium_headless_shell-/, exe: ["chrome-headless-shell-win64", "chrome-headless-shell.exe"] },
    { dir: /^chromium-/, exe: ["chrome-win64", "chrome.exe"] },
    { dir: /^chromium_headless_shell-/, exe: ["chrome-headless-shell-linux", "chrome-headless-shell"] },
    { dir: /^chromium-/, exe: ["chrome-linux", "chrome"] },
  ];
  for (const p of patterns) {
    for (const d of dirs) {
      if (!p.dir.test(d)) continue;
      const exe = join(base, d, ...p.exe);
      if (existsSync(exe)) return exe;
    }
  }
  return null;
}

const PW_ENTRY = findPlaywrightEntry();
const CHROMIUM_EXE = findChromiumExe();
const SKIP = !PW_ENTRY || !CHROMIUM_EXE ? `Playwright entry=${!!PW_ENTRY} chromium=${!!CHROMIUM_EXE} — browser lane not-tested` : false;

// ── static file server rooted at core/ (serves the built dist/) ────────────
const MIME = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".map": "application/json", ".html": "text/html" };
function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://x");
      if (url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(PAGE_HTML);
        return;
      }
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const abs = join(CORE_DIR, rel);
      if (!abs.startsWith(CORE_DIR)) {
        res.writeHead(403).end("no");
        return;
      }
      const body = await readFile(abs);
      res.writeHead(200, { "content-type": MIME[extname(abs)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const PAGE_HTML = `<!doctype html><meta charset=utf-8><title>obix-core-web dom lane</title>
<script type="importmap">
{
  "imports": {
    "@obinexusltd/obix-core-capabilities": "/obix-core-capabilities/dist/index.js",
    "@obinexusltd/obix-core-scheduler": "/obix-core-scheduler/dist/index.js",
    "@obinexusltd/obix-core-web/dom": "/obix-core-web/dist/dom.js"
  }
}
</script>
<div id="root"></div>
<script type="module">
  const results = [];
  const rec = (name, fn) => { try { fn(); results.push({ name, ok: true }); }
    catch (e) { results.push({ name, ok: false, detail: String(e && e.message || e) }); } };
  const asyncRec = async (name, fn) => { try { await fn(); results.push({ name, ok: true }); }
    catch (e) { results.push({ name, ok: false, detail: String(e && e.message || e) }); } };
  const tick = () => new Promise(r => setTimeout(r, 0));
  window.__DONE__ = (async () => {
    const dom = await import("@obinexusltd/obix-core-web/dom");
    const { defineElement, attachWebHost } = dom;

    // spy adapter — counts mount/update/destroy, records last state
    function spyAdapter() {
      const calls = { mount: 0, update: 0, destroy: 0, lastState: undefined };
      return {
        calls,
        mount(el, artifact) {
          calls.mount++;
          el.innerHTML = artifact.render(artifact.state);
          return {
            update(s) { calls.update++; calls.lastState = s; el.innerHTML = artifact.render(s); },
            destroy() { calls.destroy++; },
          };
        },
      };
    }

    const mkArtifact = () => ({
      name: "bx-counter",
      state: { n: 0 },
      actions: { attributeChanged: (s, name, val) => (name === "n" ? { ...s, n: Number(val) } : s) },
      render: (s) => \`<input id="f" value="x"><span>n=\${s ? s.n : 0}</span>\`,
    });

    // 1 — define once
    rec("defineElement registers the tag exactly once; a second call is a harmless no-op", () => {
      defineElement("obix-bx-counter", { create: mkArtifact, observedAttributes: ["n"] });
      const first = customElements.get("obix-bx-counter");
      defineElement("obix-bx-counter", { create: mkArtifact, observedAttributes: ["n"] });
      if (!first) throw new Error("tag not registered");
      if (customElements.get("obix-bx-counter") !== first) throw new Error("re-defined the element");
    });

    // 2 — connect mounts + paints
    const root = document.getElementById("root");
    await asyncRec("connectedCallback mounts and paints initial state", async () => {
      root.innerHTML = '<obix-bx-counter n="1"></obix-bx-counter>';
      await tick();
      const host = root.firstElementChild;
      if (!host.textContent.includes("n=1")) throw new Error("initial paint missing, got: " + host.textContent);
      if (host.querySelectorAll("input#f").length !== 1) throw new Error("expected one input");
    });

    // 3 — same-tick move keeps the mount; real disconnect destroys once
    await asyncRec("same-tick move keeps one mount (no double mount, no destroy); real removal destroys once", async () => {
      const spy = spyAdapter();
      defineElement("obix-bx-move", { create: mkArtifact, adapter: spy, observedAttributes: ["n"] });
      const a = document.createElement("div");
      const b = document.createElement("div");
      root.append(a, b);
      const host = document.createElement("obix-bx-move");
      a.append(host);
      await tick();
      if (spy.calls.mount !== 1) throw new Error("mount count after connect = " + spy.calls.mount);
      // move within the same synchronous tick
      a.removeChild(host);
      b.append(host);
      await tick();
      if (spy.calls.mount !== 1) throw new Error("move re-mounted: mount = " + spy.calls.mount);
      if (spy.calls.destroy !== 0) throw new Error("move destroyed the mount: destroy = " + spy.calls.destroy);
      // now really remove it
      b.removeChild(host);
      await tick();
      if (spy.calls.destroy !== 1) throw new Error("real removal destroy = " + spy.calls.destroy);
    });

    // 4 — focus + caret survive a repaint
    await asyncRec("focus and caret survive a repaint (no blind container replacement)", async () => {
      root.innerHTML = '<obix-bx-counter n="0"></obix-bx-counter>';
      await tick();
      const host = root.firstElementChild;
      const input = host.querySelector("input#f");
      input.focus();
      input.setSelectionRange(1, 1);
      if (document.activeElement !== input) throw new Error("precondition: input not focused");
      host.setAttribute("n", "5"); // drives attributeChanged -> update -> repaint
      await tick();
      const input2 = host.querySelector("input#f");
      if (document.activeElement !== input2) throw new Error("focus lost across repaint");
      if (input2.selectionStart !== 1) throw new Error("caret not restored: " + input2.selectionStart);
      if (!host.textContent.includes("n=5")) throw new Error("repaint did not apply new state");
    });

    // 5 — repaint coalescing
    await asyncRec("coalesce:true collapses an attribute burst into ONE adapter update with the final state", async () => {
      const spy = spyAdapter();
      defineElement("obix-bx-coalesce", { create: mkArtifact, adapter: spy, observedAttributes: ["n"], coalesce: true });
      const host = document.createElement("obix-bx-coalesce");
      root.append(host);
      await tick();
      host.setAttribute("n", "1");
      host.setAttribute("n", "2");
      host.setAttribute("n", "3");
      if (spy.calls.update !== 0) throw new Error("update fired synchronously despite coalesce: " + spy.calls.update);
      await tick();
      if (spy.calls.update !== 1) throw new Error("expected 1 coalesced update, got " + spy.calls.update);
      if (!spy.calls.lastState || spy.calls.lastState.n !== 3) throw new Error("coalesced update lost the final state");
    });

    await asyncRec("coalesce off applies every update synchronously", async () => {
      const spy = spyAdapter();
      defineElement("obix-bx-sync", { create: mkArtifact, adapter: spy, observedAttributes: ["n"] });
      const host = document.createElement("obix-bx-sync");
      root.append(host);
      await tick();
      host.setAttribute("n", "1");
      host.setAttribute("n", "2");
      if (spy.calls.update !== 2) throw new Error("expected 2 synchronous updates, got " + spy.calls.update);
    });

    window.__RESULTS__ = results;
    return results;
  })();
</script>`;

// ── the node:test wrapper ─────────────────────────────────────────────────
test("obix-core-web/dom — real Chromium lifecycle", { skip: SKIP }, async (t) => {
  const { chromium } = await import(PW_ENTRY.startsWith("file:") ? PW_ENTRY : "file:///" + PW_ENTRY.replace(/\\/g, "/"));
  const server = await startServer();
  const { port } = server.address();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_EXE });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
    const results = await page.evaluate(async () => {
      await window.__DONE__;
      return window.__RESULTS__;
    });
    assert.ok(Array.isArray(results) && results.length >= 6, `expected >=6 sub-results, got ${JSON.stringify(results)}`);
    for (const r of results) {
      await t.test(r.name, () => {
        assert.ok(r.ok, r.detail || "sub-test failed in the browser");
      });
    }
    assert.deepEqual(pageErrors, [], "no uncaught page errors");
  } finally {
    if (browser) await browser.close();
    server.close();
  }
});
