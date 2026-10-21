import { describe, expect, it } from "vitest";
import { countable, eventKey, eventLanes, nearestColorId, sessionEvent, toCalendarEvent, type CalendarEvent } from "./google";
import type { SessionRecord } from "./store";

const MIN = 60_000;

describe("google calendar helpers", () => {
  it("maps category colours to the closest Google event colour", () => {
    expect(nearestColorId("#e8594f")).toBe("4"); // Work red → Flamingo
    expect(nearestColorId("#4f8ee8")).toBe("1"); // Study blue → Lavender
    expect(nearestColorId("#52b788")).toBe("2"); // Personal green → Sage
    expect(nearestColorId("var(--accent)")).toBe("7");
  });

  it("reads timed and all-day events and skips Stint's own", () => {
    const cal = { id: "me@x", color: "#039be5" };
    const timed = toCalendarEvent(
      { id: "a", summary: "Standup", start: { dateTime: "2026-10-18T09:00:00Z" }, end: { dateTime: "2026-10-18T09:15:00Z" } },
      cal,
    );
    expect(timed).toMatchObject({ title: "Standup", allDay: false, end: Date.parse("2026-10-18T09:15:00Z") });
    const allDay = toCalendarEvent({ id: "b", start: { date: "2026-10-18" }, end: { date: "2026-10-19" } }, cal);
    expect(allDay).toMatchObject({ title: "(No title)", allDay: true, start: new Date(2026, 9, 18).getTime() });
    const ours = toCalendarEvent(
      { id: "c", start: { dateTime: "2026-10-18T09:00:00Z" }, end: { dateTime: "2026-10-18T10:00:00Z" }, extendedProperties: { private: { stint: "1" } } },
      cal,
    );
    expect(ours).toBeNull();
  });

  it("describes a session as an event", () => {
    const start = Date.parse("2026-10-18T13:00:00Z");
    const s: SessionRecord = {
      id: 7,
      kind: "focus",
      intention: "Hiring plan",
      categoryId: 1,
      startedAt: start,
      endedAt: start + 50 * MIN,
      plannedMs: 45 * MIN,
      focusedMs: 50 * MIN,
      reflection: "Drafted the role.",
      rating: 3,
    };
    const e = sessionEvent(s, { id: 1, name: "Work", color: "#e8594f" });
    expect(e.summary).toBe("Hiring plan · Work");
    expect(e.description).toContain("Focused: 50m");
    expect(e.description).toContain("Mood: Focused");
    expect(e.description).toContain("Drafted the role.");
    expect(e.end.dateTime).toBe("2026-10-18T13:50:00.000Z");
    expect(e.extendedProperties.private.stint).toBe("1");
  });

  it("puts overlapping events side by side", () => {
    const ev = (id: string, h1: number, h2: number): CalendarEvent => ({
      id,
      calendarId: "c",
      title: id,
      color: "#000",
      start: h1 * 60 * MIN,
      end: h2 * 60 * MIN,
      allDay: false,
    });
    const laid = eventLanes([ev("a", 9, 11), ev("b", 10, 12), ev("c", 11, 12), ev("d", 13, 14)]);
    const by = Object.fromEntries(laid.map((l) => [l.event.id, [l.lane, l.lanes]]));
    expect(by).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 1] });
  });

  it("lays out sessions and events together", () => {
    const lanes = eventLanes([
      { start: 0, end: 30 * MIN, kind: "session" },
      { start: 10 * MIN, end: 20 * MIN, kind: "event" },
      { start: 40 * MIN, end: 50 * MIN, kind: "event" },
    ]);
    expect(lanes.map((l) => [l.event.kind, l.lane, l.lanes])).toEqual([
      ["session", 0, 2],
      ["event", 1, 2],
      ["event", 0, 1],
    ]);
  });

  it("counts only timed events that are over", () => {
    const e: CalendarEvent = { id: "x", calendarId: "me", title: "Review", color: "#e67c73", start: 0, end: 60 * MIN, allDay: false };
    expect(eventKey(e)).toBe("me/x");
    expect(countable(e, 60 * MIN)).toBe(true);
    expect(countable(e, 30 * MIN)).toBe(false);
    expect(countable({ ...e, allDay: true }, 120 * MIN)).toBe(false);
  });
});
