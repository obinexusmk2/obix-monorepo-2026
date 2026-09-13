/**
 * The only module in this package that touches `window`/`document`,
 * `requestAnimationFrame`, `Math.random`, or a keyboard event. Everything
 * it does — reading elapsed time, rolling a serve angle, deciding which
 * key maps to which paddle — is impure by nature, so it's kept out of
 * actions.ts/physics.ts/render.ts on purpose. See docs/architecture.md.
 */
import { createPong } from "./index.js";
import { describePong, renderPong } from "./render.js";
import { resolveAssets, type PongAssets } from "./assets.js";
import type { DOPComponent, PongConfig, PongState, Side } from "./types.js";

export interface KeyPair {
  up: string;
  down: string;
}

export interface MountOptions {
  config?: PongConfig;
  /** A resolved asset map, or a base URL to resolve the default filenames against. */
  assets?: PongAssets | string | URL;
  controls?: { left?: KeyPair; right?: KeyPair };
  /** KeyboardEvent.code that serves / pauses / resumes / restarts. Default "Space". */
  serveKey?: string;
  onStateChange?: (state: PongState) => void;
}

export interface PongController {
  getState(): PongState;
  dispatch(action: keyof DOPComponent<PongState>["actions"], ...args: unknown[]): void;
  destroy(): void;
}

const DEFAULT_CONTROLS: { left: KeyPair; right: KeyPair } = {
  left: { up: "KeyW", down: "KeyS" },
  right: { up: "ArrowUp", down: "ArrowDown" },
};

/**
 * Mount a fresh Pong game into `container`: renders into it, wires
 * keyboard controls + a resize-independent rAF loop, and maintains an
 * `aria-live` score/status announcer alongside it. Returns a controller
 * for programmatic access; call `destroy()` to tear everything down.
 */
export function mountPong(container: HTMLElement, options: MountOptions = {}): PongController {
  const component = createPong(options.config);
  let state = component.state;

  const assets: PongAssets | undefined =
    options.assets && typeof options.assets !== "string" && !(options.assets instanceof URL)
      ? options.assets
      : options.assets
        ? resolveAssets(options.assets)
        : undefined;

  const controls = {
    left: options.controls?.left ?? DEFAULT_CONTROLS.left,
    right: options.controls?.right ?? DEFAULT_CONTROLS.right,
  };
  const serveKey = options.serveKey ?? "Space";

  container.classList.add("obix-pong-host");
  container.tabIndex = container.tabIndex >= 0 ? container.tabIndex : 0;

  const live = document.createElement("div");
  live.className = "obix-pong__live-region";
  live.setAttribute("aria-live", "polite");
  live.setAttribute("role", "status");
  Object.assign(live.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  });
  container.appendChild(live);

  const svgHost = document.createElement("div");
  container.appendChild(svgHost);

  const pressed = new Set<string>();
  let lastAnnounced = "";
  let frame = 0;
  let lastTime: number | null = null;
  let destroyed = false;

  function render(): void {
    svgHost.innerHTML = renderPong(state, assets);
    const summary = describePong(state);
    if (summary !== lastAnnounced) {
      live.textContent = summary;
      lastAnnounced = summary;
    }
    options.onStateChange?.(state);
  }

  function dispatch(action: keyof DOPComponent<PongState>["actions"], ...args: unknown[]): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = (component.actions[action] as any)(state, ...args);
    render();
  }

  function onKeyDown(e: KeyboardEvent): void {
    pressed.add(e.code);
    if (e.code === serveKey) {
      e.preventDefault();
      if (state.status === "serving") {
        const towards: Side = Math.random() < 0.5 ? "left" : "right";
        const angle = (Math.random() * 2 - 1) * (Math.PI / 6);
        dispatch("serve", towards, angle);
      } else if (state.status === "playing") {
        dispatch("pause");
      } else if (state.status === "paused") {
        dispatch("resume");
      } else if (state.status === "gameOver") {
        dispatch("reset");
      }
    }
  }
  function onKeyUp(e: KeyboardEvent): void {
    pressed.delete(e.code);
  }

  container.addEventListener("keydown", onKeyDown);
  container.addEventListener("keyup", onKeyUp);

  function tick(time: number): void {
    if (destroyed) return;
    if (lastTime !== null) {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      if (pressed.has(controls.left.up)) state = component.actions.movePaddle(state, "left", -state.paddleSpeed * dt);
      if (pressed.has(controls.left.down)) state = component.actions.movePaddle(state, "left", state.paddleSpeed * dt);
      if (pressed.has(controls.right.up)) state = component.actions.movePaddle(state, "right", -state.paddleSpeed * dt);
      if (pressed.has(controls.right.down)) state = component.actions.movePaddle(state, "right", state.paddleSpeed * dt);
      state = component.actions.step(state, dt);
      render();
    }
    lastTime = time;
    frame = requestAnimationFrame(tick);
  }

  render();
  frame = requestAnimationFrame(tick);

  return {
    getState: () => state,
    dispatch,
    destroy(): void {
      destroyed = true;
      cancelAnimationFrame(frame);
      container.removeEventListener("keydown", onKeyDown);
      container.removeEventListener("keyup", onKeyUp);
      container.removeChild(svgHost);
      container.removeChild(live);
    },
  };
}
