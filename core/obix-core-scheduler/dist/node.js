import { supportsRefUnref } from "./index.js";
export function createNodeClock(opts = {}) {
    const keepAlive = opts.keepAlive === true;
    const canUnref = !keepAlive && supportsRefUnref();
    const tune = (h) => {
        if (canUnref && h && typeof h.unref === "function") {
            h.unref();
        }
        return h;
    };
    return {
        now: () => performance.now(),
        setTimeout: (fn, ms) => tune(setTimeout(fn, ms)),
        clearTimeout: (h) => clearTimeout(h),
        setInterval: (fn, ms) => tune(setInterval(fn, ms)),
        clearInterval: (h) => clearInterval(h),
    };
}
//# sourceMappingURL=node.js.map