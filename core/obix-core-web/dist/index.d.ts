export { CompatError } from "@obinexusltd/obix-core-capabilities";
export interface WebArtifact {
    name?: string;
    state?: unknown;
    actions?: Record<string, (...a: unknown[]) => unknown>;
    render: (state?: unknown) => string;
}
export type StringRenderer = (artifact: WebArtifact, opts?: {
    state?: unknown;
    props?: unknown;
}) => string;
export interface MountAdapter {
    mount(el: unknown, artifact: WebArtifact): MountInstance;
}
export interface MountInstance {
    update(state: unknown): void;
    destroy(): void;
}
export interface WebSupport {
    dom: boolean;
    domCapability: "available" | "unavailable" | "denied" | "unknown";
    serverRenderer: boolean;
    suiteSSR: {
        supported: false;
        reason: string;
    };
}
export declare function inspectWebSupport(opts?: {
    serverRenderer?: StringRenderer;
}): WebSupport;
export declare function describeSuiteSSR(): {
    supported: false;
    reason: string;
};
export declare function requireDom(operation: string): void;
//# sourceMappingURL=index.d.ts.map