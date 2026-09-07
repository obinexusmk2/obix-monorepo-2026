import { CompatError, probeCapabilities } from "@obinexusltd/obix-core-capabilities";
export { CompatError } from "@obinexusltd/obix-core-capabilities";
export const systemClock = {
    now: () => typeof globalThis.performance?.now === "function"
        ? globalThis.performance.now()
        : Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (h) => clearInterval(h),
};
export function createVirtualClock(startMs = 0) {
    let t = startMs;
    let seq = 0;
    const q = [];
    const add = (fn, ms, period) => {
        const id = ++seq;
        q.push({ id, due: t + Math.max(0, ms), period, fn, dead: false });
        return id;
    };
    const kill = (h) => {
        const e = q.find((x) => x.id === h);
        if (e)
            e.dead = true;
    };
    return {
        now: () => t,
        setTimeout: (fn, ms) => add(fn, ms, null),
        clearTimeout: kill,
        setInterval: (fn, ms) => add(fn, ms, Math.max(1, ms)),
        clearInterval: kill,
        get pending() {
            return q.filter((e) => !e.dead).length;
        },
        advance(ms) {
            const target = t + ms;
            for (;;) {
                const next = q
                    .filter((e) => !e.dead && e.due <= target)
                    .sort((a, b) => a.due - b.due || a.id - b.id)[0];
                if (!next)
                    break;
                t = next.due;
                if (next.period == null)
                    next.dead = true;
                else
                    next.due = t + next.period;
                if (!next.dead || next.period == null)
                    next.fn();
                for (let i = q.length - 1; i >= 0; i--)
                    if (q[i].dead)
                        q.splice(i, 1);
            }
            t = target;
        },
    };
}
const TOKEN = Symbol("obix-core-scheduler/token");
export function createScheduler(opts = {}) {
    const clock = opts.clock ?? systemClock;
    const fallbackOnError = opts.onError ?? ((e) => queueMicrotask(() => { throw e; }));
    let disposed = false;
    let seq = 0;
    const owned = new Map();
    function requireLive(op) {
        if (disposed) {
            throw new CompatError({
                code: "scheduler/disposed",
                package: "obix-core-scheduler",
                operation: op,
                reason: "the scheduler has been disposed",
                remediation: "Create a new scheduler; a disposed one cannot be reused.",
            });
        }
    }
    function mkToken(kind) {
        return Object.freeze({ [TOKEN]: true, id: ++seq, kind });
    }
    function schedule(fn, delayMs) {
        requireLive("schedule");
        const token = mkToken("timeout");
        const rec = { token, handle: null, kind: "timeout", epoch: 0, busy: false, queued: false };
        owned.set(token.id, rec);
        rec.handle = clock.setTimeout(() => {
            const myEpoch = rec.epoch;
            owned.delete(token.id);
            void runOnce(fn, () => rec.epoch === myEpoch && !disposed, fallbackOnError);
        }, Math.max(0, delayMs));
        return token;
    }
    function scheduleEvery(fn, intervalMs, o = {}) {
        requireLive("scheduleEvery");
        const overrun = o.overrun ?? "skip";
        const timing = o.predicateTiming ?? "post";
        const onErr = o.onError ?? fallbackOnError;
        const token = mkToken("interval");
        const rec = { token, handle: null, kind: "interval", epoch: 0, busy: false, queued: false };
        owned.set(token.id, rec);
        const gate = () => {
            if (!o.predicate)
                return true;
            try {
                return o.predicate() !== false;
            }
            catch (err) {
                onErr(err);
                return false;
            }
        };
        const postTick = (myEpoch) => {
            if (rec.epoch !== myEpoch || disposed || !owned.has(token.id))
                return;
            if (timing === "post" && !gate()) {
                cancel(token);
                return;
            }
            if (rec.queued) {
                rec.queued = false;
                fire();
            }
        };
        const fire = () => {
            if (disposed || !owned.has(token.id))
                return;
            const myEpoch = rec.epoch;
            if (rec.busy) {
                if (overrun === "skip")
                    return;
                if (overrun === "queue") {
                    rec.queued = true;
                    return;
                }
            }
            if (timing === "pre" && !gate()) {
                cancel(token);
                return;
            }
            let ret;
            try {
                ret = fn();
            }
            catch (err) {
                onErr(err);
                postTick(myEpoch);
                return;
            }
            if (ret && typeof ret.then === "function") {
                rec.busy = true;
                ret.then(() => {
                    rec.busy = false;
                    postTick(myEpoch);
                }, (err) => {
                    rec.busy = false;
                    if (rec.epoch === myEpoch && !disposed)
                        onErr(err);
                    postTick(myEpoch);
                });
            }
            else {
                postTick(myEpoch);
            }
        };
        rec.handle = clock.setInterval(fire, Math.max(1, intervalMs));
        return token;
    }
    function cancel(token) {
        if (!token || token[TOKEN] !== true)
            return;
        const rec = owned.get(token.id);
        if (!rec)
            return;
        rec.epoch++;
        if (rec.kind === "timeout")
            clock.clearTimeout(rec.handle);
        else
            clock.clearInterval(rec.handle);
        owned.delete(token.id);
    }
    function dispose() {
        if (disposed)
            return;
        disposed = true;
        for (const rec of owned.values()) {
            rec.epoch++;
            if (rec.kind === "timeout")
                clock.clearTimeout(rec.handle);
            else
                clock.clearInterval(rec.handle);
        }
        owned.clear();
    }
    return {
        schedule,
        scheduleEvery,
        cancel,
        dispose,
        get activeCount() {
            return owned.size;
        },
        get disposed() {
            return disposed;
        },
    };
}
async function runOnce(fn, stillValid, onErr) {
    try {
        const r = fn();
        if (r && typeof r.then === "function")
            await r;
    }
    catch (err) {
        if (stillValid())
            onErr(err);
    }
}
export function supportsRefUnref() {
    return probeCapabilities(["ref-unref"])["ref-unref"].status === "available";
}
//# sourceMappingURL=index.js.map