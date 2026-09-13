/**
 * @obinexusltd/obix-component-card — types.
 * Mirrors docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md § ObixCard.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CardImage {
  src: string;
  alt: string;
}

export interface CardConfig {
  title?: string;
  /** Trusted HTML content — not escaped by `render`. */
  content?: string;
  interactive?: boolean;
  image?: CardImage;
  loading?: boolean;
  /** Explicit dimensions prevent Cumulative Layout Shift. */
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  aspectRatio?: string;
}

export interface CardState {
  title: string;
  content: string;
  interactive: boolean;
  image: CardImage | null;
  loading: boolean;
  showSkeleton: boolean;
  width: string;
  height: string;
  minWidth: string;
  minHeight: string;
  aspectRatio: string;
  loadingProgress: number;
  contentReady: boolean;
}

export type Action<S> = (state: S, ...args: any[]) => S;

export interface DOPComponent<S> {
  name: string;
  state: S;
  actions: Record<string, Action<S>>;
  render: (state: S) => string;
}
