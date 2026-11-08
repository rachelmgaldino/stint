import { describe, expect, it } from "vitest";
import { focusSinceLongBreak, nextBreak } from "./breaks";
import { defaultSettings, type SessionRecord, withDefaults } from "./store";

const MIN = 60_000;
const settings = { ...defaultSettings, breakMinutes: 5, longBreakMinutes: 15, longBreakAfter: 90 };

// Minutes count from 9:00 today, local time.
const NINE = new Date().setHours(9, 0, 0, 0);
const at = (min: number) => NINE + min * MIN;

let id = 0;
function s(kind: "focus" | "break", startMin: number, lengthMin: number): SessionRecord {
  return {
    id: ++id,
    kind,
    intention: "",
    categoryId: null,
    startedAt: at(startMin),
    endedAt: at(startMin + lengthMin),
    plannedMs: lengthMin * MIN,
    focusedMs: lengthMin * MIN,
    reflection: "",
    rating: 0,
  };
}

// Each list ends with the session just ended, and `now` is when it ended.
describe("nextBreak", () => {
  it("is short until 90 minutes of focus have piled up", () => {
    expect(nextBreak([s("focus", 0, 25)], settings, at(25))).toEqual({ minutes: 5, long: false });
    const day = [s("focus", 0, 25), s("break", 25, 5), s("focus", 30, 25), s("break", 55, 5)];
    expect(nextBreak([...day, s("focus", 60, 25)], settings, at(85))).toEqual({ minutes: 5, long: false });
    expect(nextBreak([...day, s("focus", 60, 40)], settings, at(100))).toEqual({ minutes: 15, long: true });
  });

  it("starts counting again after a long break", () => {
    const day = [s("focus", 0, 50), s("break", 50, 5), s("focus", 55, 50), s("break", 105, 15)];
    expect(focusSinceLongBreak(day, settings, at(120))).toBe(0);
    expect(nextBreak([...day, s("focus", 120, 50)], settings, at(170)).long).toBe(false);
  });

  it("counts a long break ended early as taken", () => {
    const endedEarly = { ...s("break", 60, 3), plannedMs: 15 * MIN };
    const day = [s("focus", 0, 60), endedEarly, s("focus", 63, 40)];
    expect(focusSinceLongBreak(day, settings, at(103))).toBe(40 * MIN);
    expect(nextBreak(day, settings, at(103))).toEqual({ minutes: 5, long: false });
  });

  it("counts a short break that ran long as a long break", () => {
    const ranLong = { ...s("break", 90, 20), plannedMs: 5 * MIN };
    expect(focusSinceLongBreak([s("focus", 0, 90), ranLong, s("focus", 110, 10)], settings, at(120))).toBe(10 * MIN);
  });

  it("leaves out yesterday's focus when Stint stayed open overnight", () => {
    // Two hours of focus yesterday afternoon, no long break, then one 50 minute session today.
    const yesterday = [s("focus", -24 * 60 + 300, 60), s("break", -24 * 60 + 360, 5), s("focus", -24 * 60 + 365, 60)];
    const today = [...yesterday, s("focus", 0, 50)];
    expect(focusSinceLongBreak(today, settings, at(50))).toBe(50 * MIN);
    expect(nextBreak(today, settings, at(50))).toEqual({ minutes: 5, long: false });
  });

  it("keeps counting a focus session that ran past midnight once it is saved", () => {
    // Focus 23:40 to 00:40, a 5 minute break, then 30 minutes more: 90 minutes in all.
    const day = [s("focus", -9 * 60 - 20, 60), s("break", -9 * 60 + 40, 5), s("focus", -9 * 60 + 45, 30)];
    expect(focusSinceLongBreak(day, settings, at(-9 * 60 + 75))).toBe(90 * MIN);
    expect(nextBreak(day, settings, at(-9 * 60 + 75))).toEqual({ minutes: 15, long: true });
  });

  it("offers the long break when it was saved no longer than the short one", () => {
    // Saved before Settings kept the long break longer: every short break counted as long.
    const saved = withDefaults({ breakMinutes: 10, longBreakMinutes: 5, longBreakAfter: 60 });
    const day = [s("focus", 0, 40), s("break", 40, 10), s("focus", 50, 40), s("break", 90, 10), s("focus", 100, 40)];
    expect(nextBreak(day, saved, at(140))).toEqual({ minutes: 11, long: true });
  });

  it("starts counting again after time away as long as a long break", () => {
    // An hour in the morning and an hour in the evening are not one stretch of work.
    expect(nextBreak([s("focus", 0, 60), s("focus", 10 * 60, 60)], settings, at(11 * 60))).toEqual({ minutes: 5, long: false });
    // A 5 minute break and 10 more minutes away add up to a long break's 15.
    const back = [s("focus", 0, 50), s("break", 50, 5), s("focus", 65, 50)];
    expect(focusSinceLongBreak(back, settings, at(115))).toBe(50 * MIN);
  });

  it("counts the time before picking Break as time away", () => {
    // 100 minutes of focus, then Break picked on the plan card right away or 20 minutes later.
    const day = [s("focus", 0, 50), s("break", 50, 5), s("focus", 55, 50)];
    expect(nextBreak(day, settings, at(105))).toEqual({ minutes: 15, long: true });
    expect(nextBreak(day, settings, at(125))).toEqual({ minutes: 5, long: false });
  });
});
