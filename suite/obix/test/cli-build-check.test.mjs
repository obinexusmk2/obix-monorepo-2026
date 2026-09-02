import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, check } from "../dist/index.js";

const EXAMPLE = fileURLToPath(new URL("../../examples/timer/", import.meta.url));

test("obix build bundles the Timer example into <outdir>/", async () => {
  const out = mkdtempSync(join(tmpdir(), "obix-build-"));
  try {
    const res = await build({ cwd: EXAMPLE, outdir: out, minify: false });
    assert.ok(res.ok, res.message);
    assert.ok(existsSync(join(out, "index.html")));
    const html = readFileSync(join(out, "index.html"), "utf8");
    assert.match(html, /\.\/assets\/[\w.-]+\.js/, "script src rewritten to hashed asset");
    const assets = readdirSync(join(out, "assets"));
    assert.ok(assets.some((f) => f.endsWith(".js")), "a JS bundle was emitted");
    assert.ok(assets.some((f) => f.endsWith(".html")), "Timer.html copied as an asset");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("obix check passes on the Timer example (a11y only)", () => {
  const res = check({ cwd: EXAMPLE, types: false });
  assert.ok(res.ok, res.message + "\n" + JSON.stringify(res.diagnostics, null, 2));
});

test("obix check fails on a template with an accessibility error", () => {
  const dir = mkdtempSync(join(tmpdir(), "obix-check-"));
  try {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "Bad.html"), `<div aria-live="loud"><h1>a</h1><h3>b</h3></div>`);
    const res = check({ cwd: dir, types: false });
    assert.equal(res.ok, false);
    assert.ok(res.diagnostics.some((d) => d.severity === "error"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
