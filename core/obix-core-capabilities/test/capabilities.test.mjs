import test from "node:test";
import assert from "node:assert/strict";
import {
  detectHost,
  probeCapabilities,
  requireCapability,
  inspect,
  CompatError,
  isCompatError,
  ALL_CAPABILITIES,
} from "../dist/index.js";

// Which runtime is executing this test file? (mirrors detectHost's precedence)
const G = globalThis;
const EXPECTED_RUNTIME =
  typeof G.Deno?.version?.deno === "string"
    ? "deno"
    : typeof G.Bun?.version === "string" || typeof G.process?.versions?.bun === "string"
      ? "bun"
      : typeof G.process?.versions?.node === "string"
        ? "node"
        : "unknown";

test(`detectHost identifies this runtime (expected: ${EXPECTED_RUNTIME})`, () => {
  const h = detectHost();
  assert.equal(h.runtime, EXPECTED_RUNTIME);
  assert.ok(h.runtimeVersion === null || typeof h.runtimeVersion === "string");
  assert.equal(h.isBrowserWindow, false);
});

test("detection is a marker heuristic (spoofable), and precedence puts runtime markers before the Node marker", () => {
  // TEST OVERRIDE (not a real-host test): forge a Bun marker on the Node lane and
  // confirm the heuristic's precedence. This demonstrates spoofability by design
  // — it is NOT a claim of authenticated identity. The global is restored below
  // so later tests see the real host.
  if (EXPECTED_RUNTIME !== "node") return;
  const had = Object.prototype.hasOwnProperty.call(process.versions, "bun");
  const orig = process.versions.bun;
  Object.defineProperty(process.versions, "bun", { value: "1.0.0-forged", configurable: true });
  try {
    assert.equal(detectHost().runtime, "bun", "runtime marker precedence: bun before node");
  } finally {
    if (had) Object.defineProperty(process.versions, "bun", { value: orig, configurable: true });
    else delete process.versions.bun;
  }
  assert.equal(detectHost().runtime, "node", "global restored — no contamination of later cases");
});

test("probeCapabilities returns a stable result for every capability", () => {
  const caps = probeCapabilities();
  assert.deepEqual(Object.keys(caps).sort(), [...ALL_CAPABILITIES].sort());
  for (const name of ALL_CAPABILITIES) {
    const r = caps[name];
    assert.equal(r.capability, name);
    assert.ok(["available", "unavailable", "denied", "unknown"].includes(r.status), `${name}: ${r.status}`);
    assert.equal(typeof r.reason, "string");
  }
});

test("web APIs (streams, AbortController) are available on all three server runtimes", () => {
  const c = probeCapabilities(["web-streams", "abort-signal", "performance-now"]);
  assert.equal(c["web-streams"].status, "available");
  assert.equal(c["abort-signal"].status, "available");
  assert.equal(c["performance-now"].status, "available");
});

test("dom is unavailable in every server runtime; web-worker differs by runtime", () => {
  const c = probeCapabilities(["dom", "web-worker"]);
  assert.equal(c.dom.status, "unavailable", "no document in a server runtime");
  // Deno and Bun expose a global Web `Worker`; Node uses worker_threads instead.
  if (EXPECTED_RUNTIME === "deno" || EXPECTED_RUNTIME === "bun") {
    assert.equal(c["web-worker"].status, "available");
  } else {
    assert.equal(c["web-worker"].status, "unavailable");
  }
});

test("worker-threads is the Node path; web-worker is the Deno/Bun path", () => {
  const c = probeCapabilities(["worker-threads", "web-worker"]);
  if (EXPECTED_RUNTIME === "node") {
    assert.equal(c["worker-threads"].status, "available");
    assert.equal(c["web-worker"].status, "unavailable");
  } else if (EXPECTED_RUNTIME === "bun") {
    // Bun implements node:worker_threads AND global Worker
    assert.equal(c["web-worker"].status, "available");
  } else if (EXPECTED_RUNTIME === "deno") {
    assert.equal(c["web-worker"].status, "available");
    // Deno node:worker_threads is host-config dependent -> unknown is acceptable
    assert.ok(["available", "unknown"].includes(c["worker-threads"].status));
  }
});

test("fs + spawn status is resolvable (available or denied), not a crash", () => {
  const c = probeCapabilities(["fs", "spawn"]);
  assert.ok(["available", "denied", "unknown"].includes(c.fs.status));
  assert.ok(["available", "denied", "unknown"].includes(c.spawn.status));
  // This lane runs with permissions granted, so on Node/Bun they should be available;
  // on Deno with --allow-read/--allow-run they are available, otherwise 'unknown' (prompt).
  if (EXPECTED_RUNTIME === "node" || EXPECTED_RUNTIME === "bun") {
    assert.equal(c.fs.status, "available");
    assert.equal(c.spawn.status, "available");
  }
});

test("requireCapability returns for available, throws CompatError for unavailable", () => {
  assert.doesNotThrow(() => requireCapability("web-streams", { package: "t", operation: "o" }));
  try {
    requireCapability("dom", { package: "obix-core-web", operation: "attachWebHost" });
    assert.fail("should throw");
  } catch (err) {
    assert.ok(isCompatError(err));
    assert.equal(err.code, "capability/unavailable");
    assert.equal(err.capability, "dom");
    assert.equal(err.runtime, EXPECTED_RUNTIME);
    assert.equal(typeof err.remediation, "string");
    assert.equal(err.toJSON().name, "CompatError");
  }
});

test("inspect() bundles host + full capability map for this runtime", () => {
  const { host, capabilities } = inspect();
  assert.equal(host.runtime, EXPECTED_RUNTIME);
  assert.equal(Object.keys(capabilities).length, ALL_CAPABILITIES.length);
});

test("detectHost is lazy — a fresh record each call, not a frozen singleton", () => {
  assert.equal(typeof detectHost, "function");
  assert.notEqual(detectHost(), detectHost());
});
