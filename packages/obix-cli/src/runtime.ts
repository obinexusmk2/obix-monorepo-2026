import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compileFile } from "@obinexusltd/obix-compiler";
import type { DOPArtifact, TraceItem } from "@obinexusltd/obix-spec";

/** Resolve the on-disk URL of @obinexusltd/obix-ir so emitted temp modules
 *  can import it from anywhere. */
function irImportUrl(): string {
  // import.meta.resolve is stable on Node 20.6+
  return import.meta.resolve("@obinexusltd/obix-ir");
}

export interface LoadedComponent {
  artifact: DOPArtifact;
  code: string;
  irPath: string;
  cleanup(): void;
}

/**
 * Compile a `.obix` file and load its emitted module so it can be executed
 * (used by `obixc test` / `obixc equivalence` / `obixc verify`).
 */
export async function loadComponent(path: string): Promise<LoadedComponent> {
  const result = compileFile(path, { irImport: irImportUrl() });
  if (!result.ok || !result.code) {
    const msg = result.diagnostics
      .filter((d) => d.severity === "error")
      .map((d) => `  ${d.code} ${d.message}`)
      .join("\n");
    throw new Error(`compile failed for ${path}:\n${msg}`);
  }
  const dir = mkdtempSync(join(tmpdir(), "obixc-"));
  const file = join(dir, `${result.ir!.name}.mjs`);
  writeFileSync(file, result.code, "utf8");
  const mod = await import(pathToFileURL(file).href);
  return {
    artifact: (mod.default ?? mod[`${result.ir!.name}DOP`]) as DOPArtifact,
    code: result.code,
    irPath: file,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export function parseTrace(spec: string | undefined): TraceItem[] {
  if (!spec) return [];
  return spec
    .split(/[,\s]+/)
    .filter(Boolean)
    .map((s): TraceItem => [s]);
}
