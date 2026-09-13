/**
 * @obinexusltd/obix-component-image
 *
 * The ObixImage primitive — a responsive image with lazy loading, aspect-ratio
 * (layout-shift prevention), and alt-text enforcement.
 *
 * Data-Oriented: `createImage(config)` returns `{ name, state, actions, render }`.
 * Actions are pure `(state, ...args) => newState`; `render(state)` is
 * deterministic HTML. Zero dependencies.
 *
 * Spec: docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md § ObixImage.
 */
import type { ImageConfig, ImageState, DOPComponent } from "./types.js";

export type {
  Action,
  DOPComponent,
  ImageConfig,
  ImageDecoding,
  ImageLoading,
  ImageObjectFit,
  ImageState,
} from "./types.js";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dim(value: string | number | undefined): string {
  if (value === undefined || value === "") return "";
  return typeof value === "number" ? String(value) : value;
}

export function createImage(config: ImageConfig): DOPComponent<ImageState> {
  if (!config || typeof config.src !== "string" || config.src.length === 0) {
    throw new TypeError("[obix-component-image] createImage: `src` is required");
  }
  if (typeof config.alt !== "string") {
    throw new TypeError("[obix-component-image] createImage: `alt` is required (use \"\" for decorative images)");
  }

  const state: ImageState = {
    src: config.src,
    alt: config.alt,
    width: dim(config.width),
    height: dim(config.height),
    loading: config.loading ?? "lazy",
    decoding: config.decoding ?? "auto",
    aspectRatio: config.aspectRatio ?? "",
    objectFit: config.objectFit ?? "cover",
    sizes: config.sizes ?? "",
    srcSet: config.srcSet ?? "",
    loaded: false,
    errored: false,
  };

  const actions = {
    setLoading: (s: ImageState, eager: boolean): ImageState => ({
      ...s,
      loading: eager ? "eager" : "lazy",
    }),
    updateSrc: (s: ImageState, src: string): ImageState => ({ ...s, src, loaded: false, errored: false }),
    updateAlt: (s: ImageState, alt: string): ImageState => ({ ...s, alt }),
    onLoad: (s: ImageState): ImageState => ({ ...s, loaded: true, errored: false }),
    onError: (s: ImageState): ImageState => ({ ...s, loaded: false, errored: true }),
  };

  const render = (s: ImageState): string => {
    const style = [
      s.aspectRatio && `aspect-ratio:${s.aspectRatio}`,
      `object-fit:${s.objectFit}`,
    ]
      .filter(Boolean)
      .join(";");
    const attrs = [
      `src="${esc(s.src)}"`,
      `alt="${esc(s.alt)}"`,
      s.width && `width="${esc(s.width)}"`,
      s.height && `height="${esc(s.height)}"`,
      `loading="${s.loading}"`,
      `decoding="${s.decoding}"`,
      s.srcSet && `srcset="${esc(s.srcSet)}"`,
      s.sizes && `sizes="${esc(s.sizes)}"`,
      style && `style="${style}"`,
      s.alt === "" && `role="presentation"`,
    ].filter(Boolean);
    return `<img ${attrs.join(" ")}>`;
  };

  return { name: "ObixImage", state, actions, render };
}

/** Render an image's HTML in one call, optionally with state overrides. */
export function renderImage(config: ImageConfig, overrides: Partial<ImageState> = {}): string {
  const image = createImage(config);
  return image.render({ ...image.state, ...overrides });
}
