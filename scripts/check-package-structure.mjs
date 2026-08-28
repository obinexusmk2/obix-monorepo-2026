/**
 * GATE 1  — all 20 package directories exist
 * GATE 2  — all 20 have correct @obinexusltd/obix-* names
 * GATE 10 — every package emits TypeScript declarations (dist/index.d.ts) after build
 * GATE 12 — no package would publish src/, node_modules/, tsbuildinfo
 * plus: common package.json contract (type:module, private:false, publishConfig, exports, sideEffects, engines)
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PACKAGES, pkgName } from "./graph.mjs";
import { OBIX_VERSION, pkgDir, readPkgJson, ok, fail, BOLD } from "./_lib.mjs";

let errors = 0;
const err = (m) => {
  fail(m);
  errors++;
};

console.log(BOLD(`check:structure — ${PACKAGES.length} packages\n`));

if (PACKAGES.length !== 20) err(`expected exactly 20 packages, graph lists ${PACKAGES.length}`);

for (const short of PACKAGES) {
  const dir = pkgDir(short);
  if (!existsSync(dir)) {
    err(`GATE1 ${short}: directory missing`);
    continue;
  }
  let pkg;
  try {
    pkg = readPkgJson(short);
  } catch {
    err(`GATE1 ${short}: package.json missing`);
    continue;
  }

  if (pkg.name !== pkgName(short)) err(`GATE2 ${short}: name "${pkg.name}" !== "${pkgName(short)}"`);
  if (pkg.private !== false) err(`${short}: "private" must be false`);
  if (!pkg.publishConfig || pkg.publishConfig.access !== "public") err(`${short}: publishConfig.access must be "public"`);
  if (pkg.type !== "module") err(`${short}: "type" must be "module"`);
  if (pkg.sideEffects !== false) err(`${short}: "sideEffects" must be false`);
  if (pkg.version !== OBIX_VERSION) err(`${short}: version drift (see check:versions)`);
  if (!pkg.engines || !pkg.engines.node) err(`${short}: engines.node missing`);
  if (!pkg.exports || !pkg.exports["."]) err(`${short}: exports["."] missing`);
  else {
    const e = pkg.exports["."];
    if (e.types !== "./dist/index.d.ts") err(`${short}: exports["."].types must be ./dist/index.d.ts`);
    if (e.import !== "./dist/index.js") err(`${short}: exports["."].import must be ./dist/index.js`);
  }
  if (!Array.isArray(pkg.files) || !pkg.files.includes("dist")) err(`${short}: "files" must include "dist"`);
  for (const bad of ["src", "node_modules", "*.tsbuildinfo", "tsconfig.tsbuildinfo"]) {
    if ((pkg.files ?? []).includes(bad)) err(`GATE12 ${short}: "files" must not include "${bad}"`);
  }
  if (!existsSync(join(dir, "src", "index.ts"))) err(`${short}: src/index.ts missing`);
  if (!existsSync(join(dir, "README.md"))) err(`${short}: README.md missing`);
  if (!existsSync(join(dir, "tsconfig.json"))) err(`${short}: tsconfig.json missing`);

  // GATE 10 — declarations, only checked once built
  const built = existsSync(join(dir, "dist", "index.js"));
  if (built && !existsSync(join(dir, "dist", "index.d.ts"))) {
    err(`GATE10 ${short}: built but no dist/index.d.ts`);
  }
}

if (errors) {
  console.error(`\n${errors} structure problem(s).`);
  process.exit(1);
}
ok(`all ${PACKAGES.length} packages structurally valid`);
