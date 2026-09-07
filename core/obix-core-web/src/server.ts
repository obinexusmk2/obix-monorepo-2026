/**
 * @obinexusltd/obix-core-web/server
 *
 * DOM-free server entrypoint. It references no `document`, `window`,
 * `HTMLElement`, `Element` or `customElements`. It does not implement a
 * renderer — you inject one (the frozen `@obinexusltd/obix-adapter-ssr`
 * `renderToString`, or the suite SSR renderer when it exists).
 */
import { CompatError } from "@obinexusltd/obix-core-capabilities";
import { describeSuiteSSR, type StringRenderer, type WebArtifact } from "./index.js";

export { describeSuiteSSR, inspectWebSupport } from "./index.js";
export type { StringRenderer, WebArtifact, WebSupport } from "./index.js";

export interface RenderServerOptions {
  /** The injected string renderer. Required — nothing is fabricated. */
  renderer?: StringRenderer;
  state?: unknown;
  props?: unknown;
}

/**
 * Render an OBIX artifact to an HTML string on the server, using the **injected**
 * renderer. With no renderer this throws `web/ssr-unsupported` — it never
 * invents markup.
 */
export function renderComponentToString(artifact: WebArtifact, opts: RenderServerOptions = {}): string {
  if (typeof opts.renderer !== "function") {
    throw new CompatError({
      code: "web/ssr-unsupported",
      package: "obix-core-web",
      operation: "renderComponentToString",
      reason:
        "no server renderer was provided. " + describeSuiteSSR().reason,
      remediation:
        "Pass `renderer: renderToString` from @obinexusltd/obix-adapter-ssr for frozen-track components.",
    });
  }
  if (!artifact || typeof artifact.render !== "function") {
    throw new CompatError({
      code: "web/ssr-unsupported",
      package: "obix-core-web",
      operation: "renderComponentToString",
      reason: "artifact has no render() function",
    });
  }
  return opts.renderer(artifact, { state: opts.state, props: opts.props });
}

/** `{ supported: false }` — the suite (obixjs) SSR model is deferred upstream. */
export const suiteServerRendering = describeSuiteSSR();
