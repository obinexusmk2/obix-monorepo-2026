/**
 * @obinexusltd/obix-component-video
 *
 * The ObixVideo primitive — an accessible media player with native caption
 * tracks, a transcript link, and keyboard controls.
 *
 * Data-Oriented: `createVideo(config)` returns `{ name, state, actions, render }`.
 * Actions are pure `(state, ...args) => newState`; `render(state)` is
 * deterministic HTML. Zero dependencies.
 *
 * Spec: docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md § ObixVideo.
 */
import type { VideoConfig, VideoState, DOPComponent } from "./types.js";

export type {
  Action,
  DOPComponent,
  TrackKind,
  VideoConfig,
  VideoState,
  VideoTrack,
} from "./types.js";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mimeFor(src: string): string {
  if (/\.webm(\?|#|$)/i.test(src)) return "video/webm";
  if (/\.og[gv](\?|#|$)/i.test(src)) return "video/ogg";
  return "video/mp4";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function createVideo(config: VideoConfig): DOPComponent<VideoState> {
  if (!config || typeof config.src !== "string" || config.src.length === 0) {
    throw new TypeError("[obix-component-video] createVideo: `src` is required");
  }
  const autoplay = config.autoplay ?? false;
  const defaultCaption =
    config.tracks?.find((t) => t.default && (t.kind === "captions" || t.kind === "subtitles"))?.srcLang ?? null;

  const state: VideoState = {
    src: config.src,
    poster: config.poster ?? "",
    controls: config.controls ?? true,
    autoplay,
    muted: (config.muted ?? false) || autoplay, // WCAG: autoplay must be muted
    loop: config.loop ?? false,
    width: config.width === undefined ? "" : String(config.width),
    height: config.height === undefined ? "" : String(config.height),
    tracks: [...(config.tracks ?? [])],
    transcript: config.transcript ?? "",
    ariaLabel: config.ariaLabel ?? "Video",
    playing: autoplay,
    volume: 1,
    currentTime: 0,
    activeCaptions: defaultCaption,
  };

  const actions = {
    play: (s: VideoState): VideoState => ({ ...s, playing: true }),
    pause: (s: VideoState): VideoState => ({ ...s, playing: false }),
    setVolume: (s: VideoState, volume: number): VideoState => {
      const v = clamp(volume, 0, 1);
      return { ...s, volume: v, muted: v === 0 };
    },
    seek: (s: VideoState, time: number): VideoState => ({ ...s, currentTime: Math.max(0, time) }),
    enableCaptions: (s: VideoState, lang: string): VideoState => ({ ...s, activeCaptions: lang }),
  };

  const render = (s: VideoState): string => {
    const attrs = [
      s.width && `width="${esc(s.width)}"`,
      s.height && `height="${esc(s.height)}"`,
      s.poster && `poster="${esc(s.poster)}"`,
      `aria-label="${esc(s.ariaLabel)}"`,
      s.controls && "controls",
      s.autoplay && "autoplay",
      s.muted && "muted",
      s.loop && "loop",
    ].filter(Boolean);

    const source = `<source src="${esc(s.src)}" type="${mimeFor(s.src)}">`;
    const tracks = s.tracks
      .map(
        (t) =>
          `<track kind="${t.kind}" src="${esc(t.src)}" srclang="${esc(t.srcLang)}" label="${esc(t.label)}"${
            (t.default || t.srcLang === s.activeCaptions) && t.kind !== "descriptions" ? " default" : ""
          }>`,
      )
      .join("");
    const fallback = `<p>Your browser does not support HTML5 video. <a href="${esc(s.src)}">Download the video</a>.</p>`;
    const video = `<video ${attrs.join(" ")}>${source}${tracks}${fallback}</video>`;
    const transcript = s.transcript
      ? `<p class="obix-video__transcript"><a href="${esc(s.transcript)}">Read transcript</a></p>`
      : "";
    return `${video}${transcript}`;
  };

  return { name: "ObixVideo", state, actions, render };
}

/** Render a video's HTML in one call, optionally with state overrides. */
export function renderVideo(config: VideoConfig, overrides: Partial<VideoState> = {}): string {
  const video = createVideo(config);
  return video.render({ ...video.state, ...overrides });
}
