import test from "node:test";
import assert from "node:assert/strict";
import { CompatError, PROTOCOL, runInline } from "../dist/index.js";
import { createNodeWorkerPool } from "../dist/node.js";
import * as oracle from "./fixtures/jobs.mjs";

const JOBS = new URL("./fixtures/jobs.mjs", import.meta.url).href;
const parent = new URL("./", import.meta.url).href;

function pool(opts = {}) {
  return createNodeWorkerPool({ moduleParentURL: parent, size: 2, ...opts });
}

test("protocol id is versioned", () => {
  assert.equal(PROTOCOL, "obix-core-workers/1");
});

test("worker result agrees with the independent reference (oracle) result", async () => {
  const p = pool();
  try {
    const inWorker = await p.submitJob({ module: JOBS, action: "square", data: 9 });
    assert.equal(inWorker, oracle.square(9)); // 81
    const s = await p.submitJob({ module: JOBS, action: "sum", data: [1, 2, 3, 4] });
    assert.equal(s, await oracle.sum([1, 2, 3, 4])); // 10
  } finally {
    await p.dispose();
    assert.equal(p.activeWorkers, 0);
  }
});

test("a function as `data` is rejected before dispatch (no closures across the boundary)", async () => {
  const p = pool();
  try {
    await assert.rejects(
      () => p.submitJob({ module: JOBS, action: "square", data: () => 1 }),
      (e) => e instanceof CompatError && e.code === "workers/protocol",
    );
  } finally {
    await p.dispose();
  }
});

test("missing `module` / `action` is a workers/protocol error", async () => {
  const p = pool();
  try {
    await assert.rejects(() => p.submitJob({ action: "x", data: 1 }), (e) => e.code === "workers/protocol");
    await assert.rejects(() => p.submitJob({ module: JOBS, data: 1 }), (e) => e.code === "workers/protocol");
  } finally {
    await p.dispose();
  }
});

test("a job that throws inside the worker surfaces as workers/crash with the message", async () => {
  const p = pool();
  try {
    await assert.rejects(
      () => p.submitJob({ module: JOBS, action: "crash", data: null }),
      (e) => e instanceof CompatError && e.code === "workers/crash" && /intentional job crash/.test(e.reason),
    );
  } finally {
    await p.dispose();
  }
});

test("a worker that exits without responding is reported as a crash; pool recovers", async () => {
  const p = pool({ size: 1 });
  try {
    await assert.rejects(
      () => p.submitJob({ module: JOBS, action: "hardCrash", data: null }),
      (e) => e instanceof CompatError && e.code === "workers/crash",
    );
    // pool still works afterwards
    const ok = await p.submitJob({ module: JOBS, action: "square", data: 4 });
    assert.equal(ok, 16);
  } finally {
    await p.dispose();
  }
});

test("a transferred ArrayBuffer is moved (parent loses it) and arrives intact", async () => {
  const p = pool();
  try {
    const buf = new Uint8Array([1, 2, 3, 4, 5, 250]).buffer;
    const before = buf.byteLength;
    const res = await p.submitJob(
      { module: JOBS, action: "inspectBuffer", data: buf },
      { transfer: [""] }, // transfer the top-level data itself
    );
    assert.equal(res.byteLength, before);
    assert.equal(res.checksum, oracle.inspectBuffer(new Uint8Array([1, 2, 3, 4, 5, 250]).buffer).checksum);
    assert.equal(buf.byteLength, 0, "parent's buffer was detached by the transfer");
  } finally {
    await p.dispose();
  }
});

test("queue limit — submitting past size + queueLimit rejects with workers/queue-full", async () => {
  const p = pool({ size: 1, queueLimit: 1 });
  try {
    const a = p.submitJob({ module: JOBS, action: "slow", data: 300 }); // runs
    const b = p.submitJob({ module: JOBS, action: "slow", data: 300 }); // queued
    await assert.rejects(
      () => p.submitJob({ module: JOBS, action: "slow", data: 300 }), // over limit
      (e) => e instanceof CompatError && e.code === "workers/queue-full",
    );
    await Promise.allSettled([a, b]);
  } finally {
    await p.dispose();
  }
});

test("timeout sends a cooperative cancel and rejects; the fixture honours ctx.isCancelled", async () => {
  const p = pool({ size: 1 });
  try {
    await assert.rejects(
      () => p.submitJob({ module: JOBS, action: "slow", data: 5000 }, { timeoutMs: 120 }),
      (e) => e instanceof CompatError && /timed out/.test(e.reason) && /no preemption/.test(e.reason),
    );
  } finally {
    await p.dispose();
  }
});

test("AbortSignal cancels a queued job immediately", async () => {
  const p = pool({ size: 1 });
  try {
    const running = p.submitJob({ module: JOBS, action: "slow", data: 400 });
    const ac = new AbortController();
    const queued = p.submitJob({ module: JOBS, action: "square", data: 2 }, { signal: ac.signal });
    ac.abort();
    await assert.rejects(() => queued, (e) => e instanceof CompatError && /aborted/.test(e.reason));
    assert.equal(await running, "done");
  } finally {
    await p.dispose();
  }
});

test("dispose rejects everything pending and leaves no live workers", async () => {
  const p = pool({ size: 2 });
  const jobs = [
    p.submitJob({ module: JOBS, action: "slow", data: 2000 }),
    p.submitJob({ module: JOBS, action: "slow", data: 2000 }),
    p.submitJob({ module: JOBS, action: "slow", data: 2000 }),
  ];
  const settled = Promise.allSettled(jobs); // attach handlers BEFORE dispose rejects them
  await new Promise((r) => setTimeout(r, 100));
  await p.dispose();
  assert.ok((await settled).every((s) => s.status === "rejected"));
  assert.equal(p.activeWorkers, 0);
  assert.equal(p.queued, 0);
  assert.equal(p.running, 0);
});

test("resourceLimitsHonored is reported honestly per runtime", () => {
  const p = pool();
  const G = globalThis;
  const isBun = typeof G.Bun?.version === "string" || typeof G.process?.versions?.bun === "string";
  assert.equal(p.resourceLimitsHonored, !isBun);
  assert.equal(p.backendKind, "worker_threads");
  void p.dispose();
});

test("runInline is an explicit single-thread fallback (mode label, no isolation)", async () => {
  const { result, mode } = await runInline({ module: JOBS, action: "square", data: 6 }, parent);
  assert.equal(result, 36);
  assert.equal(mode, "inline-fallback");
});
