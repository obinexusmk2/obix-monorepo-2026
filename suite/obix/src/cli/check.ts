/**
 * `obix check` — static verification of an OBIX app:
 *   1. accessibility audit (`obix-core.auditHtml`) of every `*.html` template
 *   2. `tsc --noEmit` if a `tsconfig.json` and a local `typescript` are present
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, relative, resolve } from "node:path";
import { auditHtml, type Diagnostic } from "obix-core";
import type { CliResult } from "./types.js";

const SKIP = new Set(["node_modules", "dist", ".git"]);

function htmlFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) htmlFiles(full, acc);
    else if (extname(entry) === ".html") acc.push(full);
  }
  return acc;
}

function runTsc(cwd: string): { ran: boolean; ok: boolean; output: string } {
  if (!existsSync(join(cwd, "tsconfig.json"))) return { ran: false, ok: true, output: "" };
  let tscJs: string;
  try {
    tscJs = createRequire(join(cwd, "package.json")).resolve("typescript/lib/tsc.js");
  } catch {
    return { ran: false, ok: true, output: "typescript not installed — skipped" };
  }
  const res = spawnSync(process.execPath, [tscJs, "--noEmit", "-p", "tsconfig.json"], {
    cwd,
    encoding: "utf8",
  });
  return { ran: true, ok: res.status === 0, output: (res.stdout || "") + (res.stderr || "") };
}

export interface CheckOptions {
  cwd?: string;
  types?: boolean;
}

export function check(options: CheckOptions = {}): CliResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const diagnostics: Diagnostic[] = [];

  for (const file of htmlFiles(cwd)) {
    const rel = relative(cwd, file);
    for (const d of auditHtml(readFileSync(file, "utf8"))) {
      diagnostics.push({ ...d, message: `${rel}: ${d.message}` });
    }
  }

  const a11yErrors = diagnostics.filter((d) => d.severity === "error").length;

  const tsc = options.types === false ? { ran: false, ok: true, output: "" } : runTsc(cwd);

  const ok = a11yErrors === 0 && tsc.ok;
  const parts = [
    `${diagnostics.length} a11y finding(s), ${a11yErrors} error(s)`,
    tsc.ran ? (tsc.ok ? "tsc: clean" : "tsc: FAILED") : "tsc: skipped",
  ];
  return {
    ok,
    message: parts.join(" · ") + (tsc.ran && !tsc.ok ? `\n${tsc.output.trim()}` : ""),
    diagnostics,
  };
}
