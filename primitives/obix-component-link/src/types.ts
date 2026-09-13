/**
 * @obinexusltd/obix-component-link — types.
 * Mirrors docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md § ObixLink.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type LinkTarget = "_blank" | "_self" | "_parent" | "_top";

export interface LinkConfig {
  /** URL (required). */
  href: string;
  /** Link text (required). */
  label: string;
  target?: LinkTarget;
  /** Defaults to "noopener noreferrer" when the link opens in a new tab. */
  rel?: string;
  /** Auto-detected from the protocol when omitted. */
  external?: boolean;
  /** Filename — turns the link into a download. */
  download?: string;
  ariaLabel?: string;
  visited?: boolean;
}

export interface LinkState {
  href: string;
  label: string;
  target: LinkTarget;
  rel: string;
  external: boolean;
  download: string;
  ariaLabel: string;
  visited: boolean;
}

export type Action<S> = (state: S, ...args: any[]) => S;

export interface DOPComponent<S> {
  name: string;
  state: S;
  actions: Record<string, Action<S>>;
  render: (state: S) => string;
}
