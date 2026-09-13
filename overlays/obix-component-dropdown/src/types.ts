/**
 * @obinexusltd/obix-component-dropdown — types.
 * Mirrors docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md § ObixDropdown.
 *
 * Note: the doc lists `trigger` twice. Here the trigger *button* is `trigger`
 * and the *interaction* ("click"/"hover") is `activateOn`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type DropdownPlacement = "top" | "bottom" | "left" | "right";
export type DropdownActivateOn = "click" | "hover";

export interface DropdownTrigger {
  label: string;
  icon?: string;
}

export interface DropdownItem {
  label?: string;
  /** Machine-readable id emitted as `data-action`; wire the handler yourself. */
  action?: string;
  disabled?: boolean;
  /** Visual separator — renders `<li role="separator">`, ignores other fields. */
  divider?: boolean;
}

export interface DropdownConfig {
  trigger: DropdownTrigger;
  items: DropdownItem[];
  placement?: DropdownPlacement;
  activateOn?: DropdownActivateOn;
  closeOnClick?: boolean;
  ariaLabel?: string;
  open?: boolean;
  /** DOM id root — `${id}-menu` links the trigger via aria-controls. */
  id?: string;
}

export interface DropdownState {
  trigger: DropdownTrigger;
  items: DropdownItem[];
  placement: DropdownPlacement;
  activateOn: DropdownActivateOn;
  closeOnClick: boolean;
  ariaLabel: string;
  isOpen: boolean;
  focusedIndex: number;
  id: string;
}

export type Action<S> = (state: S, ...args: any[]) => S;

export interface DOPComponent<S> {
  name: string;
  state: S;
  actions: Record<string, Action<S>>;
  render: (state: S) => string;
}
