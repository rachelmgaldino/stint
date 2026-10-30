import { afterEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  addableCalendars,
  addEvent,
  canDelete,
  canEdit,
  countable,
  defaultEventCalendar,
  errorStatus,
  eventBody,
  eventErrorKey,
  eventGone,
  eventKey,
  eventLanes,
  meetState,
  nearestColorId,
  newEventId,
  sessionEvent,
  syncs,
  toCalendarEvent,
  waitForMeet,
  type CalendarEvent,
  type GoogleCalendar,
} from "./google";
import { setLanguage } from "./i18n";
import type { SessionRecord } from "./store";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: () => false }));

const MIN = 60_000;
const HOUR = 60 * MIN;

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

  it("makes one event for a session with several tasks, listing them", () => {
    const start = Date.parse("2026-10-24T13:00:00Z");
    const part = (id: number, intention: string, from: number, to: number, reflection = ""): SessionRecord => ({
      id,
      kind: "focus",
      intention,
      categoryId: 1,
      startedAt: start + from * MIN,
      endedAt: start + to * MIN,
      plannedMs: 60 * MIN,
      focusedMs: (to - from) * MIN,
      reflection,
      rating: 2,
      partOf: start,
    });
    const parts = [part(8, "Task AFD", 0, 22), part(9, "Ponto", 22, 53, "Compared both reports.")];
    const e = sessionEvent(parts[0], { id: 1, name: "Peoplenity", color: "#8f7fe0" }, parts);
    expect(e.summary).toBe("Task AFD +1 · Peoplenity");
    expect(e.description).toContain("Focused: 53m");
    expect(e.description).toContain("Task AFD (22m)");
    expect(e.description).toContain("Ponto (31m)");
    expect(e.description).toContain("Compared both reports.");
    expect(e.start.dateTime).toBe("2026-10-24T13:00:00.000Z");
    expect(e.end.dateTime).toBe("2026-10-24T13:53:00.000Z");
    expect(e.extendedProperties.private.stintId).toBe("8");
  });

  it("puts overlapping events side by side", () => {
    const ev = (id: string, h1: number, h2: number): CalendarEvent => ({
      id,
      calendarId: "c",
      title: id,
      untitled: false,
      color: "#000",
      start: h1 * 60 * MIN,
      end: h2 * 60 * MIN,
      allDay: false,
      writable: false,
      shared: false,
      recurring: false,
      joinUrl: null,
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

  it("syncs a session unless its category is skipped, and breaks only when asked", () => {
    const s: SessionRecord = {
      id: 1,
      kind: "focus",
      intention: "",
      categoryId: 2,
      startedAt: 0,
      endedAt: 30 * MIN,
      plannedMs: 30 * MIN,
      focusedMs: 30 * MIN,
      reflection: "",
      rating: 2,
    };
    const cal = { syncBreaks: false, skipCategories: [2] };
    expect(syncs(s, cal)).toBe(false);
    expect(syncs({ ...s, categoryId: 1 }, cal)).toBe(true);
    expect(syncs({ ...s, categoryId: null }, cal)).toBe(true);
    expect(syncs({ ...s, kind: "break", categoryId: null }, cal)).toBe(false);
    expect(syncs({ ...s, kind: "break", categoryId: null }, { ...cal, syncBreaks: true })).toBe(true);
  });

  it("counts only timed events that are over", () => {
    const e: CalendarEvent = {
      id: "x",
      calendarId: "me",
      title: "Review",
      untitled: false,
      color: "#e67c73",
      start: 0,
      end: 60 * MIN,
      allDay: false,
      writable: false,
      shared: false,
      recurring: false,
      joinUrl: null,
    };
    expect(eventKey(e)).toBe("me/x");
    expect(countable(e, 60 * MIN)).toBe(true);
    expect(countable(e, 30 * MIN)).toBe(false);
    expect(countable({ ...e, allDay: true }, 120 * MIN)).toBe(false);
  });

  it("takes writable from the calendar, and shared and recurring from the event", () => {
    const api = { id: "a", start: { dateTime: "2026-10-18T09:00:00Z" }, end: { dateTime: "2026-10-18T10:00:00Z" } };
    const cal = { id: "me@x", color: "#039be5" };
    expect(toCalendarEvent(api, cal)).toMatchObject({ writable: false, shared: false, recurring: false });
    expect(toCalendarEvent(api, { ...cal, writable: true })?.writable).toBe(true);
    expect(toCalendarEvent({ ...api, attendees: [{ self: true }, {}] }, cal)?.shared).toBe(true);
    expect(toCalendarEvent({ ...api, attendees: [{ self: true }] }, cal)?.shared).toBe(false);
    expect(toCalendarEvent({ ...api, recurringEventId: "base" }, cal)?.recurring).toBe(true);
  });

  it("counts an event someone else organizes as shared, even with no guests listed", () => {
    const api = { id: "a", start: { dateTime: "2026-10-18T09:00:00Z" }, end: { dateTime: "2026-10-18T10:00:00Z" } };
    const cal = { id: "me@x", color: "#039be5" };
    expect(toCalendarEvent({ ...api, organizer: { self: false } }, cal)?.shared).toBe(true);
    // Google's default for `self` is false, so leaving it out means the same.
    expect(toCalendarEvent({ ...api, organizer: {} }, cal)?.shared).toBe(true);
    expect(toCalendarEvent({ ...api, organizer: { self: true } }, cal)?.shared).toBe(false);
    expect(toCalendarEvent(api, cal)?.shared).toBe(false);
  });

  it("marks an event with no title, and names it in the chosen language", () => {
    const api = { id: "a", start: { dateTime: "2026-10-18T09:00:00Z" }, end: { dateTime: "2026-10-18T10:00:00Z" } };
    const cal = { id: "me@x", color: "#039be5" };
    expect(toCalendarEvent({ ...api, summary: "Standup" }, cal)).toMatchObject({ title: "Standup", untitled: false });
    expect(toCalendarEvent({ ...api, summary: "" }, cal)).toMatchObject({ title: "(No title)", untitled: true });
    vi.stubGlobal("document", { documentElement: {} });
    setLanguage("pt-BR");
    expect(toCalendarEvent(api, cal)).toMatchObject({ title: "(Sem título)", untitled: true });
    setLanguage("en");
    vi.unstubAllGlobals();
  });

  it("reads how far along a Meet link is", () => {
    const status = (statusCode?: string) => ({ conferenceData: { createRequest: { status: { statusCode } } } });
    expect(meetState({ hangoutLink: "https://meet.google.com/abc" })).toBe("ready");
    expect(meetState({ hangoutLink: "https://meet.google.com/abc", ...status("pending") })).toBe("ready");
    expect(meetState(status("success"))).toBe("ready");
    expect(meetState(status("failure"))).toBe("failed");
    expect(meetState(status("pending"))).toBe("pending");
    expect(meetState(status())).toBe("pending");
    expect(meetState({})).toBe("pending");
  });

  it("finds the status in the desktop shell's error text", () => {
    expect(errorStatus('Google Calendar returned 404 Not Found: {"error":{"code":404}}')).toBe(404);
    expect(errorStatus("Google Calendar returned 503 Service Unavailable: ")).toBe(503);
    expect(errorStatus("Google refused the sign-in: invalid_grant")).toBeNull();
    expect(errorStatus("error sending request for url (https://www.googleapis.com:443/)")).toBeNull();
    expect(errorStatus(undefined)).toBeNull();
  });

  it("sorts failures into what the user can do about them", () => {
    const returned = (code: string) => `Google Calendar returned ${code}: {}`;
    expect(eventErrorKey(returned("401 Unauthorized"))).toBe("needsReconnect");
    expect(eventErrorKey(returned("403 Forbidden"))).toBe("needsReconnect");
    expect(eventErrorKey("Google refused the sign-in: invalid_grant")).toBe("needsReconnect");
    expect(eventErrorKey("Google Calendar isn't connected.")).toBe("needsReconnect");
    expect(eventErrorKey(returned("400 Bad Request"))).toBe("googleRefused");
    expect(eventErrorKey(returned("404 Not Found"))).toBe("googleRefused");
    expect(eventErrorKey(returned("500 Internal Server Error"))).toBe("googleRefused");
    expect(eventErrorKey("error sending request for url (https://www.googleapis.com/)")).toBe("saveFailed");
  });

  it("treats only 404 and 410 as an event already gone", () => {
    expect(eventGone("Google Calendar returned 404 Not Found: {}")).toBe(true);
    expect(eventGone("Google Calendar returned 410 Gone: {}")).toBe(true);
    expect(eventGone("Google Calendar returned 403 Forbidden: {}")).toBe(false);
    expect(eventGone("network down")).toBe(false);
  });

  it("makes event ids from characters Google allows", () => {
    const id = newEventId();
    expect(id).toMatch(/^[0-9a-f]+$/);
    expect(id).toHaveLength(32);
    expect(newEventId()).not.toBe(id);
  });

  it("asks for a Meet link only when the draft does, with a new request id each time", () => {
    const draft = { title: "Sync", start: 0, end: HOUR };
    expect(eventBody(draft)).not.toHaveProperty("conferenceData");
    const body = eventBody({ ...draft, meet: true });
    const request = body.conferenceData?.createRequest;
    expect(request?.conferenceSolutionKey.type).toBe("hangoutsMeet");
    expect(request?.requestId).toBeTruthy();
    expect(eventBody({ ...draft, meet: true }).conferenceData?.createRequest.requestId).not.toBe(request?.requestId);
  });

  it("keeps the id out of the shared body, and reuses it for the Meet request", () => {
    const draft = { title: "Sync", start: 0, end: HOUR, id: "abc123" };
    expect(eventBody(draft)).not.toHaveProperty("id");
    const body = eventBody({ ...draft, meet: true });
    expect(body).not.toHaveProperty("id");
    expect(body.conferenceData?.createRequest.requestId).toBe("abc123");
  });

  it("finds the https link to join an event", () => {
    const api = { id: "a", start: { dateTime: "2026-10-18T09:00:00Z" }, end: { dateTime: "2026-10-18T10:00:00Z" } };
    const cal = { id: "me@x", color: "#039be5" };
    const meet = "https://meet.google.com/abc-defg-hij";
    const join = (extra: object) => toCalendarEvent({ ...api, ...extra }, cal)?.joinUrl;
    expect(join({})).toBeNull();
    expect(join({ hangoutLink: meet })).toBe(meet);
    expect(join({ conferenceData: { entryPoints: [{ entryPointType: "phone", uri: "tel:+1-555" }, { entryPointType: "video", uri: meet }] } })).toBe(meet);
    expect(join({ conferenceData: { entryPoints: [{ entryPointType: "phone", uri: "https://tel.meet/abc" }] } })).toBeNull();
    expect(join({ hangoutLink: "http://meet.google.com/abc-defg-hij" })).toBeNull();
  });

  it("lets only the user's own one-off events be deleted, and timed ones under a day be edited", () => {
    const e: CalendarEvent = {
      id: "x",
      calendarId: "me",
      title: "Dentist",
      untitled: false,
      color: "#e67c73",
      start: 0,
      end: HOUR,
      allDay: false,
      writable: true,
      shared: false,
      recurring: false,
      joinUrl: null,
    };
    expect(canDelete(e)).toBe(true);
    expect(canEdit(e)).toBe(true);
    for (const blocked of [{ writable: false }, { shared: true }, { recurring: true }]) {
      expect(canDelete({ ...e, ...blocked })).toBe(false);
      expect(canEdit({ ...e, ...blocked })).toBe(false);
    }
    expect(canDelete({ ...e, allDay: true })).toBe(true);
    expect(canEdit({ ...e, allDay: true })).toBe(false);
    expect(canDelete({ ...e, end: 24 * HOUR })).toBe(true);
    expect(canEdit({ ...e, end: 24 * HOUR })).toBe(false);
    expect(canEdit({ ...e, end: 24 * HOUR - 1 })).toBe(true);
  });

  it("builds an event body that leaves the rest to Google's defaults", () => {
    const start = Date.parse("2026-10-18T13:00:00Z");
    const body = eventBody({ title: "Dentist", start, end: start + 45 * MIN });
    expect(body).toEqual({
      summary: "Dentist",
      start: { dateTime: "2026-10-18T13:00:00.000Z" },
      end: { dateTime: "2026-10-18T13:45:00.000Z" },
    });
    expect(body).not.toHaveProperty("extendedProperties");
    expect(body).not.toHaveProperty("transparency");
    expect(body).not.toHaveProperty("reminders");
  });

  describe("adding an event", () => {
    const api = vi.mocked(invoke);
    const draft = { title: "Sync", start: 0, end: HOUR, id: "abc123" };
    const taken = "Google Calendar returned 409 Conflict: {}";
    const pending = { conferenceData: { createRequest: { status: { statusCode: "pending" } } } };
    afterEach(() => {
      api.mockReset();
      vi.useRealTimers();
    });

    it("sends the id, and reports no Meet when none was asked for", async () => {
      api.mockResolvedValueOnce({ id: "abc123" });
      await expect(addEvent("me@x", draft)).resolves.toEqual({ id: "abc123", meet: null });
      expect(api).toHaveBeenCalledWith("google_request", {
        method: "POST",
        path: "/calendars/me%40x/events",
        body: expect.objectContaining({ id: "abc123", summary: "Sync" }),
      });
    });

    it("reports how the Meet link stands in Google's answer", async () => {
      api.mockResolvedValueOnce({ id: "abc123", hangoutLink: "https://meet.google.com/abc" });
      await expect(addEvent("me", { ...draft, meet: true })).resolves.toEqual({ id: "abc123", meet: "ready" });
      expect(api.mock.calls[0][1]).toMatchObject({ path: "/calendars/me/events?conferenceDataVersion=1" });
      api.mockResolvedValueOnce({ id: "abc123", ...pending });
      await expect(addEvent("me", { ...draft, meet: true })).resolves.toEqual({ id: "abc123", meet: "pending" });
    });

    it("takes a 409 as the earlier try having worked, and saves what the form has now", async () => {
      api.mockRejectedValueOnce(taken).mockResolvedValueOnce({});
      await expect(addEvent("me", draft)).resolves.toEqual({ id: "abc123", meet: null });
      expect(api).toHaveBeenCalledTimes(2);
      expect(api.mock.calls[1][1]).toMatchObject({ method: "PATCH", path: "/calendars/me/events/abc123" });
    });

    it("reads the Meet state with a GET after a 409", async () => {
      api.mockRejectedValueOnce(taken).mockResolvedValueOnce({}).mockResolvedValueOnce({ hangoutLink: "https://meet.google.com/abc" });
      await expect(addEvent("me", { ...draft, meet: true })).resolves.toEqual({ id: "abc123", meet: "ready" });
      expect(api.mock.calls[2][1]).toMatchObject({ method: "GET", path: "/calendars/me/events/abc123" });
    });

    it("still counts as added when that GET fails", async () => {
      api.mockRejectedValueOnce(taken).mockResolvedValueOnce({}).mockRejectedValueOnce("network down");
      await expect(addEvent("me", { ...draft, meet: true })).resolves.toEqual({ id: "abc123", meet: "pending" });
    });

    it("passes on any other failure, and a 409 it has no id for", async () => {
      api.mockRejectedValueOnce("Google Calendar returned 400 Bad Request: {}");
      await expect(addEvent("me", draft)).rejects.toContain("400");
      api.mockRejectedValueOnce(taken);
      await expect(addEvent("me", { title: "Sync", start: 0, end: HOUR })).rejects.toBe(taken);
    });

    it("waits for the Meet link, looking every 1.5 seconds", async () => {
      vi.useFakeTimers();
      api.mockResolvedValueOnce(pending).mockResolvedValueOnce({ hangoutLink: "https://meet.google.com/abc" });
      const wait = waitForMeet("me", "abc123");
      await vi.advanceTimersByTimeAsync(1499);
      expect(api).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1501);
      await expect(wait).resolves.toBe(true);
      expect(api).toHaveBeenCalledTimes(2);
    });

    it("stops waiting when Google says the link failed", async () => {
      vi.useFakeTimers();
      api.mockResolvedValueOnce({ conferenceData: { createRequest: { status: { statusCode: "failure" } } } });
      const wait = waitForMeet("me", "abc123");
      await vi.advanceTimersByTimeAsync(1500);
      await expect(wait).resolves.toBe(false);
      expect(api).toHaveBeenCalledTimes(1);
    });

    it("gives up after six looks, and a failed look doesn't reject", async () => {
      vi.useFakeTimers();
      api.mockResolvedValue(pending);
      api.mockRejectedValueOnce("network down");
      const wait = waitForMeet("me", "abc123");
      await vi.advanceTimersByTimeAsync(9000);
      await expect(wait).resolves.toBe(false);
      expect(api).toHaveBeenCalledTimes(6);
    });
  });

  describe("choosing a calendar for a new event", () => {
    const c = (id: string, over: Partial<GoogleCalendar> = {}): GoogleCalendar => ({ id, name: id, color: "#000", primary: false, writable: true, ...over });

    it("offers only writable calendars that are not hidden", () => {
      const cals = [c("mine"), c("holidays", { writable: false }), c("hidden")];
      expect(addableCalendars(cals, ["hidden"]).map((x) => x.id)).toEqual(["mine"]);
    });

    it("prefers the last used, then the primary, then the first", () => {
      const cals = [c("a"), c("b", { primary: true }), c("d")];
      expect(defaultEventCalendar(cals, "d")?.id).toBe("d");
      expect(defaultEventCalendar(cals, null)?.id).toBe("b");
      expect(defaultEventCalendar(cals, "gone")?.id).toBe("b");
      expect(defaultEventCalendar([c("a"), c("d")], "gone")?.id).toBe("a");
      expect(defaultEventCalendar([], "gone")).toBeNull();
    });
  });
});
