import { type WorkerBackend, type WorkerPoolAPI } from "./index.js";
export interface WebWorkerPoolOptions {
    size?: number;
    queueLimit?: number;
    defaultTimeoutMs?: number;
    moduleParentURL?: string;
}
export declare function createWebWorkerBackend(): WorkerBackend;
export declare function createWebWorkerPool(o?: WebWorkerPoolOptions): WorkerPoolAPI;
export type { WorkerPoolAPI, JobRequest } from "./index.js";
//# sourceMappingURL=web.d.ts.map