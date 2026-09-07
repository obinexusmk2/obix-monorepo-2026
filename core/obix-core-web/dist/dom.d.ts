import { type SchedulerAPI } from "@obinexusltd/obix-core-scheduler";
import { type MountAdapter, type WebArtifact } from "./index.js";
export { requireDom, inspectWebSupport } from "./index.js";
export type { MountAdapter, MountInstance, WebArtifact } from "./index.js";
export interface WebHostHandle {
    update(state: unknown): void;
    detach(): void;
    readonly detached: boolean;
}
export interface AttachOptions {
    adapter?: MountAdapter;
    coalesce?: SchedulerAPI | boolean;
}
export declare function attachWebHost(el: Element, artifact: WebArtifact, opts?: AttachOptions): WebHostHandle;
export declare function detachWebHost(handle: WebHostHandle): void;
export interface DefineElementOptions {
    create: (host: HTMLElement) => WebArtifact;
    adapter?: MountAdapter;
    coalesce?: SchedulerAPI | boolean;
    observedAttributes?: string[];
}
export declare function defineElement(tagName: string, opts: DefineElementOptions): void;
//# sourceMappingURL=dom.d.ts.map