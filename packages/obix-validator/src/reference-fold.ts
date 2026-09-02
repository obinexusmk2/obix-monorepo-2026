import type {
  DOPArtifact,
  State,
  Props,
  ActionTrace,
  ValidationResult,
} from "obix-spec";

export interface ReferenceFoldResult<S extends object = State> {
  /** state after the whole trace */
  finalState: S;
  /** state snapshots: history[0] = initialState, history[i] = after trace[i-1] */
  history: S[];
  /** render() output at each history entry (only where artifact.render exists) */
  renders: (string | undefined)[];
  /** validate() output at each history entry (only where artifact.validate exists) */
  validations: (ValidationResult | undefined)[];
}

/**
 * THE INDEPENDENT SEMANTIC ORACLE. (Draft 0.2.1 — Problem 1: adapter-equivalence
 * meta-circularity.)
 *
 * referenceFold operates DIRECTLY on the DOP artifact. It deliberately does NOT
 * use — and this package deliberately does not import:
 *
 *     toData() / toFunctional() / toOOP() / toReactive()
 *     obix-ir.applyAction() / obix-ir.replayTrace()
 *
 * The duplication of the fold logic here is the whole point: a bug in the shared
 * adapter primitive cannot also be present in the thing that judges the
 * adapters, because they share no code.
 *
 *     let current = initialState
 *     for each [name, payload] in trace:
 *         current = artifact.actions[name](current, payload, props)
 *
 * The validator defines the EXPECTED result. Adapters are tested against it in
 * obix-equivalence.
 */
export function referenceFold<S extends object = State, P extends object = Props>(
  artifact: DOPArtifact<S, P>,
  initialState: S,
  props: P,
  trace: ActionTrace,
): ReferenceFoldResult<S> {
  let current: S = initialState;
  const history: S[] = [current];

  for (const step of trace) {
    const name = step[0];
    const payload = step[1];
    const fn = artifact.actions[name];
    if (typeof fn !== "function") {
      throw new Error(`[OBIX] referenceFold: unknown action "${name}" on artifact "${artifact.name}"`);
    }
    // canonical Action(state, payload, props) — invoked directly, no helper
    current = fn(current, payload, props);
    history.push(current);
  }

  const renders = history.map((s) => (artifact.render ? artifact.render(s, props) : undefined));
  const validations = history.map((s) => (artifact.validate ? artifact.validate(s, props) : undefined));

  return { finalState: current, history, renders, validations };
}
