import test from "node:test";
import assert from "node:assert/strict";
import { createVideo, renderVideo } from "../dist/index.js";

const base = {
  src: "/intro.mp4",
  poster: "/intro-poster.jpg",
  width: 800,
  height: 450,
  tracks: [
    { kind: "captions", src: "/intro-en.vtt", srcLang: "en", label: "English" },
    { kind: "captions", src: "/intro-es.vtt", srcLang: "es", label: "Spanish" },
  ],
  transcript: "/intro-transcript.txt",
  ariaLabel: "Product introduction video",
};

test("src is required", () => {
  assert.throws(() => createVideo({}), /src/);
});

test("render emits <video> + <source> + one <track> per track + fallback + transcript", () => {
  const html = renderVideo(base);
  assert.match(html, /<video width="800" height="450" poster="\/intro-poster.jpg" aria-label="Product introduction video" controls>/);
  assert.match(html, /<source src="\/intro.mp4" type="video\/mp4">/);
  assert.match(html, /<track kind="captions" src="\/intro-en.vtt" srclang="en" label="English">/);
  assert.match(html, /<track kind="captions" src="\/intro-es.vtt" srclang="es" label="Spanish">/);
  assert.match(html, /Your browser does not support HTML5 video\. <a href="\/intro.mp4">Download the video<\/a>/);
  assert.match(html, /<p class="obix-video__transcript"><a href="\/intro-transcript.txt">Read transcript<\/a><\/p>/);
});

test("autoplay forces muted (WCAG)", () => {
  assert.equal(createVideo({ src: "/a.mp4", autoplay: true }).state.muted, true);
  assert.match(renderVideo({ src: "/a.mp4", autoplay: true }), /autoplay muted/);
});

test("mime type derives from extension", () => {
  assert.match(renderVideo({ src: "/a.webm" }), /type="video\/webm"/);
  assert.match(renderVideo({ src: "/a.ogv" }), /type="video\/ogg"/);
});

test("actions are pure; setVolume(0) mutes, enableCaptions sets default track", () => {
  const v = createVideo(base);
  assert.equal(v.actions.setVolume(v.state, 0).muted, true);
  assert.equal(v.state.muted, false); // original untouched
  const html = v.render(v.actions.enableCaptions(v.state, "es"));
  assert.match(html, /srclang="es" label="Spanish" default>/);
});
