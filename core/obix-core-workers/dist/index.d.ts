export { CompatError } from "@obinexusltd/obix-core-capabilities";
export declare const PROTOCOL: "obix-core-workers/1";
export interface JobRequest {
    module: string;
    action: string;
    data: unknown;
}
export interface JobEnvelope extends JobRequest {
    protocol: typeof PROTOCOL;
    jobId: string;
    moduleParentURL: string;
    transfer?: string[];
}
export type WorkerOutbound = {
    protocol: typeof PROTOCOL;
    jobId: string;
    ok: true;
    result: unknown;
} | {
    protocol: typeof PROTOCOL;
    jobId: string;
    ok: false;
    error: {
        name: string;
        message: string;
        code?: string;
    };
} | {
    protocol: typeof PROTOCOL;
    type: "ready";
} | {
    protocol: typeof PROTOCOL;
    type: "protocol-error";
    detail: string;
};
export interface BackendWorker {
    postMessage(msg: unknown, transfer?: Transferable[]): void;
    onMessage(cb: (msg: unknown) => void): void;
    onError(cb: (err: unknown) => void): void;
    onExit(cb: (code: number) => void): void;
    terminate(): Promise<void> | void;
}
export interface WorkerBackend {
    create(): Promise<BackendWorker>;
    readonly resourceLimitsHonored: boolean;
    readonly kind: "worker_threads" | "web-worker" | "inline";
}
export interface WorkerPoolOptions {
    backend: WorkerBackend;
    size?: number;
    queueLimit?: number;
    defaultTimeoutMs?: number;
    moduleParentURL: string;
}
export interface SubmitOptions {
    signal?: AbortSignal;
    timeoutMs?: number;
    transfer?: string[];
}
export interface WorkerPoolAPI {
    submitJob<T = unknown>(req: JobRequest, opts?: SubmitOptions): Promise<T>;
    cancelJob(jobId: string): void;
    dispose(): Promise<void>;
    readonly activeWorkers: number;
    readonly queued: number;
    readonly running: number;
    readonly resourceLimitsHonored: boolean;
    readonly backendKind: WorkerBackend["kind"];
}
export declare function createWorkerPool(opts: WorkerPoolOptions): WorkerPoolAPI;
export interface InlineResult<T> {
    result: T;
    mode: "inline-fallback";
}
export declare function runInline<T = unknown>(req: JobRequest, moduleParentURL: string): Promise<InlineResult<T>>;
//# sourceMappingURL=index.d.ts.map