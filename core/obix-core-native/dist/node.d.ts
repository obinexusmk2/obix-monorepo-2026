import type { NativeModule, NativeProviderSpec, Ownership } from "./index.js";
export interface NodeApiProviderOptions {
    id: string;
    addonPath: string;
    operations: string[];
    os?: string[];
    arch?: string[];
    libc?: ("glibc" | "musl")[];
    napiVersion?: number;
    ownership?: Ownership;
    bind?: (addon: Record<string, unknown>) => NativeModule;
    detail?: string;
}
export declare function nodeApiProvider(o: NodeApiProviderOptions): NativeProviderSpec;
export interface PolycallInspection {
    installed: boolean;
    resolvedFrom: string | null;
    exportKeys: string[];
    version: string | null;
    note: string;
}
export declare function inspectNodePolycall(fromDir?: string): PolycallInspection;
export { createNativeRegistry, probeNative } from "./index.js";
export type { NativeRegistryAPI, NativeProviderSpec, NativeHandle } from "./index.js";
//# sourceMappingURL=node.d.ts.map