import { CompatError, probeCapabilities } from "@obinexusltd/obix-core-capabilities";
export { CompatError } from "@obinexusltd/obix-core-capabilities";
export function inspectWebSupport(opts = {}) {
    const cap = probeCapabilities(["dom"])["dom"];
    const g = globalThis;
    return {
        dom: typeof g.document !== "undefined",
        domCapability: cap.status,
        serverRenderer: typeof opts.serverRenderer === "function",
        suiteSSR: describeSuiteSSR(),
    };
}
export function describeSuiteSSR() {
    return {
        supported: false,
        reason: "the 0.3.0 suite (obixjs) does not implement server-side rendering; it is deferred in OBIX-SUITE-0.3.0-DRAFT. " +
            "For frozen-track DOP components, inject @obinexusltd/obix-adapter-ssr's renderToString into obix-core-web/server.",
    };
}
export function requireDom(operation) {
    const g = globalThis;
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
//# sourceMappingURL=index.js.map