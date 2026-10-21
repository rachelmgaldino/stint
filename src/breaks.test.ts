import { describe, expect, it } from "vitest";
import { focusSinceLongBreak, nextBreak } from "./breaks";
import { defaultSettings, type SessionRecord } from "./store";

const MIN = 60_000;
const settings = { ...defaultSettings, breakMinutes: 5, longBreakMinutes: 15, longBreakAfter: 90 };

let id = 0;
function s(kind: "focus" | "break", startMin: number, lengthMin: number): SessionRecord {
  return {
    id: ++id,
    kind,
    intention: "",
    categoryId: null,
    startedAt: startMin * MIN,
    endedAt: (startMin + lengthMin) * MIN,
    plannedMs: lengthMin * MIN,
    focusedMs: lengthMin * MIN,
    reflection: "",
    rating: 0,
  };
}

describe("nextBreak", () => {
  it("is short until 90 minutes of focus have piled up", () => {
    expect(nextBreak([], settings, 25 * MIN)).toEqual({ minutes: 5, long: false });
    const day = [s("focus", 0, 25), s("break", 25, 5), s("focus", 30, 25), s("break", 55, 5)];
    expect(nextBreak(day, settings, 25 * MIN)).toEqual({ minutes: 5, long: false });
    expect(nextBreak(day, settings, 40 * MIN)).toEqual({ minutes: 15, long: true });
  });

  it("starts counting again after a long break", () => {
    const day = [s("focus", 0, 50), s("break", 50, 5), s("focus", 55, 50), s("break", 105, 15)];
    expect(focusSinceLongBreak(day, settings)).toBe(0);
    expect(nextBreak(day, settings, 50 * MIN).long).toBe(false);
  });

  it("counts a short break that ran long as a long break", () => {
    const day = [s("focus", 0, 90), s("break", 90, 20)];
    expect(focusSinceLongBreak(day, settings, 10 * MIN)).toBe(10 * MIN);
  });
});
