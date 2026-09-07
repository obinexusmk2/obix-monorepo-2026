/**
 * @obinexusltd/obix-core-web
 *
 * Portable host contracts for OBIX on the web, with explicit `/dom` and
 * `/server` boundaries around the **existing** OBIX renderer. This portable root
 * touches no DOM global and no DOM type — importing it on a server is safe.
 *
 * It does not implement a renderer. `/server` delegates to an injected string
 * renderer (e.g. the frozen `@obinexusltd/obix-adapter-ssr` `renderToString`);
 * `/dom` delegates mounting to an injected adapter and only manages listener /
 * focus / subscription ownership around it.
 */
import { CompatError, probeCapabilities } from "@obinexusltd/obix-core-capabilities";

export { CompatError } from "@obinexusltd/obix-core-capabilities";

/** The minimal shape of an OBIX artifact this package passes through. */
export interface WebArtifact {
  name?: string;
  state?: unknown;
  actions?: Record<string, (...a: unknown[]) => unknown>;
  render: (state?: unknown) => string;
}

/** Injected server renderer — e.g. `@obinexusltd/obix-adapter-ssr`'s `renderToString`. */
export type StringRenderer = (artifact: WebArtifact, opts?: { state?: unknown; props?: unknown }) => string;

/** Injected DOM mount adapter — the *existing*, verified one. */
export interface MountAdapter {
  mount(el: unknown, artifact: WebArtifact): MountInstance;
}
export interface MountInstance {
  /** Apply a new state → view. */
  update(state: unknown): void;
  /** Release everything this mount owns (listeners, subscriptions, styles). */
  destroy(): void;
}

export interface WebSupport {
  /** A real `document` is present (window context). */
  dom: boolean;
  /** `dom` capability status from obix-core-capabilities. */
  domCapability: "available" | "unavailable" | "denied" | "unknown";
  /** A string renderer was supplied to this call. */
  serverRenderer: boolean;
  /** The 0.3.0 suite (obixjs) SSR situation. */
  suiteSSR: { supported: false; reason: string };
}

/** Inspect web support **without** touching the DOM. */
export function inspectWebSupport(opts: { serverRenderer?: StringRenderer } = {}): WebSupport {
  const cap = probeCapabilities(["dom"])["dom"];
  const g = globalThis as { document?: unknown };
  return {
    dom: typeof g.document !== "undefined",
    domCapability: cap.status,
    serverRenderer: typeof opts.serverRenderer === "function",
    suiteSSR: describeSuiteSSR(),
  };
}

/**
 * The 0.3.0 suite umbrella (`obixjs`) does not implement SSR — it is deferred
 * upstream. This is reported, never faked.
 */
export function describeSuiteSSR(): { supported: false; reason: string } {
  return {
    supported: false,
    reason:
      "the 0.3.0 suite (obixjs) does not implement server-side rendering; it is deferred in OBIX-SUITE-0.3.0-DRAFT. " +
      "For frozen-track DOP components, inject @obinexusltd/obix-adapter-ssr's renderToString into obix-core-web/server.",
  };
}

/** Guard for `/dom` entrypoints — throws `web/dom-required` off a window context. */
export function requireDom(operation: string): void {
  const g = globalThis as { document?: unknown };
  if (typeof g.document === "undefined") {
    throw new CompatError({
      code: "web/dom-required",
      package: "obix-core-web",
      operation,
      reason: "no document — this is a browser-only entrypoint",
      remediation: "Import @obinexusltd/obix-core-web/server (or the portable root) on the server.",
    });
  }
}
