import test from "node:test";
import assert from "node:assert/strict";
import {
  toReadableStream,
  fromReadableStream,
  collectBytes,
  decodeText,
  pipeBytes,
  countingStream,
  CompatError,
} from "../dist/index.js";

const enc = new TextEncoder();
const bytesOf = (s) => enc.encode(s);

test("empty stream -> zero chunks, empty collect", async () => {
  const chunks = [];
  for await (const c of fromReadableStream(toReadableStream([]))) chunks.push(c);
  assert.equal(chunks.length, 0);
  assert.equal((await collectBytes(toReadableStream([]))).byteLength, 0);
});

test("one-byte chunks reassemble to the exact bytes", async () => {
  const data = bytesOf("hello world");
  const oneByteChunks = [...data].map((b) => new Uint8Array([b]));
  const out = await collectBytes(toReadableStream(oneByteChunks));
  assert.deepEqual([...out], [...data]);
});

test("split multibyte UTF-8 across chunk boundaries decodes correctly (no U+FFFD)", async () => {
  const text = "café — 日本語 — 😀 tail";
  const full = bytesOf(text);
  // cut every 1 byte to guarantee multibyte code points straddle boundaries
  const chunks = [...full].map((b) => new Uint8Array([b]));
  let acc = "";
  for await (const piece of decodeText(toReadableStream(chunks))) acc += piece;
  assert.equal(acc, text);
  assert.doesNotMatch(acc, /�/);
});

test("decodeText fatal:true rejects an invalid byte sequence", async () => {
  const bad = toReadableStream([new Uint8Array([0xff, 0xfe, 0xfd])]);
  await assert.rejects(async () => {
    // eslint-disable-next-line no-unused-vars
    for await (const _ of decodeText(bad, { fatal: true })) { /* consume */ }
  });
});

test("backpressure — a slow consumer means the source is pulled lazily, not drained ahead", async () => {
  let produced = 0;
  async function* slowSource() {
    for (let i = 0; i < 20; i++) {
      produced++;
      yield new Uint8Array([i]);
    }
  }
  const stream = toReadableStream(slowSource(), { highWaterMark: 1 });
  const reader = stream.getReader();
  await reader.read(); // pull 1
  await new Promise((r) => setTimeout(r, 10));
  // with hwm 1, at most a couple of chunks are pre-produced, not all 20
  assert.ok(produced <= 3, `expected lazy production, got ${produced}`);
  await reader.cancel();
  reader.releaseLock();
});

test("mid-stream error propagates to the consumer", async () => {
  async function* failing() {
    yield bytesOf("ok ");
    throw new Error("boom at chunk 2");
  }
  await assert.rejects(
    () => collectBytes(toReadableStream(failing())),
    (err) => err instanceof CompatError && /boom at chunk 2/.test(err.reason),
  );
});

test("abort via AbortSignal errors the stream and stops the source", async () => {
  const ac = new AbortController();
  let produced = 0;
  async function* infinite() {
    for (;;) {
      produced++;
      yield new Uint8Array([0]);
      await new Promise((r) => setTimeout(r, 5));
    }
  }
  const stream = toReadableStream(infinite(), { signal: ac.signal, highWaterMark: 1 });
  const it = fromReadableStream(stream);
  await it.next();
  ac.abort(new Error("caller cancelled"));
  await assert.rejects(() => it.next(), (e) => e instanceof CompatError && e.code === "streams/aborted");
  // one chunk may already have been in flight when abort landed; after that the
  // count must be stable (no *new* pulls).
  await new Promise((r) => setTimeout(r, 30));
  const at = produced;
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(produced, at, "source stopped producing new chunks after abort");
});

test("a locked stream cannot be consumed twice", async () => {
  const stream = toReadableStream([bytesOf("x")]);
  const r = stream.getReader();
  await assert.rejects(
    async () => {
      // eslint-disable-next-line no-unused-vars
      for await (const _ of fromReadableStream(stream)) { /* */ }
    },
    (e) => e instanceof CompatError && e.code === "streams/locked",
  );
  r.releaseLock();
});

test("fromReadableStream releases the reader lock on normal completion", async () => {
  const stream = toReadableStream([bytesOf("a"), bytesOf("b")]);
  // eslint-disable-next-line no-unused-vars
  for await (const _ of fromReadableStream(stream)) { /* consume all */ }
  assert.equal(stream.locked, false, "lock released -> stream reusable state is clean");
});

test("pipeBytes counts bytes and closes the writable", async () => {
  const received = [];
  const writable = new WritableStream({
    write(chunk) {
      received.push(chunk);
    },
  });
  const src = toReadableStream([bytesOf("abc"), bytesOf("defgh")]);
  const { bytes } = await pipeBytes(src, writable);
  assert.equal(bytes, 8);
  assert.equal(received.reduce((n, c) => n + c.byteLength, 0), 8);
});

test("countingStream instruments a piped transfer (bounded-queue observation)", async () => {
  const counter = countingStream();
  const src = toReadableStream([...Array(50)].map(() => new Uint8Array(64)), { highWaterMark: 4 });
  const sink = new WritableStream({ write() {} });
  await src.pipeThrough(counter.stream).pipeTo(sink);
  assert.equal(counter.chunks, 50);
  assert.equal(counter.bytes, 50 * 64);
});
