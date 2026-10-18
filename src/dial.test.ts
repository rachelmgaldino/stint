import { describe, expect, it } from "vitest";
import { clampMinutes, dragStep, lapAt, minuteAt, nextHourOffset, slicePath } from "./dial";

describe("dial", () => {
  it("maps points around the face to minutes", () => {
    expect(minuteAt(0, -10)).toBeCloseTo(0);
    expect(minuteAt(10, 0)).toBeCloseTo(15);
    expect(minuteAt(0, 10)).toBeCloseTo(30);
    expect(minuteAt(-10, 0)).toBeCloseTo(45);
  });

  it("adds an hour when dragging clockwise past 12 and removes it going back", () => {
    expect(nextHourOffset(0, 58, 2)).toBe(60);
    expect(nextHourOffset(60, 3, 57)).toBe(0);
    expect(nextHourOffset(0, 20, 25)).toBe(0);
  });

  it("splits a length into hour laps", () => {
    expect(lapAt(0)).toEqual({ lap: 1, fraction: 0 });
    expect(lapAt(48)).toEqual({ lap: 1, fraction: 0.8 });
    expect(lapAt(60)).toEqual({ lap: 1, fraction: 1 });
    expect(lapAt(66)).toEqual({ lap: 2, fraction: 0.1 });
    expect(lapAt(147)).toEqual({ lap: 3, fraction: 0.45 });
    expect(lapAt(180)).toEqual({ lap: 3, fraction: 1 });
  });

  it("parks at the max when dragged past the last lap, until dragged back", () => {
    let s = { hourOffset: 120, prev: 58, pinned: null as "min" | "max" | null };
    let r = dragStep(s, 2, 180);
    expect(r.minutes).toBe(180);
    r = dragStep(r.state, 20, 180);
    expect(r.minutes).toBe(180);
    r = dragStep({ ...r.state, prev: 5 }, 57, 180);
    expect(r.minutes).toBe(177);
    s = r.state;
    expect(s.pinned).toBeNull();
  });

  it("parks at 1 minute when dragged back past 12 in the first lap", () => {
    let r = dragStep({ hourOffset: 0, prev: 2, pinned: null }, 58, 180);
    expect(r.minutes).toBe(1);
    r = dragStep(r.state, 40, 180);
    expect(r.minutes).toBe(1);
    r = dragStep({ ...r.state, prev: 55 }, 3, 180);
    expect(r.minutes).toBe(3);
  });

  it("still moves between laps inside the range", () => {
    const r = dragStep({ hourOffset: 60, prev: 59, pinned: null }, 1, 180);
    expect(r.minutes).toBe(121);
  });

  it("clamps to whole minutes within range", () => {
    expect(clampMinutes(-5, 180)).toBe(1);
    expect(clampMinutes(24.6, 180)).toBe(25);
    expect(clampMinutes(400, 180)).toBe(180);
  });

  it("draws slices", () => {
    expect(slicePath(0, 0, 10, 0)).toBe("");
    expect(slicePath(0, 0, 10, 0.25)).toBe("M 0 0 L 0 -10 A 10 10 0 0 1 10.000 0.000 Z");
    expect(slicePath(0, 0, 10, 0.75)).toContain(" 0 1 1 ");
    expect(slicePath(0, 0, 10, 1)).toContain("A 10 10 0 1 1 0 10");
  });
});
