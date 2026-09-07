// Job module loaded INSIDE the worker. Exports are called as (data, ctx).

export function square(n) {
  return n * n;
}

export async function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

export function crash() {
  throw new Error("intentional job crash");
}

export function hardCrash() {
  // exit the worker without a response
  // eslint-disable-next-line no-undef
  (globalThis.process ?? { exit() {} }).exit?.(7);
  return "unreachable";
}

export async function slow(ms, ctx) {
  const step = 10;
  for (let waited = 0; waited < ms; waited += step) {
    await new Promise((r) => setTimeout(r, step));
    if (ctx?.isCancelled?.()) return "cancelled-cooperatively";
  }
  return "done";
}

/** Receives a transferred ArrayBuffer, returns its byteLength + a checksum. */
export function inspectBuffer(buf) {
  const view = new Uint8Array(buf);
  let sum = 0;
  for (const b of view) sum = (sum + b) % 251;
  return { byteLength: buf.byteLength, checksum: sum };
}
