/**
 * @obinexusltd/obix-component-button
 *
 * The ObixButton primitive — a clickable action trigger with loading states,
 * toggle mode, and a WCAG 2.5.5 48×48 touch target.
 *
 * Data-Oriented: `createButton(config)` returns `{ name, state, actions, render }`.
 * Actions are pure `(state, ...args) => newState`; `render(state)` is deterministic
 * HTML. Zero dependencies.
 *
 * Spec: docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md § ObixButton.
 */
import type { ButtonConfig, ButtonState, DOPComponent } from "./types.js";

export type {
  Action,
  ButtonConfig,
  ButtonSize,
  ButtonState,
  ButtonType,
  ButtonVariant,
  DOPComponent,
} from "./types.js";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createButton(config: ButtonConfig): DOPComponent<ButtonState> {
  if (!config || typeof config.label !== "string" || config.label.length === 0) {
    throw new TypeError("[obix-component-button] createButton: `label` is required");
  }

  const loading = config.loading ?? false;
  const state: ButtonState = {
    label: config.label,
    variant: config.variant ?? "primary",
    size: config.size ?? "md",
    disabled: (config.disabled ?? false) || loading,
    loading,
    toggle: config.toggle ?? false,
    ariaLabel: config.ariaLabel ?? config.label,
    ariaPressed: config.ariaPressed ?? false,
    type: config.type ?? "button",
    touched: false,
    focused: false,
    minWidth: "48px",
    minHeight: "48px",
  };

  const actions = {
    click: (s: ButtonState): ButtonState => (s.disabled || s.loading ? s : { ...s, touched: true }),
    setLoading: (s: ButtonState, isLoading: boolean): ButtonState => ({
      ...s,
      loading: isLoading,
      disabled: isLoading || (config.disabled ?? false),
    }),
    toggle: (s: ButtonState): ButtonState =>
      !s.toggle || s.disabled || s.loading ? s : { ...s, ariaPressed: !s.ariaPressed, touched: true },
    setDisabled: (s: ButtonState, isDisabled: boolean): ButtonState => ({
      ...s,
      disabled: isDisabled || s.loading,
    }),
    focus: (s: ButtonState): ButtonState => ({ ...s, focused: true }),
    blur: (s: ButtonState): ButtonState => ({ ...s, focused: false, touched: true }),
  };

  const render = (s: ButtonState): string => {
    const attrs = [
      `class="obix-button obix-button--${s.variant} obix-button--${s.size}"`,
      `type="${s.type}"`,
      `aria-label="${esc(s.ariaLabel)}"`,
      `style="min-width:${s.minWidth};min-height:${s.minHeight}"`,
    ];
    if (s.disabled) attrs.push("disabled", `aria-disabled="true"`);
    if (s.loading) attrs.push(`aria-busy="true"`);
    if (s.toggle) attrs.push(`aria-pressed="${s.ariaPressed}"`);
    const spinner = s.loading ? `<span aria-hidden="true" class="obix-button__spinner"></span>` : "";
    return `<button ${attrs.join(" ")}>${spinner}${esc(s.label)}</button>`;
  };

  return { name: "ObixButton", state, actions, render };
}

/** Render a button's HTML in one call, optionally with state overrides. */
export function renderButton(config: ButtonConfig, overrides: Partial<ButtonState> = {}): string {
  const button = createButton(config);
  return button.render({ ...button.state, ...overrides });
}
