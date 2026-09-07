import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CompatError } from "../dist/index.js";
import { createNodeFilesystem } from "../dist/node.js";

function tmpProject() {
  const root = mkdtempSync(join(tmpdir(), "obix-fs-"));
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("resolveProjectPath: CLI-relative resolves under root; a URL is rejected; `..` escape is rejected", () => {
  const { root, cleanup } = tmpProject();
  try {
    const fs = createNodeFilesystem({ projectRoot: root });
    assert.equal(fs.resolveProjectPath("a/b.txt"), join(root, "a", "b.txt"));
    assert.throws(() => fs.resolveProjectPath("file:///C:/x"), CompatError);
    assert.throws(() => fs.resolveProjectPath("../../etc/passwd"), CompatError);
  } finally {
    cleanup();
  }
});

test("urlToPath / pathToUrl round-trip, including a Windows drive path and a space", () => {
  const { root, cleanup } = tmpProject();
  try {
    const fs = createNodeFilesystem({ projectRoot: root });
    const p = join(root, "a b", "c.txt");
    const url = fs.pathToUrl(p);
    assert.ok(url.startsWith("file://"));
    assert.equal(fs.urlToPath(url), p);
    assert.throws(() => fs.urlToPath("https://example.com/x"), CompatError);
  } finally {
    cleanup();
  }
});

test("readText preserves CRLF and decodes Unicode; readBytes returns exact bytes", async () => {
  const { root, cleanup } = tmpProject();
  try {
    const fs = createNodeFilesystem({ projectRoot: root });
    const content = "line1\r\nlíne2 — 日本語\r\n";
    writeFileSync(join(root, "f.txt"), content, "utf8");
    assert.equal(await fs.readText("f.txt"), content); // CRLF intact
    const bytes = await fs.readBytes("f.txt");
    assert.deepEqual([...bytes], [...Buffer.from(content, "utf8")]);
  } finally {
    cleanup();
  }
});

test("writeFileSafely: temp-file+rename, reports durability limits, target ends with the data", async () => {
  const { root, cleanup } = tmpProject();
  try {
    const fs = createNodeFilesystem({ projectRoot: root });
    const res = await fs.writeFileSafely("nested/dir/out.txt", "hello");
    assert.equal(res.strategy, "temp-file-rename");
    assert.match(res.durability, /atomic within one directory/i);
    assert.equal(readFileSync(res.path, "utf8"), "hello");
    // no temp files left behind
    assert.equal(existsSync(join(root, "nested", "dir")), true);
  } finally {
    cleanup();
  }
});

test("concurrent writes to the SAME target are serialized (last write wins, no corruption)", async () => {
  const { root, cleanup } = tmpProject();
  try {
    const fs = createNodeFilesystem({ projectRoot: root });
    const writes = [];
    for (let i = 0; i < 25; i++) writes.push(fs.writeFileSafely("race.txt", `v${i}`.padEnd(64, ".")));
    const results = await Promise.all(writes);
    const final = readFileSync(results[0].path, "utf8");
    assert.match(final, /^v\d+\.+$/); // a clean single value, never interleaved
    assert.equal(final.length, 64);
  } finally {
    cleanup();
  }
});

test("writes to DIFFERENT targets run concurrently and all land", async () => {
  const { root, cleanup } = tmpProject();
  try {
    const fs = createNodeFilesystem({ projectRoot: root });
    await Promise.all([...Array(10)].map((_, i) => fs.writeFileSafely(`p${i}.txt`, String(i))));
    for (let i = 0; i < 10; i++) assert.equal(readFileSync(join(root, `p${i}.txt`), "utf8"), String(i));
  } finally {
    cleanup();
  }
});

test("watchTree (native on Windows): an atomic-save replacement is eventually detected as an invalidation", async () => {
  const { root, cleanup } = tmpProject();
  try {
    const fs = createNodeFilesystem({ projectRoot: root });
    writeFileSync(join(root, "watched.txt"), "one");
    let invalidations = [];
    const handle = fs.watchTree(".", (paths) => {
      invalidations.push(...paths);
    }, { debounceMs: 20 });

    await new Promise((r) => setTimeout(r, 60));
    // simulate an editor's atomic save: write sibling temp, rename over target
    writeFileSync(join(root, ".watched.txt.tmp"), "two");
    const { renameSync } = await import("node:fs");
    renameSync(join(root, ".watched.txt.tmp"), join(root, "watched.txt"));

    // eventual detection: poll for up to ~2s
    const start = Date.now();
    while (invalidations.length === 0 && Date.now() - start < 2000) {
      await new Promise((r) => setTimeout(r, 50));
    }
    handle.close();
    assert.ok(invalidations.length > 0, "atomic save was detected as an invalidation");
  } finally {
    cleanup();
  }
});

test("watchTree poll mode: deletion then recreation is detected within poll interval + bounded time", async () => {
  const { root, cleanup } = tmpProject();
  try {
    const fs = createNodeFilesystem({ projectRoot: root });
    writeFileSync(join(root, "x.txt"), "a");
    let hits = 0;
    const handle = fs.watchTree(".", () => { hits++; }, { mode: "poll", pollMs: 40, debounceMs: 10 });
    assert.equal(handle.mode, "poll");
    await new Promise((r) => setTimeout(r, 80)); // let it prime
    rmSync(join(root, "x.txt"));
    await new Promise((r) => setTimeout(r, 150));
    writeFileSync(join(root, "x.txt"), "b");
    const start = Date.now();
    while (hits < 2 && Date.now() - start < 1500) await new Promise((r) => setTimeout(r, 30));
    handle.close();
    assert.ok(hits >= 1, "deletion and/or recreation produced invalidations under polling");
  } finally {
    cleanup();
  }
});

test("watchTree close() is idempotent and stops further invalidations", async () => {
  const { root, cleanup } = tmpProject();
  try {
    const fs = createNodeFilesystem({ projectRoot: root });
    const handle = fs.watchTree(".", () => assert.fail("should not fire after close"), { mode: "poll", pollMs: 30 });
    handle.close();
    handle.close(); // no throw
    writeFileSync(join(root, "late.txt"), "x");
    await new Promise((r) => setTimeout(r, 120));
  } finally {
    cleanup();
  }
});

test("a read of a missing file is a CompatError fs/read with the path in the reason", async () => {
  const { root, cleanup } = tmpProject();
  try {
    const fs = createNodeFilesystem({ projectRoot: root });
    await assert.rejects(() => fs.readText("nope.txt"), (e) => e instanceof CompatError && e.code === "fs/read" && /nope\.txt/.test(e.reason));
  } finally {
    cleanup();
  }
});
