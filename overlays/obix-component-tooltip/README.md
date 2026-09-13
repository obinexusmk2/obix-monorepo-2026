# @obinexusltd/obix-component-tooltip

**The `ObixTooltip` overlay** — hover / focus information with `role="tooltip"`,
a trigger linked via `aria-describedby`, and show / delay / close-delay hooks
emitted as `data-*` attributes.

Split out of `@obinexusltd/obix-component-overlays` as an independent package.

```bash
npm install @obinexusltd/obix-component-tooltip
```

> **Zero dependencies.** Data-Oriented: `{ name, state, actions, render }`.
> Actions are pure `(state) => newState`; `render(state)` is deterministic HTML.
> Spec: `docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md` § ObixTooltip.
> (The doc lists `trigger` twice; here `trigger` is the trigger's visible text
> and the interaction is `activateOn`.)

## API

```ts
import { createTooltip, renderTooltip } from "@obinexusltd/obix-component-tooltip";

const help = createTooltip({
  trigger: "?",
  content: "Enter your email address to receive updates",
  placement: "right",
  delay: 200,
  closeDelay: 500,
  id: "email-help",
});

help.render(help.state);
// <span class="obix-tooltip-trigger" tabindex="0" aria-describedby="email-help"
//       data-activate-on="hover" data-delay="200" data-close-delay="500">?</span>
// <div id="email-help" role="tooltip" class="obix-tooltip obix-tooltip--right" hidden>
//   Enter your email address to receive updates</div>

help.render(help.actions.show(help.state)); // same, without `hidden`
```

### `createTooltip(config)`

| config | type | default |
|---|---|---|
| `trigger` | `string` (visible text) | **required** |
| `content` | `string` (escaped on render) | **required** |
| `placement` | `"top" \| "bottom" \| "left" \| "right"` | `"top"` |
| `activateOn` | `"hover" \| "focus" \| "click"` | `"hover"` |
| `delay` / `closeDelay` | `number` (ms) | `0` / `200` |
| `ariaLabel` | `string` | — |
| `visible` | `boolean` | `false` |
| `id` | `string` | `"obix-tooltip"` — set a unique value per instance |

### Actions — `tooltip.actions.*(state) → TooltipState`

`show` · `hide` · `toggle`

## Accessibility

- `role="tooltip"` on the bubble · trigger `tabindex="0"` +
  `aria-describedby="{id}"` · `hidden` while not visible ·
  `data-close-delay` so pointer-out does not trap the user · `content` HTML-escaped

To attach the tooltip to an existing element instead of the rendered
`<span>`, reuse the emitted `id` as that element's `aria-describedby`.

## Related overlays

`@obinexusltd/obix-component-`[`modal`](../obix-component-modal) ·
[`dropdown`](../obix-component-dropdown)
