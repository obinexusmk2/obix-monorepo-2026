/** Deep structural freeze. Idempotent, cycle-safe. */
export function deepFreeze<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value as object)) return value;
  seen.add(value as object);
  for (const key of Object.keys(value as object)) {
    deepFreeze((value as Record<string, unknown>)[key], seen);
  }
  return Object.freeze(value);
}

/** Alias with intent — the state a projection is handed is never mutated. */
export const freezeState = <S>(state: S): S => deepFreeze(state);

/** Alias with intent — props are frozen for the whole component lifetime. */
export const freezeProps = <P>(props: P): P => deepFreeze(props);
