/**
 * @obinexusltd/obix-component-tooltip — types.
 * Mirrors docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md § ObixTooltip.
 *
 * Note: the doc lists `trigger` twice. Here `trigger` is the trigger's visible
 * text and the interaction ("hover"/"focus"/"click") is `activateOn`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type TooltipPlacement = "top" | "bottom" | "left" | "right";
export type TooltipActivateOn = "hover" | "focus" | "click";

export interface TooltipConfig {
  /** The trigger's visible text (e.g. "?"). */
  trigger: string;
  /** Tooltip text (escaped on render — keep it short). */
  content: string;
  placement?: TooltipPlacement;
  activateOn?: TooltipActivateOn;
  /** ms before showing. */
  delay?: number;
  /** ms before hiding. */
  closeDelay?: number;
  ariaLabel?: string;
  visible?: boolean;
  /** DOM id of the tooltip element — the trigger's `aria-describedby`. */
  id?: string;
}

export interface TooltipState {
  trigger: string;
  content: string;
  placement: TooltipPlacement;
  activateOn: TooltipActivateOn;
  delay: number;
  closeDelay: number;
  ariaLabel: string;
  visible: boolean;
  id: string;
}

export type Action<S> = (state: S, ...args: any[]) => S;

export interface DOPComponent<S> {
  name: string;
  state: S;
  actions: Record<string, Action<S>>;
  render: (state: S) => string;
}
