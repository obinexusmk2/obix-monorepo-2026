import type { ValidationResult, Violation } from "./types.js";

/**
 * Runtime shape check for a DOPArtifact-like object. Used by obix-ir.createDOP
 * and by obix-validator before it will run the reference evaluator.
 */
export function validateArtifactShape(artifact: unknown): ValidationResult {
  const v: Violation[] = [];
  const add = (rule: string, message: string, path?: string) => v.push({ rule, message, path });

  if (typeof artifact !== "object" || artifact === null) {
    return { valid: false, violations: [{ rule: "artifact.object", message: "artifact must be an object" }] };
  }
  const a = artifact as Record<string, unknown>;

  if (typeof a.name !== "string" || a.name.length === 0) add("artifact.name", "name must be a non-empty string", "name");
  if (typeof a.initialState !== "object" || a.initialState === null) add("artifact.initialState", "initialState must be an object", "initialState");
  if (typeof a.props !== "object" || a.props === null) add("artifact.props", "props must be an object", "props");

  const actions = a.actions as Record<string, unknown> | undefined;
  if (typeof actions !== "object" || actions === null) {
    add("artifact.actions", "actions must be an object", "actions");
  } else {
    for (const [name, fn] of Object.entries(actions)) {
      if (typeof fn !== "function") add("artifact.actions.fn", `action "${name}" must be a function`, `actions.${name}`);
      else if ((fn as (...x: unknown[]) => unknown).length > 3) add("artifact.actions.arity", `action "${name}" has arity ${(fn as (...x: unknown[]) => unknown).length}; max is 3 — Action(state, payload, props)`, `actions.${name}`);
    }
  }

  const derived = (a.derived ?? {}) as Record<string, unknown>;
  for (const [name, fn] of Object.entries(derived)) {
    if (typeof fn !== "function") add("artifact.derived.fn", `derived "${name}" must be a function`, `derived.${name}`);
    else if ((fn as (...x: unknown[]) => unknown).length > 2) add("artifact.derived.arity", `derived "${name}" has arity ${(fn as (...x: unknown[]) => unknown).length}; max is 2 — Derived(state, props)`, `derived.${name}`);
  }

  const effects = (a.effects ?? {}) as Record<string, unknown>;
  for (const [name, desc] of Object.entries(effects)) {
    const d = desc as Record<string, unknown>;
    if (typeof d?.kind !== "string") add("artifact.effects.kind", `effect "${name}" needs a kind`, `effects.${name}`);
    if (typeof d?.dispatch !== "string") add("artifact.effects.dispatch", `effect "${name}" needs a dispatch action name`, `effects.${name}`);
  }

  return { valid: v.length === 0, violations: v };
}
