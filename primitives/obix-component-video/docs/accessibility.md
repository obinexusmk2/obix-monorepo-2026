# Accessibility — `@obinexusltd/obix-component-video`

## Autoplay must be muted

`state.muted` is computed as `(config.muted ?? false) || autoplay` — if `autoplay: true`, the video is muted **regardless of what `muted` was set to**. This directly encodes the WCAG 1.4.2 (Audio Control) expectation that auto-playing audio not ambush the user; a video that plays sound automatically without the visitor's action is a common accessibility failure this package makes structurally impossible.

## Captions and transcripts

- `tracks` renders one `<track>` per entry, each carrying `kind`, `src`, `srclang`, `label`, and `default` when it matches `activeCaptions` (or was configured `default`). `kind="descriptions"` tracks are excluded from the "mark as default" logic — audio-description tracks aren't meant to be forced on the way a caption track is.
- `transcript` (when set) renders a plain visible link ("Read transcript") after the `<video>` — a transcript is required content for users who cannot perceive audio/video at all (deaf-blind users, or anyone who prefers reading), and is not a substitute for captions or vice versa.

## Fallback content

`render()` always includes fallback markup inside the `<video>` element for browsers/user agents that don't support HTML5 video: `<p>Your browser does not support HTML5 video. <a href="...">Download the video</a>.</p>`.

## Accessible name

`ariaLabel` defaults to `"Video"` — for any non-trivial page with more than one video, set an explicit, descriptive `ariaLabel` (e.g. `"Product demo: wireless earbuds"`) so screen reader users can distinguish players without playing each one.

## What this component does not do

It does not generate captions, does not transcode video, and does not enforce that a `tracks` array is non-empty — captioning content is still the integrator's responsibility to author and supply.
