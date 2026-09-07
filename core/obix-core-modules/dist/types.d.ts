import type { CompatError } from "@obinexusltd/obix-core-capabilities";
export type { CompatError } from "@obinexusltd/obix-core-capabilities";
export interface ResolvedSpecifier {
    input: string;
    parentURL: string;
    kind: "url" | "bare";
    resolved: string;
    via: "import.meta.resolve" | "url-relative" | "passthrough";
}
export interface LoadResult<T = unknown> {
    namespace: T;
    resolved: ResolvedSpecifier;
}
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
    importImpl?: (specifier: string) => Promise<unknown>;
    resolveImpl?: (specifier: string, parentURL: string) => string;
}
export interface ModuleResolverAPI {
    resolveModule(specifier: string, parentURL: string): ResolvedSpecifier;
    loadModule<T = unknown>(specifier: string, parentURL: string): Promise<LoadResult<T>>;
    resolveAsset(assetSpecifier: string, ownerURL: string): string;
    validatePackageSet(manifests: readonly InstalledManifest[], opts: {
        familyPrefix: string;
        expectedVersion: string;
    }): PackageSetReport;
}
export type { CompatError as _CompatError };
//# sourceMappingURL=types.d.ts.map