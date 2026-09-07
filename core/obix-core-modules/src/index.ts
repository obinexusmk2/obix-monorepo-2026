/**
 * @obinexusltd/obix-core-modules
 *
 * Host-delegating module resolution and loading, asset URL resolution, and
 * installed package-set validation for the OBIX CLI.
 *
 * Portable root: no filesystem access at import time. Loading is delegated to
 * the host's own `import()` (overridable). ESM is the baseline; CommonJS callers
 * use the documented asynchronous `import()` — this package does **not** promise
 * a synchronous `require()`.
 */
import { CompatError } from "@obinexusltd/obix-core-capabilities";
import type {
  InstalledManifest,
  LoadResult,
  ModuleResolverAPI,
  PackageSetProblem,
  PackageSetReport,
  ResolvedSpecifier,
  ResolverHooks,
} from "./types.js";

export type {
  InstalledManifest,
  LoadResult,
  ModuleResolverAPI,
  PackageSetProblem,
  PackageSetReport,
  ResolvedSpecifier,
  ResolverHooks,
} from "./types.js";
export { CompatError } from "@obinexusltd/obix-core-capabilities";

const RELATIVE = /^(\.\.?)(\/|\\|$)/;

/**
 * Percent-encode the URL-significant characters `#` and `?` that would otherwise
 * split a filesystem path into a fragment / query. `new URL()` already encodes
 * spaces and non-ASCII in the pathname; it does NOT do this.
 */
function encodePathDelimiters(s: string): string {
  return s.replace(/#/g, "%23").replace(/\?/g, "%3F");
}

/** `import.meta.resolve` is stable in Node ≥ 20.6, Deno, and Bun. */
function defaultResolve(specifier: string, parentURL: string): string | null {
  const im = import.meta as unknown as { resolve?: (s: string, p?: string) => string };
  if (typeof im.resolve === "function") {
    try {
      return im.resolve(specifier, parentURL);
    } catch {
      return null;
    }
  }
  return null;
}

export function createModuleResolver(hooks: ResolverHooks = {}): ModuleResolverAPI {
  const doImport = hooks.importImpl ?? ((s: string) => import(s));
  const doResolve = hooks.resolveImpl ?? defaultResolve;

  function resolveModule(specifier: string, parentURL: string): ResolvedSpecifier {
    if (typeof specifier !== "string" || specifier === "") {
      throw new CompatError({
        code: "module/resolve",
        package: "obix-core-modules",
        operation: "resolveModule",
        reason: "specifier must be a non-empty string",
      });
    }
    if (typeof parentURL !== "string" || !/^[a-z][a-z0-9+.-]*:/i.test(parentURL)) {
      throw new CompatError({
        code: "module/resolve",
        package: "obix-core-modules",
        operation: "resolveModule",
        reason: `parentURL must be an absolute URL, got ${JSON.stringify(parentURL)}`,
        remediation: "Pass `import.meta.url` of the importing module.",
      });
    }

    // Relative / absolute-path specifier -> concrete URL, no guessing.
    if (RELATIVE.test(specifier) || specifier.startsWith("/") || /^[a-z]+:/i.test(specifier)) {
      if (/^[a-z]+:/i.test(specifier)) {
        return { input: specifier, parentURL, kind: "url", resolved: specifier, via: "passthrough" };
      }
      const url = new URL(encodePathDelimiters(specifier.replace(/\\/g, "/")), parentURL).href;
      return { input: specifier, parentURL, kind: "url", resolved: url, via: "url-relative" };
    }

    // Bare specifier -> ask the runtime, else pass through for the host loader.
    const r = doResolve(specifier, parentURL);
    if (r) return { input: specifier, parentURL, kind: "url", resolved: r, via: "import.meta.resolve" };
    return { input: specifier, parentURL, kind: "bare", resolved: specifier, via: "passthrough" };
  }

  async function loadModule<T = unknown>(specifier: string, parentURL: string): Promise<LoadResult<T>> {
    const resolved = resolveModule(specifier, parentURL);
    try {
      const namespace = (await doImport(resolved.resolved)) as T;
      return { namespace, resolved };
    } catch (err) {
      throw classifyLoadError(err, specifier, parentURL);
    }
  }

  function resolveAsset(assetSpecifier: string, ownerURL: string): string {
    if (typeof assetSpecifier !== "string" || assetSpecifier === "") {
      throw new CompatError({
        code: "module/resolve",
        package: "obix-core-modules",
        operation: "resolveAsset",
        reason: "assetSpecifier must be a non-empty string",
      });
    }
    if (/^[a-z]+:/i.test(assetSpecifier)) return assetSpecifier; // already a URL
    // Assets resolve relative to their OWNING module's URL — not the CLI cwd.
    return new URL(encodePathDelimiters(assetSpecifier.replace(/\\/g, "/")), ownerURL).href;
  }

  function validatePackageSet(
    manifests: readonly InstalledManifest[],
    opts: { familyPrefix: string; expectedVersion: string },
  ): PackageSetReport {
    const problems: PackageSetProblem[] = [];
    const byName = new Map<string, Set<string>>();
    for (const m of manifests) {
      if (!m || typeof m.name !== "string") continue;
      if (!byName.has(m.name)) byName.set(m.name, new Set());
      byName.get(m.name)!.add(m.version);
    }

    for (const [name, versions] of byName) {
      if (!name.startsWith(opts.familyPrefix)) continue;
      if (versions.size > 1) {
        problems.push({
          kind: "duplicate-version",
          package: name,
          detail: `installed at ${[...versions].sort().join(", ")} — the family must be a single version`,
        });
      }
      for (const v of versions) {
        if (v !== opts.expectedVersion) {
          problems.push({
            kind: "version-mismatch",
            package: name,
            detail: `installed ${v}, family version is ${opts.expectedVersion}`,
          });
        }
      }
    }

    for (const m of manifests) {
      if (!m?.name?.startsWith(opts.familyPrefix)) continue;
      for (const [dep, range] of Object.entries(m.dependencies ?? {})) {
        if (!dep.startsWith(opts.familyPrefix)) continue;
        if (range !== opts.expectedVersion) {
          problems.push({
            kind: "range-not-exact",
            package: `${m.name} -> ${dep}`,
            detail: `range "${range}" is not the exact family pin "${opts.expectedVersion}"`,
          });
        }
        if (!byName.has(dep)) {
          problems.push({ kind: "missing", package: dep, detail: `required by ${m.name} but not in the installed set` });
        }
      }
    }

    return { ok: problems.length === 0, problems };
  }

  return { resolveModule, loadModule, resolveAsset, validatePackageSet };
}

function classifyLoadError(err: unknown, specifier: string, parentURL: string): CompatError {
  const e = err as { code?: string; message?: string };
  const msg = e?.message ?? String(err);
  let code: "module/resolve" | "module/load" = "module/load";
  let reason = msg;
  let remediation: string | undefined;

  if (e?.code === "ERR_MODULE_NOT_FOUND" || e?.code === "ERR_UNSUPPORTED_DIR_IMPORT") {
    code = "module/resolve";
    reason = `cannot resolve "${specifier}" from ${parentURL}`;
    remediation =
      "Use an explicit relative path with a `.js` extension, or a bare specifier that is an actual dependency.";
  } else if (e?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED" || /is not exported/.test(msg)) {
    code = "module/load";
    reason = `"${specifier}" resolves, but that subpath is not in the package's "exports"`;
    remediation = "Import a subpath the package actually declares in its `exports` map.";
  } else if (/does not provide an export named|has no exported member/.test(msg)) {
    code = "module/load";
    reason = `"${specifier}" loaded but a named export is missing: ${msg}`;
    remediation = "The installed version's public API differs — check for version skew (`validatePackageSet`).";
  }

  return new CompatError({
    code,
    package: "obix-core-modules",
    operation: "loadModule",
    reason,
    cause: err,
    remediation,
  });
}

/** A ready resolver bound to the host's own `import()` and `import.meta.resolve`. */
export const modules: ModuleResolverAPI = createModuleResolver();
