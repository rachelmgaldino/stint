import { describe, expect, it } from "vitest";
import { addDays, atTime, clockTime, fromIsoDate, inputTime, isoDate, startOfDay, startOfWeek, timeRange, timeSpan, weekDays } from "./dates";
import { setLanguage } from "./i18n";

// setLanguage sets the page's lang, so tests give it a stand-in document.
(globalThis as { document?: unknown }).document ??= { documentElement: {} };

describe("dates", () => {
  const sat = new Date(2026, 9, 17, 21, 14).getTime();

  it("finds the start of the day and week (weeks start on Monday)", () => {
    expect(startOfDay(sat)).toBe(new Date(2026, 9, 17).getTime());
    expect(startOfWeek(sat)).toBe(new Date(2026, 9, 12).getTime());
    const sun = new Date(2026, 9, 18, 8).getTime();
    expect(startOfWeek(sun)).toBe(new Date(2026, 9, 12).getTime());
  });

  it("lists the seven days of the week", () => {
    const days = weekDays(sat);
    expect(days).toHaveLength(7);
    expect(new Date(days[6]).getDate()).toBe(18);
  });

  it("adds days across a month boundary", () => {
    expect(addDays(new Date(2026, 9, 31).getTime(), 1)).toBe(new Date(2026, 10, 1).getTime());
  });

  it("formats and parses date input values", () => {
    const day = new Date(2026, 9, 18).getTime();
    expect(isoDate(day + 5 * 3_600_000)).toBe("2026-10-18");
    expect(fromIsoDate("2026-10-18")).toBe(day);
    expect(fromIsoDate("2026-02-30")).toBeNull();
    expect(fromIsoDate("")).toBeNull();
  });

  it("formats and parses clock times", () => {
    setLanguage("en");
    expect(clockTime(sat)).toBe("9:14\u00a0PM");
    expect(clockTime(startOfDay(sat) + 5 * 60_000)).toBe("12:05\u00a0AM");
    expect(inputTime(sat)).toBe("21:14");
    setLanguage("pt-BR");
    expect(clockTime(sat)).toBe("21:14");
    setLanguage("en");
    const day = startOfDay(sat);
    expect(atTime(day, "9:05")).toBe(new Date(2026, 9, 17, 9, 5).getTime());
    expect(atTime(day, "24:00")).toBeNull();
    expect(atTime(day, "nope")).toBeNull();
  });

  it("says AM or PM once when a range stays in the same half of the day", () => {
    setLanguage("en");
    const day = startOfDay(sat);
    const at = (h: number, m: number) => day + (h * 60 + m) * 60_000;
    expect(timeRange(at(21, 14), at(21, 39))).toBe("9:14 to 9:39\u00a0PM");
    expect(timeRange(at(11, 30), at(12, 15))).toBe("11:30\u00a0AM to 12:15\u00a0PM");
    expect(timeSpan(at(9, 0), at(10, 30))).toBe("9:00–10:30\u00a0AM");
    setLanguage("pt-BR");
    expect(timeRange(at(21, 14), at(21, 39))).toBe("21:14 às 21:39");
    setLanguage("en");
  });
});
