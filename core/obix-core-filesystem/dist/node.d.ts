import { type FilesystemAPI, type FsProvider } from "./index.js";
export interface NodeFilesystemOptions {
    projectRoot?: string;
}
export declare function createNodeFsProvider(): FsProvider;
export declare function createNodeFilesystem(opts?: NodeFilesystemOptions): FilesystemAPI;
export type { FilesystemAPI, FsProvider } from "./index.js";
//# sourceMappingURL=node.d.ts.map