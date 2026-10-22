import { describe, expect, it } from "vitest";
import { focusSinceLongBreak, nextBreak } from "./breaks";
import { defaultSettings, type SessionRecord } from "./store";

const MIN = 60_000;
const settings = { ...defaultSettings, breakMinutes: 5, longBreakMinutes: 15, longBreakAfter: 90 };

// Minutes count from 9:00 today, local time, so every session falls on today.
const NINE = new Date().setHours(9, 0, 0, 0);
const NOW = NINE + 12 * 60 * MIN;

let id = 0;
function s(kind: "focus" | "break", startMin: number, lengthMin: number): SessionRecord {
  return {
    id: ++id,
    kind,
    intention: "",
    categoryId: null,
    startedAt: NINE + startMin * MIN,
    endedAt: NINE + (startMin + lengthMin) * MIN,
    plannedMs: lengthMin * MIN,
    focusedMs: lengthMin * MIN,
    reflection: "",
    rating: 0,
  };
}

describe("nextBreak", () => {
  it("is short until 90 minutes of focus have piled up", () => {
    expect(nextBreak([], settings, 25 * MIN, NOW)).toEqual({ minutes: 5, long: false });
    const day = [s("focus", 0, 25), s("break", 25, 5), s("focus", 30, 25), s("break", 55, 5)];
    expect(nextBreak(day, settings, 25 * MIN, NOW)).toEqual({ minutes: 5, long: false });
    expect(nextBreak(day, settings, 40 * MIN, NOW)).toEqual({ minutes: 15, long: true });
  });

  it("starts counting again after a long break", () => {
    const day = [s("focus", 0, 50), s("break", 50, 5), s("focus", 55, 50), s("break", 105, 15)];
    expect(focusSinceLongBreak(day, settings, 0, NOW)).toBe(0);
    expect(nextBreak(day, settings, 50 * MIN, NOW).long).toBe(false);
  });

  it("counts a short break that ran long as a long break", () => {
    const day = [s("focus", 0, 90), s("break", 90, 20)];
    expect(focusSinceLongBreak(day, settings, 10 * MIN, NOW)).toBe(10 * MIN);
  });

  it("leaves out yesterday's focus when Stint stayed open overnight", () => {
    // Two hours of focus yesterday afternoon, no long break, then one 50 minute session today.
    const yesterday = [s("focus", -24 * 60 + 300, 60), s("break", -24 * 60 + 360, 5), s("focus", -24 * 60 + 365, 60)];
    expect(focusSinceLongBreak(yesterday, settings, 50 * MIN, NOW)).toBe(50 * MIN);
    expect(nextBreak(yesterday, settings, 50 * MIN, NOW)).toEqual({ minutes: 5, long: false });
  });
});
