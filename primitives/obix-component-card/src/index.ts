/**
 * @obinexusltd/obix-component-card
 *
 * The ObixCard primitive — a content container with explicit dimensions for
 * Cumulative Layout Shift (CLS) prevention and a loading skeleton.
 *
 * Data-Oriented: `createCard(config)` returns `{ name, state, actions, render }`.
 * Actions are pure `(state, ...args) => newState`; `render(state)` is
 * deterministic HTML. Zero dependencies.
 *
 * Spec: docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md § ObixCard.
 */
import type { CardConfig, CardState, DOPComponent } from "./types.js";

export type { Action, CardConfig, CardImage, CardState, DOPComponent } from "./types.js";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createCard(config: CardConfig = {}): DOPComponent<CardState> {
  const loading = config.loading ?? false;
  const state: CardState = {
    title: config.title ?? "",
    content: config.content ?? "",
    interactive: config.interactive ?? false,
    image: config.image ?? null,
    loading,
    showSkeleton: loading,
    width: config.width ?? "100%",
    height: config.height ?? "auto",
    minWidth: config.minWidth ?? "",
    minHeight: config.minHeight ?? "",
    aspectRatio: config.aspectRatio ?? "",
    loadingProgress: loading ? 0 : 100,
    contentReady: !loading,
  };

  const actions = {
    startLoading: (s: CardState): CardState => ({
      ...s,
      loading: true,
      showSkeleton: true,
      contentReady: false,
      loadingProgress: 0,
    }),
    finishLoading: (s: CardState, content: string): CardState => ({
      ...s,
      content,
      loading: false,
      showSkeleton: false,
      contentReady: true,
      loadingProgress: 100,
    }),
    setDimensions: (s: CardState, width: string, height: string): CardState => ({
      ...s,
      width,
      height,
    }),
    updateContent: (s: CardState, content: string): CardState => ({
      ...s,
      content,
      contentReady: true,
    }),
  };

  const render = (s: CardState): string => {
    const style = [
      s.width && `width:${s.width}`,
      s.height && s.height !== "auto" && `height:${s.height}`,
      s.minWidth && `min-width:${s.minWidth}`,
      s.minHeight && `min-height:${s.minHeight}`,
      s.aspectRatio && `aspect-ratio:${s.aspectRatio}`,
    ]
      .filter(Boolean)
      .join(";");
    const open = `<article class="obix-card${s.interactive ? " obix-card--interactive" : ""}"${
      style ? ` style="${style}"` : ""
    }${s.showSkeleton ? ` aria-busy="true"` : ""}>`;

    if (s.showSkeleton) {
      return `${open}<div class="obix-card__skeleton" aria-hidden="true"></div></article>`;
    }

    const figure = s.image
      ? `<figure class="obix-card__media"><img src="${esc(s.image.src)}" alt="${esc(s.image.alt)}"></figure>`
      : "";
    const heading = s.title ? `<h3 class="obix-card__title">${esc(s.title)}</h3>` : "";
    const body = s.content ? `<div class="obix-card__body">${s.content}</div>` : "";
    return `${open}${figure}${heading}${body}</article>`;
  };

  return { name: "ObixCard", state, actions, render };
}

/** Render a card's HTML in one call, optionally with state overrides. */
export function renderCard(config: CardConfig = {}, overrides: Partial<CardState> = {}): string {
  const card = createCard(config);
  return card.render({ ...card.state, ...overrides });
}
