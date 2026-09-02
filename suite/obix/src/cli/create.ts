/**
 * `obix create <dir>` — scaffold a standard HTML/CSS/TS Web Component app.
 * Copies `dist/templates/app/` (populated from `src/templates/app/` at build
 * time), substituting `__APP_NAME__`.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CliResult } from "./types.js";

const TEMPLATE_DIR = fileURLToPath(new URL("../templates/app/", import.meta.url));

function substituteTree(dir: string, appName: string): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      substituteTree(full, appName);
      continue;
    }
    const text = readFileSync(full, "utf8").replaceAll("__APP_NAME__", appName);
    writeFileSync(full, text);
    if (entry.endsWith(".tmpl")) renameSync(full, full.slice(0, -".tmpl".length));
  }
}

export function create(targetDir: string): CliResult {
  if (!existsSync(TEMPLATE_DIR)) {
    return { ok: false, message: `create: template dir missing (${TEMPLATE_DIR}) — run the suite build` };
  }
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    return { ok: false, message: `create: ${targetDir} exists and is not empty` };
  }
  const appName = basename(targetDir).replace(/[^a-zA-Z0-9-]/g, "-") || "obix-app";
  mkdirSync(targetDir, { recursive: true });
  cpSync(TEMPLATE_DIR, targetDir, { recursive: true });
  substituteTree(targetDir, appName);

  return {
    ok: true,
    message: [
      `scaffolded ${appName} in ${targetDir}`,
      ``,
      `  cd ${targetDir}`,
      `  npm install`,
      `  npx obix dev      # serve with live reload`,
      `  npx obix build    # bundle to dist/`,
      `  npx obix check    # types + accessibility`,
    ].join("\n"),
  };
}
