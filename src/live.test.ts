import { describe, expect, it } from "vitest";
import { isLive } from "./live";
import { idle, pause, start, startFlow } from "./timer";

const MIN = 60_000;
const T0 = new Date(2026, 10, 8, 9, 0).getTime();
// What saveLive writes and loadLive reads back.
const saved = (x: unknown) => JSON.parse(JSON.stringify(x));
const live = { timer: start("focus", 25 * MIN, T0), intention: "Write report", categoryId: 1 };

describe("isLive", () => {
  it("takes every timer the app saves", () => {
    expect(isLive(saved({ timer: idle, intention: "", categoryId: null }))).toBe(true);
    expect(isLive(saved(live))).toBe(true);
    expect(isLive(saved({ ...live, timer: pause(live.timer, T0 + 10 * MIN) }))).toBe(true);
    expect(isLive(saved({ ...live, timer: startFlow(T0) }))).toBe(true);
    expect(isLive(saved({ ...live, timer: start("break", 15 * MIN, T0), long: true, done: [] }))).toBe(true);
    const done = [{ intention: "Plan", categoryId: null, endedAt: T0 + 10 * MIN, focusedMs: 10 * MIN }];
    expect(isLive(saved({ ...live, done }))).toBe(true);
  });

  it("drops a saved value that isn't one, which used to throw on every start", () => {
    for (const x of [null, 0, "focus", [], {}, { timer: null, intention: "", categoryId: null }]) expect(isLive(x)).toBe(false);
  });

  it("drops a timer with missing or wrong fields, which would save NaN times", () => {
    const { endsAt: _gone, ...noEnd } = live.timer as Extract<typeof live.timer, { status: "running" }>;
    expect(isLive({ ...live, timer: noEnd })).toBe(false);
    expect(isLive({ ...live, timer: { ...live.timer, status: "stopped" } })).toBe(false);
    expect(isLive({ ...live, timer: { ...live.timer, kind: "nap" } })).toBe(false);
    expect(isLive({ ...live, timer: { ...live.timer, startedAt: "09:00" } })).toBe(false);
    expect(isLive({ ...live, timer: { ...live.timer, flow: "yes" } })).toBe(false);
    const { pausedAt: _away, ...noPause } = pause(live.timer, T0 + MIN) as Extract<typeof live.timer, { status: "paused" }>;
    expect(isLive({ ...live, timer: noPause })).toBe(false);
  });

  it("drops wrong fields around the timer", () => {
    expect(isLive({ ...live, intention: 5 })).toBe(false);
    expect(isLive({ ...live, categoryId: "1" })).toBe(false);
    expect(isLive({ ...live, long: "yes" })).toBe(false);
    expect(isLive({ ...live, done: {} })).toBe(false);
    expect(isLive({ ...live, done: [{ intention: "Plan", categoryId: null, endedAt: T0 }] })).toBe(false);
  });
});
