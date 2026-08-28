/**
 * @obinexusltd/obix-ir
 *
 * Canonical DOP artifact construction + the shared adapter execution
 * primitive. The layer directly below the adapters.
 */
export { deepFreeze, freezeState, freezeProps } from "./freeze.js";
export { calculateChangedKeys, assertClosedStateShape } from "./diff.js";
export {
  applyAction,
  replayTrace,
  describeTransition,
  validateTransition,
} from "./apply-action.js";
export { createDOP } from "./create-dop.js";
export type { DopDefinition } from "./create-dop.js";

// convenience re-exports of the types this package's signatures reference
export type {
  DOPArtifact,
  ActionFn,
  DerivedFn,
  ActionTrace,
  TraceItem,
  TransitionMeta,
} from "@obinexusltd/obix-spec";
