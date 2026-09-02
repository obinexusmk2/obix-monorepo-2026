/**
 * TimerDOP — the compiled canonical DOP artifact for the frozen Timer fixture.
 *
 * Terminal semantics: Draft 0.2.1 Addendum A, adopted Model B *refined*.
 *   - at seconds === limitSeconds: running === false
 *   - Start at the limit is identity; Reset is the only way out
 *   - Tick never decreases seconds (restored {seconds:8} -> stays 8, running:false)
 *
 * This mirrors fixture/Timer.obix exactly. The compiler is expected to produce
 * an artifact that is behaviourally identical to this one.
 */
import { createDOP } from "obix-ir";
import type {
  ActionFn,
  DerivedFn,
  TemplateDescriptor,
  ValidationResult,
} from "obix-spec";

export interface TimerState {
  readonly seconds: number;
  readonly running: boolean;
}
export interface TimerProps {
  readonly label: string;
  readonly limitSeconds: number;
  readonly idleText: string;
}

const initialState: TimerState = { seconds: 0, running: false };
const props: TimerProps = { label: "Timer", limitSeconds: 5, idleText: "Ready" };

const actions: Record<string, ActionFn<TimerState, TimerProps>> = {
  Start(state, _payload, props) {
    if (state.running) return state;
    if (state.seconds >= props.limitSeconds) return state;
    return { ...state, running: true };
  },
  Stop(state) {
    if (!state.running) return state;
    return { ...state, running: false };
  },
  Reset(state) {
    return { ...state, seconds: 0, running: false };
  },
  Tick(state, _payload, props) {
    if (!state.running) return state;
    if (state.seconds >= props.limitSeconds) return { ...state, running: false };
    const seconds = state.seconds + 1;
    if (seconds >= props.limitSeconds) return { ...state, seconds, running: false };
    return { ...state, seconds };
  },
};

const derived: Record<string, DerivedFn<TimerState, TimerProps>> = {
  formattedTime({ seconds }) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  },
  finished({ running, seconds }, { limitSeconds }) {
    return !running && seconds >= limitSeconds;
  },
  statusLabel({ running, seconds }, { idleText, limitSeconds }) {
    if (!running && seconds >= limitSeconds) return "Finished";
    if (running) return "Running";
    if (seconds > 0) return "Paused";
    return idleText;
  },
  visualState({ running, seconds }, { limitSeconds }) {
    if (!running && seconds >= limitSeconds) return "finished";
    return running ? "running" : "idle";
  },
  cannotStart({ running, seconds }, { limitSeconds }) {
    return running || seconds >= limitSeconds;
  },
  stopped({ running }) {
    return !running;
  },
  atLimit({ seconds }, { limitSeconds }) {
    return seconds >= limitSeconds;
  },
};

function validate(state: TimerState, props: TimerProps): ValidationResult {
  const violations =
    state.seconds > props.limitSeconds
      ? [{ rule: "NeverPastLimit", message: "seconds exceeded limitSeconds" }]
      : [];
  return { valid: violations.length === 0, violations };
}

function render(state: TimerState, props: TimerProps): string {
  const time = derived.formattedTime!(state, props) as string;
  const status = derived.statusLabel!(state, props) as string;
  const hint = (derived.finished!(state, props) as boolean)
    ? `<p class="Timer__hint">Time&#39;s up. Reset to start again.</p>`
    : ``;
  return `<output class="Timer__display">${time}</output><p class="Timer__status" role="status" aria-live="polite">${status}</p>${hint}`;
}

const effects = {
  tick: {
    name: "tick",
    kind: "every" as const,
    every: 1000,
    whileExpr: "({ running }) => running",
    while: (state: unknown) => Boolean((state as TimerState).running),
    dispatch: "Tick",
  },
};

/** Hand-authored template descriptor so every projection — including native —
 *  works straight from this package. Child-index paths are from the root <div>. */
const template: TemplateDescriptor = {
  root: {
    kind: "element",
    tag: "div",
    attrs: [
      { name: "class", value: "Timer" },
      { name: "role", value: "timer" },
      { name: "aria-label", value: "{label}", interpolation: "label", directive: "aria" },
    ],
    children: [
      {
        kind: "element",
        tag: "output",
        attrs: [{ name: "class", value: "Timer__display" }],
        children: [{ kind: "interpolation", expr: "formattedTime" }],
      },
      {
        kind: "element",
        tag: "p",
        attrs: [
          { name: "class", value: "Timer__status" },
          { name: "role", value: "status" },
          { name: "aria-live", value: "polite" },
        ],
        children: [{ kind: "interpolation", expr: "statusLabel" }],
      },
      {
        kind: "element",
        tag: "div",
        attrs: [{ name: "class", value: "Timer__controls" }],
        children: [
          {
            kind: "element",
            tag: "button",
            attrs: [
              { name: "type", value: "button" },
              { name: "class", value: "Timer__button" },
              { name: "on:click", value: "Start", directive: "event" },
              { name: "disabled", value: "{cannotStart}", interpolation: "cannotStart", directive: "bool" },
            ],
            children: [{ kind: "text", value: "Start" }],
          },
          {
            kind: "element",
            tag: "button",
            attrs: [
              { name: "type", value: "button" },
              { name: "class", value: "Timer__button" },
              { name: "on:click", value: "Stop", directive: "event" },
              { name: "disabled", value: "{stopped}", interpolation: "stopped", directive: "bool" },
            ],
            children: [{ kind: "text", value: "Stop" }],
          },
          {
            kind: "element",
            tag: "button",
            attrs: [
              { name: "type", value: "button" },
              { name: "class", value: "Timer__button" },
              { name: "on:click", value: "Reset", directive: "event" },
            ],
            children: [{ kind: "text", value: "Reset" }],
          },
        ],
      },
      {
        kind: "element",
        tag: "p",
        attrs: [
          { name: "class", value: "Timer__hint" },
          { name: "obix:if", value: "finished", directive: "conditional" },
        ],
        children: [{ kind: "text", value: "Time's up. Reset to start again." }],
      },
    ],
  },
  bindings: [
    { kind: "aria", target: "aria-label", expr: "label", deps: ["label"], path: [] },
    { kind: "text", target: "", expr: "formattedTime", deps: ["formattedTime"], path: [0, 0] },
    { kind: "text", target: "", expr: "statusLabel", deps: ["statusLabel"], path: [1, 0] },
    { kind: "bool", target: "disabled", expr: "cannotStart", deps: ["cannotStart"], path: [2, 0] },
    { kind: "bool", target: "disabled", expr: "stopped", deps: ["stopped"], path: [2, 1] },
    { kind: "conditional", target: "", expr: "finished", deps: ["finished"], path: [3] },
  ],
  events: [
    { event: "click", action: "Start", path: [2, 0] },
    { event: "click", action: "Stop", path: [2, 1] },
    { event: "click", action: "Reset", path: [2, 2] },
  ],
};

export const TimerDOP = createDOP<TimerState, TimerProps>({
  name: "Timer",
  initialState,
  props,
  actions,
  derived,
  effects,
  validate,
  render,
  template,
  style: { token: "obix-timer000", css: "" },
  actionPropDeps: {
    Start: ["limitSeconds"],
    Tick: ["limitSeconds"],
  },
  derivedDeps: {
    formattedTime: { stateDeps: ["seconds"] },
    finished: { stateDeps: ["running", "seconds"], propDeps: ["limitSeconds"] },
    statusLabel: { stateDeps: ["running", "seconds"], propDeps: ["idleText", "limitSeconds"] },
    visualState: { stateDeps: ["running", "seconds"], propDeps: ["limitSeconds"] },
    cannotStart: { stateDeps: ["running", "seconds"], propDeps: ["limitSeconds"] },
    stopped: { stateDeps: ["running"] },
    atLimit: { stateDeps: ["seconds"], propDeps: ["limitSeconds"] },
  },
});
