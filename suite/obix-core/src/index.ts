/**
 * obix-core — the OBIX suite runtime.
 *
 * Data-oriented store · runtime `{marker}` DOM binder · `ObixElement` Web
 * Component base · function ⇄ class projections · dev-time a11y audit.
 * Zero dependencies. Authored in standard TypeScript; components are standard
 * `.html` + `.css` + `.ts` (no `.obix`, no compiler).
 */
export {
  SUITE_VERSION,
  isPlainObject,
  assertComponentDef,
  kebab,
} from "./spec.js";
export type {
  Plain,
  ObixState,
  ObixProps,
  ObixAction,
  ObixActions,
  ObixDerived,
  ObixDeriveds,
  ObixEffect,
  ObixEffects,
  ObixLifecycle,
  ComponentDef,
  Diagnostic,
} from "./spec.js";

export { createStore } from "./store.js";
export type {
  Store,
  StoreChange,
  Subscriber,
  Scheduler,
  CreateStoreOptions,
} from "./store.js";

export {
  buildScope,
  resolvePath,
  parseTemplate,
  adoptStyles,
  bindRoot,
} from "./dom.js";
export type { BindScope, BinderHandle } from "./dom.js";

export { auditHtml, auditRoot, hasBlockingA11yError, A11Y_CODES } from "./a11y.js";

export { toFunc, toClass } from "./project.js";
export type {
  Trace,
  FuncInstance,
  FuncProjection,
  ClassInstance,
  ClassProjection,
} from "./project.js";

export { defineElement, makeElementClass } from "./element.js";
