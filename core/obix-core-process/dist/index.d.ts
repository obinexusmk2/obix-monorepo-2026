export { CompatError } from "@obinexusltd/obix-core-capabilities";
export interface ChildStreams {
    stdout: ReadableStream<Uint8Array> | null;
    stderr: ReadableStream<Uint8Array> | null;
}
export interface ChildProc {
    readonly pid: number | undefined;
    readonly streams: ChildStreams;
    readonly exited: Promise<{
        code: number | null;
        signal: string | null;
    }>;
    kill(signal?: string): boolean;
    killTree?(): Promise<boolean>;
}
export interface SpawnParams {
    command: string;
    args: readonly string[];
    cwd?: string;
    env?: Record<string, string | undefined>;
}
export type SpawnImpl = (params: SpawnParams) => ChildProc;
export interface SpawnResult {
    command: string;
    args: readonly string[];
    cwd: string | undefined;
    code: number | null;
    signal: string | null;
    timedOut: boolean;
    aborted: boolean;
    durationMs: number;
    stdout: Uint8Array;
    stderr: Uint8Array;
    stdoutTruncated: boolean;
    stderrTruncated: boolean;
}
export interface SpawnRequest {
    command: string;
    args?: readonly string[];
    cwd?: string;
    env?: Record<string, string | undefined>;
    signal?: AbortSignal;
    timeoutMs?: number;
    killSignal?: string;
    maxBuffer?: number;
    tree?: boolean;
}
export interface ToolResolution {
    found: boolean;
    command: string;
    args: string[];
    kind: "executable" | "js-bin";
    runtime?: string;
    detail: string;
}
export interface ResolveToolHooks {
    resolveJsBin?: (pkgName: string, binName?: string) => string | null;
    which?: (name: string) => string | null;
    jsRuntime?: string;
}
export declare function resolveTool(spec: {
    kind: "js-bin";
    package: string;
    bin?: string;
} | {
    kind: "executable";
    name: string;
}, hooks?: ResolveToolHooks): ToolResolution;
export interface ProcessRunnerAPI {
    spawnTool(req: SpawnRequest): Promise<SpawnResult>;
    spawnShellScript(req: SpawnRequest & {
        shellArgsArray: string[];
    }): Promise<SpawnResult>;
    terminateChild(handle: RunningChild, opts?: {
        signal?: string;
        tree?: boolean;
    }): Promise<void>;
    disposeAll(opts?: {
        signal?: string;
        tree?: boolean;
    }): Promise<void>;
    readonly activeCount: number;
}
export interface RunningChild {
    readonly pid: number | undefined;
    readonly done: Promise<SpawnResult>;
    kill(signal?: string): void;
}
export declare function createProcessRunner(spawnImpl: SpawnImpl): ProcessRunnerAPI;
export declare function canSpawn(): boolean;
//# sourceMappingURL=index.d.ts.map