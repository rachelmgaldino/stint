import { describe, expect, it } from "vitest";
import { addDays, atTime, clockTime, startOfDay, startOfWeek, weekDays } from "./dates";

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

  it("formats and parses clock times", () => {
    expect(clockTime(sat)).toBe("21:14");
    const day = startOfDay(sat);
    expect(atTime(day, "9:05")).toBe(new Date(2026, 9, 17, 9, 5).getTime());
    expect(atTime(day, "24:00")).toBeNull();
    expect(atTime(day, "nope")).toBeNull();
  });
});
