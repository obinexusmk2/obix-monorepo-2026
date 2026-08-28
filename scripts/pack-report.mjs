/**
 * GATE 11 — `npm pack --dry-run` succeeds for every package
 * GATE 12 — no package ships src/, test/, node_modules/, tsbuildinfo, coverage
 * Also emits the §19 report: package / version / tarball / packed / unpacked / files.
 */
import { PACKAGES } from "./graph.mjs";
import { OBIX_VERSION, pkgDir, run, NPM, ok, fail, BOLD } from "./_lib.mjs";

console.log(BOLD("pack:dry-run — npm pack --dry-run for all 20 packages\n"));

const FORBIDDEN = [/^src\//, /^test\//, /(^|\/)node_modules\//, /\.tsbuildinfo$/, /^coverage\//, /\.map\.map$/];
const rows = [];
let errors = 0;

for (const short of PACKAGES) {
  let json;
  try {
    const out = run(NPM, ["pack", "--dry-run", "--json"], { cwd: pkgDir(short), stdio: "pipe", capture: true });
    json = JSON.parse(out);
  } catch (err) {
    fail(`${short}: npm pack --dry-run failed\n${err.stdout || ""}${err.stderr || ""}`);
    errors++;
    continue;
  }
  const info = Array.isArray(json) ? json[0] : json;
  const files = (info.files ?? []).map((f) => f.path);
  const bad = files.filter((f) => FORBIDDEN.some((re) => re.test(f)));
  if (bad.length) {
    fail(`${short}: tarball would include forbidden files: ${bad.join(", ")}`);
    errors++;
  }
  rows.push({
    package: info.name,
    version: info.version,
    tarball: info.filename,
    packedKB: (info.size / 1024).toFixed(1),
    unpackedKB: (info.unpackedSize / 1024).toFixed(1),
    files: info.entryCount ?? files.length,
  });
}

console.log("");
const w = (s, n) => String(s).padEnd(n);
console.log(w("package", 40), w("ver", 8), w("packed", 9), w("unpack", 9), "files");
console.log("-".repeat(78));
for (const r of rows) {
  console.log(w(r.package, 40), w(r.version, 8), w(r.packedKB + "K", 9), w(r.unpackedKB + "K", 9), r.files);
}
console.log("-".repeat(78));
console.log(`${rows.length} packages, all at ${OBIX_VERSION}\n`);

if (errors) {
  console.error(`${errors} pack problem(s).`);
  process.exit(1);
}
if (rows.length !== 20) {
  console.error(`expected 20 packed packages, got ${rows.length}`);
  process.exit(1);
}
ok("npm pack --dry-run succeeds for all 20; no build junk in any tarball");
