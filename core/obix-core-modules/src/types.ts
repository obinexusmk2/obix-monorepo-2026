/**
 * @obinexusltd/obix-core-modules — shared types (portable).
 */
import type { CompatError } from "@obinexusltd/obix-core-capabilities";

export type { CompatError } from "@obinexusltd/obix-core-capabilities";

/** A `file:` / `https:` URL string a resolver produced, or a bare specifier the
 *  host must resolve itself at load time. `kind` says which. */
export interface ResolvedSpecifier {
  input: string;
  parentURL: string;
  /** `"url"` — a concrete URL you can pass to `import()`. `"bare"` — hand to the host. */
  kind: "url" | "bare";
  resolved: string;
  /** How the resolution was produced. */
  via: "import.meta.resolve" | "url-relative" | "passthrough";
}

export interface LoadResult<T = unknown> {
  namespace: T;
  resolved: ResolvedSpecifier;
}

/** Minimal manifest shape for `validatePackageSet`. */
export interface InstalledManifest {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
}

export interface PackageSetProblem {
  kind: "version-mismatch" | "range-not-exact" | "missing" | "duplicate-version";
  package: string;
  detail: string;
}

export interface PackageSetReport {
  ok: boolean;
  problems: PackageSetProblem[];
}

export interface ResolverHooks {
  /** Override the dynamic import used by `loadModule` (tests / sandboxes). */
  importImpl?: (specifier: string) => Promise<unknown>;
  /** Override `import.meta.resolve`. Receives (specifier, parentURL). */
  resolveImpl?: (specifier: string, parentURL: string) => string;
}

export interface ModuleResolverAPI {
  /**
   * Resolve `specifier` against `parentURL`. Relative specifiers become a `file:`
   * URL; bare specifiers are resolved with `import.meta.resolve` when the runtime
   * provides it, else passed through for the host loader to resolve.
   * Never guesses deep subpaths and never appends cache-busting query strings.
   */
  resolveModule(specifier: string, parentURL: string): ResolvedSpecifier;
  /** Resolve then `await import()`. Classifies missing-export / not-found failures. */
  loadModule<T = unknown>(specifier: string, parentURL: string): Promise<LoadResult<T>>;
  /**
   * Resolve a non-JS asset (`.html`, `.css`, …) **relative to its owning module**.
   * Returns a URL string; it does not read the file.
   */
  resolveAsset(assetSpecifier: string, ownerURL: string): string;
  /**
   * Check an installed manifest set for version skew within one family
   * (`familyPrefix` + `expectedVersion`) and for non-exact internal ranges.
   */
  validatePackageSet(
    manifests: readonly InstalledManifest[],
    opts: { familyPrefix: string; expectedVersion: string },
  ): PackageSetReport;
}

export type { CompatError as _CompatError };
