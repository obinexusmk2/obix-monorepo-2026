import { DIAGNOSTIC_CODES } from "obix-spec";

/** Keys whose value differs by Object.is between two state snapshots. */
export function calculateChangedKeys(prev: object, next: object): string[] {
  const p = (prev ?? {}) as Record<string, unknown>;
  const n = (next ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(p), ...Object.keys(n)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (!Object.is(p[k], n[k])) changed.push(k);
  }
  return changed;
}

/**
 * Throw if `state` carries keys outside the declared closed shape. OBIX state
 * shapes are closed: an action may not invent a new key.
 */
export function assertClosedStateShape(state: object, shape: readonly string[]): void {
  const allowed = new Set(shape);
  const extra = Object.keys(state).filter((k) => !allowed.has(k));
  if (extra.length > 0) {
    throw new Error(
      `[OBIX] ${DIAGNOSTIC_CODES.S006_STATE_SHAPE_NOT_CLOSED}: state has keys outside the closed shape: ${extra.join(", ")}`,
    );
  }
}
