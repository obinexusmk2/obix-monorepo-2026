/**
 * @obinexusltd/obix-component-button — types.
 * Mirrors docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md § ObixButton.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonType = "button" | "submit" | "reset";

export interface ButtonConfig {
  /** Button text (required). */
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Toggleable (aria-pressed) button. */
  toggle?: boolean;
  /** Falls back to `label`. */
  ariaLabel?: string;
  ariaPressed?: boolean;
  type?: ButtonType;
}

export interface ButtonState {
  label: string;
  variant: ButtonVariant;
  size: ButtonSize;
  disabled: boolean;
  loading: boolean;
  toggle: boolean;
  ariaLabel: string;
  ariaPressed: boolean;
  type: ButtonType;
  touched: boolean;
  focused: boolean;
  /** WCAG 2.5.5 touch target — always 48px. */
  minWidth: string;
  minHeight: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** A pure state transition — never mutates its input. */
export type Action<S> = (state: S, ...args: any[]) => S;

/** The Data-Oriented component contract (state + actions + deterministic render). */
export interface DOPComponent<S> {
  name: string;
  state: S;
  actions: Record<string, Action<S>>;
  render: (state: S) => string;
}
