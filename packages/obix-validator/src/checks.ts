import { DIAGNOSTIC_CODES } from "@obinexusltd/obix-spec";
import type {
  DOPArtifact,
  State,
  Props,
  ValidationDescriptor,
  ValidationResult,
  Violation,
} from "@obinexusltd/obix-spec";

const result = (violations: Violation[]): ValidationResult => ({
  valid: violations.length === 0,
  violations,
});

export function validateProps(descriptor: ValidationDescriptor | undefined, props: Props): ValidationResult {
  const v: Violation[] = [];
  for (const [key, rule] of Object.entries(descriptor?.props ?? {})) {
    const value = (props as Record<string, unknown>)[key];
    if (rule.type && value !== undefined && typeof value !== rule.type) {
      v.push({ rule: "props.type", message: `prop "${key}" should be ${rule.type}`, path: key });
    }
  }
  return result(v);
}

export function validateState(descriptor: ValidationDescriptor | undefined, state: State): ValidationResult {
  const v: Violation[] = [];
  for (const [key, rule] of Object.entries(descriptor?.state ?? {})) {
    const value = (state as Record<string, unknown>)[key];
    if (rule.type && value !== undefined && typeof value !== rule.type) {
      v.push({ rule: "state.type", message: `state "${key}" should be ${rule.type}`, path: key });
    }
    if (typeof value === "number") {
      if (rule.min !== undefined && value < rule.min) v.push({ rule: "state.min", message: `state "${key}" < ${rule.min}`, path: key });
      if (rule.max !== undefined && value > rule.max) v.push({ rule: "state.max", message: `state "${key}" > ${rule.max}`, path: key });
    }
  }
  return result(v);
}

export function validateRules(
  descriptor: ValidationDescriptor | undefined,
  state: State,
  props: Props,
): ValidationResult {
  const v: Violation[] = [];
  for (const [name, rule] of Object.entries(descriptor?.rules ?? {})) {
    try {
      if (rule.when(state, props)) v.push({ rule: name, message: rule.message });
    } catch (err) {
      v.push({ rule: name, message: `rule threw: ${(err as Error).message}` });
    }
  }
  return result(v);
}

/**
 * Every prop an action declares as a dependency must exist on props. (Problem 8
 * seen from the static side.)
 */
export function checkActionPropDeps<S extends object, P extends object>(
  artifact: DOPArtifact<S, P>,
): ValidationResult {
  const v: Violation[] = [];
  const propKeys = new Set(Object.keys(artifact.props));
  for (const [name, decl] of Object.entries(artifact.meta.actionDecls)) {
    for (const dep of decl.propDeps) {
      if (!propKeys.has(dep)) {
        v.push({
          rule: DIAGNOSTIC_CODES.S004_PROP_DEP_UNDECLARED,
          message: `action "${name}" declares prop dependency "${dep}" which is not in props`,
          path: `actions.${name}`,
        });
      }
    }
  }
  return result(v);
}

/**
 * DATA FIRST, PARADIGM SECOND. Nothing after the DOP IR may add business logic:
 * actions have arity <= 3, derived arity <= 2, and the artifact carries no
 * adapter-specific fields.
 */
export function checkPipelineInvariant<S extends object, P extends object>(
  artifact: DOPArtifact<S, P>,
): ValidationResult {
  const v: Violation[] = [];
  for (const [name, fn] of Object.entries(artifact.actions)) {
    if (fn.length > 3) v.push({ rule: DIAGNOSTIC_CODES.S003_ACTION_ARITY, message: `action "${name}" arity ${fn.length} > 3`, path: `actions.${name}` });
  }
  for (const [name, fn] of Object.entries(artifact.derived)) {
    if (fn.length > 2) v.push({ rule: DIAGNOSTIC_CODES.S005_PIPELINE_INVARIANT, message: `derived "${name}" arity ${fn.length} > 2`, path: `derived.${name}` });
  }
  const bag = artifact as unknown as Record<string, unknown>;
  for (const forbidden of ["toData", "toFunctional", "toOOP", "toReactive", "adapter", "projection"]) {
    if (forbidden in bag) {
      v.push({ rule: DIAGNOSTIC_CODES.S005_PIPELINE_INVARIANT, message: `artifact carries adapter-specific field "${forbidden}"` });
    }
  }
  return result(v);
}
