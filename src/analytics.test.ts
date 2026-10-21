import { describe, expect, it } from "vitest";
import { compactDuration, computeStats, daysCounted, nextRange, percentChange, previousRange, rangeFor, switchRange } from "./analytics";
import type { Category, SessionRecord } from "./store";

const MIN = 60_000;
const cats: Category[] = [
  { id: 1, name: "Peoplenity", color: "#d94545" },
  { id: 2, name: "Study", color: "#4f8ee8" },
];

let nextId = 1;
function session(kind: "focus" | "break", start: number, minutes: number, extra: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: nextId++,
    kind,
    intention: "",
    categoryId: kind === "focus" ? 1 : null,
    startedAt: start,
    endedAt: start + minutes * MIN,
    plannedMs: minutes * MIN,
    focusedMs: minutes * MIN,
    reflection: "",
    rating: 0,
    ...extra,
  };
}

describe("ranges", () => {
  const sat = new Date(2026, 9, 17, 21).getTime();

  it("builds day, week and month ranges", () => {
    expect(rangeFor("day", sat).from).toBe(new Date(2026, 9, 17).getTime());
    expect(rangeFor("week", sat).from).toBe(new Date(2026, 9, 12).getTime());
    const month = rangeFor("month", sat);
    expect(month.from).toBe(new Date(2026, 9, 1).getTime());
    expect(month.to).toBe(new Date(2026, 10, 1).getTime());
  });

  it("steps to the previous and next period", () => {
    expect(previousRange(rangeFor("month", sat)).from).toBe(new Date(2026, 8, 1).getTime());
    expect(nextRange(rangeFor("week", sat)).from).toBe(new Date(2026, 9, 19).getTime());
  });

  it("keeps the same day when switching between day, week and month", () => {
    const wed = new Date(2026, 9, 21, 10).getTime();
    let r = rangeFor("day", wed);
    for (const kind of ["week", "month", "week", "day", "week", "month", "week", "month", "week"] as const) {
      r = switchRange(r, kind);
      expect(r.kind).toBe(kind);
      expect(r.anchor).toBe(new Date(2026, 9, 21).getTime());
    }
    expect(r.from).toBe(new Date(2026, 9, 19).getTime());
    expect(switchRange(r, "month").from).toBe(new Date(2026, 9, 1).getTime());
    expect(switchRange(r, "day").from).toBe(new Date(2026, 9, 21).getTime());
  });

  it("moves the anchor along with the arrows", () => {
    const wed = new Date(2026, 9, 21).getTime();
    const lastWeek = previousRange(rangeFor("week", wed));
    expect(lastWeek.from).toBe(new Date(2026, 9, 12).getTime());
    expect(switchRange(lastWeek, "day").from).toBe(new Date(2026, 9, 14).getTime());
    const sep = previousRange(rangeFor("month", new Date(2026, 9, 31).getTime()));
    expect(sep.anchor).toBe(new Date(2026, 8, 30).getTime());
    // Coming back to the period with today in it lands on today.
    expect(nextRange(lastWeek, wed + 3600_000).anchor).toBe(wed);
  });

  it("counts days elapsed in the current period only", () => {
    expect(daysCounted(rangeFor("week", sat), sat)).toBe(6);
    expect(daysCounted(rangeFor("week", sat), new Date(2026, 11, 1).getTime())).toBe(7);
  });
});

describe("computeStats", () => {
  const day = new Date(2026, 9, 17).getTime();
  const at = (h: number, m: number) => day + (h * 60 + m) * MIN;
  const range = rangeFor("day", day);
  const sessions = [
    session("break", at(9, 13), 17),
    session("focus", at(9, 31), 63, { rating: 2 }),
    session("break", at(10, 35), 16),
    session("focus", at(10, 51), 38, { rating: 3, intention: "Hiring" }),
    session("break", at(11, 29), 9),
    session("focus", at(11, 38), 97, { rating: 3, categoryId: 2 }),
  ];
  const previous = [session("focus", at(9, 0) - 86_400_000, 100)];
  const s = computeStats(range, sessions, previous, cats, at(21, 0));

  it("totals focus and break time and compares with the previous day", () => {
    expect(s.totalFocus).toBe(198 * MIN);
    expect(s.totalBreak).toBe(42 * MIN);
    expect(s.focusChange).toBeCloseTo(98);
    expect(s.breakChange).toBeNull();
    expect(s.focusPerBreak).toBeCloseTo(198 / 42);
  });

  it("counts ratings and finds the most focused category", () => {
    expect(s.ratings).toEqual({ focused: 2, neutral: 1, distracted: 0 });
    // Peoplenity and Study have one great session each; Study has more time.
    expect(s.mostFocused).toBe("Study");
    expect(s.mostDistracted).toBeNull();
  });

  it("splits time by category, with breaks as their own row", () => {
    expect(s.categories.map((c) => [c.name, c.ms / MIN])).toEqual([
      ["Peoplenity", 101],
      ["Study", 97],
      ["Break", 42],
    ]);
    const total = s.categories.reduce((a, c) => a + c.ratio, 0);
    expect(total).toBeCloseTo(1);
  });

  it("groups by intention, falling back to the category name", () => {
    expect(s.intentions.map((i) => [i.name, i.sessions])).toEqual([
      ["Study", 1],
      ["Peoplenity", 1],
      ["Hiring", 1],
    ]);
  });

  it("formats durations and changes", () => {
    expect(compactDuration(198 * MIN)).toBe("3h18min");
    expect(compactDuration(43 * MIN)).toBe("43min");
    expect(compactDuration(120 * MIN)).toBe("2h");
    expect(percentChange(65, 100)).toBe(-35);
    expect(percentChange(5, 0)).toBeNull();
  });
});
