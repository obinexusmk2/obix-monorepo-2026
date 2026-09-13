/**
 * @obinexusltd/obix-component-modal — types.
 * Mirrors docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md § ObixModal.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ModalSize = "sm" | "md" | "lg";
export type ModalBackdrop = "dark" | "light" | "blur";

export interface ModalAction {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  /** Machine-readable id emitted as `data-action`; wire the handler yourself. */
  action?: string;
}

export interface ModalConfig {
  /** Modal title (required). */
  title: string;
  /** Trusted HTML body content. */
  content?: string;
  open?: boolean;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  size?: ModalSize;
  centered?: boolean;
  backdrop?: ModalBackdrop;
  actions?: ModalAction[];
  /** DOM id root — `${id}-title` links the heading. Set a unique value per instance. */
  id?: string;
}

export interface ModalState {
  title: string;
  content: string;
  isOpen: boolean;
  closeOnEscape: boolean;
  closeOnBackdropClick: boolean;
  size: ModalSize;
  centered: boolean;
  backdrop: ModalBackdrop;
  actions: ModalAction[];
  id: string;
}

export type Action<S> = (state: S, ...args: any[]) => S;

export interface DOPComponent<S> {
  name: string;
  state: S;
  actions: Record<string, Action<S>>;
  render: (state: S) => string;
}
