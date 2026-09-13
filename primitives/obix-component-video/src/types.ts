/**
 * @obinexusltd/obix-component-video — types.
 * Mirrors docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md § ObixVideo.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type TrackKind = "captions" | "subtitles" | "descriptions";

export interface VideoTrack {
  kind: TrackKind;
  /** VTT file URL. */
  src: string;
  /** e.g. "en", "es". */
  srcLang: string;
  /** e.g. "English". */
  label: string;
  default?: boolean;
}

export interface VideoConfig {
  /** Video URL (required). */
  src: string;
  poster?: string;
  controls?: boolean;
  autoplay?: boolean;
  /** Forced on when `autoplay` is set. */
  muted?: boolean;
  loop?: boolean;
  width?: string | number;
  height?: string | number;
  tracks?: VideoTrack[];
  /** Full transcript text or a URL. */
  transcript?: string;
  ariaLabel?: string;
}

export interface VideoState {
  src: string;
  poster: string;
  controls: boolean;
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  width: string;
  height: string;
  tracks: VideoTrack[];
  transcript: string;
  ariaLabel: string;
  playing: boolean;
  volume: number;
  currentTime: number;
  activeCaptions: string | null;
}

export type Action<S> = (state: S, ...args: any[]) => S;

export interface DOPComponent<S> {
  name: string;
  state: S;
  actions: Record<string, Action<S>>;
  render: (state: S) => string;
}
