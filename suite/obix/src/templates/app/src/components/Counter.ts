import { defineElement, type ComponentDef } from "obix-core";

interface CounterState {
  count: number;
}
interface CounterProps {
  step: number;
  label: string;
}

export const Counter: ComponentDef<CounterState, CounterProps> = {
  tag: "app-counter",
  props: { step: 1, label: "Counter" },
  state: { count: 0 },
  actions: {
    Increment: (s, _payload, props) => ({ ...s, count: s.count + props.step }),
    Decrement: (s, _payload, props) => ({ ...s, count: s.count - props.step }),
    Reset: (s) => (s.count === 0 ? s : { ...s, count: 0 }),
  },
  derived: {
    display: (s) => String(s.count),
    isZero: (s) => s.count === 0,
  },
  template: new URL("./Counter.html", import.meta.url),
  styles: new URL("./Counter.css", import.meta.url),
};

defineElement(Counter);
