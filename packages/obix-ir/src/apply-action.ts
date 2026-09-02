import { DIAGNOSTIC_CODES } from "obix-spec";
import type {
  DOPArtifact,
  State,
  Props,
  Payload,
  ActionTrace,
  ValidationResult,
  TransitionMeta,
} from "obix-spec";
import { calculateChangedKeys, assertClosedStateShape } from "./diff.js";

/**
 * THE shared adapter execution primitive. (Draft 0.2.1 — Problem 8: props
 * threading invariant.)
 *
 * Every adapter — Data, Functional, OOP, Reactive, Native — routes state
 * transitions through this one function. It is the only place adapter-side that
 * invokes a business action, and it always invokes it in the frozen shape:
 *
 *     artifact.actions[actionName](state, payload, props)
 *
 * Adapters MUST NOT call actions in any other shape or thread arguments
 * differently.
 *
 * NOTE: this is NOT the equivalence oracle. The independent oracle is
 * `obix-validator.referenceFold`, which deliberately does not import this
 * module — see that package for why.
 */
export function applyAction<S extends object = State, P extends object = Props>(
  artifact: DOPArtifact<S, P>,
  state: S,
  actionName: string,
  payload: Payload,
  props: P,
): S {
  const fn = artifact.actions[actionName];
  if (typeof fn !== "function") {
    throw new Error(
      `[OBIX] ${DIAGNOSTIC_CODES.S001_UNKNOWN_ACTION}: unknown action "${actionName}" on artifact "${artifact.name}"`,
    );
  }
  return fn(state, payload, props);
}

/**
 * Convenience fold over a trace using {@link applyAction}. Ordinary execution
 * helper — NOT the verification oracle.
 */
export function replayTrace<S extends object = State, P extends object = Props>(
  artifact: DOPArtifact<S, P>,
  trace: ActionTrace,
  from: S = artifact.initialState,
  props: P = artifact.props,
): S {
  let current = from;
  for (const [name, payload] of trace) {
    current = applyAction(artifact, current, name, payload, props);
  }
  return current;
}

/** Build a TransitionMeta for a single step (used by the reactive adapter). */
export function describeTransition<S extends object = State>(
  action: string,
  payload: Payload,
  from: S,
  to: S,
): TransitionMeta<S> {
  return { action, payload, from, to, changedKeys: calculateChangedKeys(from, to) };
}

/**
 * Structural check on a produced transition: `to` must stay within the closed
 * state shape, and the artifact's own validate() (if any) must pass.
 */
export function validateTransition<S extends object = State, P extends object = Props>(
  artifact: DOPArtifact<S, P>,
  _from: S,
  to: S,
): ValidationResult {
  try {
    assertClosedStateShape(to, Object.keys(artifact.initialState));
  } catch (err) {
    return { valid: false, violations: [{ rule: "closed-shape", message: (err as Error).message }] };
  }
  if (artifact.validate) return artifact.validate(to, artifact.props);
  return { valid: true, violations: [] };
}
