/**
 * @obinexusltd/obix-core-modules/node
 *
 * Node-specific helpers: CommonJS-aware resolution and asset copying. Importing
 * this entrypoint touches `node:module` / `node:fs` — do not import it from a
 * portable context.
 */
import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CompatError } from "@obinexusltd/obix-core-capabilities";
import { createModuleResolver } from "./index.js";
import type { ModuleResolverAPI, ResolvedSpecifier } from "./types.js";

/**
 * A resolver whose bare-specifier resolution also consults Node's CJS
 * `require.resolve` (so packages that only publish a `main`/CJS entry still
 * resolve). ESM resolution still wins when available.
 */
export function createNodeModuleResolver(parentForRequire: string): ModuleResolverAPI {
  const req = createRequire(parentForRequire);
  return createModuleResolver({
    resolveImpl(specifier: string, parentURL: string): string {
      const im = import.meta as unknown as { resolve?: (s: string, p?: string) => string };
      if (typeof im.resolve === "function") {
        try {
          return im.resolve(specifier, parentURL);
        } catch {
          /* fall through to CJS */
        }
      }
      // CJS fallback — resolves `main` / `require` conditions.
      return pathToFileURL(req.resolve(specifier)).href;
    },
  });
}

export interface AssetCopy {
  /** URL or path of the asset, relative to `ownerURL`. */
  from: string;
  /** Destination path (filesystem path, not URL). */
  to: string;
}

/**
 * Copy assets referenced by a module to a build output directory. Paths in
 * `items[].from` are resolved **relative to `ownerURL`** (the owning module),
 * matching `resolveAsset`. Directories are copied recursively.
 */
export function copyAssets(items: readonly AssetCopy[], ownerURL: string): { copied: number } {
  const resolver = createModuleResolver();
  let copied = 0;
  for (const item of items) {
    const srcUrl = resolver.resolveAsset(item.from, ownerURL);
    if (!srcUrl.startsWith("file:")) {
      throw new CompatError({
        code: "module/resolve",
        package: "obix-core-modules",
        operation: "copyAssets",
        reason: `asset "${item.from}" did not resolve to a file: URL (${srcUrl})`,
      });
    }
    const src = fileURLToPath(srcUrl);
    if (!existsSync(src)) {
      throw new CompatError({
        code: "fs/read",
        package: "obix-core-modules",
        operation: "copyAssets",
        reason: `asset not found: ${src}`,
        remediation: "Check the asset path is relative to the module that references it.",
      });
    }
    mkdirSync(dirname(item.to), { recursive: true });
    cpSync(src, item.to, { recursive: true });
    copied++;
  }
  return { copied };
}

export type { ModuleResolverAPI, ResolvedSpecifier } from "./types.js";
