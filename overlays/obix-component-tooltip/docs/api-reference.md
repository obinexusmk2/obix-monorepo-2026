# API Reference — `@obinexusltd/obix-component-tooltip`

## `createTooltip(config: TooltipConfig): DOPComponent<TooltipState>`

Throws `TypeError` if `trigger` or `content` is missing/empty.

```ts
import { createTooltip } from "@obinexusltd/obix-component-tooltip";

const tooltip = createTooltip({ trigger: "?", content: "Your password must be at least 12 characters." });
tooltip.render(tooltip.state);
```

## `renderTooltip(config: TooltipConfig, overrides?: Partial<TooltipState>): string`

One-shot create + render.

## `TooltipConfig`

| Field | Type | Default | Notes |
|---|---|---|---|
| `trigger` | `string` | — | **Required.** The trigger's visible text (e.g. `"?"`). |
| `content` | `string` | — | **Required.** Escaped on render — keep it short. |
| `placement` | `TooltipPlacement` | `"top"` | `"top" \| "bottom" \| "left" \| "right"` |
| `activateOn` | `TooltipActivateOn` | `"hover"` | `"hover" \| "focus" \| "click"` |
| `delay` | `number` | `0` | ms before showing; clamped to `>= 0`. |
| `closeDelay` | `number` | `200` | ms before hiding; clamped to `>= 0`. |
| `ariaLabel` | `string` | `""` | Optional override for the trigger's accessible name. |
| `visible` | `boolean` | `false` | Initial visibility. |
| `id` | `string` | `"obix-tooltip"` | DOM id of the tooltip element — set a unique value per instance. |

## `TooltipState`

`TooltipConfig`'s resolved fields, all concrete (no optional fields left unresolved).

## Actions

| Action | Signature | Behaviour |
|---|---|---|
| `show` | `(s) => s` | `visible: true`. |
| `hide` | `(s) => s` | `visible: false`. |
| `toggle` | `(s) => s` | Flips `visible`. |

## Render shape

`render(state)` returns **two** sibling elements concatenated: the trigger `<span>` and the tooltip `<div>` — see [architecture.md](./architecture.md) for why they're linked by id rather than nested.

## Exported types

`Action<S>`, `DOPComponent<S>`, `TooltipActivateOn`, `TooltipConfig`, `TooltipPlacement`, `TooltipState`.
