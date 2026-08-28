/**
 * @obinexusltd/obix-spec
 *
 * The canonical type surface + structural contracts for OBIX 1.0.
 * Zero runtime dependencies. Every other OBIX package imports its types
 * from here so there is exactly one definition of each.
 */
export * from "./types.js";
export { SPEC_VERSION, LEVEL } from "./version.js";
export type { ObixLevel } from "./version.js";
export { DIAGNOSTIC_CODES, UnsupportedFeatureError } from "./diagnostics.js";
export type { DiagnosticCode } from "./diagnostics.js";
export { createScopeToken, SCOPE_ATTR } from "./scope-token.js";
export { validateObixAST } from "./validate-ast.js";
export { validateArtifactShape } from "./validate-artifact.js";
