import { LEVEL } from "./version.js";

/**
 * Stable diagnostic codes. `OBIX-<area><nnn>`:
 *   C = configuration / workspace   P = parser        S = semantic
 *   A = accessibility               E = emit          X = equivalence
 */
export const DIAGNOSTIC_CODES = Object.freeze({
  // configuration / workspace
  C011_VERSION_MISMATCH: "OBIX-C011",
  // parser
  P001_MISSING_TEMPLATE: "OBIX-P001",
  P002_MISSING_SCRIPT: "OBIX-P002",
  P003_DUPLICATE_SECTION: "OBIX-P003",
  P004_UNCLOSED_TAG: "OBIX-P004",
  P005_UNEXPECTED_TOKEN: "OBIX-P005",
  P006_BAD_INTERPOLATION: "OBIX-P006",
  P007_UNKNOWN_DIRECTIVE: "OBIX-P007",
  P008_BAD_COMPONENT_NAME: "OBIX-P008",
  // semantic
  S001_UNKNOWN_ACTION: "OBIX-S001",
  S002_UNKNOWN_BINDING_REF: "OBIX-S002",
  S003_ACTION_ARITY: "OBIX-S003",
  S004_PROP_DEP_UNDECLARED: "OBIX-S004",
  S005_PIPELINE_INVARIANT: "OBIX-S005",
  S006_STATE_SHAPE_NOT_CLOSED: "OBIX-S006",
  // accessibility
  A001_LIVE_REGION_INVALID: "OBIX-A001",
  A002_LIVE_REGION_NO_BINDING: "OBIX-A002",
  A003_FOCUS_POLICY: "OBIX-A003",
  A004_HEADING_SKIP: "OBIX-A004",
  A005_UNKNOWN_ROLE: "OBIX-A005",
  A006_UNKNOWN_ARIA_ATTR: "OBIX-A006",
  // emit
  E001_UNSUPPORTED_EMIT_MODE: "OBIX-E001",
  // equivalence
  X001_ADAPTER_DIVERGENCE: "OBIX-X001",
});

export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[keyof typeof DIAGNOSTIC_CODES];

/**
 * Thrown by any package when a caller asks for a feature that belongs to a
 * later implementation level. Carries structured level info so tooling can
 * report it cleanly instead of pretending the feature works.
 */
export class UnsupportedFeatureError extends Error {
  readonly feature: string;
  readonly requiredLevel: number;
  readonly currentLevel: number;

  constructor(feature: string, requiredLevel: number, currentLevel: number = LEVEL) {
    super(
      `[OBIX] "${feature}" requires Level ${requiredLevel}; this build implements Level ${currentLevel}.`,
    );
    this.name = "UnsupportedFeatureError";
    this.feature = feature;
    this.requiredLevel = requiredLevel;
    this.currentLevel = currentLevel;
  }
}
