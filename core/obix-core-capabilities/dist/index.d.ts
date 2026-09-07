export type RuntimeName = "node" | "deno" | "bun" | "browser" | "webworker" | "unknown";
export interface HostRecord {
    runtime: RuntimeName;
    runtimeVersion: string | null;
    nodeCompatVersion: string | null;
    os: string | null;
    arch: string | null;
    libc: "glibc" | "musl" | null;
    isBrowserWindow: boolean;
    isWorker: boolean;
}
export type CapabilityStatus = "available" | "unavailable" | "denied" | "unknown";
export type CapabilityName = "fs" | "fs-watch" | "spawn" | "worker-threads" | "web-worker" | "native-addon" | "ffi" | "dom" | "fetch" | "web-streams" | "abort-signal" | "performance-now" | "high-res-time" | "ref-unref";
export interface CapabilityResult {
    capability: CapabilityName;
    status: CapabilityStatus;
    reason: string;
    provider: string | null;
}
export type CompatErrorCode = "capability/unavailable" | "capability/denied" | "capability/unknown" | "host/unsupported" | "core/version-skew" | "module/resolve" | "module/load" | "fs/read" | "fs/write" | "fs/watch" | "process/tool-not-found" | "process/nonzero-exit" | "process/timeout" | "process/aborted" | "scheduler/disposed" | "streams/locked" | "streams/aborted" | "workers/startup" | "workers/crash" | "workers/protocol" | "workers/queue-full" | "native/no-provider" | "native/no-binary" | "native/abi-mismatch" | "native/arch-mismatch" | "native/denied" | "native/failure" | "native/disposed" | "web/dom-required" | "web/ssr-unsupported" | "diagnostics/invalid-invocation";
export interface CompatErrorInit {
    code: CompatErrorCode;
    package: string;
    operation: string;
    reason: string;
    runtime?: RuntimeName;
    capability?: CapabilityName;
    cause?: unknown;
    remediation?: string;
}
export declare class CompatError extends Error {
    readonly name = "CompatError";
    readonly code: CompatErrorCode;
    readonly package: string;
    readonly operation: string;
    readonly reason: string;
    readonly runtime: RuntimeName;
    readonly capability?: CapabilityName;
    readonly remediation?: string;
    constructor(init: CompatErrorInit);
    toJSON(): Record<string, unknown>;
}
export declare function isCompatError(value: unknown): value is CompatError;
export declare const HOST_DETECTION_NOTE: string;
export declare function detectHost(): HostRecord;
export declare function probeCapabilities(names?: readonly CapabilityName[]): Record<CapabilityName, CapabilityResult>;
export interface RequireOptions {
    package: string;
    operation: string;
    results?: Record<CapabilityName, CapabilityResult>;
    allowUnknown?: boolean;
}
export declare function requireCapability(capability: CapabilityName, opts: RequireOptions): CapabilityResult;
export declare function inspect(): {
    host: HostRecord;
    capabilities: Record<CapabilityName, CapabilityResult>;
};
export declare const ALL_CAPABILITIES: readonly CapabilityName[];
//# sourceMappingURL=index.d.ts.map