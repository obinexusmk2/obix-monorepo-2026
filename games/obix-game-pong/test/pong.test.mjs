import test from "node:test";
import assert from "node:assert/strict";
import {
  createPong,
  movePaddle,
  step,
  serve,
  pause,
  resume,
  reset,
  renderPong,
  describePong,
  bounceOffWalls,
  ballOverlapsPaddle,
  resolvePaddleHit,
  whoConceded,
  movePaddleWithin,
  clamp,
} from "../dist/index.js";

test("createPong: sane, centered initial state", () => {
  const { state } = createPong();
  assert.equal(state.status, "serving");
  assert.equal(state.left.score, 0);
  assert.equal(state.right.score, 0);
  assert.equal(state.ball.x, state.width / 2);
  assert.equal(state.ball.y, state.height / 2);
  assert.equal(state.ball.vx, 0);
  assert.equal(state.ball.vy, 0);
  assert.equal(state.left.y, (state.height - state.left.height) / 2);
});

test("createPong: config overrides apply", () => {
  const { state } = createPong({ width: 640, height: 360, winningScore: 5 });
  assert.equal(state.width, 640);
  assert.equal(state.height, 360);
  assert.equal(state.winningScore, 5);
  assert.equal(state.right.x, 640 - 24 - state.right.width);
});

test("movePaddle: clamps to court bounds, does not mutate input", () => {
  const { state } = createPong({ height: 400, paddleHeight: 100 });
  const up = movePaddle(state, "left", -1000);
  assert.equal(up.left.y, 0);
  const down = movePaddle(state, "left", 1000);
  assert.equal(down.left.y, 300);
  assert.equal(state.left.y, (400 - 100) / 2, "original state untouched");
});

test("movePaddle: no-op when the game is over", () => {
  let s = createPong().state;
  s = { ...s, status: "gameOver" };
  assert.equal(movePaddle(s, "left", 50), s);
});

test("step: no-op unless status is 'playing'", () => {
  const { state } = createPong();
  assert.equal(step(state, 0.016), state);
  const paused = { ...state, status: "paused", ball: { ...state.ball, vx: 100, vy: 0 } };
  assert.equal(step(paused, 0.016), paused);
});

test("serve: sets status to playing and aims the ball", () => {
  const { state } = createPong();
  const served = serve(state, "right", 0);
  assert.equal(served.status, "playing");
  assert.ok(served.ball.vx > 0, "serving toward right gives positive vx");
  assert.equal(served.ball.vy, 0, "angle 0 gives zero vy");

  const servedLeft = serve(state, "left", 0);
  assert.ok(servedLeft.ball.vx < 0, "serving toward left gives negative vx");
});

test("serve: angle is clamped to +/- 60 degrees", () => {
  const { state } = createPong();
  const wild = serve(state, "right", Math.PI); // 180 degrees, way over the limit
  const maxVy = Math.hypot(wild.ball.vx, wild.ball.vy) * Math.sin(Math.PI / 3);
  assert.ok(Math.abs(wild.ball.vy) <= maxVy + 1e-9);
});

test("step: ball bounces off the top and bottom walls", () => {
  const height = 300;
  const { state } = createPong({ height });
  let s = { ...state, status: "playing", ball: { ...state.ball, y: 5, vy: -400, vx: 0 } };
  s = step(s, 0.05); // would overshoot past y=0 without the bounce
  assert.ok(s.ball.y >= 0);
  assert.ok(s.ball.vy > 0, "vy flips sign off the top wall");
});

test("step: paddle hit reflects vx, steers vy by offset, ramps speed, and counts a rally", () => {
  const { state } = createPong({ ballSpeedIncrement: 1.5, maxBallSpeed: 10_000 });
  const left = state.left;
  // Ball approaching the left paddle, offset toward the bottom half.
  const approaching = {
    ...state,
    status: "playing",
    ball: { ...state.ball, x: left.x + left.width + state.ball.radius + 2, y: left.y + left.height * 0.75, vx: -300, vy: 0 },
  };
  const afterOneStep = step(approaching, 0.02);
  assert.ok(afterOneStep.ball.vx > 0, "reflected off the left paddle");
  assert.ok(afterOneStep.ball.vy > 0, "hit below center steers the ball downward");
  assert.ok(
    Math.hypot(afterOneStep.ball.vx, afterOneStep.ball.vy) > 300,
    "speed increased by ballSpeedIncrement",
  );
  assert.equal(afterOneStep.rally, 1);
});

test("step: missing the right paddle scores the left side and re-centers for serve", () => {
  const { state } = createPong({ winningScore: 11 });
  const missed = {
    ...state,
    status: "playing",
    ball: { ...state.ball, x: state.width - 5, y: state.height / 2, vx: 500, vy: 0 },
  };
  const after = step(missed, 0.05);
  assert.equal(after.left.score, 1);
  assert.equal(after.right.score, 0);
  assert.equal(after.rally, 0);
  assert.equal(after.status, "serving");
  assert.equal(after.ball.x, state.width / 2);
  assert.equal(after.ball.vx, 0);
});

test("step: reaching winningScore ends the game", () => {
  const { state } = createPong({ winningScore: 1 });
  const missed = {
    ...state,
    status: "playing",
    ball: { ...state.ball, x: state.width - 5, y: state.height / 2, vx: 500, vy: 0 },
  };
  const after = step(missed, 0.05);
  assert.equal(after.status, "gameOver");
  assert.equal(after.winner, "left");
});

test("step is deterministic: same input always produces an equal (deep) output", () => {
  const { state } = createPong();
  const playing = { ...state, status: "playing", ball: { ...state.ball, vx: 137, vy: -53 } };
  const ballBefore = { ...playing.ball };
  const a = step(playing, 0.0173);
  const b = step(playing, 0.0173);
  assert.deepEqual(a, b);
  assert.deepEqual(playing.ball, ballBefore, "the input state was not mutated by step()");
});

test("pause / resume: only transition from the expected status", () => {
  const { state } = createPong();
  const playing = { ...state, status: "playing" };
  assert.equal(pause(playing).status, "paused");
  assert.equal(pause(state).status, "serving", "cannot pause while serving");
  const paused = { ...state, status: "paused" };
  assert.equal(resume(paused).status, "playing");
  assert.equal(resume(state).status, "serving", "cannot resume while serving");
});

test("reset: zeroes scores, re-centers the ball, and returns to 'serving'", () => {
  const { state } = createPong();
  const midGame = {
    ...state,
    status: "gameOver",
    winner: "right",
    left: { ...state.left, score: 4 },
    right: { ...state.right, score: 11 },
    rally: 7,
  };
  const after = reset(midGame);
  assert.equal(after.left.score, 0);
  assert.equal(after.right.score, 0);
  assert.equal(after.status, "serving");
  assert.equal(after.winner, null);
  assert.equal(after.rally, 0);
  assert.equal(after.ball.x, state.width / 2);
});

test("physics: bounceOffWalls clamps position and flips vy only at the boundary", () => {
  const ball = { x: 0, y: -3, vx: 0, vy: -50, radius: 10 };
  const bounced = bounceOffWalls(ball, 400);
  assert.equal(bounced.y, 10);
  assert.equal(bounced.vy, 50);
  const midCourt = { x: 0, y: 200, vx: 0, vy: -50, radius: 10 };
  assert.equal(bounceOffWalls(midCourt, 400), midCourt);
});

test("physics: ballOverlapsPaddle is a correct circle/rect test", () => {
  const paddle = { x: 100, y: 100, width: 20, height: 80, score: 0 };
  assert.ok(ballOverlapsPaddle({ x: 115, y: 140, vx: 0, vy: 0, radius: 8 }, paddle));
  assert.ok(!ballOverlapsPaddle({ x: 500, y: 140, vx: 0, vy: 0, radius: 8 }, paddle));
});

test("physics: resolvePaddleHit steers by offset and repositions flush to the paddle face", () => {
  const paddle = { x: 100, y: 100, width: 20, height: 80, score: 0 };
  const ballAtTop = { x: 118, y: 100, vx: -200, vy: 0, radius: 6 };
  const { ball, offset } = resolvePaddleHit(ballAtTop, paddle, "left", 200);
  assert.equal(offset, -1, "hit exactly at the top edge is fully off-center");
  assert.ok(ball.vy < 0, "top-edge hit steers upward");
  assert.equal(ball.x, paddle.x + paddle.width + ball.radius);
});

test("physics: whoConceded / movePaddleWithin / clamp", () => {
  assert.equal(whoConceded({ x: -1, y: 0, vx: 0, vy: 0, radius: 5 }, 800), "left");
  assert.equal(whoConceded({ x: 801, y: 0, vx: 0, vy: 0, radius: 5 }, 800), "right");
  assert.equal(whoConceded({ x: 400, y: 0, vx: 0, vy: 0, radius: 5 }, 800), null);
  const paddle = { x: 0, y: 0, width: 10, height: 50, score: 0 };
  assert.equal(movePaddleWithin(paddle, -100, 200).y, 0);
  assert.equal(movePaddleWithin(paddle, 1000, 200).y, 150);
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(50, 0, 10), 10);
});

test("renderPong: deterministic SVG reflecting score and status", () => {
  const { state } = createPong();
  const svg = renderPong(state);
  assert.match(svg, /^<svg /);
  assert.match(svg, /obix-pong__score--left"[^]*?>0</);
  assert.match(svg, /obix-pong__score--right"[^]*?>0</);
  assert.match(svg, /Press Space to serve/);
  assert.equal(renderPong(state), svg, "same state renders the same string");

  const scored = { ...state, left: { ...state.left, score: 7 } };
  assert.match(renderPong(scored), /obix-pong__score--left"[^]*?>7</);
});

test("renderPong: no status overlay text while actually playing", () => {
  const { state } = createPong();
  const playing = { ...state, status: "playing" };
  assert.ok(!renderPong(playing).includes("obix-pong__overlay"));
});

test("describePong: one summary line per status", () => {
  const { state } = createPong();
  assert.match(describePong(state), /Ready to serve/);
  assert.match(describePong({ ...state, status: "playing" }), /In play/);
  assert.match(describePong({ ...state, status: "paused" }), /Paused/);
  assert.match(
    describePong({ ...state, status: "gameOver", winner: "right" }),
    /Right player wins/,
  );
});
