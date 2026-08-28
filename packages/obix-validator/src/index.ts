/**
 * @obinexusltd/obix-validator
 *
 * Validation helpers + the INDEPENDENT reference evaluator.
 *
 * CRITICAL: this package imports NO adapter. It depends only on obix-spec and
 * obix-ir. `referenceFold` is the semantic oracle that defines the expected
 * result; adapters are compared against it in obix-test.
 */
export { referenceFold } from "./reference-fold.js";
export type { ReferenceFoldResult } from "./reference-fold.js";
export {
  validateProps,
  validateState,
  validateRules,
  checkActionPropDeps,
  checkPipelineInvariant,
} from "./checks.js";

// re-export the artifact-shape check so callers have one import site
export { validateArtifactShape, validateObixAST } from "@obinexusltd/obix-spec";
