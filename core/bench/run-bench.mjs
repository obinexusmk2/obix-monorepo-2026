/**
 * Core-compatibility benchmark harness.
 *
 *   node core/bench/run-bench.mjs [--out <file.json>] [--quick]
 *
 * Measures, with identical fixtures and a correctness check on every sample:
 *   - obix CLI cold start   (spawned `--version`, process + module load)
 *   - obix CLI warm dispatch (runCli() called in-process after a warmup)
 *   - streams: collectBytes(toReadableStream(fixture))   (1 MiB / 64 KiB chunks)
 *   - workers: N `sum` jobs through a real worker pool
 *   - filesystem watch: latency from a write to onInvalidate
 *
 * It records runtime/machine facts, keeps every raw sample, and reports
 * median / p95 / min / max / stdev. It also measures a no-op spawn and an
 * empty-loop baseline so the noise floor is visible BEFORE anyone sets a
 * threshold. No thresholds are asserted here.
 *
 * There is deliberately NO build benchmark — this CLI has no build command.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as os from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const QUICK = process.argv.includes("--quick");
const outIdx = process.argv.indexOf("--out");
const OUT = outIdx >= 0 ? process.argv[outIdx + 1] : null;

const N = QUICK ? 15 : 60;
const N_HEAVY = QUICK ? 5 : 20;

// ── stats ────────────────────────────────────────────────────────────────
function stats(samples) {
  const s = [...samples].sort((a, b) => a - b);
  const n = s.length;
  const mean = s.reduce((a, b) => a + b, 0) / n;
  const variance = s.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const q = (p) => s[Math.min(n - 1, Math.floor(p * n))];
  return {
    n,
    min: round(s[0]),
    median: round(q(0.5)),
    p95: round(q(0.95)),
    max: round(s[n - 1]),
    mean: round(mean),
    stdev: round(Math.sqrt(variance)),
    samplesMs: s.map(round),
  };
}
const round = (x) => Math.round(x * 1000) / 1000;

async function timeAsync(fn, iters, verify) {
  const out = [];
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    const r = await fn(i);
    const dt = performance.now() - t0;
    verify(r, i);
    out.push(dt);
  }
  return out;
}

// ── baselines: the measurement noise floor ───────────────────────────────
function baselineEmptyLoop() {
  const out = [];
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    let x = 0;
    for (let k = 0; k < 1e5; k++) x += k;
    out.push(performance.now() - t0);
    if (x < 0) throw new Error("unreachable");
  }
  return stats(out);
}
function baselineNoopSpawn() {
  const out = [];
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    const r = spawnSync(process.execPath, ["-e", "0"], { encoding: "utf8" });
    out.push(performance.now() - t0);
    if (r.status !== 0) throw new Error("noop spawn failed");
  }
  return stats(out);
}

// ── CLI cold start (spawned) ─────────────────────────────────────────────
function cliColdStart() {
  const bin = join(ROOT, "runtime", "obix", "dist", "bin", "obix.js");
  const out = [];
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    const r = spawnSync(process.execPath, [bin, "--version"], { encoding: "utf8" });
    out.push(performance.now() - t0);
    if (r.status !== 0 || !/@obinexusltd\/obix /.test(r.stdout)) throw new Error("cold start sample invalid: " + r.stdout + r.stderr);
  }
  return stats(out);
}

// ── CLI warm dispatch (in-process) ──────────────────────────────────────
async function cliWarmDispatch() {
  const { runCli } = await import(new URL("../../runtime/obix/dist/cli/index.js", import.meta.url));
  const sink = { stdout() {}, stderr() {}, env: {}, isTTY: false, flush: async () => {}, onCancel: () => () => {} };
  // warmup
  for (let i = 0; i < 3; i++) await runCli(["--version"], sink);
  return stats(await timeAsync(() => runCli(["--version"], sink), N, (code) => {
    if (code !== 0) throw new Error("warm dispatch code " + code);
  }));
}

// ── streams: 1 MiB round-trip ──────────────────────────────────────────
async function streamsRoundTrip() {
  const st = await import("@obinexusltd/obix-core-streams");
  const CHUNK = 64 * 1024;
  const COUNT = 16; // 1 MiB
  const fixture = [];
  for (let c = 0; c < COUNT; c++) {
    const u = new Uint8Array(CHUNK);
    for (let i = 0; i < CHUNK; i++) u[i] = (c * 131 + i) & 0xff;
    fixture.push(u);
  }
  let checksum = 0;
  for (const u of fixture) for (let i = 0; i < u.length; i++) checksum = (checksum + u[i]) >>> 0;

  return stats(
    await timeAsync(
      async () => st.collectBytes(st.toReadableStream(fixture.map((u) => u.slice()))),
      N_HEAVY,
      (bytes) => {
        if (bytes.length !== CHUNK * COUNT) throw new Error("stream length mismatch: " + bytes.length);
        let ck = 0;
        for (let i = 0; i < bytes.length; i++) ck = (ck + bytes[i]) >>> 0;
        if (ck !== checksum) throw new Error(`stream checksum mismatch: ${ck} != ${checksum}`);
      },
    ),
  );
}

// ── workers: N sum jobs through a real pool ─────────────────────────────
async function workersThroughput() {
  const wNode = await import("@obinexusltd/obix-core-workers/node");
  const parentURL = new URL("../../runtime/obix/dist/cli/index.js", import.meta.url).href;
  const pool = wNode.createNodeWorkerPool({ size: 2, moduleParentURL: parentURL });
  try {
    const arr = Array.from({ length: 64 }, (_, i) => i + 1);
    const expected = arr.reduce((a, b) => a + b, 0);
    return stats(
      await timeAsync(
        () => pool.submitJob({ module: "./doctor-job.js", action: "sum", data: arr }, { timeoutMs: 15_000 }),
        N_HEAVY,
        (r) => {
          if (r !== expected) throw new Error("worker result " + r);
        },
      ),
    );
  } finally {
    await pool.dispose();
  }
}

// ── filesystem watch latency ───────────────────────────────────────────
async function watchLatency() {
  const fsNode = await import("@obinexusltd/obix-core-filesystem/node");
  const samples = [];
  for (let i = 0; i < N_HEAVY; i++) {
    const dir = mkdtempSync(join(tmpdir(), "obix-bench-watch-"));
    const fs = fsNode.createNodeFilesystem({ projectRoot: dir });
    let firedAt = 0;
    const handle = fs.watchTree(".", () => {
      if (!firedAt) firedAt = performance.now();
    }, { debounceMs: 10 });
    await new Promise((r) => setTimeout(r, 60)); // let the watcher arm
    const t0 = performance.now();
    writeFileSync(join(dir, `f${i}.txt`), "x");
    const deadline = Date.now() + 3000;
    while (!firedAt && Date.now() < deadline) await new Promise((r) => setTimeout(r, 5));
    handle.close();
    rmSync(dir, { recursive: true, force: true });
    if (!firedAt) throw new Error("watch never fired");
    samples.push(firedAt - t0);
  }
  return stats(samples);
}

// ── run ────────────────────────────────────────────────────────────────
const started = new Date().toISOString();
const machine = {
  platform: os.platform(),
  arch: os.arch(),
  cpuModel: os.cpus()[0]?.model ?? null,
  cpuCount: os.cpus().length,
  totalMemMB: Math.round(os.totalmem() / 1e6),
  nodeVersions: process.versions,
  note: "run against the in-repo built dist/ (no npm cache involved)",
};

console.log(`core-compatibility bench — ${machine.platform}/${machine.arch}, node ${process.versions.node}${QUICK ? " (quick)" : ""}`);

const results = {};
const step = async (name, fn) => {
  process.stdout.write(`  ${name} … `);
  const r = await fn();
  console.log(`median ${r.median}ms  p95 ${r.p95}ms  stdev ${r.stdev}ms  (n=${r.n})`);
  results[name] = r;
};

await step("baseline.emptyLoop", async () => baselineEmptyLoop());
await step("baseline.noopSpawn", async () => baselineNoopSpawn());
await step("cli.coldStart", async () => cliColdStart());
await step("cli.warmDispatch", cliWarmDispatch);
await step("streams.roundTrip1MiB", streamsRoundTrip);
await step("workers.sum64", workersThroughput);
await step("filesystem.watchLatency", watchLatency);

const report = {
  schema: "obix-core-compat/bench@1",
  startedAt: started,
  finishedAt: new Date().toISOString(),
  quick: QUICK,
  iterations: { light: N, heavy: N_HEAVY },
  machine,
  thresholds: null, // deliberately unset — measure variability first (see baselines)
  results,
};

if (OUT) {
  writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
  console.log(`\nwrote ${OUT}`);
} else {
  console.log("\n" + JSON.stringify(report, null, 2));
}
