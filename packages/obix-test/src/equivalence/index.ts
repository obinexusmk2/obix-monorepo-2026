/**
 * Adapter Equivalence — every projection vs the INDEPENDENT oracle.
 *
 * The expected values come from obix-validator.referenceFold, which does not
 * use any adapter. We never compare adapters only with each other (four
 * implementations could share one bug); every adapter is compared to the
 * oracle, at every step, for state / render / validation.
 */
import { referenceFold } from "@obinexusltd/obix-validator";
import { toData, dataRender, dataValidate } from "@obinexusltd/obix-adapter-data";
import { toFunctional } from "@obinexusltd/obix-adapter-functional";
import { toOOP } from "@obinexusltd/obix-adapter-oop";
import { toReactive } from "@obinexusltd/obix-adapter-reactive";
import type {
  DOPArtifact,
  State,
  Props,
  ActionTrace,
  ValidationResult,
} from "@obinexusltd/obix-spec";

export interface EquivalenceScenario<S extends object, P extends object> {
  trace: ActionTrace;
  initialState?: S;
  props?: P;
}

export interface AdapterRun<S extends object> {
  states: S[];
  renders: (string | undefined)[];
  validations: (ValidationResult | undefined)[];
}

export interface EquivalenceReport<S extends object> {
  equivalent: boolean;
  stepWise: boolean;
  renderEqual: boolean;
  validationEqual: boolean;
  expected: S;
  oracleHistory: S[];
  perAdapter: Record<string, AdapterRun<S>>;
  divergences: string[];
}

const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.keys(val).sort().map((k) => [k, (val as Record<string, unknown>)[k]]))
      : val,
  );

const eq = (a: unknown, b: unknown): boolean => stable(a) === stable(b);

export function checkEquivalence<S extends object = State, P extends object = Props>(
  artifact: DOPArtifact<S, P>,
  scenario: EquivalenceScenario<S, P>,
): EquivalenceReport<S> {
  const initialState = (scenario.initialState ?? artifact.initialState) as S;
  const props = (scenario.props ?? artifact.props) as P;
  const { trace } = scenario;

  const oracle = referenceFold(artifact, initialState, props, trace);

  const perAdapter: Record<string, AdapterRun<S>> = {
    data: runData(artifact, initialState, props, trace),
    functional: runFunctionalReduce(artifact, initialState, props, trace),
    "functional.create": runFunctionalCreate(artifact, initialState, props, trace),
    oop: runOOP(artifact, initialState, props, trace),
    reactive: runReactive(artifact, initialState, props, trace),
  };

  const divergences: string[] = [];
  let stepWise = true;
  let renderEqual = true;
  let validationEqual = true;

  for (const [name, run] of Object.entries(perAdapter)) {
    for (let i = 0; i < oracle.history.length; i++) {
      if (!eq(run.states[i], oracle.history[i])) {
        stepWise = false;
        divergences.push(`${name} state@${i}: ${stable(run.states[i])} != ${stable(oracle.history[i])}`);
      }
      if (run.renders[i] !== undefined && oracle.renders[i] !== undefined && run.renders[i] !== oracle.renders[i]) {
        renderEqual = false;
        divergences.push(`${name} render@${i} differs from oracle`);
      }
      if (run.validations[i] !== undefined && oracle.validations[i] !== undefined && !eq(run.validations[i], oracle.validations[i])) {
        validationEqual = false;
        divergences.push(`${name} validation@${i} differs from oracle`);
      }
    }
  }

  return {
    equivalent: stepWise && renderEqual && validationEqual,
    stepWise,
    renderEqual,
    validationEqual,
    expected: oracle.finalState,
    oracleHistory: oracle.history,
    perAdapter,
    divergences,
  };
}

function renderAt<S extends object, P extends object>(a: DOPArtifact<S, P>, s: S, p: P) {
  return a.render ? a.render(s, p) : undefined;
}
function validateAt<S extends object, P extends object>(a: DOPArtifact<S, P>, s: S, p: P) {
  return a.validate ? a.validate(s, p) : undefined;
}

function runData<S extends object, P extends object>(a: DOPArtifact<S, P>, from: S, props: P, trace: ActionTrace): AdapterRun<S> {
  const d = toData(a);
  let s = from;
  const states = [s];
  const renders = [d.render ? dataRender(d, s, props) : undefined];
  const validations = [d.validate ? dataValidate(d, s, props) : undefined];
  for (const [name, payload] of trace) {
    s = d.actions[name]!(s, payload, props);
    states.push(s);
    renders.push(d.render ? dataRender(d, s, props) : undefined);
    validations.push(d.validate ? dataValidate(d, s, props) : undefined);
  }
  return { states, renders, validations };
}

function runFunctionalReduce<S extends object, P extends object>(a: DOPArtifact<S, P>, from: S, props: P, trace: ActionTrace): AdapterRun<S> {
  const F = toFunctional(a);
  let s = from;
  const states = [s];
  const renders = [renderAt(a, s, props)];
  const validations = [validateAt(a, s, props)];
  for (const [name, payload] of trace) {
    s = F.reduce(s, name, payload, props);
    states.push(s);
    renders.push(renderAt(a, s, props));
    validations.push(validateAt(a, s, props));
  }
  return { states, renders, validations };
}

function runFunctionalCreate<S extends object, P extends object>(a: DOPArtifact<S, P>, from: S, props: P, trace: ActionTrace): AdapterRun<S> {
  const inst = toFunctional(a).create({ state: from, props });
  const states = [inst.getState()];
  const renders = [a.render ? inst.render() : undefined];
  const validations = [a.validate ? inst.validate() : undefined];
  for (const [name, payload] of trace) {
    inst.dispatch(name, payload);
    states.push(inst.getState());
    renders.push(a.render ? inst.render() : undefined);
    validations.push(a.validate ? inst.validate() : undefined);
  }
  return { states, renders, validations };
}

function runOOP<S extends object, P extends object>(a: DOPArtifact<S, P>, from: S, props: P, trace: ActionTrace): AdapterRun<S> {
  const Ctor = toOOP(a);
  const inst = new Ctor({ state: from, props });
  const states = [inst.state];
  const renders = [a.render ? inst.render() : undefined];
  const validations = [a.validate ? inst.validate() : undefined];
  for (const [name, payload] of trace) {
    inst.dispatch(name, payload);
    states.push(inst.state);
    renders.push(a.render ? inst.render() : undefined);
    validations.push(a.validate ? inst.validate() : undefined);
  }
  return { states, renders, validations };
}

function runReactive<S extends object, P extends object>(a: DOPArtifact<S, P>, from: S, props: P, trace: ActionTrace): AdapterRun<S> {
  const inst = toReactive(a)({ state: from, props });
  const states = [inst.state];
  const renders = [a.render ? inst.render() : undefined];
  const validations = [a.validate ? inst.validate() : undefined];
  for (const [name, payload] of trace) {
    inst.dispatch(name, payload);
    states.push(inst.state);
    renders.push(a.render ? inst.render() : undefined);
    validations.push(a.validate ? inst.validate() : undefined);
  }
  return { states, renders, validations };
}
