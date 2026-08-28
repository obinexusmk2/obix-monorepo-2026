/**
 * @obinexusltd/obix-timer
 *
 * The frozen OBIX golden fixture. It is a **reference fixture / teaching example
 * / acceptance artifact** — not a product. Nothing in the compiler, runtime or
 * adapters may depend on this package; it is a leaf.
 *
 * The npm package version follows the unified OBIX version (0.2.1). The FIXTURE
 * identity is separate metadata carried INSIDE the package:
 *   FIXTURE_VERSION  — the spec revision the fixture is frozen against
 *   FIXTURE_CHECKSUM — sha256 of the LF-normalised Timer.obix source
 */
import { SPEC_VERSION } from "@obinexusltd/obix-spec";
import type { ActionTrace } from "@obinexusltd/obix-spec";
import { TIMER_OBIX_SOURCE, sha256 } from "./timer-source.js";

export { TimerDOP } from "./timer-dop.js";
export type { TimerState, TimerProps } from "./timer-dop.js";
export {
  TIMER_OBIX_SOURCE,
  TIMER_TEST_OBIX_SOURCE,
  TIMER_OBIX_TEST_SOURCE,
} from "./timer-source.js";

/** The spec revision this fixture is frozen against. Independent of npm semver. */
export const FIXTURE_VERSION = "draft-0.2.1-addendum-a" as const;

/** sha256 of the LF-normalised `Timer.obix`. Recomputed and asserted in tests. */
export const FIXTURE_CHECKSUM =
  "d0d7166c3ba19c45f84d0642cc1a19a1a5427d2d4957281d515038cf9e1b023c" as const;

/** The spec version of the surrounding package family (for cross-checks). */
export const FIXTURE_SPEC_VERSION = SPEC_VERSION;

/** Recompute the checksum from the shipped source. */
export function computeFixtureChecksum(): string {
  return sha256(TIMER_OBIX_SOURCE);
}

/** True when the shipped source matches the frozen checksum. */
export function verifyFixture(): boolean {
  return computeFixtureChecksum() === FIXTURE_CHECKSUM;
}

const rep = <T>(n: number, v: T): T[] => Array.from({ length: n }, () => v);

/** Canonical traces + their expected outcomes (Addendum A). */
export const EXPECTED_TRACES: {
  startTickTickStop: { trace: ActionTrace; expected: { seconds: number; running: boolean } };
  terminal: {
    trace: ActionTrace;
    expected: { seconds: number; running: boolean };
    finished: true;
    cannotStart: true;
    statusLabel: "Finished";
  };
} = {
  startTickTickStop: {
    trace: [["Start"], ["Tick"], ["Tick"], ["Stop"]],
    expected: { seconds: 2, running: false },
  },
  terminal: {
    trace: [["Start"], ...rep(8, ["Tick"] as const)],
    expected: { seconds: 5, running: false },
    finished: true,
    cannotStart: true,
    statusLabel: "Finished",
  },
};
