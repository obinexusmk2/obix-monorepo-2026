/**
 * @obinexusltd/obix-component-tooltip
 *
 * The ObixTooltip overlay — hover / focus information with `role="tooltip"`, a
 * trigger linked via `aria-describedby`, and show/hide/close-delay hooks emitted
 * as data attributes.
 *
 * Data-Oriented: `createTooltip(config)` returns `{ name, state, actions, render }`.
 * Actions are pure `(state) => newState`; `render(state)` is deterministic HTML.
 * Zero dependencies.
 *
 * Spec: docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md § ObixTooltip.
 */
import type { TooltipConfig, TooltipState, DOPComponent } from "./types.js";

export type {
  Action,
  DOPComponent,
  TooltipActivateOn,
  TooltipConfig,
  TooltipPlacement,
  TooltipState,
} from "./types.js";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createTooltip(config: TooltipConfig): DOPComponent<TooltipState> {
  if (!config || typeof config.trigger !== "string" || config.trigger.length === 0) {
    throw new TypeError("[obix-component-tooltip] createTooltip: `trigger` (text) is required");
  }
  if (typeof config.content !== "string" || config.content.length === 0) {
    throw new TypeError("[obix-component-tooltip] createTooltip: `content` is required");
  }

  const state: TooltipState = {
    trigger: config.trigger,
    content: config.content,
    placement: config.placement ?? "top",
    activateOn: config.activateOn ?? "hover",
    delay: Math.max(0, config.delay ?? 0),
    closeDelay: Math.max(0, config.closeDelay ?? 200),
    ariaLabel: config.ariaLabel ?? "",
    visible: config.visible ?? false,
    id: config.id ?? "obix-tooltip",
  };

  const actions = {
    show: (s: TooltipState): TooltipState => ({ ...s, visible: true }),
    hide: (s: TooltipState): TooltipState => ({ ...s, visible: false }),
    toggle: (s: TooltipState): TooltipState => ({ ...s, visible: !s.visible }),
  };

  const render = (s: TooltipState): string => {
    const label = s.ariaLabel ? ` aria-label="${esc(s.ariaLabel)}"` : "";
    const trigger =
      `<span class="obix-tooltip-trigger" tabindex="0" aria-describedby="${s.id}"` +
      ` data-activate-on="${s.activateOn}" data-delay="${s.delay}" data-close-delay="${s.closeDelay}"${label}>` +
      `${esc(s.trigger)}</span>`;
    const tip =
      `<div id="${s.id}" role="tooltip" class="obix-tooltip obix-tooltip--${s.placement}"` +
      `${s.visible ? "" : " hidden"}>${esc(s.content)}</div>`;
    return `${trigger}${tip}`;
  };

  return { name: "ObixTooltip", state, actions, render };
}

/** Render a tooltip's HTML in one call, optionally with state overrides. */
export function renderTooltip(config: TooltipConfig, overrides: Partial<TooltipState> = {}): string {
  const tooltip = createTooltip(config);
  return tooltip.render({ ...tooltip.state, ...overrides });
}
