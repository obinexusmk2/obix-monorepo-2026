import test from "node:test";
import assert from "node:assert/strict";
import { createModuleResolver, modules, CompatError } from "../dist/index.js";

const HERE = import.meta.url;
const G = globalThis;
const RUNTIME =
  typeof G.Deno?.version?.deno === "string" ? "deno"
  : typeof G.Bun?.version === "string" ? "bun"
  : "node";

test("resolveModule: relative specifier -> concrete file URL, no query string added", () => {
  const r = modules.resolveModule("./sub/thing.js", HERE);
  assert.equal(r.kind, "url");
  assert.equal(r.via, "url-relative");
  assert.ok(r.resolved.startsWith("file:"));
  assert.ok(r.resolved.endsWith("/sub/thing.js"));
  assert.doesNotMatch(r.resolved, /\?/); // never cache-busts
});

test("resolveModule: paths with spaces, Unicode and # are preserved/encoded, not guessed", () => {
  const cases = ["./a b/c.js", "./naïve/café.js", "./weird#name.js", "./deep/../flat.js"];
  for (const c of cases) {
    const r = modules.resolveModule(c, HERE);
    assert.equal(r.kind, "url");
    assert.ok(r.resolved.startsWith("file:"), c);
    // round-trips back to the same file path
    const u = new URL(r.resolved);
    assert.ok(decodeURIComponent(u.pathname).length > 0, c);
  }
  // '#' must be percent-encoded in the path, not treated as a fragment
  const hash = modules.resolveModule("./weird#name.js", HERE);
  assert.match(hash.resolved, /weird%23name\.js$/);
});

test("resolveModule: a bare specifier either resolves to a URL (import.meta.resolve) or passes through for the host loader", () => {
  const r = modules.resolveModule("@obinexusltd/obix-core-capabilities", HERE);
  if (r.kind === "url") {
    // Node resolves a bare specifier against an explicit parentURL.
    assert.equal(r.via, "import.meta.resolve");
    assert.ok(r.resolved.startsWith("file:"));
  } else {
    // Deno/Bun `import.meta.resolve` does not honour a 2nd parentURL arg for an
    // arbitrary parent -> documented passthrough; the host loader resolves it.
    assert.equal(r.kind, "bare");
    assert.equal(r.via, "passthrough");
    assert.equal(r.resolved, "@obinexusltd/obix-core-capabilities");
  }
});

test("resolveModule: bare specifier with no resolver falls back to passthrough (host loader resolves)", () => {
  const noResolve = createModuleResolver({ resolveImpl: () => null });
  const r = noResolve.resolveModule("some-bare-pkg", HERE);
  assert.equal(r.kind, "bare");
  assert.equal(r.via, "passthrough");
  assert.equal(r.resolved, "some-bare-pkg");
});

test("resolveModule: rejects a non-URL parent and an empty specifier", () => {
  assert.throws(() => modules.resolveModule("./x.js", "not-a-url"), CompatError);
  assert.throws(() => modules.resolveModule("", HERE), CompatError);
});

test("resolveAsset: resolves RELATIVE TO THE OWNING MODULE, not cwd", () => {
  const owner = "file:///project/dist/widgets/panel.js";
  assert.equal(modules.resolveAsset("./panel.css", owner), "file:///project/dist/widgets/panel.css");
  assert.equal(modules.resolveAsset("../shared/base.css", owner), "file:///project/dist/shared/base.css");
  assert.equal(modules.resolveAsset("https://cdn/x.css", owner), "https://cdn/x.css");
});

test("loadModule: loads a real module namespace (on every runtime, url or bare)", async () => {
  const { namespace, resolved } = await modules.loadModule("@obinexusltd/obix-core-capabilities", HERE);
  assert.equal(typeof namespace.detectHost, "function");
  assert.ok(["url", "bare"].includes(resolved.kind));
});

test("loadModule: a missing subpath is classified as module/load with a clear reason", async () => {
  try {
    await modules.loadModule("@obinexusltd/obix-core-capabilities/does-not-exist", HERE);
    assert.fail("should throw");
  } catch (err) {
    assert.ok(err instanceof CompatError);
    assert.ok(["module/load", "module/resolve"].includes(err.code));
    assert.match(err.reason, /exports|resolve/i);
  }
});

test("loadModule: injected importImpl is used (no real import)", async () => {
  let sawSpecifier = "";
  const r = createModuleResolver({
    importImpl: async (s) => {
      sawSpecifier = s;
      return { hello: 1 };
    },
  });
  const { namespace } = await r.loadModule("./whatever.js", HERE);
  assert.deepEqual(namespace, { hello: 1 });
  assert.ok(sawSpecifier.startsWith("file:"));
});

test("validatePackageSet: flags version skew, duplicate versions and non-exact internal ranges", () => {
  const report = modules.validatePackageSet(
    [
      { name: "@obinexusltd/obix-core-capabilities", version: "0.1.0" },
      { name: "@obinexusltd/obix-core-modules", version: "0.1.0", dependencies: { "@obinexusltd/obix-core-capabilities": "0.1.0" } },
      { name: "@obinexusltd/obix-core-streams", version: "0.2.0" }, // skew
      { name: "@obinexusltd/obix-core-process", version: "0.1.0", dependencies: { "@obinexusltd/obix-core-streams": "^0.1.0" } }, // non-exact
    ],
    { familyPrefix: "@obinexusltd/obix-core-", expectedVersion: "0.1.0" },
  );
  assert.equal(report.ok, false);
  const kinds = report.problems.map((p) => p.kind).sort();
  assert.ok(kinds.includes("version-mismatch"));
  assert.ok(kinds.includes("range-not-exact"));
});

test("validatePackageSet: a clean single-version family passes", () => {
  const report = modules.validatePackageSet(
    [
      { name: "@obinexusltd/obix-core-capabilities", version: "0.1.0" },
      { name: "@obinexusltd/obix-core-diagnostics", version: "0.1.0", dependencies: { "@obinexusltd/obix-core-capabilities": "0.1.0" } },
    ],
    { familyPrefix: "@obinexusltd/obix-core-", expectedVersion: "0.1.0" },
  );
  assert.equal(report.ok, true);
  assert.equal(report.problems.length, 0);
});
