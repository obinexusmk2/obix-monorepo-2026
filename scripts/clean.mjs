/** Remove build output from every package. */
import { join } from "node:path";
import { PACKAGES } from "./graph.mjs";
import { pkgDir, rmrf, ok } from "./_lib.mjs";

for (const short of PACKAGES) {
  rmrf(join(pkgDir(short), "dist"));
  rmrf(join(pkgDir(short), "tsconfig.tsbuildinfo"));
  rmrf(join(pkgDir(short), "test", "__out__"));
}
ok("cleaned dist/ + tsbuildinfo for all packages");
