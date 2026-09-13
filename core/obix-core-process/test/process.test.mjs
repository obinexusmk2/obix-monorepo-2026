import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CompatError, canSpawn } from "../dist/index.js";
import { createNodeProcessRunner, which } from "../dist/node.js";

const NODE = process.execPath; // the current runtime's executable (node / deno / bun)
const dec = (u8) => new TextDecoder().decode(u8);
const runner = createNodeProcessRunner();

// A tiny script we can spawn identically under node / deno / bun. `-e` argv
// semantics differ across runtimes, so read argv from a real file instead.
const SCRIPTS = mkdtempSync(join(tmpdir(), "obix-proc-scripts-"));
writeFileSync(join(SCRIPTS, "echo-argv2.mjs"), "process.stdout.write(process.argv[2] ?? '')");
writeFileSync(join(SCRIPTS, "hello.mjs"), "process.stdout.write('hi ' + (2 + 2))");
writeFileSync(join(SCRIPTS, "exit3.mjs"), "process.exit(3)");
writeFileSync(join(SCRIPTS, "spin.mjs"), "setInterval(() => {}, 1000)");
writeFileSync(
  join(SCRIPTS, "flood.mjs"),
  'const big = "x".repeat(64 * 1024); for (let i = 0; i < 40; i++) { process.stdout.write(big); process.stderr.write(big); }',
);
const S = (name) => join(SCRIPTS, name);
process.on("exit", () => { try { rmSync(SCRIPTS, { recursive: true, force: true }); } catch {} });

test("canSpawn is true on this host", () => {
  assert.equal(canSpawn(), true);
});

test("spawnTool runs the current Node with an argv array (shell:false), captures stdout, exit 0", async () => {
  const r = await runner.spawnTool({ command: NODE, args: [S("hello.mjs")] });
  assert.equal(r.code, 0);
  assert.equal(r.signal, null);
  assert.equal(dec(r.stdout), "hi 4");
  assert.ok(r.durationMs >= 0);
});

test("literal shell metacharacters in an argument are passed through verbatim, NOT interpreted", async () => {
  const payload = "a && b | c > d ; $(x) `y` %PATH%";
  const r = await runner.spawnTool({ command: NODE, args: [S("echo-argv2.mjs"), payload] });
  assert.equal(r.code, 0);
  assert.equal(dec(r.stdout), payload); // no expansion, no injection
});

test("a cwd / path containing spaces works", async () => {
  const dir = mkdtempSync(join(tmpdir(), "obix proc test "));
  try {
    writeFileSync(join(dir, "s.mjs"), "process.stdout.write(process.cwd())");
    const r = await runner.spawnTool({ command: NODE, args: ["s.mjs"], cwd: dir });
    assert.equal(r.code, 0);
    // Compare against the realpath, not the raw tmpdir() result: on macOS
    // os.tmpdir() returns a path under /var, which is itself a symlink to
    // /private/var, and a spawned child's own process.cwd() reports the
    // resolved (/private/var/...) form. The path-with-spaces behavior this
    // test targets is unaffected either way.
    assert.equal(dec(r.stdout), realpathSync(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing tool is a CompatError process/tool-not-found (not a silent success)", async () => {
  await assert.rejects(
    () => runner.spawnTool({ command: "definitely-not-a-real-binary-xyz", args: [] }),
    (e) => e instanceof CompatError && e.code === "process/tool-not-found",
  );
});

test("a nonzero exit is reported as `code`, not thrown; launch != success", async () => {
  const r = await runner.spawnTool({ command: NODE, args: [S("exit3.mjs")] });
  assert.equal(r.code, 3);
  assert.equal(r.timedOut, false);
  assert.equal(r.aborted, false);
});

test("large output on BOTH stdout and stderr is drained without deadlock (bounded)", async () => {
  const r = await runner.spawnTool({ command: NODE, args: [S("flood.mjs")], maxBuffer: 1024 * 1024 });
  assert.equal(r.code, 0);
  assert.equal(r.stdout.byteLength, 1024 * 1024);
  assert.equal(r.stderr.byteLength, 1024 * 1024);
  assert.equal(r.stdoutTruncated, true);
  assert.equal(r.stderrTruncated, true);
});

test("timeout kills the child and sets timedOut", async () => {
  const r = await runner.spawnTool({ command: NODE, args: [S("spin.mjs")], timeoutMs: 150 });
  assert.equal(r.timedOut, true);
  assert.ok(r.code !== 0 || r.signal !== null, "process did not exit cleanly on its own");
});

test("AbortSignal aborts the child and sets aborted", async () => {
  const ac = new AbortController();
  const p = runner.spawnTool({ command: NODE, args: [S("spin.mjs")], signal: ac.signal });
  setTimeout(() => ac.abort(), 120);
  const r = await p;
  assert.equal(r.aborted, true);
});

test("disposeAll kills every tracked child — no owned child survives teardown", async () => {
  const started = [];
  for (let i = 0; i < 4; i++) {
    started.push(runner.spawnTool({ command: NODE, args: [S("spin.mjs")], killSignal: "SIGKILL" }));
  }
  await new Promise((r) => setTimeout(r, 80));
  assert.ok(runner.activeCount >= 1);
  await runner.disposeAll({ signal: "SIGKILL" });
  assert.equal(runner.activeCount, 0);
  const results = await Promise.all(started);
  for (const r of results) assert.ok(r.code !== 0 || r.signal !== null);
});

test("resolveTool js-bin: resolves an installed package bin under the CURRENT runtime, never a global", () => {
  // typescript is a devDependency of the monorepo -> its `tsc` bin is installed
  const res = runner.resolve({ kind: "js-bin", package: "typescript", bin: "tsc" });
  assert.equal(res.found, true);
  assert.equal(res.kind, "js-bin");
  assert.equal(res.runtime, process.execPath); // runs under this Node, not a PATH tsc
  assert.match(res.args[0], /typescript[\\/].*tsc/);
});

test("resolveTool executable: which() finds node; a bogus name is not found", () => {
  const nodeRes = runner.resolve({ kind: "executable", name: process.platform === "win32" ? "node.exe" : "node" });
  assert.equal(nodeRes.found, true);
  assert.equal(which("no-such-exe-zzz"), null);
});

test("spawnShellScript rejects a non-script target", async () => {
  await assert.rejects(
    () => runner.spawnShellScript({ command: NODE, args: [], shellArgsArray: [] }),
    (e) => e instanceof CompatError && /only for \.cmd/.test(e.reason),
  );
});
