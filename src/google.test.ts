import { afterEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  addableCalendars,
  addEvent,
  addMeeting,
  addMeetTo,
  canDelete,
  canEdit,
  changeEvent,
  countable,
  defaultEventCalendar,
  errorStatus,
  eventBody,
  eventErrorKey,
  eventGone,
  eventKey,
  eventLanes,
  linkHost,
  meetingLink,
  meetState,
  nearestColorId,
  newEventId,
  sessionEvent,
  syncs,
  toCalendarEvent,
  waitForLink,
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
      location: "",
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
      location: "",
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

  it("keeps the id and any Meet request out of the shared body", () => {
    const body = eventBody({ title: "Sync", start: 0, end: HOUR, id: "abc123" });
    expect(body).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("conferenceData");
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
    expect(join({ hangoutLink: "https://" })).toBeNull();
  });

  it("takes a link from the location, but only when that's all the location is", () => {
    const api = { id: "a", start: { dateTime: "2026-10-18T09:00:00Z" }, end: { dateTime: "2026-10-18T10:00:00Z" } };
    const cal = { id: "me@x", color: "#039be5" };
    const zoom = "https://zoom.us/j/1";
    const meet = "https://meet.google.com/abc-defg-hij";
    const join = (extra: object) => toCalendarEvent({ ...api, ...extra }, cal)?.joinUrl;
    expect(join({ location: zoom })).toBe(zoom);
    expect(join({ location: "Rua das Flores, 123, Fortaleza" })).toBeNull();
    expect(join({ location: "https://zoom.us/j/1 room 4" })).toBeNull();
    expect(join({ location: "http://zoom.us/j/1" })).toBeNull();
    expect(join({ location: "https://" })).toBeNull();
    expect(join({ location: zoom, hangoutLink: meet })).toBe(meet);
    expect(join({ location: zoom, conferenceData: { entryPoints: [{ entryPointType: "video", uri: meet }] } })).toBe(meet);
  });

  it("keeps the location as Google has it, empty when there's none", () => {
    const api = { id: "a", start: { dateTime: "2026-10-18T09:00:00Z" }, end: { dateTime: "2026-10-18T10:00:00Z" } };
    const cal = { id: "me@x", color: "#039be5" };
    expect(toCalendarEvent(api, cal)?.location).toBe("");
    expect(toCalendarEvent({ ...api, location: "Rua das Flores, 123" }, cal)?.location).toBe("Rua das Flores, 123");
  });

  it("turns what was pasted into a meeting link", () => {
    expect(meetingLink("meet.google.com/abc")).toBe("https://meet.google.com/abc");
    expect(meetingLink("  meet.google.com/abc\n")).toBe("https://meet.google.com/abc");
    expect(meetingLink("zoom.us:8443/abc")).toBe("https://zoom.us:8443/abc");
    expect(meetingLink("https://zoom.us/j/1")).toBe("https://zoom.us/j/1");
    expect(meetingLink("http://x.com")).toBeNull();
    expect(meetingLink("hello")).toBeNull();
    expect(meetingLink("javascript:alert(1)")).toBeNull();
    expect(meetingLink("mailto:ana@x.com")).toBeNull();
    expect(meetingLink("")).toBeNull();
  });

  it("refuses anything with whitespace inside it", () => {
    expect(meetingLink("https://zoom.us/j/1 room 4")).toBeNull();
    expect(meetingLink("zoom.us/j/1\nroom")).toBeNull();
    expect(meetingLink("Rua das Flores, 123")).toBeNull();
  });

  it("gives back a link that reads as one when it's joined", () => {
    const link = meetingLink("HTTPS://zoom.us/x");
    expect(link).toBe("https://zoom.us/x");
    const api = { id: "a", location: link!, start: { dateTime: "2026-10-18T09:00:00Z" }, end: { dateTime: "2026-10-18T10:00:00Z" } };
    expect(toCalendarEvent(api, { id: "me@x", color: "#039be5" })?.joinUrl).toBe(link);
    expect(meetingLink("meet.google.com:443/abc")).toBe("https://meet.google.com/abc");
  });

  it("writes the location only when the draft has a link, even an empty one", () => {
    const draft = { title: "Sync", start: 0, end: HOUR };
    expect(eventBody(draft)).not.toHaveProperty("location");
    expect(eventBody({ ...draft, link: "https://zoom.us/j/1" })).toMatchObject({ location: "https://zoom.us/j/1" });
    expect(eventBody({ ...draft, link: "" })).toHaveProperty("location", "");
  });

  it("reads the host a link goes to", () => {
    expect(linkHost("https://meet.google.com/abc-defg-hij")).toBe("meet.google.com");
    expect(linkHost("not a link")).toBe("");
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
      location: "",
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
    afterEach(() => {
      api.mockReset();
    });

    it("sends the id, and gives back Google's", async () => {
      api.mockResolvedValueOnce({ id: "abc123" });
      await expect(addEvent("me@x", draft)).resolves.toBe("abc123");
      expect(api).toHaveBeenCalledWith("google_request", {
        method: "POST",
        path: "/calendars/me%40x/events",
        body: expect.objectContaining({ id: "abc123", summary: "Sync" }),
      });
    });

    it("takes a 409 as the earlier try having worked, and saves what the form has now", async () => {
      api.mockRejectedValueOnce(taken).mockResolvedValueOnce({});
      await expect(addEvent("me", draft)).resolves.toBe("abc123");
      expect(api).toHaveBeenCalledTimes(2);
      expect(api.mock.calls[1][1]).toMatchObject({ method: "PATCH", path: "/calendars/me/events/abc123" });
    });

    it("passes on any other failure, and a 409 it has no id for", async () => {
      api.mockRejectedValueOnce("Google Calendar returned 400 Bad Request: {}");
      await expect(addEvent("me", draft)).rejects.toContain("400");
      api.mockRejectedValueOnce(taken);
      await expect(addEvent("me", { title: "Sync", start: 0, end: HOUR })).rejects.toBe(taken);
    });
  });

  describe("making a Meet link", () => {
    const api = vi.mocked(invoke);
    const draft = { title: "Sync", start: 0, end: HOUR, id: "abc123" };
    const link = "https://meet.google.com/abc";
    const pending = { conferenceData: { createRequest: { status: { statusCode: "pending" } } } };
    const failed = { conferenceData: { createRequest: { status: { statusCode: "failure" } } } };
    afterEach(() => {
      api.mockReset();
      vi.useRealTimers();
    });

    it("waits for the link, looking every 1.5 seconds", async () => {
      vi.useFakeTimers();
      api.mockResolvedValueOnce(pending).mockResolvedValueOnce({ hangoutLink: link });
      const wait = waitForLink("me", "abc123");
      await vi.advanceTimersByTimeAsync(1499);
      expect(api).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1501);
      await expect(wait).resolves.toBe(link);
      expect(api).toHaveBeenCalledTimes(2);
      expect(api.mock.calls[0][1]).toMatchObject({ method: "GET", path: "/calendars/me/events/abc123" });
    });

    it("takes the video entry point when there's no hangoutLink", async () => {
      vi.useFakeTimers();
      api.mockResolvedValueOnce({ conferenceData: { entryPoints: [{ entryPointType: "video", uri: link }] } });
      const wait = waitForLink("me", "abc123");
      await vi.advanceTimersByTimeAsync(1500);
      await expect(wait).resolves.toBe(link);
    });

    it("stops waiting when Google says the link failed", async () => {
      vi.useFakeTimers();
      api.mockResolvedValueOnce(failed);
      const wait = waitForLink("me", "abc123");
      await vi.advanceTimersByTimeAsync(1500);
      await expect(wait).resolves.toBeNull();
      expect(api).toHaveBeenCalledTimes(1);
    });

    it("gives up after six looks, and a failed look counts as still waiting", async () => {
      vi.useFakeTimers();
      api.mockResolvedValue(pending);
      api.mockRejectedValueOnce("network down");
      const wait = waitForLink("me", "abc123");
      await vi.advanceTimersByTimeAsync(9000);
      await expect(wait).resolves.toBeNull();
      expect(api).toHaveBeenCalledTimes(6);
    });

    it("adds a new event and returns the link in Google's answer", async () => {
      api.mockResolvedValueOnce({ id: "abc123", hangoutLink: link });
      await expect(addMeeting("me@x", { ...draft, link: "" })).resolves.toEqual({ id: "abc123", link });
      expect(api).toHaveBeenCalledTimes(1);
      expect(api.mock.calls[0][1]).toMatchObject({
        method: "POST",
        path: "/calendars/me%40x/events?conferenceDataVersion=1",
        body: {
          id: "abc123",
          summary: "Sync",
          location: "",
          conferenceData: { createRequest: { requestId: "abc123", conferenceSolutionKey: { type: "hangoutsMeet" } } },
        },
      });
    });

    it("uses a fresh request id for a draft with no id", async () => {
      api.mockResolvedValueOnce({ id: "new", hangoutLink: link });
      await expect(addMeeting("me", { title: "Sync", start: 0, end: HOUR })).resolves.toEqual({ id: "new", link });
      const sent = api.mock.calls[0][1] as { body: { conferenceData: { createRequest: { requestId: string } } } };
      expect(sent.body.conferenceData.createRequest.requestId).toBeTruthy();
    });

    it("polls for the link when Google's answer doesn't have it yet", async () => {
      vi.useFakeTimers();
      api.mockResolvedValueOnce({ id: "abc123", ...pending }).mockResolvedValueOnce({ hangoutLink: link });
      const add = addMeeting("me", draft);
      await vi.advanceTimersByTimeAsync(1500);
      await expect(add).resolves.toEqual({ id: "abc123", link });
      expect(api.mock.calls[1][1]).toMatchObject({ method: "GET", path: "/calendars/me/events/abc123" });
    });

    it("takes a 409 as the earlier try having worked, and reads the link from it", async () => {
      api.mockRejectedValueOnce("Google Calendar returned 409 Conflict: {}").mockResolvedValueOnce({ hangoutLink: link });
      await expect(addMeeting("me", draft)).resolves.toEqual({ id: "abc123", link });
      expect(api).toHaveBeenCalledTimes(2);
      expect(api.mock.calls[1][1]).toMatchObject({ method: "GET", path: "/calendars/me/events/abc123" });
    });

    it("keeps waiting after a 409 if that event has no link yet", async () => {
      vi.useFakeTimers();
      api
        .mockRejectedValueOnce("Google Calendar returned 409 Conflict: {}")
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce({ hangoutLink: link });
      const add = addMeeting("me", draft);
      await vi.advanceTimersByTimeAsync(1500);
      await expect(add).resolves.toEqual({ id: "abc123", link });
    });

    it("passes on any other failure, and a 409 it has no id for", async () => {
      api.mockRejectedValueOnce("Google Calendar returned 400 Bad Request: {}");
      await expect(addMeeting("me", draft)).rejects.toContain("400");
      api.mockRejectedValueOnce("Google Calendar returned 409 Conflict: {}");
      await expect(addMeeting("me", { title: "Sync", start: 0, end: HOUR })).rejects.toContain("409");
      expect(api).toHaveBeenCalledTimes(2);
    });

    it("adds a link to an existing event, sending nothing but the conference", async () => {
      api.mockResolvedValueOnce({ hangoutLink: link });
      await expect(addMeetTo("me@x", "abc123")).resolves.toBe(link);
      const sent = api.mock.calls[0][1] as { method: string; path: string; body: object };
      expect(sent.method).toBe("PATCH");
      expect(sent.path).toBe("/calendars/me%40x/events/abc123?conferenceDataVersion=1");
      expect(Object.keys(sent.body)).toEqual(["conferenceData"]);
      expect(sent.body).toMatchObject({ conferenceData: { createRequest: { conferenceSolutionKey: { type: "hangoutsMeet" } } } });
    });

    it("polls for an existing event's link, and passes on a failed PATCH", async () => {
      vi.useFakeTimers();
      api.mockResolvedValueOnce(pending).mockResolvedValueOnce({ hangoutLink: link });
      const add = addMeetTo("me", "abc123");
      await vi.advanceTimersByTimeAsync(1500);
      await expect(add).resolves.toBe(link);
      api.mockRejectedValueOnce("Google Calendar returned 403 Forbidden: {}");
      await expect(addMeetTo("me", "abc123")).rejects.toContain("403");
    });
  });

  it("leaves conferenceDataVersion off a change, so an existing conference stays", async () => {
    const api = vi.mocked(invoke);
    api.mockResolvedValueOnce({});
    await changeEvent("me", "abc123", { title: "Sync", start: 0, end: HOUR });
    expect(api.mock.calls[0][1]).toMatchObject({ method: "PATCH", path: "/calendars/me/events/abc123" });
    api.mockReset();
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
