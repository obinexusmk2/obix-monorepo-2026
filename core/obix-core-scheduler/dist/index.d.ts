export { CompatError } from "@obinexusltd/obix-core-capabilities";
export interface Clock {
    now(): number;
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
    setInterval(fn: () => void, ms: number): unknown;
    clearInterval(handle: unknown): void;
}
export declare const systemClock: Clock;
export interface VirtualClock extends Clock {
    advance(ms: number): void;
    readonly pending: number;
}
export declare function createVirtualClock(startMs?: number): VirtualClock;
declare const TOKEN: unique symbol;
export interface TimerToken {
    readonly [TOKEN]: true;
    readonly id: number;
    readonly kind: "timeout" | "interval";
}
export type OverrunPolicy = "skip" | "queue" | "concurrent";
export type PredicateTiming = "pre" | "post";
export interface EveryOptions {
    overrun?: OverrunPolicy;
    predicate?: () => boolean;
    predicateTiming?: PredicateTiming;
    onError?: (err: unknown) => void;
}
export interface SchedulerAPI {
    schedule(fn: () => void | Promise<void>, delayMs: number): TimerToken;
    scheduleEvery(fn: () => void | Promise<void>, intervalMs: number, opts?: EveryOptions): TimerToken;
    cancel(token: TimerToken): void;
    dispose(): void;
    readonly activeCount: number;
    readonly disposed: boolean;
}
export interface SchedulerOptions {
    clock?: Clock;
    onError?: (err: unknown) => void;
}
export declare function createScheduler(opts?: SchedulerOptions): SchedulerAPI;
export declare function supportsRefUnref(): boolean;
//# sourceMappingURL=index.d.ts.map