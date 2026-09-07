import { type StringRenderer, type WebArtifact } from "./index.js";
export { describeSuiteSSR, inspectWebSupport } from "./index.js";
export type { StringRenderer, WebArtifact, WebSupport } from "./index.js";
export interface RenderServerOptions {
    renderer?: StringRenderer;
    state?: unknown;
    props?: unknown;
}
export declare function renderComponentToString(artifact: WebArtifact, opts?: RenderServerOptions): string;
export declare const suiteServerRendering: {
    supported: false;
    reason: string;
};
//# sourceMappingURL=server.d.ts.map