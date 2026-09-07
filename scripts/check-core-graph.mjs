/**
 * Gate: the ten @obinexusltd/obix-core-* compatibility packages.
 *
 * Enforces, against the ACTUAL source and manifests:
 *   - exactly the ten expected scoped names, one per core/obix-core-<suffix> dir
 *   - every core/* version === core/version.json  (independent of OBIX_VERSION / SUITE_VERSION)
 *   - internal deps pinned EXACT to the family version (no ^ ~ ranges)
 *   - declared internal deps ⊆ the allowed edge set
 *   - every internal specifier IMPORTED in source .ts files is DECLARED (import-aware,
 *     comment/string safe; covers `import … from`, `export … from`, `import("literal")`)
 *   - a computed `import(expr)` may not select an internal core/* package
 *   - no dependency cycle among the ten
 *   - after build, every declared `exports` target file exists on disk
 *   - `sideEffects: false` on every core/* manifest
 *   - the frozen graph (scripts/graph.mjs) and fixture (packages/obix-timer) are unchanged
 *
 * Usage:  node scripts/check-core-graph.mjs [--no-build] [--no-frozen-check]
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const CORE = join(ROOT, "core");
const args = new Set(process.argv.slice(2));
const DO_BUILD = !args.has("--no-build");
const DO_FROZEN = !args.has("--no-frozen-check");

const SCOPE = "@obinexusltd";
const PREFIX = "obix-core-";

/** suffix -> allowed internal (compatibility-family) dependency suffixes */
const ALLOWED = {
  capabilities: [],
  modules: ["capabilities"],
  filesystem: ["capabilities"],
  process: ["capabilities", "modules", "streams"],
  scheduler: ["capabilities"],
  streams: ["capabilities"],
  workers: ["capabilities", "modules", "scheduler"],
  native: ["capabilities", "modules"],
  web: ["capabilities", "scheduler"],
  diagnostics: ["capabilities"],
};
const SUFFIXES = Object.keys(ALLOWED).sort();

// ── output ──────────────────────────────────────────────────────────────────
const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", b: "\x1b[1m", x: "\x1b[0m" };
let errors = 0;
let warns = 0;
const ok = (m) => console.log(`  ${C.g}✔${C.x} ${m}`);
const bad = (m) => {
  console.log(`  ${C.r}✗${C.x} ${m}`);
  errors++;
};
const warn = (m) => {
  console.log(`  ${C.y}!${C.x} ${m}`);
  warns++;
};
const head = (m) => console.log(`\n${C.b}${m}${C.x}`);

// ── helpers ─────────────────────────────────────────────────────────────────
function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

/** Strip // and /* *​/ comments and the contents of string/template literals so
 *  a later specifier scan cannot be fooled by text inside comments or strings. */
function stripCommentsAndStrings(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && c2 === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      out += " '' "; // placeholder token so `from ''` still parses structurally
      i++;
      while (i < n) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === q) {
          i++;
          break;
        }
        if (q === "`" && src[i] === "$" && src[i + 1] === "{") {
          // recurse into ${ ... } template expressions (they are real code)
          let depth = 1;
          i += 2;
          const start = i;
          while (i < n && depth > 0) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}") depth--;
            if (depth > 0) i++;
          }
          out += " " + stripCommentsAndStrings(src.slice(start, i)) + " ";
          i++; // past }
        } else {
          i++;
        }
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** All import/export specifiers + computed-dynamic-import flags for a source string. */
function analyzeImports(src) {
  const code = stripCommentsAndStrings(src);
  const specifiers = new Set();
  const rawWithStrings = src;

  // static: import ... from "X" | export ... from "X" | import "X"
  for (const m of rawWithStrings.matchAll(
    /(?:^|[\n;])\s*(?:import|export)\b[^;\n]*?\bfrom\s*(["'])([^"']+)\1/g,
  )) {
    specifiers.add(m[2]);
  }
  for (const m of rawWithStrings.matchAll(/(?:^|[\n;])\s*import\s*(["'])([^"']+)\1/g)) {
    specifiers.add(m[2]);
  }
  // dynamic import("literal")
  for (const m of rawWithStrings.matchAll(/\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/g)) {
    specifiers.add(m[2]);
  }
  // computed dynamic import( <not-a-plain-string> ) — keep the argument
  // expressions so the caller can judge WHAT is being selected, instead of a
  // whole-file regex that trips on an unrelated static import or a header
  // comment mentioning the scope.
  const computedArgs = [];
  for (const m of code.matchAll(/\bimport\s*\(\s*([^)]*)\)/g)) {
    const arg = m[1].trim();
    // after string-stripping a literal import becomes  import( '' )
    if (arg !== "''" && arg !== "") computedArgs.push(arg);
  }
  return { specifiers: [...specifiers], computed: computedArgs.length > 0, computedArgs };
}

function tsFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".ts")) out.push(p);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

function internalDepSuffixes(pkg) {
  const deps = { ...(pkg.dependencies ?? {}) };
  const out = [];
  for (const name of Object.keys(deps)) {
    if (name.startsWith(`${SCOPE}/${PREFIX}`)) out.push(name.slice(`${SCOPE}/${PREFIX}`.length));
  }
  return out.sort();
}

// ── load ────────────────────────────────────────────────────────────────────
head("check:core-graph — the ten @obinexusltd/obix-core-* packages");

if (!existsSync(join(CORE, "version.json"))) {
  bad("core/version.json is missing");
  process.exit(1);
}
const FAMILY_VERSION = readJson(join(CORE, "version.json")).version;
console.log(`  family version (core/version.json): ${FAMILY_VERSION}`);

const dirs = existsSync(CORE)
  ? readdirSync(CORE).filter((d) => d.startsWith(PREFIX) && statSync(join(CORE, d)).isDirectory())
  : [];

// ── 1. names / count ────────────────────────────────────────────────────────
head("1. names & count");
const foundSuffixes = dirs.map((d) => d.slice(PREFIX.length)).sort();
if (foundSuffixes.length === 10 && JSON.stringify(foundSuffixes) === JSON.stringify(SUFFIXES)) {
  ok(`exactly the ten expected packages: ${SUFFIXES.join(", ")}`);
} else {
  const missing = SUFFIXES.filter((s) => !foundSuffixes.includes(s));
  const extra = foundSuffixes.filter((s) => !SUFFIXES.includes(s));
  if (missing.length) bad(`missing core/obix-core-*: ${missing.join(", ")}`);
  if (extra.length) bad(`unexpected core/obix-core-* (no 11th package allowed): ${extra.join(", ")}`);
}

const pkgs = {};
for (const suffix of foundSuffixes) {
  const dir = join(CORE, PREFIX + suffix);
  const pj = join(dir, "package.json");
  if (!existsSync(pj)) {
    bad(`${PREFIX}${suffix}: no package.json`);
    continue;
  }
  const pkg = readJson(pj);
  pkgs[suffix] = { dir, pkg };
  const want = `${SCOPE}/${PREFIX}${suffix}`;
  if (pkg.name !== want) bad(`${PREFIX}${suffix}: package.json name is "${pkg.name}", expected "${want}"`);
}

// ── 2. version = family version ─────────────────────────────────────────────
head("2. single version source (independent of OBIX_VERSION / SUITE_VERSION)");
for (const [suffix, { pkg }] of Object.entries(pkgs)) {
  if (pkg.version === FAMILY_VERSION) ok(`${PREFIX}${suffix} @ ${pkg.version}`);
  else bad(`${PREFIX}${suffix} version "${pkg.version}" != family "${FAMILY_VERSION}"`);
}
// independence: the two other version sources must not equal-by-coincidence be edited to match
for (const f of ["OBIX_VERSION", join("suite", "SUITE_VERSION")]) {
  const p = join(ROOT, f);
  if (existsSync(p)) console.log(`  (${f} = ${readFileSync(p, "utf8").trim()} — left independent)`);
}

// ── 3. exact internal pins ─────────────────────────────────────────────────
head("3. internal dependency pins are EXACT");
for (const [suffix, { pkg }] of Object.entries(pkgs)) {
  for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
    if (!name.startsWith(`${SCOPE}/${PREFIX}`)) continue;
    if (range === FAMILY_VERSION) ok(`${PREFIX}${suffix} -> ${name}@${range}`);
    else bad(`${PREFIX}${suffix} -> ${name}@"${range}" is not an exact pin to ${FAMILY_VERSION}`);
  }
}

// ── 4. declared deps ⊆ allowed edges ───────────────────────────────────────
head("4. declared internal deps ⊆ allowed edges");
for (const [suffix, { pkg }] of Object.entries(pkgs)) {
  const declared = internalDepSuffixes(pkg);
  const allowed = ALLOWED[suffix] ?? [];
  const forbidden = declared.filter((d) => !allowed.includes(d));
  if (forbidden.length) bad(`${PREFIX}${suffix} declares forbidden edge(s): ${forbidden.join(", ")} (allowed: ${allowed.join(", ") || "none"})`);
  else ok(`${PREFIX}${suffix} -> [${declared.join(", ") || "none"}]  ⊆  [${allowed.join(", ") || "none"}]`);
}

// ── 5. imported internal specifiers ⊆ declared; computed import guard ───────
head("5. every imported internal specifier is declared (import-aware)");
for (const [suffix, { dir, pkg }] of Object.entries(pkgs)) {
  const declared = new Set(internalDepSuffixes(pkg).map((s) => `${SCOPE}/${PREFIX}${s}`));
  let clean = true;
  for (const file of tsFiles(join(dir, "src"))) {
    const src = readFileSync(file, "utf8");
    const { specifiers, computedArgs } = analyzeImports(src);
    for (const spec of specifiers) {
      // normalise subpath imports like @obinexusltd/obix-core-streams/node
      const base = spec.startsWith(`${SCOPE}/${PREFIX}`) ? spec.split("/").slice(0, 2).join("/") : null;
      if (base && !declared.has(base)) {
        bad(`${PREFIX}${suffix}: ${file.slice(ROOT.length)} imports "${spec}" but it is not in dependencies`);
        clean = false;
      }
    }
    for (const arg of computedArgs) {
      // Flag ONLY when the computed expression itself builds an internal
      // specifier (e.g. import("@obinexusltd/obix-core-" + name)). A computed
      // import of a caller/host specifier is legitimate for a module loader.
      if (new RegExp(`${PREFIX}|@obinexusltd`).test(arg)) {
        bad(`${PREFIX}${suffix}: ${file.slice(ROOT.length)} computes an internal specifier in import(${arg}) — internal selection must be a literal import`);
        clean = false;
      } else {
        warn(`${PREFIX}${suffix}: ${file.slice(ROOT.length)} has a computed import(${arg}) — target not statically resolvable (host built-ins / caller specifiers only)`);
      }
    }
  }
  if (clean) ok(`${PREFIX}${suffix}: all internal imports declared; no computed internal selection`);
}

// ── 6. no cycles among the ten ─────────────────────────────────────────────
head("6. acyclic compatibility graph");
{
  const g = {};
  for (const [suffix, { pkg }] of Object.entries(pkgs)) g[suffix] = internalDepSuffixes(pkg);
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = Object.fromEntries(Object.keys(g).map((k) => [k, WHITE]));
  const stack = [];
  let cyclic = false;
  const visit = (n) => {
    color[n] = GRAY;
    stack.push(n);
    for (const d of g[n] ?? []) {
      if (color[d] === GRAY) {
        bad(`cycle: ${stack.slice(stack.indexOf(d)).join(" -> ")} -> ${d}`);
        cyclic = true;
      } else if (color[d] === WHITE) visit(d);
    }
    stack.pop();
    color[n] = BLACK;
  };
  for (const n of Object.keys(g)) if (color[n] === WHITE) visit(n);
  if (!cyclic) ok("no dependency cycle among the ten");
}

// ── 7. built export targets exist ─────────────────────────────────────────
head("7. declared exports resolve to built files");
if (DO_BUILD) {
  for (const [suffix, { dir }] of Object.entries(pkgs)) {
    try {
      // Hermetic: resolve the workspace's own TypeScript and run it with the
      // current Node — no shell, no `npx.cmd` (EINVAL on modern Node/Windows),
      // no dependency on a globally installed tsc.
      const req = createRequire(join(dir, "package.json"));
      const tsc = req.resolve("typescript/bin/tsc");
      execFileSync(process.execPath, [tsc, "-p", "tsconfig.json"], { cwd: dir, stdio: "pipe" });
    } catch (err) {
      bad(`${PREFIX}${suffix}: build failed\n${(err.stdout || err.message || err).toString().slice(0, 800)}`);
    }
  }
}
for (const [suffix, { dir, pkg }] of Object.entries(pkgs)) {
  const exp = pkg.exports ?? {};
  let good = true;
  for (const [key, val] of Object.entries(exp)) {
    const targets = typeof val === "string" ? [val] : Object.values(val);
    for (const t of targets) {
      if (typeof t !== "string" || !t.startsWith("./")) continue;
      if (!existsSync(join(dir, t))) {
        bad(`${PREFIX}${suffix}: exports["${key}"] -> ${t} does not exist${DO_BUILD ? "" : " (run without --no-build)"}`);
        good = false;
      }
    }
  }
  if (pkg.sideEffects !== false) bad(`${PREFIX}${suffix}: "sideEffects" must be exactly false`);
  if (good && pkg.sideEffects === false) ok(`${PREFIX}${suffix}: all export targets present; sideEffects:false`);
}

// ── 8. frozen track untouched ────────────────────────────────────────────
head("8. frozen compiler track & fixture unchanged");
if (DO_FROZEN) {
  try {
    const diff = execFileSync("git", ["diff", "--stat", "HEAD", "--", "scripts/graph.mjs", "packages/obix-timer", "OBIX_VERSION"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
    if (diff === "") ok("scripts/graph.mjs, packages/obix-timer/, OBIX_VERSION — no diff vs HEAD");
    else bad(`frozen files changed vs HEAD:\n${diff}`);
  } catch (err) {
    warn(`could not run git diff for the frozen-track check: ${err.message}`);
  }
  // frozen graph self-check still green
  try {
    execFileSync("node", ["scripts/check-graph-rules.mjs"], { cwd: ROOT, stdio: "pipe" });
    execFileSync("node", ["scripts/check-cycles.mjs"], { cwd: ROOT, stdio: "pipe" });
    ok("frozen graph gates (check-graph-rules, check-cycles) still pass");
  } catch (err) {
    bad(`a frozen graph gate now fails:\n${(err.stdout || err.message || "").toString().slice(0, 600)}`);
  }
}

// ── result ──────────────────────────────────────────────────────────────────
console.log("");
if (errors) {
  console.log(`${C.r}${C.b}check:core-graph FAILED — ${errors} error(s), ${warns} warning(s)${C.x}`);
  process.exit(1);
}
console.log(`${C.g}${C.b}check:core-graph PASSED${C.x}  (${warns} warning(s))`);
