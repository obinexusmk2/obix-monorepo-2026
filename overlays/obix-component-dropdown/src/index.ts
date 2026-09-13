/**
 * @obinexusltd/obix-component-dropdown
 *
 * The ObixDropdown overlay — a menu / picker with `role="menu"`,
 * `aria-haspopup` / `aria-expanded` on the trigger, and pure keyboard-navigation
 * transitions (`focusNext` / `focusPrev` skip dividers and disabled items).
 *
 * Data-Oriented: `createDropdown(config)` returns `{ name, state, actions, render }`.
 * Actions are pure; `render(state)` is deterministic HTML. Zero dependencies.
 *
 * Spec: docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md § ObixDropdown.
 */
import type { DropdownConfig, DropdownItem, DropdownState, DOPComponent } from "./types.js";

export type {
  Action,
  DOPComponent,
  DropdownActivateOn,
  DropdownConfig,
  DropdownItem,
  DropdownPlacement,
  DropdownState,
  DropdownTrigger,
} from "./types.js";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const selectable = (item: DropdownItem): boolean => !item.divider && !item.disabled;

function step(items: DropdownItem[], from: number, dir: 1 | -1): number {
  const n = items.length;
  if (n === 0) return -1;
  for (let i = 1; i <= n; i++) {
    const idx = (((from + dir * i) % n) + n) % n;
    if (selectable(items[idx]!)) return idx;
  }
  return from;
}

export function createDropdown(config: DropdownConfig): DOPComponent<DropdownState> {
  if (!config || !config.trigger || typeof config.trigger.label !== "string") {
    throw new TypeError("[obix-component-dropdown] createDropdown: `trigger.label` is required");
  }
  if (!Array.isArray(config.items)) {
    throw new TypeError("[obix-component-dropdown] createDropdown: `items` must be an array");
  }

  const state: DropdownState = {
    trigger: { label: config.trigger.label, icon: config.trigger.icon },
    items: [...config.items],
    placement: config.placement ?? "bottom",
    activateOn: config.activateOn ?? "click",
    closeOnClick: config.closeOnClick ?? true,
    ariaLabel: config.ariaLabel ?? config.trigger.label,
    isOpen: config.open ?? false,
    focusedIndex: -1,
    id: config.id ?? "obix-dropdown",
  };

  const actions = {
    open: (s: DropdownState): DropdownState => ({ ...s, isOpen: true, focusedIndex: step(s.items, -1, 1) }),
    close: (s: DropdownState): DropdownState => ({ ...s, isOpen: false, focusedIndex: -1 }),
    toggle: (s: DropdownState): DropdownState =>
      s.isOpen ? { ...s, isOpen: false, focusedIndex: -1 } : { ...s, isOpen: true, focusedIndex: step(s.items, -1, 1) },
    selectItem: (s: DropdownState, index: number): DropdownState => {
      const item = s.items[index];
      if (!item || !selectable(item)) return s;
      return { ...s, focusedIndex: index, isOpen: s.closeOnClick ? false : s.isOpen };
    },
    focusItem: (s: DropdownState, index: number): DropdownState =>
      s.items[index] && selectable(s.items[index]!) ? { ...s, focusedIndex: index } : s,
    focusNext: (s: DropdownState): DropdownState => ({ ...s, focusedIndex: step(s.items, s.focusedIndex, 1) }),
    focusPrev: (s: DropdownState): DropdownState => ({ ...s, focusedIndex: step(s.items, s.focusedIndex, -1) }),
  };

  const render = (s: DropdownState): string => {
    const menuId = `${s.id}-menu`;
    const icon = s.trigger.icon ? ` <span class="obix-dropdown__icon" aria-hidden="true">${esc(s.trigger.icon)}</span>` : "";
    const trigger =
      `<button type="button" class="obix-dropdown__trigger" aria-label="${esc(s.ariaLabel)}"` +
      ` aria-haspopup="true" aria-expanded="${s.isOpen}" aria-controls="${menuId}">` +
      `${esc(s.trigger.label)}${icon}</button>`;

    const items = s.items
      .map((item, i) => {
        if (item.divider) return `<li role="separator" class="obix-dropdown-menu__divider"></li>`;
        const itemId = `${s.id}-item-${i}`;
        const attrs = item.disabled ? " disabled aria-disabled=\"true\"" : "";
        const data = item.action ? ` data-action="${esc(item.action)}"` : "";
        return (
          `<li role="menuitem" id="${itemId}"${i === s.focusedIndex ? ' class="is-focused"' : ""}>` +
          `<button type="button"${attrs}${data}>${esc(item.label ?? "")}</button></li>`
        );
      })
      .join("");

    const activedescendant =
      s.isOpen && s.focusedIndex >= 0 ? ` aria-activedescendant="${s.id}-item-${s.focusedIndex}"` : "";
    const menu =
      `<ul id="${menuId}" role="menu" class="obix-dropdown-menu obix-dropdown-menu--${s.placement}"` +
      `${s.isOpen ? "" : " hidden"}${activedescendant}>${items}</ul>`;

    return `<div class="obix-dropdown" data-activate-on="${s.activateOn}">${trigger}${menu}</div>`;
  };

  return { name: "ObixDropdown", state, actions, render };
}

/** Render a dropdown's HTML in one call, optionally with state overrides. */
export function renderDropdown(config: DropdownConfig, overrides: Partial<DropdownState> = {}): string {
  const dropdown = createDropdown(config);
  return dropdown.render({ ...dropdown.state, ...overrides });
}
