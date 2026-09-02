/**
 * OBIX demo — plain HTML + CSS + JavaScript. No TypeScript, no build step.
 *
 * Prerequisite: obix-core must be built once —
 *     npm run build:suite        (from the repo root)
 *
 * Run it: serve the `suite/` directory (or the repo root) with any static
 * server and open this folder, e.g.
 *     npx serve suite      →  http://localhost:3000/examples/meeting-cost/
 *
 * A <meeting-cost> is a standard custom element: a plain-object ComponentDef
 * driven by obix-core's data-oriented store, a `{marker}` HTML template, and a
 * shadow-DOM stylesheet (styles.css). The 1-second `tick` effect self-clears
 * whenever `running` is false.
 */
import { defineElement } from "../../obix-core/dist/index.js";

const money = (n) => n.toFixed(2);

const MeetingCost = {
  tag: "meeting-cost",

  props: { currency: "$", rateStep: 5, maxPeople: 50 },
  state: { people: 5, rate: 75, seconds: 0, running: false },

  actions: {
    AddPerson: (s, _payload, p) => (s.people >= p.maxPeople ? s : { ...s, people: s.people + 1 }),
    RemovePerson: (s) => (s.people <= 1 ? s : { ...s, people: s.people - 1 }),
    RaiseRate: (s, _payload, p) => ({ ...s, rate: s.rate + p.rateStep }),
    LowerRate: (s, _payload, p) => ({ ...s, rate: Math.max(p.rateStep, s.rate - p.rateStep) }),
    Start: (s) => (s.running ? s : { ...s, running: true }),
    Pause: (s) => (s.running ? { ...s, running: false } : s),
    Reset: (s) => (s.seconds === 0 && !s.running ? s : { ...s, seconds: 0, running: false }),
    Tick: (s) => (s.running ? { ...s, seconds: s.seconds + 1 } : s),
  },

  derived: {
    elapsed: (s) => {
      const m = Math.floor(s.seconds / 60);
      const sec = s.seconds % 60;
      return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    },
    runningCost: (s, p) => p.currency + money((s.seconds * s.people * s.rate) / 3600),
    perMinuteCost: (s, p) => p.currency + money((s.people * s.rate) / 60),
    rateLabel: (s, p) => `${p.currency}${s.rate}/hr`,
    statusLabel: (s) => (s.running ? "Running" : s.seconds > 0 ? "Paused" : "Ready"),
    soloPerson: (s) => s.people <= 1,
    minRate: (s, p) => s.rate <= p.rateStep,
    isRunning: (s) => s.running,
    notRunning: (s) => !s.running,
    pristine: (s) => s.seconds === 0 && !s.running,
    overBudget: (s) => (s.seconds * s.people * s.rate) / 3600 > 100,
  },

  effects: {
    tick: { every: 1000, while: (s) => s.running, dispatch: "Tick" },
  },

  styles: new URL("./styles.css", import.meta.url),

  template: `
    <div class="mc" data-bind-data-state="statusLabel">
      <p class="mc__cost" role="status" aria-live="polite">{runningCost}</p>
      <p class="mc__meta">{statusLabel} &middot; {elapsed} elapsed &middot; {perMinuteCost}/min</p>

      <div class="mc__stepper">
        <span class="mc__label">People</span>
        <button type="button" class="mc__pm" data-on-click="RemovePerson"
                data-bind-disabled="soloPerson" aria-label="Remove a person">&minus;</button>
        <span class="mc__num">{people}</span>
        <button type="button" class="mc__pm" data-on-click="AddPerson"
                aria-label="Add a person">+</button>
      </div>

      <div class="mc__stepper">
        <span class="mc__label">Rate</span>
        <button type="button" class="mc__pm" data-on-click="LowerRate"
                data-bind-disabled="minRate" aria-label="Lower the hourly rate">&minus;</button>
        <span class="mc__num">{rateLabel}</span>
        <button type="button" class="mc__pm" data-on-click="RaiseRate"
                aria-label="Raise the hourly rate">+</button>
      </div>

      <div class="mc__controls">
        <button type="button" class="mc__btn mc__btn--go" data-on-click="Start"
                data-bind-disabled="isRunning">Start</button>
        <button type="button" class="mc__btn" data-on-click="Pause"
                data-bind-disabled="notRunning">Pause</button>
        <button type="button" class="mc__btn" data-on-click="Reset"
                data-bind-disabled="pristine">Reset</button>
      </div>

      <p class="mc__warn" role="alert" data-if="overBudget">
        Past {currency}100 — time to wrap up.
      </p>
    </div>
  `,
};

defineElement(MeetingCost);
