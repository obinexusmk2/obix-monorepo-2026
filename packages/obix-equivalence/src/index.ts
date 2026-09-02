/**
 * obix-equivalence
 *
 * Adapter-equivalence orchestration + behavioural/contract DSL parsers. One npm
 * package with internal submodules (equivalence / behavioural / contracts /
 * virtual-time) — NOT split into a 21st package. Also available via subpath
 * exports (`obix-equivalence/equivalence`, …).
 */
export {
  checkEquivalence,
  type EquivalenceScenario,
  type EquivalenceReport,
  type AdapterRun,
} from "./equivalence/index.js";

export {
  parseTestDSL,
  type BehaviouralSuite,
  type BehaviouralCase,
  type BehaviouralStep,
  type Expectation,
} from "./behavioural/index.js";

export {
  parseContractDSL,
  type ContractModel,
  type ContractActionDecl,
  type ContractDerivedDecl,
  type ContractEffectDecl,
  type ContractInvariant,
  type ContractElement,
} from "./contracts/index.js";

export {
  runWithVirtualTime,
  createVirtualClock,
  type VirtualRun,
} from "./virtual-time/index.js";

// re-export the oracle so a test file has a single import site
export { referenceFold } from "obix-validator";
