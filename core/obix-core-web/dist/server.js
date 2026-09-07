import { CompatError } from "@obinexusltd/obix-core-capabilities";
import { describeSuiteSSR } from "./index.js";
export { describeSuiteSSR, inspectWebSupport } from "./index.js";
export function renderComponentToString(artifact, opts = {}) {
    if (typeof opts.renderer !== "function") {
        throw new CompatError({
            code: "web/ssr-unsupported",
            package: "obix-core-web",
            operation: "renderComponentToString",
            reason: "no server renderer was provided. " + describeSuiteSSR().reason,
            remediation: "Pass `renderer: renderToString` from @obinexusltd/obix-adapter-ssr for frozen-track components.",
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
export const suiteServerRendering = describeSuiteSSR();
//# sourceMappingURL=server.js.map