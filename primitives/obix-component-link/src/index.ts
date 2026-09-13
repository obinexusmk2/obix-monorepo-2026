/**
 * @obinexusltd/obix-component-link
 *
 * The ObixLink primitive — a semantic anchor with external-link indication and
 * safe `rel` defaults.
 *
 * Data-Oriented: `createLink(config)` returns `{ name, state, actions, render }`.
 * Actions are pure `(state, ...args) => newState`; `render(state)` is
 * deterministic HTML. Zero dependencies.
 *
 * Spec: docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md § ObixLink.
 */
import type { LinkConfig, LinkState, DOPComponent } from "./types.js";

export type { Action, DOPComponent, LinkConfig, LinkState, LinkTarget } from "./types.js";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function looksExternal(href: string): boolean {
  return /^([a-z][a-z0-9+.-]*:)?\/\//i.test(href) && !href.startsWith("/");
}

function computeAriaLabel(s: {
  ariaLabel: string;
  label: string;
  external: boolean;
  target: string;
  download: string;
}): string {
  if (s.ariaLabel) return s.ariaLabel;
  if (s.download) return `${s.label} (download)`;
  if (s.external && s.target === "_blank") return `${s.label} (opens in a new window)`;
  if (s.external) return `${s.label} (external link)`;
  return s.label;
}

export function createLink(config: LinkConfig): DOPComponent<LinkState> {
  if (!config || typeof config.href !== "string" || config.href.length === 0) {
    throw new TypeError("[obix-component-link] createLink: `href` is required");
  }
  if (typeof config.label !== "string" || config.label.length === 0) {
    throw new TypeError("[obix-component-link] createLink: `label` is required");
  }

  const target: LinkState["target"] = config.target ?? "_self";
  const external = config.external ?? looksExternal(config.href);
  const rel = config.rel ?? (target === "_blank" ? "noopener noreferrer" : "");

  const state: LinkState = {
    href: config.href,
    label: config.label,
    target,
    rel,
    external,
    download: config.download ?? "",
    ariaLabel: config.ariaLabel ?? "",
    visited: config.visited ?? false,
  };

  const actions = {
    navigate: (s: LinkState): LinkState => ({ ...s, visited: true }),
    setExternal: (s: LinkState, isExternal: boolean): LinkState => ({
      ...s,
      external: isExternal,
      rel: isExternal && s.target === "_blank" && !s.rel ? "noopener noreferrer" : s.rel,
    }),
    updateHref: (s: LinkState, href: string): LinkState => ({
      ...s,
      href,
      external: config.external ?? looksExternal(href),
    }),
  };

  const render = (s: LinkState): string => {
    const attrs = [
      `class="obix-link${s.external ? " obix-link--external" : ""}${s.visited ? " obix-link--visited" : ""}"`,
      `href="${esc(s.href)}"`,
      s.target !== "_self" && `target="${s.target}"`,
      s.rel && `rel="${esc(s.rel)}"`,
      s.download && `download="${esc(s.download)}"`,
      `aria-label="${esc(computeAriaLabel(s))}"`,
    ].filter(Boolean);
    const indicator = s.external
      ? `<span class="obix-link__external" aria-hidden="true">↗</span>`
      : "";
    return `<a ${attrs.join(" ")}>${esc(s.label)}${indicator}</a>`;
  };

  return { name: "ObixLink", state, actions, render };
}

/** Render a link's HTML in one call, optionally with state overrides. */
export function renderLink(config: LinkConfig, overrides: Partial<LinkState> = {}): string {
  const link = createLink(config);
  return link.render({ ...link.state, ...overrides });
}
