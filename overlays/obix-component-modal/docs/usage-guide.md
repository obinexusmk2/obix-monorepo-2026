# Usage Guide — `@obinexusltd/obix-component-modal`

## Install

```bash
npm install @obinexusltd/obix-component-modal
```

Zero runtime dependencies.

## Quick start

```ts
import { createModal } from "@obinexusltd/obix-component-modal";

let modal = createModal({ title: "Welcome", content: "<p>Thanks for signing up.</p>" });
let state = modal.state;

function render() {
  document.querySelector("#modal-slot")!.innerHTML = modal.render(state);
}

function open() { state = modal.actions.open(state); render(); }
function close() { state = modal.actions.close(state); render(); }
```

## Wiring escape / backdrop close yourself

This package renders `data-close-on-escape` / `data-close-on-backdrop` attributes but does **not** attach any event listeners — you own the interaction:

```ts
document.addEventListener("keydown", (e) => {
  const el = document.querySelector(".obix-modal");
  if (e.key === "Escape" && el?.getAttribute("data-close-on-escape") === "true") close();
});

document.querySelector("#modal-slot")!.addEventListener("click", (e) => {
  const backdrop = (e.target as HTMLElement).closest(".obix-modal-backdrop");
  if (backdrop && (e.target as HTMLElement) === backdrop && backdrop.getAttribute("data-close-on-backdrop") === "true") {
    close();
  }
});
```

## Footer actions

```ts
createModal({
  title: "Delete item?",
  actions: [
    { label: "Cancel", action: "cancel" },
    { label: "Delete", variant: "danger", action: "confirm" },
  ],
});
```

Each button renders `data-action="..."` — delegate a click listener on the modal container and switch on `event.target.dataset.action` to trigger `close()` (for cancel) or your delete logic (for confirm).

## Multiple modal instances

Give each a distinct `id` so `aria-labelledby` targets don't collide when more than one modal type exists on the page:

```ts
createModal({ id: "delete-confirm-modal", title: "Delete?" });
createModal({ id: "share-modal", title: "Share this" });
```

See [api-reference.md](./api-reference.md) for the full config and [accessibility.md](./accessibility.md) for the dialog semantics.
