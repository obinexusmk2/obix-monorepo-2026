/**
 * Packed-consumer verification for the OBIX core-compatibility layer.
 *
 * Proves that a CLEAN install of the amended umbrella `@obinexusltd/obix` — built
 * only from `npm pack` tarballs, resolved OUTSIDE this workspace — runs
 * `obix doctor` reliably, exposes every core package's declared entrypoints, and
 * loads no DOM or native code eagerly.
 *
 *   node core/fixtures/pack-and-verify.mjs [--keep]
 *
 * Exit 0 = every assertion held. Exit 1 = a failure (details on stderr).
 * `--keep` leaves the temp project in place for inspection.
 *
 * This never publishes anything. `npm pack` + local install is the whole point.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = fileURLToPath(new URL("../../", import.meta.url)); // repo /obix
const KEEP = process.argv.includes("--keep");
const CORE_SUFFIXES = [
  "capabilities",
  "diagnostics",
  "modules",
  "filesystem",
  "process",
  "scheduler",
  "streams",
  "workers",
  "native",
  "web",
];

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
function npm(args, cwd) {
  const r = spawnSync(npmCmd, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
  if (r.status !== 0) throw new Error(`npm ${args.join(" ")} failed (${r.status})\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}
/** Always captures BOTH streams and the exit code, on success or failure. */
function tryRun(cmd, args, cwd, env) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
  return { ok: r.status === 0, code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

let failures = 0;
const pass = (m) => console.log(`  \x1b[32mok\x1b[0m   ${m}`);
const fail = (m) => {
  console.log(`  \x1b[31mFAIL\x1b[0m ${m}`);
  failures++;
};
const check = (cond, m) => (cond ? pass(m) : fail(m));

// ── 1. build + pack every package ─────────────────────────────────────────
console.log("\n\x1b[1m1. build + npm pack (10 core packages + amended umbrella)\x1b[0m");
const work = mkdtempSync(join(tmpdir(), "obix-packed-"));
const tarDir = join(work, "_tarballs");
mkdirSync(tarDir);
const consumer = join(work, "consumer");
mkdirSync(consumer);

const tarballs = [];
function buildAndPack(dir, label) {
  const pkgDir = join(ROOT, dir);
  execFileSync(process.execPath, [require_resolve_tsc(pkgDir), "-p", "tsconfig.json"], { cwd: pkgDir, stdio: "pipe" });
  const out = npm(["pack", "--pack-destination", tarDir], pkgDir).trim().split(/\s+/).pop();
  const tgz = join(tarDir, out);
  if (!existsSync(tgz)) throw new Error(`pack produced no tarball for ${label}: ${out}`);
  tarballs.push(tgz);
  pass(`packed ${label} -> ${out}`);
}
function require_resolve_tsc(fromDir) {
  return createRequire(join(fromDir, "package.json")).resolve("typescript/bin/tsc");
}

try {
  for (const s of CORE_SUFFIXES) buildAndPack(`core/obix-core-${s}`, `@obinexusltd/obix-core-${s}`);
  buildAndPack("runtime/obix", "@obinexusltd/obix (umbrella)");

  // ── 2. clean install OUTSIDE the workspace ──────────────────────────────
  console.log("\n\x1b[1m2. clean install of local tarballs (no workspace resolution)\x1b[0m");
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ name: "obix-packed-consumer", version: "0.0.0", private: true, type: "module" }, null, 2),
  );
  // one install so the umbrella's exact core pins resolve from sibling tarballs;
  // the five @obinexusltd/obix-adapter-* deps come from the public registry.
  npm(["install", "--no-audit", "--no-fund", "--install-strategy=hoisted", ...tarballs], consumer);
  pass("npm install completed");

  const installed = join(consumer, "node_modules", "@obinexusltd");
  check(existsSync(join(installed, "obix")), "@obinexusltd/obix is installed");
  for (const s of CORE_SUFFIXES) {
    check(existsSync(join(installed, `obix-core-${s}`)), `@obinexusltd/obix-core-${s} is installed`);
  }

  // ── 3. the `obix` binary belongs to the packed umbrella ─────────────────
  console.log("\n\x1b[1m3. the obix binary is the packed umbrella's\x1b[0m");
  const binShim = join(consumer, "node_modules", ".bin", process.platform === "win32" ? "obix" : "obix");
  check(existsSync(binShim) || existsSync(binShim + ".cmd"), "node_modules/.bin/obix exists");
  const umbPkg = JSON.parse(readFileSync(join(installed, "obix", "package.json"), "utf8"));
  check(umbPkg.bin && umbPkg.bin.obix === "./dist/bin/obix.js", "umbrella package.json declares bin.obix -> ./dist/bin/obix.js");
  check(existsSync(join(installed, "obix", "dist", "bin", "obix.js")), "packed umbrella ships dist/bin/obix.js");
  check(existsSync(join(installed, "obix", "dist", "cli", "doctor-job.js")), "packed umbrella ships the worker fixture dist/cli/doctor-job.js");

  const OBIX_JS = join(installed, "obix", "dist", "bin", "obix.js");

  // ── 4. obix --help / --version / doctor / doctor --json ─────────────────
  console.log("\n\x1b[1m4. obix --help / --version / doctor / doctor --json\x1b[0m");
  const help = tryRun(process.execPath, [OBIX_JS], consumer);
  check(help.code === 0 && /host-compatibility CLI/.test(help.stdout), "obix (help) exits 0 with help text on stdout");

  const ver = tryRun(process.execPath, [OBIX_JS, "--version"], consumer);
  check(ver.code === 0 && /@obinexusltd\/obix \d+\.\d+\.\d+ {2}\(core family \d+\.\d+\.\d+, 10 packages\)/.test(ver.stdout), "obix --version prints umbrella + core family versions");

  const doc = tryRun(process.execPath, [OBIX_JS, "doctor"], consumer);
  check(doc.code === 0, `obix doctor exits 0 (got ${doc.code})`);
  check(doc.stdout === "", "obix doctor writes nothing to stdout (human report on stderr)");
  check(/pass=\d+ fail=0/.test(doc.stderr), "obix doctor human report shows fail=0");

  const jsonRes = tryRun(process.execPath, [OBIX_JS, "doctor", "--json"], consumer);
  let report = null;
  try {
    report = JSON.parse(jsonRes.stdout);
  } catch {
    /* handled below */
  }
  check(report !== null, "obix doctor --json stdout is exactly one JSON document");
  check((jsonRes.stdout.match(/\n/g) || []).length === 1, "obix doctor --json emits a single newline-terminated document");
  check(report && report.schema === "obix-core-diagnostics/doctor@1", "report schema is obix-core-diagnostics/doctor@1");
  check(report && report.ok === true, "obix doctor --json reports ok:true on a clean install");
  check(jsonRes.code === 0, `obix doctor --json exits 0 (got ${jsonRes.code})`);
  check(report && report.checks.length >= 10, "report carries >=10 checks");

  // ── 5. no eager DOM / native loading in the basic path ──────────────────
  console.log("\n\x1b[1m5. basic doctor loads no DOM and no native code\x1b[0m");
  if (report) {
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
    check(byId["native/execution"] && byId["native/execution"].status === "not-tested", "native/execution is not-tested (no library opened)");
    check(byId["process/spawn"] && byId["process/spawn"].status === "not-tested", "process/spawn is not-tested (no process spawned)");
    check(byId["web/dom"] && ["unsupported", "not-tested"].includes(byId["web/dom"].status), "web/dom is not evaluated off a browser");
    check(byId["native/registry"] && byId["native/registry"].status === "tested-pass", "native/registry machinery loads without opening a binary");
    check(byId["scheduler/frozen-timer"] && byId["scheduler/frozen-timer"].status === "tested-pass", "scheduler frozen-Timer semantics verified from the installed package");
  }

  // ── 6. missing optional provider vs an explicit requirement ─────────────
  console.log("\n\x1b[1m6. optional native missing vs --require native\x1b[0m");
  const reqNative = tryRun(process.execPath, [OBIX_JS, "doctor", "--json", "--require", "native"], consumer);
  check(reqNative.code === 1, `obix doctor --require native exits 1 when no real provider exists (got ${reqNative.code})`);
  let rn = null;
  try {
    rn = JSON.parse(reqNative.stdout);
  } catch {
    /* -- */
  }
  check(rn && rn.ok === false && rn.checks.find((c) => c.id === "native/execution")?.required === true, "native/execution is marked required and fails the run");

  // ── 7. every core package's declared exports + decls load from the install
  console.log("\n\x1b[1m7. every core package's declared entrypoints load from the install\x1b[0m");
  for (const s of CORE_SUFFIXES) {
    const pkgDir = join(installed, `obix-core-${s}`);
    const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
    const subpaths = Object.keys(pkg.exports).filter((k) => k !== "./package.json");
    for (const sub of subpaths) {
      const spec = sub === "." ? `@obinexusltd/obix-core-${s}` : `@obinexusltd/obix-core-${s}/${sub.slice(2)}`;
      const isDom = s === "web" && sub === "./dom";
      const r = tryRun(
        process.execPath,
        ["-e", `import(${JSON.stringify(spec)}).then(m=>{if(!m||typeof m!=='object')throw new Error('empty ns');process.exit(0)}).catch(e=>{console.error(e.message);process.exit(3)})`],
        consumer,
      );
      // obix-core-web/dom throws web/dom-required only when a function is CALLED,
      // not on import — so import must still succeed everywhere.
      check(r.code === 0, `import ${spec} succeeds${isDom ? " (module load only; DOM guard is call-time)" : ""}`);
      // matching .d.ts present
      const decl = pkg.exports[sub].types?.replace("./", "");
      if (decl) check(existsSync(join(pkgDir, decl)), `  decl ${decl} present for ${spec}`);
    }
  }

  // ── 8. plain-JS consumer + separately type-checked TS consumer ──────────
  console.log("\n\x1b[1m8. plain-JS consumer + type-checked TS consumer\x1b[0m");
  writeFileSync(
    join(consumer, "use.mjs"),
    `import { runCli } from "@obinexusltd/obix/cli";
import * as caps from "@obinexusltd/obix-core-capabilities";
const code = await runCli(["--version"], {
  stdout: s => process.stdout.write(s), stderr: () => {},
  env: {}, isTTY: false, flush: async () => {}, onCancel: () => () => {},
});
if (code !== 0) throw new Error("runCli --version code " + code);
if (typeof caps.detectHost !== "function") throw new Error("caps.detectHost missing");
console.log("js-consumer ok");
`,
  );
  const jsC = tryRun(process.execPath, [join(consumer, "use.mjs")], consumer);
  check(jsC.code === 0 && /js-consumer ok/.test(jsC.stdout), "plain-JS consumer imports @obinexusltd/obix/cli and a core package");

  // TS consumer — install a local typescript only for this sub-check
  npm(["install", "--no-audit", "--no-fund", "--save-dev", "typescript@~5.7.2"], consumer);
  writeFileSync(
    join(consumer, "use.ts"),
    `import type { HostRecord } from "@obinexusltd/obix-core-capabilities";
import { inspect } from "@obinexusltd/obix-core-capabilities";
import { renderComponentToString } from "@obinexusltd/obix-core-web/server";
const h: HostRecord = inspect().host;
export const rt: string = h.runtime;
export const html: string = renderComponentToString(
  { name: "x", render: () => "<i/>" },
  { renderer: (a) => a.render() },
);
`,
  );
  writeFileSync(
    join(consumer, "tsconfig.json"),
    JSON.stringify(
      { compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", strict: true, noEmit: true, skipLibCheck: true, types: [] }, files: ["use.ts"] },
      null,
      2,
    ),
  );
  const tsC = tryRun(process.execPath, [require_resolve_tsc(consumer), "-p", "tsconfig.json"], consumer);
  check(tsC.code === 0, `TS consumer type-checks against the installed declarations${tsC.code ? "\n" + tsC.stdout + tsC.stderr : ""}`);

  // ── 9. Node / Deno / Bun run the installed entrypoint directly ──────────
  console.log("\n\x1b[1m9. Node / Deno / Bun run the installed dist/bin/obix.js directly\x1b[0m");
  const runners = [
    ["node", process.execPath, []],
    ["deno", process.env.OBIX_DENO || denoPath(), ["run", "-A"]],
    ["bun", process.env.OBIX_BUN || bunPath(), []],
  ];
  for (const [name, exe, pre] of runners) {
    if (!exe || !existsSync(exe)) {
      console.log(`  \x1b[33mskip\x1b[0m ${name} not found — entrypoint execution not-tested on ${name}`);
      continue;
    }
    const r = tryRun(exe, [...pre, OBIX_JS, "doctor", "--json"], consumer);
    let d = null;
    try {
      d = JSON.parse(r.stdout);
    } catch {
      /* -- */
    }
    const wellFormed = Boolean(d && d.schema === "obix-core-diagnostics/doctor@1" && typeof d.ok === "boolean");
    check(wellFormed, `${name} runs the installed umbrella entrypoint and produces one doctor document`);
    // the CLI must report the runtime it actually runs under, FROM INSIDE the
    // process — an npm bin shim that only ever launches Node is not a Deno/Bun result.
    check(wellFormed && d.runtime === name,
      `${name}: doctor.runtime === ${JSON.stringify(name)} (got ${JSON.stringify(d && d.runtime)})`);
  }
} finally {
  if (KEEP) console.log(`\n(kept: ${work})`);
  else
    try {
      rmSync(work, { recursive: true, force: true });
    } catch {
      /* windows file locks — best effort */
    }
}

console.log("");
if (failures) {
  console.log(`\x1b[31m\x1b[1mpacked-consumer verification FAILED — ${failures} failure(s)\x1b[0m`);
  process.exit(1);
}
console.log("\x1b[32m\x1b[1mpacked-consumer verification PASSED\x1b[0m");

function denoPath() {
  const p = join(process.env.USERPROFILE || process.env.HOME || "", ".deno", "bin", "deno.exe");
  return existsSync(p) ? p : "";
}
function bunPath() {
  const p = join(process.env.USERPROFILE || process.env.HOME || "", ".bun", "bin", "bun.exe");
  return existsSync(p) ? p : "";
}
