/**
 * @obinexusltd/obix-component-modal
 *
 * The ObixModal primitive — a dialog with `role="dialog"`, `aria-modal`, a
 * title linked via `aria-labelledby`, and configurable escape / backdrop close
 * behaviour (emitted as data attributes — wire the handlers yourself).
 *
 * Data-Oriented: `createModal(config)` returns `{ name, state, actions, render }`.
 * Actions are pure `(state) => newState`; `render(state)` is deterministic HTML
 * (empty string while closed). Zero dependencies.
 *
 * Spec: docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md § ObixModal.
 */
import type { ModalConfig, ModalState, DOPComponent } from "./types.js";

export type {
  Action,
  DOPComponent,
  ModalAction,
  ModalBackdrop,
  ModalConfig,
  ModalSize,
  ModalState,
} from "./types.js";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createModal(config: ModalConfig): DOPComponent<ModalState> {
  if (!config || typeof config.title !== "string" || config.title.length === 0) {
    throw new TypeError("[obix-component-modal] createModal: `title` is required");
  }

  const state: ModalState = {
    title: config.title,
    content: config.content ?? "",
    isOpen: config.open ?? false,
    closeOnEscape: config.closeOnEscape ?? true,
    closeOnBackdropClick: config.closeOnBackdropClick ?? true,
    size: config.size ?? "md",
    centered: config.centered ?? true,
    backdrop: config.backdrop ?? "dark",
    actions: [...(config.actions ?? [])],
    id: config.id ?? "obix-modal",
  };

  const actions = {
    open: (s: ModalState): ModalState => ({ ...s, isOpen: true }),
    close: (s: ModalState): ModalState => ({ ...s, isOpen: false }),
    toggle: (s: ModalState): ModalState => ({ ...s, isOpen: !s.isOpen }),
  };

  const render = (s: ModalState): string => {
    if (!s.isOpen) return "";
    const titleId = `${s.id}-title`;
    const buttons = s.actions
      .map((a) => {
        const variant = a.variant ?? "secondary";
        const dataAction = a.action ? ` data-action="${esc(a.action)}"` : "";
        return `<button type="button" class="obix-button obix-button--${variant}"${dataAction}>${esc(a.label)}</button>`;
      })
      .join("");
    const actionsBlock = buttons ? `<div class="obix-modal-actions">${buttons}</div>` : "";
    return (
      `<div class="obix-modal-backdrop" data-backdrop="${s.backdrop}"` +
      ` data-close-on-backdrop="${s.closeOnBackdropClick}">` +
      `<div class="obix-modal obix-modal--${s.size}${s.centered ? " obix-modal--centered" : ""}"` +
      ` role="dialog" aria-modal="true" aria-labelledby="${titleId}"` +
      ` data-close-on-escape="${s.closeOnEscape}">` +
      `<h2 id="${titleId}" class="obix-modal__title">${esc(s.title)}</h2>` +
      `<div class="obix-modal__body">${s.content}</div>` +
      actionsBlock +
      `</div></div>`
    );
  };

  return { name: "ObixModal", state, actions, render };
}

/** Render a modal's HTML in one call, optionally with state overrides. */
export function renderModal(config: ModalConfig, overrides: Partial<ModalState> = {}): string {
  const modal = createModal(config);
  return modal.render({ ...modal.state, ...overrides });
}
