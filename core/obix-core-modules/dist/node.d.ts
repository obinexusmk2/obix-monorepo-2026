import type { ModuleResolverAPI } from "./types.js";
export declare function createNodeModuleResolver(parentForRequire: string): ModuleResolverAPI;
export interface AssetCopy {
    from: string;
    to: string;
}
export declare function copyAssets(items: readonly AssetCopy[], ownerURL: string): {
    copied: number;
};
export type { ModuleResolverAPI, ResolvedSpecifier } from "./types.js";
//# sourceMappingURL=node.d.ts.map