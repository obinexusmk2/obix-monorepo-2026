import { CompatError, type HostRecord, type RuntimeName } from "@obinexusltd/obix-core-capabilities";
export { CompatError, detectHost } from "@obinexusltd/obix-core-capabilities";
export type { HostRecord, RuntimeName } from "@obinexusltd/obix-core-capabilities";
export type NativeKind = "node-api" | "ffi-bun" | "ffi-node-experimental" | "bridge";
export type Libc = "glibc" | "musl";
export type Ownership = "caller-frees" | "provider-managed";
export interface NativeAbi {
    napiVersion?: number;
    ffi?: "bun" | "node-experimental";
}
export interface NativeModule {
    [operation: string]: (...args: unknown[]) => unknown;
}
export interface NativeProviderSpec {
    id: string;
    kind: NativeKind;
    runtime: RuntimeName[];
    os: string[];
    arch: string[];
    libc?: Libc[];
    abi?: NativeAbi;
    operations: string[];
    ownership: Ownership;
    load: () => Promise<NativeModule> | NativeModule;
    detail?: string;
}
export interface ProviderInfo {
    id: string;
    kind: NativeKind;
    runtime: RuntimeName[];
    os: string[];
    arch: string[];
    libc: Libc[] | null;
    abi: NativeAbi | null;
    operations: string[];
    ownership: Ownership;
    detail: string | null;
}
export type SelectFailure = "native/no-provider" | "native/arch-mismatch" | "native/abi-mismatch" | "native/denied";
export interface SelectResult {
    ok: boolean;
    provider?: NativeProviderSpec;
    error?: CompatError;
}
export interface NativeHandle {
    readonly providerId: string;
    readonly ownership: Ownership;
    readonly closed: boolean;
    call<T = unknown>(operation: string, ...args: unknown[]): Promise<T>;
    close(): Promise<void>;
}
export interface NativeRegistryAPI {
    register(spec: NativeProviderSpec): void;
    list(): ProviderInfo[];
    select(operation: string, host?: HostRecord): SelectResult;
    open(providerId: string, opts?: {
        signal?: AbortSignal;
    }): Promise<NativeHandle>;
    isSelectableHere(providerId: string): boolean;
}
export declare function createNativeRegistry(): NativeRegistryAPI;
export interface NativeReadiness {
    operations: Record<string, {
        selectable: boolean;
        providerId?: string;
        reason: string;
    }>;
    executionTested: false;
    note: string;
}
export declare function probeNative(registry: NativeRegistryAPI, operations: readonly string[]): NativeReadiness;
//# sourceMappingURL=index.d.ts.map