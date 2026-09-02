/** The frozen Timer fixture, expressed as a plain ComponentDef (no `.obix`). */
export const Timer = {
  tag: "obix-timer",
  props: { label: "Timer", limitSeconds: 5, idleText: "Ready" },
  state: { seconds: 0, running: false },
  actions: {
    Start: (s, _p, p) => (s.running || s.seconds >= p.limitSeconds ? s : { ...s, running: true }),
    Stop: (s) => (s.running ? { ...s, running: false } : s),
    Reset: (s) => ({ ...s, seconds: 0, running: false }),
    Tick: (s, _p, p) => {
      if (!s.running) return s;
      if (s.seconds >= p.limitSeconds) return { ...s, running: false };
      const seconds = s.seconds + 1;
      if (seconds >= p.limitSeconds) return { ...s, seconds, running: false };
      return { ...s, seconds };
    },
  },
  derived: {
    formattedTime: ({ seconds }) => {
      const m = Math.floor(seconds / 60);
      const r = seconds % 60;
      return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
    },
    finished: ({ running, seconds }, { limitSeconds }) => !running && seconds >= limitSeconds,
    statusLabel: ({ running, seconds }, { idleText, limitSeconds }) => {
      if (!running && seconds >= limitSeconds) return "Finished";
      if (running) return "Running";
      if (seconds > 0) return "Paused";
      return idleText;
    },
    cannotStart: ({ running, seconds }, { limitSeconds }) => running || seconds >= limitSeconds,
    stopped: ({ running }) => !running,
  },
  effects: {
    tick: { every: 1000, while: ({ running }) => running, dispatch: "Tick" },
  },
  template:
    '<output class="Timer__display">{formattedTime}</output>' +
    '<p class="Timer__status">{statusLabel}</p>',
};
