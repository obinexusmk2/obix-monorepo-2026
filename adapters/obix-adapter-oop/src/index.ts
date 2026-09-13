/**
 * @obinexusltd/obix-adapter-oop
 *
 * The OOP projection: a generated class. `state` is read-only from outside and
 * `props` is frozen. Every generated action method (`Inc(payload)`, …) delegates
 * to `dispatch`, which runs the vendored `reduce` (./dop.js). There is never a
 * second implementation of an action.
 *
 * Zero dependencies.
 */
import { reduce, renderHtml, validate as validateState } from "./dop.js";
import type { ActionTrace, DOPComponent, ValidationResult } from "./types.js";

export type {
  ActionContext,
  ActionFn,
  ActionTrace,
  DOPComponent,
  EffectDescriptor,
  RenderView,
  ValidationResult,
} from "./types.js";

export interface OOPInstance<S extends object, P extends object> {
  readonly state: S;
  readonly props: P;
  dispatch(actionName: string, payload?: unknown): S;
  replay(trace: ActionTrace): S;
  render(): string;
  validate(): ValidationResult;
  [member: string]: unknown;
}

export interface OOPConstructor<S extends object, P extends object> {
  new (opts?: { state?: S; props?: Partial<P> }): OOPInstance<S, P>;
}

export function toOOP<S extends object, P extends object = Record<string, unknown>>(
  artifact: DOPComponent<S, P>,
): OOPConstructor<S, P> {
  class Component {
    #state: S;
    #props: P;

    constructor(opts: { state?: S; props?: Partial<P> } = {}) {
      this.#state = opts.state ?? artifact.state;
      this.#props = Object.freeze({ ...(artifact.props ?? {}), ...(opts.props ?? {}) }) as P;
    }

    get state(): S {
      return this.#state;
    }
    set state(_next: S) {
      throw new TypeError(`[obix] ${artifact.name}.state is read-only`);
    }
    get props(): P {
      return this.#props;
    }

    dispatch(actionName: string, payload?: unknown): S {
      this.#state = reduce(artifact, this.#state, actionName, payload, this.#props);
      return this.#state;
    }

    replay(trace: ActionTrace): S {
      for (const [name, payload] of trace) this.dispatch(name, payload);
      return this.#state;
    }

    render(): string {
      return renderHtml(artifact, this.#state, this.#props);
    }

    validate(): ValidationResult {
      return validateState(artifact, this.#state, this.#props);
    }
  }

  // generated action methods — all delegate to dispatch, none re-implement
  for (const name of Object.keys(artifact.actions)) {
    Object.defineProperty(Component.prototype, name, {
      value(this: Component, payload?: unknown) {
        return this.dispatch(name, payload);
      },
      writable: false,
      enumerable: false,
    });
  }

  // generated derived getters
  for (const name of Object.keys(artifact.derived ?? {})) {
    Object.defineProperty(Component.prototype, name, {
      get(this: Component) {
        return artifact.derived![name]!(this.state, this.props);
      },
      enumerable: false,
    });
  }

  return Component as unknown as OOPConstructor<S, P>;
}
