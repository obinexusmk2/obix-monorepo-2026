export { CompatError } from "@obinexusltd/obix-core-capabilities";
export interface FsStat {
    isFile: boolean;
    isDirectory: boolean;
    size: number;
    mtimeMs: number;
}
export interface FsProvider {
    readFile(path: string): Promise<Uint8Array>;
    writeFile(path: string, data: Uint8Array): Promise<void>;
    rename(from: string, to: string): Promise<void>;
    mkdir(path: string, opts: {
        recursive: boolean;
    }): Promise<void>;
    rm(path: string, opts: {
        force: boolean;
    }): Promise<void>;
    stat(path: string): Promise<FsStat>;
    readdir(path: string): Promise<string[]>;
    watch?(path: string, onEvent: (evt: {
        type: "rename" | "change";
        path: string;
    }) => void): {
        close(): void;
    };
    join(...parts: string[]): string;
    dirname(path: string): string;
    basename(path: string): string;
    resolve(...parts: string[]): string;
    isInside(parent: string, child: string): boolean;
    sep: string;
}
export interface TimingHooks {
    now(): number;
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
}
export interface FilesystemOptions {
    provider: FsProvider;
    timing: TimingHooks;
    projectRoot: string;
    randomToken?: () => string;
}
export interface WriteResult {
    path: string;
    bytes: number;
    strategy: "temp-file-rename";
    durability: string;
}
export interface WatchOptions {
    mode?: "native" | "poll" | "auto";
    debounceMs?: number;
    pollMs?: number;
    signal?: AbortSignal;
}
export interface WatchHandle {
    close(): void;
    readonly mode: "native" | "poll";
}
export interface FilesystemAPI {
    resolveProjectPath(relOrAbs: string): string;
    urlToPath(url: string | URL): string;
    pathToUrl(path: string): string;
    readBytes(relOrAbs: string): Promise<Uint8Array>;
    readText(relOrAbs: string, encoding?: string): Promise<string>;
    writeFileSafely(relOrAbs: string, data: Uint8Array | string, encoding?: string): Promise<WriteResult>;
    watchTree(relOrAbs: string, onInvalidate: (paths: string[]) => void, opts?: WatchOptions): WatchHandle;
}
export declare function createFilesystem(opts: FilesystemOptions): FilesystemAPI;
//# sourceMappingURL=index.d.ts.map