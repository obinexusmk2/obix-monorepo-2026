import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create } from "../dist/index.js";

test("obix create scaffolds a substituted, .tmpl-free app", () => {
  const dir = mkdtempSync(join(tmpdir(), "obix-create-"));
  try {
    const res = create(join(dir, "my-widget"));
    assert.ok(res.ok, res.message);
    const app = join(dir, "my-widget");

    const index = readFileSync(join(app, "index.html"), "utf8");
    assert.match(index, /<title>my-widget<\/title>/);
    assert.doesNotMatch(index, /__APP_NAME__/);

    assert.ok(existsSync(join(app, "src/components/Counter.ts")));
    assert.ok(existsSync(join(app, "src/components/Counter.html")));

    const pkg = JSON.parse(readFileSync(join(app, "package.json"), "utf8"));
    assert.equal(pkg.name, "my-widget");
    assert.ok(pkg.dependencies["obix-core"]);

    const stray = [];
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(d, e.name));
        else if (e.name.endsWith(".tmpl")) stray.push(e.name);
      }
    };
    walk(app);
    assert.deepEqual(stray, [], "no .tmpl files should remain");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("obix create refuses a non-empty target", () => {
  const dir = mkdtempSync(join(tmpdir(), "obix-create-"));
  try {
    assert.ok(create(join(dir, "a")).ok);
    assert.equal(create(join(dir, "a")).ok, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
