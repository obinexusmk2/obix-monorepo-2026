/**
 * obix-test — headless verification for the OBIX suite.
 *
 * `mountForTest` runs a component's store on a virtual clock and renders its
 * `{marker}` text; `checkEquivalence` folds a trace through a direct reference
 * evaluator and both `obix-core` projections and asserts they agree.
 */
export { createVirtualClock } from "./virtual-clock.js";
export type { VirtualClock } from "./virtual-clock.js";

export { mountForTest } from "./mount.js";
export type { MountOptions, MountedComponent } from "./mount.js";

export { checkEquivalence } from "./equivalence.js";
export type { EquivalenceReport } from "./equivalence.js";
