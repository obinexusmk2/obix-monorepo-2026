/**
 * Timer — the frozen OBIX 1.0 `Timer.obix` golden fixture, rebuilt as a standard
 * Web Component. Same state, actions, derived values and terminal semantics; no
 * `.obix` file, no compiler.
 *
 *   Timer.obix  <script>  →  this ComponentDef
 *   Timer.obix  <template> →  Timer.html   (runtime {marker} bindings)
 *   Timer.obix  <style>    →  Timer.css    (scoped by shadow DOM)
 */
import { defineElement, type ComponentDef } from "obix-core";

export interface TimerState {
  seconds: number;
  running: boolean;
}
export interface TimerProps {
  label: string;
  limitSeconds: number;
  idleText: string;
}

export const Timer: ComponentDef<TimerState, TimerProps> = {
  tag: "obix-timer",
  state: { seconds: 0, running: false },
  props: { label: "Timer", limitSeconds: 5, idleText: "Ready" },

  actions: {
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
  },

  derived: {
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
    cannotStart({ running, seconds }, { limitSeconds }) {
      return running || seconds >= limitSeconds;
    },
    stopped({ running }) {
      return !running;
    },
    atLimit({ seconds }, { limitSeconds }) {
      return seconds >= limitSeconds;
    },
  },

  effects: {
    tick: { every: 1000, while: ({ running }) => running, dispatch: "Tick" },
  },

  template: new URL("./Timer.html", import.meta.url),
  styles: new URL("./Timer.css", import.meta.url),
};

defineElement(Timer);
