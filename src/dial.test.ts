import { describe, expect, it } from "vitest";
import { clampMinutes, minuteAt, nextHourOffset, slicePath } from "./dial";

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
