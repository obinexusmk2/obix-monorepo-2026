/**
 * GATE 3 — unified lockstep versioning.
 * Failure code: OBIX-C011
 *
 *   - every package .version === OBIX_VERSION
 *   - every internal @obinexusltd/obix-* dependency pins the EXACT OBIX_VERSION
 *     (no "*", "^", "~", ">=", "workspace:*", ranges)
 */
import { PACKAGES } from "./graph.mjs";
import { OBIX_VERSION, readPkgJson, ok, fail, BOLD } from "./_lib.mjs";

const CODE = "OBIX-C011";
let errors = 0;

console.log(BOLD(`check:versions — OBIX_VERSION = ${OBIX_VERSION}\n`));

for (const short of PACKAGES) {
  let pkg;
  try {
    pkg = readPkgJson(short);
  } catch {
    fail(`${CODE} ${short}: package.json missing or unreadable`);
    errors++;
    continue;
  }

  if (pkg.version !== OBIX_VERSION) {
    fail(`${CODE} ${pkg.name}: version "${pkg.version}" !== "${OBIX_VERSION}"`);
    errors++;
  }

  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    const deps = pkg[field] ?? {};
    for (const [name, spec] of Object.entries(deps)) {
      if (!name.startsWith("@obinexusltd/obix-")) continue;
      if (spec !== OBIX_VERSION) {
        fail(`${CODE} ${pkg.name}: ${field}["${name}"] = "${spec}" — must be exactly "${OBIX_VERSION}"`);
        errors++;
      }
    }
  }
}

if (errors) {
  console.error(`\n${CODE}: ${errors} version problem(s). CI must reject this.`);
  process.exit(1);
}
ok(`all ${PACKAGES.length} packages at ${OBIX_VERSION}; every internal dep pins it exactly`);
