# Architecture — `@obinexusltd/obix-component-dropdown`

## DOP contract

`{ name: "ObixDropdown", state, actions, render }` — the shared contract described in the button package's [architecture.md](../../../primitives/obix-component-button/docs/architecture.md).

## `step()` — the one function all navigation routes through

```ts
function step(items: DropdownItem[], from: number, dir: 1 | -1): number
```

`focusNext`, `focusPrev`, and `open`'s initial-focus computation all call `step()` rather than each re-implementing "find the next selectable index." `step` walks the list starting one position past `from` in direction `dir`, wrapping with modulo arithmetic, and returns the first index where `selectable(item)` is true (not a divider, not disabled) — or `from` unchanged if nothing in the list is selectable at all (avoiding an infinite loop or an out-of-range index on an all-disabled/all-divider list).

## Why `focusedIndex` lives in state, not derived at render time

Unlike `obix-component-link`'s aria-label (computed fresh every render), `focusedIndex` genuinely is state — it changes independently of the other fields via keyboard navigation, and two different `DropdownState` values with identical `items`/`trigger` but different `focusedIndex` must render different `aria-activedescendant` output. It cannot be derived from anything else in the state.

## Zero dependencies

`src/index.ts` imports only `./types.js`; `esc()` and `step()` are local.
