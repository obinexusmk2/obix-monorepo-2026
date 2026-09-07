import { type WorkerBackend, type WorkerPoolAPI } from "./index.js";
export interface NodeWorkerPoolOptions {
    size?: number;
    queueLimit?: number;
    defaultTimeoutMs?: number;
    moduleParentURL?: string;
    resourceLimits?: {
        maxOldGenerationSizeMb?: number;
        maxYoungGenerationSizeMb?: number;
    };
}
export declare function createNodeWorkerBackend(o?: NodeWorkerPoolOptions): WorkerBackend;
export declare function createNodeWorkerPool(o?: NodeWorkerPoolOptions): WorkerPoolAPI;
export type { WorkerPoolAPI, JobRequest } from "./index.js";
//# sourceMappingURL=node.d.ts.map