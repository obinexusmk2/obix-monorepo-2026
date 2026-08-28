import {
  SPEC_VERSION,
  LEVEL,
  validateArtifactShape,
} from "@obinexusltd/obix-spec";
import type {
  DOPArtifact,
  ActionFn,
  DerivedFn,
  ActionSignature,
  DerivedSignature,
  EffectDescriptor,
  TemplateDescriptor,
  A11yModel,
  State,
  Props,
  ValidationResult,
} from "@obinexusltd/obix-spec";
import { deepFreeze } from "./freeze.js";

export interface DopDefinition<S extends object = State, P extends object = Props> {
  name: string;
  initialState: S;
  props: P;
  actions: Record<string, ActionFn<S, P>>;
  derived?: Record<string, DerivedFn<S, P>>;
  effects?: Record<string, EffectDescriptor>;
  validate?: (state: S, props: P) => ValidationResult;
  render?: (state: S, props: P) => string;
  template?: TemplateDescriptor;
  style?: { token: string; css: string };
  a11y?: A11yModel;
  /** optional declared prop-dependencies per action (from the compiler IR) */
  actionPropDeps?: Record<string, readonly string[]>;
  /** optional declared dependencies per derived value (from the compiler IR) */
  derivedDeps?: Record<string, { propDeps?: readonly string[]; stateDeps?: readonly string[] }>;
}

const clampArity = (n: number): 1 | 2 | 3 => (n <= 1 ? 1 : n === 2 ? 2 : 3);

/**
 * Build the canonical, frozen DOP artifact. `initialState` and `props` are
 * deep-frozen; the actions/derived/effects containers are frozen. `meta` records
 * the derived signatures the compiler computed (or conservative defaults).
 */
export function createDOP<S extends object = State, P extends object = Props>(
  def: DopDefinition<S, P>,
): DOPArtifact<S, P> {
  const shape = validateArtifactShape(def);
  if (!shape.valid) {
    throw new Error(
      `[OBIX] createDOP("${def.name}"): invalid artifact shape:\n  ` +
        shape.violations.map((v) => `${v.rule}: ${v.message}`).join("\n  "),
    );
  }

  const actions = Object.freeze({ ...def.actions });
  const derived = Object.freeze({ ...(def.derived ?? {}) });
  const effects = Object.freeze({ ...(def.effects ?? {}) });

  const actionDecls: Record<string, ActionSignature> = {};
  for (const [name, fn] of Object.entries(actions)) {
    const arity = clampArity(fn.length);
    actionDecls[name] = {
      name,
      arity,
      usesProps: arity >= 3,
      propDeps: def.actionPropDeps?.[name] ?? [],
    };
  }

  const derivedDeps: Record<string, DerivedSignature> = {};
  for (const name of Object.keys(derived)) {
    derivedDeps[name] = {
      name,
      propDeps: def.derivedDeps?.[name]?.propDeps ?? [],
      stateDeps: def.derivedDeps?.[name]?.stateDeps ?? [],
    };
  }

  const artifact: DOPArtifact<S, P> = {
    name: def.name,
    initialState: deepFreeze(def.initialState),
    props: deepFreeze(def.props),
    actions,
    derived,
    effects,
    validate: def.validate,
    render: def.render,
    template: def.template,
    style: def.style,
    a11y: def.a11y,
    meta: Object.freeze({
      specVersion: SPEC_VERSION,
      level: LEVEL,
      actionDecls: Object.freeze(actionDecls),
      derivedDeps: Object.freeze(derivedDeps),
    }),
  };

  return Object.freeze(artifact);
}
