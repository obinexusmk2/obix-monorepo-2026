# Usage Guide — `@obinexusltd/obix-component-tooltip`

## Install

```bash
npm install @obinexusltd/obix-component-tooltip
```

Zero runtime dependencies.

## Quick start

```ts
import { createTooltip } from "@obinexusltd/obix-component-tooltip";

let tooltip = createTooltip({ trigger: "?", content: "Learn more about this field." });
let state = tooltip.state;

function render() { document.querySelector("#slot")!.innerHTML = tooltip.render(state); }
```

## Hover with delay

```ts
createTooltip({ trigger: "Hover me", content: "Details here.", delay: 300, closeDelay: 150 });
```

`delay`/`closeDelay` are rendered as `data-delay`/`data-close-delay` — this package doesn't run its own `setTimeout`s. Read them off the trigger element in your own show/hide handlers:

```ts
const el = document.querySelector(".obix-tooltip-trigger")!;
let showTimer: ReturnType<typeof setTimeout>;
el.addEventListener("mouseenter", () => {
  showTimer = setTimeout(() => { state = tooltip.actions.show(state); render(); }, Number(el.dataset.delay));
});
el.addEventListener("mouseleave", () => {
  clearTimeout(showTimer);
  setTimeout(() => { state = tooltip.actions.hide(state); render(); }, Number(el.dataset.closeDelay));
});
```

## Focus- or click-activated tooltips

```ts
createTooltip({ trigger: "Info", content: "Click for details.", activateOn: "click" });
// data-activate-on="click" — wire a click listener instead of mouseenter/mouseleave
```

## Placement

```ts
createTooltip({ trigger: "?", content: "Appears below the trigger.", placement: "bottom" });
```

Placement only controls the emitted `obix-tooltip--{placement}` class (see [styling.md](./styling.md)) — actual positioning (flipping to stay in the viewport, offset from the trigger) is your integration's responsibility; this package renders static markup, not a positioning engine.
