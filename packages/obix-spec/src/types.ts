/**
 * OBIX 1.0 — canonical type surface.
 *
 * Every other package imports these types from here. Nothing redefines
 * DOPArtifact, ActionSignature, BindingDescriptor, EffectDescriptor,
 * A11yModel, TransitionMeta, ValidationResult, etc. anywhere else.
 * (Draft 0.2.1 — Problem 12: TypeScript declaration drift.)
 */

/* ------------------------------------------------------------------ */
/* source positions + diagnostics                                     */
/* ------------------------------------------------------------------ */

export interface SourceSpan {
  readonly start: number;
  readonly end: number;
  readonly line: number;
  readonly column: number;
}

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly span?: SourceSpan;
}

/* ------------------------------------------------------------------ */
/* state / props / payload                                            */
/* ------------------------------------------------------------------ */

export type StateValue = unknown;
export type State = Readonly<Record<string, StateValue>>;
export type Props = Readonly<Record<string, unknown>>;
export type Payload = unknown;

/* ------------------------------------------------------------------ */
/* the frozen action + derived signatures                            */
/*   Action(state, payload, props) -> nextState                       */
/*   Derived(state, props) -> value                                   */
/* ------------------------------------------------------------------ */

export type ActionFn<S extends object = State, P extends object = Props> = (
  state: S,
  payload: Payload,
  props: P,
) => S;

export type DerivedFn<S extends object = State, P extends object = Props> = (
  state: S,
  props: P,
) => unknown;

export interface ActionSignature {
  readonly name: string;
  readonly arity: 1 | 2 | 3;
  readonly usesProps: boolean;
  readonly propDeps: readonly string[];
}

export interface DerivedSignature {
  readonly name: string;
  readonly propDeps: readonly string[];
  readonly stateDeps: readonly string[];
}

/* ------------------------------------------------------------------ */
/* effects                                                            */
/* ------------------------------------------------------------------ */

export type EffectKind = "every" | "after" | "on";

export interface EffectDescriptor {
  readonly name: string;
  readonly kind: EffectKind;
  /** action name dispatched on each firing */
  readonly dispatch: string;
  /** milliseconds, for kind "every" */
  readonly every?: number;
  /** verbatim source of the `while(state, props)` predicate */
  readonly whileExpr?: string;
}

/* ------------------------------------------------------------------ */
/* template AST (produced by obix-parser, validated by validateObixAST) */
/* ------------------------------------------------------------------ */

export type TemplateNode = TemplateElement | TemplateText | TemplateInterpolation;

export interface TemplateAttr {
  readonly name: string;
  /** literal value, or null for a bare boolean attribute */
  readonly value: string | null;
  /** expression text when the value was `"{expr}"` */
  readonly interpolation?: string;
  readonly directive?: "event" | "aria" | "bool" | "conditional";
  readonly span?: SourceSpan;
}

export interface TemplateElement {
  readonly kind: "element";
  readonly tag: string;
  readonly attrs: readonly TemplateAttr[];
  readonly children: readonly TemplateNode[];
  readonly span?: SourceSpan;
}

export interface TemplateText {
  readonly kind: "text";
  readonly value: string;
  readonly span?: SourceSpan;
}

export interface TemplateInterpolation {
  readonly kind: "interpolation";
  readonly expr: string;
  readonly span?: SourceSpan;
}

/* ------------------------------------------------------------------ */
/* descriptors (produced by obix-template — pure, no DOM, no JS parse) */
/* ------------------------------------------------------------------ */

export type BindingKind = "text" | "attr" | "bool" | "aria" | "conditional";

export interface BindingDescriptor {
  readonly kind: BindingKind;
  /** attribute name for attr/bool/aria; "" for text/conditional */
  readonly target: string;
  /** expression source (Level 0: identifier or dotted path) */
  readonly expr: string;
  readonly deps: readonly string[];
  /** child-index path from the template root element */
  readonly path: readonly number[];
}

export interface EventDescriptor {
  readonly event: string;
  readonly action: string;
  readonly path: readonly number[];
}

export interface TemplateDescriptor {
  readonly root: TemplateElement;
  readonly bindings: readonly BindingDescriptor[];
  readonly events: readonly EventDescriptor[];
}

/* ------------------------------------------------------------------ */
/* accessibility model (produced by obix-accessibility, compile-time)  */
/* ------------------------------------------------------------------ */

export interface A11yLiveRegion {
  readonly path: readonly number[];
  readonly politeness: "polite" | "assertive" | "off";
  readonly hasBinding: boolean;
}

export interface A11yModel {
  readonly liveRegions: readonly A11yLiveRegion[];
  readonly focusableCount: number;
  readonly headingLevels: readonly number[];
  readonly roles: readonly string[];
  readonly violations: readonly Diagnostic[];
}

/* ------------------------------------------------------------------ */
/* validation                                                         */
/* ------------------------------------------------------------------ */

export interface Violation {
  readonly rule: string;
  readonly message: string;
  readonly path?: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly violations: readonly Violation[];
}

export interface ValidationRule<S extends object = State, P extends object = Props> {
  readonly when: (state: S, props: P) => boolean;
  readonly message: string;
}

export interface ValidationDescriptor {
  readonly state?: Readonly<Record<string, { type?: string; min?: number; max?: number }>>;
  readonly props?: Readonly<Record<string, { type?: string }>>;
  readonly rules?: Readonly<Record<string, ValidationRule>>;
}

/* ------------------------------------------------------------------ */
/* transitions + traces                                               */
/* ------------------------------------------------------------------ */

export interface TransitionMeta<S extends object = State> {
  readonly action: string;
  readonly payload: Payload;
  readonly changedKeys: readonly string[];
  readonly from: S;
  readonly to: S;
}

export type TraceItem = readonly [action: string, payload?: Payload];
export type ActionTrace = readonly TraceItem[];

/* ------------------------------------------------------------------ */
/* the canonical DOP artifact                                         */
/* ------------------------------------------------------------------ */

export interface DopArtifactMeta {
  readonly specVersion: string;
  readonly level: number;
  readonly actionDecls: Readonly<Record<string, ActionSignature>>;
  readonly derivedDeps: Readonly<Record<string, DerivedSignature>>;
}

export interface DOPArtifact<S extends object = State, P extends object = Props> {
  readonly name: string;
  readonly initialState: S;
  readonly props: P;
  readonly actions: Readonly<Record<string, ActionFn<S, P>>>;
  readonly derived: Readonly<Record<string, DerivedFn<S, P>>>;
  readonly effects: Readonly<Record<string, EffectDescriptor>>;
  readonly validate?: (state: S, props: P) => ValidationResult;
  readonly render?: (state: S, props: P) => string;
  /** present when produced by the compiler or a fixture that ships one */
  readonly template?: TemplateDescriptor;
  readonly style?: { readonly token: string; readonly css: string };
  readonly a11y?: A11yModel;
  readonly meta: DopArtifactMeta;
}

/* ------------------------------------------------------------------ */
/* parser-facing AST container                                        */
/* ------------------------------------------------------------------ */

export interface ObixSection {
  readonly raw: string;
  readonly span: SourceSpan;
}

export interface ObixScriptModel {
  readonly raw: string;
  readonly stateInit?: string;
  readonly propsInit?: string;
  readonly actionNames: readonly string[];
  readonly derivedNames: readonly string[];
  readonly effectNames: readonly string[];
  /** raw source text of each member body, keyed by member name */
  readonly members: {
    readonly actions: Readonly<Record<string, string>>;
    readonly derived: Readonly<Record<string, string>>;
    readonly effects: Readonly<Record<string, string>>;
  };
}

export interface ObixAST {
  readonly componentName: string;
  readonly sections: {
    readonly style?: ObixSection;
    readonly template?: ObixSection;
    readonly script?: ObixSection;
  };
  readonly template?: TemplateElement;
  readonly script?: ObixScriptModel;
}

/* ------------------------------------------------------------------ */
/* compiler IR (the canonical DOP IR, JSON-serialisable)              */
/* ------------------------------------------------------------------ */

export interface DopIR {
  readonly name: string;
  readonly specVersion: string;
  readonly level: number;
  readonly stateShape: readonly string[];
  readonly propsShape: readonly string[];
  readonly actionDecls: Readonly<Record<string, ActionSignature>>;
  readonly derivedDeps: Readonly<Record<string, DerivedSignature>>;
  readonly template: TemplateDescriptor;
  readonly events: readonly EventDescriptor[];
  readonly style: { readonly token: string; readonly css: string };
  readonly a11y: A11yModel;
  readonly effects: Readonly<Record<string, EffectDescriptor>>;
}

/* ------------------------------------------------------------------ */
/* emit modes (Problem 6 — inline runtime duplication)                */
/* ------------------------------------------------------------------ */

export type EmitMode = "linked" | "bare" | "inline" | "shared-inline";
