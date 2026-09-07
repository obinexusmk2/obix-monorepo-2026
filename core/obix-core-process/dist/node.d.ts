import { resolveTool, type ProcessRunnerAPI } from "./index.js";
export declare function which(name: string): string | null;
export declare function resolveJsBin(fromDir: string): (pkg: string, bin?: string) => string | null;
export interface NodeProcessRunnerOptions {
    resolveFrom?: string;
}
export declare function createNodeProcessRunner(opts?: NodeProcessRunnerOptions): ProcessRunnerAPI & {
    resolve(spec: Parameters<typeof resolveTool>[0]): ReturnType<typeof resolveTool>;
};
export { resolveTool } from "./index.js";
export type { ProcessRunnerAPI, SpawnResult, SpawnRequest } from "./index.js";
//# sourceMappingURL=node.d.ts.map