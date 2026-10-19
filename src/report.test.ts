import { afterEach, describe, expect, it } from "vitest";
import { dayCsv, daySummary, hoursMinutes, isoDay } from "./report";
import { setLanguage } from "./i18n";
import type { Category, SessionRecord } from "./store";

const MIN = 60_000;
const cats: Category[] = [
  { id: 1, name: "Peoplenity", color: "#d94545" },
  { id: 2, name: "Study", color: "#4f8ee8" },
];
const day = new Date(2026, 9, 19).getTime();
const at = (h: number, m = 0) => new Date(2026, 9, 19, h, m).getTime();

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

const sessions = [
  session("focus", at(13), 30, { categoryId: 2, intention: "Course" }),
  session("focus", at(9), 90, { intention: "Payroll, March", rating: 3, reflection: 'Said "done"' }),
  session("break", at(10, 30), 15),
];

// setLanguage sets the page's lang, so tests give it a stand-in document.
(globalThis as { document?: unknown }).document ??= { documentElement: {} };
afterEach(() => setLanguage("en"));

describe("day report", () => {
  it("names the file's day and writes hours as h:mm", () => {
    expect(isoDay(day)).toBe("2026-10-19");
    expect(hoursMinutes(95 * MIN)).toBe("1:35");
    expect(hoursMinutes(0)).toBe("0:00");
  });

  it("lists the day in order with totals per category", () => {
    setLanguage("en");
    const rows = dayCsv(day, sessions, cats).replace("﻿", "").trim().split("\r\n");
    expect(rows[0]).toBe("Date,Start,End,Type,Category,Intention,Duration,Hours,Felt,Notes");
    expect(rows[1]).toBe('2026-10-19,09:00,10:30,Focus,Peoplenity,"Payroll, March",1:30,1.50,Focused,"Said ""done"""');
    expect(rows[2]).toBe("2026-10-19,10:30,10:45,Break,,,0:15,0.25,,");
    expect(rows[3]).toBe("2026-10-19,13:00,13:30,Focus,Study,Course,0:30,0.50,,");
    expect(rows.slice(4)).toEqual([
      "",
      "Totals,,,,,,Duration,Hours",
      "2026-10-19,,,Focus,Peoplenity,,1:30,1.50",
      "2026-10-19,,,Focus,Study,,0:30,0.50",
      "2026-10-19,,,All focus,,,2:00,2.00",
      "2026-10-19,,,All breaks,,,0:15,0.25",
    ]);
  });

  it("uses semicolons and decimal commas in Portuguese", () => {
    setLanguage("pt-BR");
    const rows = dayCsv(day, sessions, cats).replace("﻿", "").split("\r\n");
    expect(rows[1]).toBe('2026-10-19;09:00;10:30;Foco;Peoplenity;Payroll, March;1:30;1,50;Focada;"Said ""done"""');
  });

  it("sums the day up in a few lines", () => {
    setLanguage("en");
    expect(daySummary(day, sessions, cats)).toBe(
      [
        "Stint · Monday, 19 October 2026",
        "Focused 2h in 2 sessions, breaks 15min",
        "9:00\u00a0AM to 1:30\u00a0PM",
        "",
        "Peoplenity: 1h30min",
        "Study: 30min",
        "",
        "9:00–10:30\u00a0AM  Peoplenity · Payroll, March (1h30min)",
        "10:30–10:45\u00a0AM  Break (15min)",
        "1:00–1:30\u00a0PM  Study · Course (30min)",
      ].join("\n"),
    );
  });
});
