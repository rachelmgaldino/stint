import { describe, expect, it } from "vitest";
import {
  elapsed,
  formatClock,
  formatDuration,
  heat,
  idle,
  pause,
  progress,
  remaining,
  resume,
  scrub,
  start,
} from "./timer";

const MIN = 60_000;

describe("timer", () => {
  it("counts down from the start time", () => {
    const t = start("focus", 25 * MIN, 1_000);
    expect(remaining(t, 1_000)).toBe(25 * MIN);
    expect(remaining(t, 1_000 + 5 * MIN)).toBe(20 * MIN);
  });

  it("freezes while paused and excludes the pause from elapsed time", () => {
    let t = start("focus", 25 * MIN, 0);
    t = pause(t, 10 * MIN);
    expect(remaining(t, 30 * MIN)).toBe(15 * MIN);
    t = resume(t, 20 * MIN);
    expect(remaining(t, 20 * MIN)).toBe(15 * MIN);
    expect(elapsed(t, 25 * MIN)).toBe(15 * MIN);
  });

  it("goes negative after the end so overtime can be shown", () => {
    const t = start("focus", 1 * MIN, 0);
    expect(remaining(t, 3 * MIN)).toBe(-2 * MIN);
    expect(progress(t, 3 * MIN)).toBe(1);
  });

  it("scrubs time on and off, keeping at least a minute", () => {
    let t = start("focus", 25 * MIN, 0);
    t = scrub(t, 5 * MIN, 0);
    expect(remaining(t, 0)).toBe(30 * MIN);
    expect(t.status !== "idle" && t.plannedMs).toBe(30 * MIN);
    t = scrub(t, -60 * MIN, 0);
    expect(remaining(t, 0)).toBe(1 * MIN);
  });

  it("scrubs a paused timer", () => {
    let t = pause(start("break", 5 * MIN, 0), 1 * MIN);
    t = scrub(t, 2 * MIN, 2 * MIN);
    expect(remaining(t, 9 * MIN)).toBe(6 * MIN);
  });

  it("ignores actions that don't apply", () => {
    expect(pause(idle, 0)).toBe(idle);
    expect(resume(idle, 0)).toBe(idle);
    expect(scrub(idle, MIN, 0)).toBe(idle);
    const running = start("focus", MIN, 0);
    expect(resume(running, 0)).toBe(running);
  });
});

describe("formatting", () => {
  it("formats the clock", () => {
    expect(formatClock(25 * MIN)).toBe("25:00");
    expect(formatClock(25 * MIN - 400)).toBe("25:00");
    expect(formatClock(9_000)).toBe("0:09");
    expect(formatClock(65 * MIN + 9_000)).toBe("1:05:09");
    expect(formatClock(-192_000)).toBe("+3:12");
  });

  it("formats durations", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(25 * MIN)).toBe("25m");
    expect(formatDuration(60 * MIN)).toBe("1h");
    expect(formatDuration(85 * MIN)).toBe("1h 25m");
  });

  it("warms the mascot after an hour of focus and overheats it after two", () => {
    const t = start("focus", 180 * MIN, 0);
    expect(heat(t, 60 * MIN)).toBe(0);
    expect(heat(t, 61 * MIN)).toBe(1);
    expect(heat(t, 120 * MIN)).toBe(1);
    expect(heat(t, 121 * MIN)).toBe(2);
    expect(heat(pause(t, 90 * MIN), 200 * MIN)).toBe(1);
    expect(heat(start("break", 180 * MIN, 0), 150 * MIN)).toBe(0);
    expect(heat(idle, 150 * MIN)).toBe(0);
  });
});
