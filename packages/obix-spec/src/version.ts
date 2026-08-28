/** The frozen language/spec revision this package family implements. */
export const SPEC_VERSION = "0.2.1" as const;

/** Implementation milestone. Level 0 = Timer.obix end to end. */
export const LEVEL = 0 as const;

export type ObixLevel = 0 | 1 | 2;
