import { readFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const PACKAGES_DIR = join(ROOT, "packages");

export const OBIX_VERSION = readFileSync(join(ROOT, "OBIX_VERSION"), "utf8").trim();

export function readJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function pkgJsonPath(short) {
  return join(PACKAGES_DIR, short, "package.json");
}

export function readPkgJson(short) {
  return readJSON(pkgJsonPath(short));
}

export function pkgDir(short) {
  return join(PACKAGES_DIR, short);
}

/** internal obix-* deps declared in a package.json (deps only, not dev) */
export function internalDeps(pkgJson) {
  const deps = pkgJson.dependencies ?? {};
  return Object.keys(deps).filter((n) => n.startsWith("obix-"));
}

export function run(cmd, args, opts = {}) {
  const isCmd = /\.(cmd|bat)$/i.test(cmd);
  return execFileSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: opts.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    // .cmd/.bat shims need a shell on Windows; real executables never do
    shell: isCmd && process.platform === "win32",
    ...opts,
  });
}

/** Absolute path to the TypeScript compiler entry (tsc.js) — run with node. */
export function tscJs() {
  return join(ROOT, "node_modules", "typescript", "lib", "tsc.js");
}

/** Platform-correct npm executable name. */
export const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

export function gzipSize(buf) {
  return gzipSync(typeof buf === "string" ? Buffer.from(buf) : buf, { level: 9 }).length;
}

export function listTestFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTestFiles(p));
    else if (entry.name.endsWith(".test.mjs")) out.push(p);
  }
  return out;
}

export function rmrf(path) {
  rmSync(path, { recursive: true, force: true });
}

export const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
export const RED = (s) => `\x1b[31m${s}\x1b[0m`;
export const DIM = (s) => `\x1b[2m${s}\x1b[0m`;
export const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;

export function ok(msg) {
  console.log(`${GREEN("✔")} ${msg}`);
}
export function fail(msg) {
  console.error(`${RED("x")} ${msg}`);
}

export function die(msg, code = 1) {
  fail(msg);
  process.exit(code);
}
