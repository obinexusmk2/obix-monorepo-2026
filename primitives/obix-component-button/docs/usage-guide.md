# Usage Guide — `@obinexusltd/obix-component-button`

## Install

```bash
npm install @obinexusltd/obix-component-button
```

Zero runtime dependencies — this package pulls in nothing else.

## Quick start

```ts
import { createButton } from "@obinexusltd/obix-component-button";

const button = createButton({ label: "Save changes" });
document.querySelector("#slot")!.innerHTML = button.render(button.state);
```

## Driving state changes

`createButton` returns an artifact, not a live component — you own the state and re-render after every action:

```ts
let state = button.state;

function dispatch(action: keyof typeof button.actions, ...args: unknown[]) {
  state = (button.actions[action] as any)(state, ...args);
  document.querySelector("#slot")!.innerHTML = button.render(state);
}

dispatch("setLoading", true);
// ...await the save...
dispatch("setLoading", false);
```

This is the same pattern every `obix-adapter-*` package wraps (`toOOP`, `toReactive`, …) if you want a class or a subscribe/dispatch instance instead of hand-rolling the loop above.

## A loading button

```ts
const save = createButton({ label: "Save", loading: true });
save.render(save.state);
// <button ... disabled aria-disabled="true" aria-busy="true">
//   <span aria-hidden="true" class="obix-button__spinner"></span>Save
// </button>
```

## A toggle button

```ts
const bold = createButton({ label: "Bold", toggle: true, ariaPressed: false });
const pressed = bold.actions.toggle(bold.state);
bold.render(pressed); // aria-pressed="true"
```

## One-shot rendering

When you don't need to keep the artifact around (e.g. server-side templating), use `renderButton`:

```ts
import { renderButton } from "@obinexusltd/obix-component-button";

const html = renderButton({ label: "Delete", variant: "danger" });
```

See [api-reference.md](./api-reference.md) for the full config surface, [accessibility.md](./accessibility.md) for what each ARIA attribute means, and [styling.md](./styling.md) for the emitted class names.
