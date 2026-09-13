/**
 * Pure rendering — `renderPong(state)` returns a deterministic SVG string;
 * `describePong(state)` returns a short text summary for an aria-live
 * region. Neither touches the DOM: this module never calls
 * `document.*`/`window.*`, so it runs identically in a browser, in Node for
 * a test's string assertions, or (in principle) on a server.
 */
import { PONG_ASSETS, type PongAssets } from "./assets.js";
import type { PongState } from "./types.js";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Round to keep the SVG string stable across floating-point noise. */
function n(value: number): number {
  return Math.round(value * 100) / 100;
}

export function renderPong(state: PongState, assets: PongAssets = PONG_ASSETS): string {
  const { width: w, height: h, left, right, ball } = state;
  const label = describePong(state);
  const overlay = renderStatusOverlay(state);

  return (
    `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}" ` +
    `class="obix-pong" xmlns="http://www.w3.org/2000/svg">` +
    `<image href="${esc(assets.backgroundGrid)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>` +
    `<line class="obix-pong__net" x1="${n(w / 2)}" y1="0" x2="${n(w / 2)}" y2="${h}" ` +
    `stroke="currentColor" stroke-width="2" stroke-dasharray="10 12" opacity="0.5"/>` +
    `<image href="${esc(assets.paddleLeft)}" x="${n(left.x)}" y="${n(left.y)}" width="${n(left.width)}" height="${n(left.height)}"/>` +
    `<image href="${esc(assets.paddleRight)}" x="${n(right.x)}" y="${n(right.y)}" width="${n(right.width)}" height="${n(right.height)}"/>` +
    `<image href="${esc(assets.ball)}" x="${n(ball.x - ball.radius)}" y="${n(ball.y - ball.radius)}" ` +
    `width="${n(ball.radius * 2)}" height="${n(ball.radius * 2)}"/>` +
    `<text class="obix-pong__score obix-pong__score--left" x="${n(w / 2 - 40)}" y="48" ` +
    `text-anchor="end" font-size="36">${left.score}</text>` +
    `<text class="obix-pong__score obix-pong__score--right" x="${n(w / 2 + 40)}" y="48" ` +
    `text-anchor="start" font-size="36">${right.score}</text>` +
    overlay +
    `</svg>`
  );
}

function renderStatusOverlay(state: PongState): string {
  if (state.status === "playing") return "";
  const w = state.width;
  const h = state.height;
  const message =
    state.status === "gameOver"
      ? `${state.winner === "left" ? "Left" : "Right"} player wins`
      : state.status === "paused"
        ? "Paused"
        : "Press Space to serve";
  return (
    `<text class="obix-pong__overlay" x="${n(w / 2)}" y="${n(h / 2)}" text-anchor="middle" ` +
    `font-size="24">${esc(message)}</text>`
  );
}

/** A short, human-readable summary of the current state — for an aria-live region, not the SVG. */
export function describePong(state: PongState): string {
  const score = `Left ${state.left.score}, right ${state.right.score}.`;
  switch (state.status) {
    case "serving":
      return `${score} Ready to serve.`;
    case "paused":
      return `${score} Paused.`;
    case "gameOver":
      return `${score} ${state.winner === "left" ? "Left" : "Right"} player wins.`;
    default:
      return `${score} In play.`;
  }
}
