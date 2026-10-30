import { invoke, isTauri } from "@tauri-apps/api/core";
import type { CalendarSettings, Category, SessionRecord } from "./store";
import { formatDuration } from "./timer";
import { timeSpan } from "./dates";
import { t } from "./i18n";

// Google Calendar, through the desktop shell (src-tauri/src/google.rs), which
// holds the tokens. None of this works in a plain browser.

export type GoogleCalendar = { id: string; name: string; color: string; primary: boolean; writable: boolean };

export type CalendarEvent = {
  id: string;
  calendarId: string;
  title: string;
  /** Google has no title for it, so `title` is only a placeholder to show. */
  untitled: boolean;
  color: string;
  start: number;
  end: number;
  allDay: boolean;
  /** Its calendar is one the user owns or can write to. */
  writable: boolean;
  /** It has guests other than the user, or someone else organizes it. */
  shared: boolean;
  /** It is one occurrence of a repeating event. */
  recurring: boolean;
  /** Where to join its video call, if it has one. */
  joinUrl: string | null;
  /** Its location as Google has it, "" if none. */
  location: string;
};

/** `link` is written to the event's location; left out, the location stays as it is. */
export type EventDraft = { title: string; start: number; end: number; id?: string; link?: string };

export type MeetState = "ready" | "pending" | "failed";

/** Which message a failed save or delete shows; the same names as the strings in `events`. */
export type EventErrorKey = "saveFailed" | "needsReconnect" | "googleRefused";

export const googleAvailable = isTauri;

/** Names an event across calendars; a session made from it keeps this. */
export const eventKey = (e: CalendarEvent) => `${e.calendarId}/${e.id}`;

/** An event can count as focus once it is over, if it has a time of day. */
export const countable = (e: CalendarEvent, now: number) => !e.allDay && e.end <= now;

// Events with guests or that repeat stay in Google, where the guest-notification and this-or-all-occurrences choices live.
export const canDelete = (e: CalendarEvent) => e.writable && !e.shared && !e.recurring;
export const canEdit = (e: CalendarEvent) => canDelete(e) && !e.allDay && e.end - e.start < 24 * 3_600_000;

export const connect = (clientId: string, clientSecret: string) =>
  invoke<void>("google_connect", { clientId, clientSecret });
export const isConnected = () => (isTauri() ? invoke<boolean>("google_status") : Promise.resolve(false));
export const disconnect = () => invoke<void>("google_disconnect");
export const openMeeting = (url: string) => invoke<void>("google_open_meeting", { url });

function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  return invoke<T>("google_request", { method, path, body: body ?? null });
}

const enc = encodeURIComponent;

/** The HTTP status in the desktop shell's "Google Calendar returned 404 Not Found: ...", if it has one. */
export function errorStatus(err: unknown): number | null {
  const match = String(err).match(/Google Calendar returned (\d{3})\b/);
  return match ? Number(match[1]) : null;
}

/** The event is no longer on Google, so there's nothing left to change or delete. */
export const eventGone = (err: unknown) => [404, 410].includes(errorStatus(err) ?? 0);

/** Sorts a failure into a message of ours; Google's own text never reaches the screen. */
export function eventErrorKey(err: unknown): EventErrorKey {
  const message = String(err);
  const status = errorStatus(err);
  if (status === 401 || status === 403) return "needsReconnect";
  if (message.includes("Google refused the sign-in") || message.includes("Google Calendar isn't connected")) return "needsReconnect";
  return status === null ? "saveFailed" : "googleRefused";
}

type ListEntry = { id: string; summary: string; summaryOverride?: string; backgroundColor?: string; primary?: boolean; accessRole: string };

export async function listCalendars(): Promise<GoogleCalendar[]> {
  const r = await request<{ items?: ListEntry[] }>("GET", "/users/me/calendarList?maxResults=250");
  return (r.items ?? [])
    .map((c) => ({
      id: c.id,
      name: c.summaryOverride || c.summary,
      color: c.backgroundColor ?? "#4f8ee8",
      primary: !!c.primary,
      writable: c.accessRole === "owner" || c.accessRole === "writer",
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
}

type ApiEvent = {
  id: string;
  summary?: string;
  status?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
  recurringEventId?: string;
  attendees?: { self?: boolean }[];
  organizer?: { self?: boolean };
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] };
};

/** Parses "2026-10-18" as local midnight, the way an all-day event means it. */
function localDate(d: string): number {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).getTime();
}

/** The host a link goes to, or "" if it isn't a valid URL. */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/** What someone pasted as a meeting link, made whole, or null if it isn't an https link to a real host. */
export function meetingLink(value: string): string | null {
  const text = value.trim();
  if (/\s/.test(text)) return null;
  const link = /^[a-z][a-z0-9+-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(link);
    // href, not what was typed: locationLink only reads a location starting with a lowercase https://.
    return url.protocol === "https:" && url.hostname.includes(".") ? url.href : null;
  } catch {
    return null;
  }
}

/** The link of the event's own video call, if Google has given it one. */
function conferenceLink(e: MeetFields): string | null {
  const link = e.hangoutLink ?? e.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ?? null;
  return link?.startsWith("https://") && linkHost(link) ? link : null;
}

// A pasted link lives in the location, where Google Calendar shows it. Only a location that is nothing but a link counts, so a street address never becomes one.
const locationLink = (location = "") => (location.startsWith("https://") && !/\s/.test(location) && linkHost(location) ? location : null);

export function toCalendarEvent(e: ApiEvent, cal: { id: string; color: string; writable?: boolean }): CalendarEvent | null {
  // Skip cancelled events and the ones Stint itself added for sessions.
  if (e.status === "cancelled" || e.extendedProperties?.private?.stint) return null;
  const allDay = !e.start.dateTime;
  const start = allDay ? localDate(e.start.date!) : Date.parse(e.start.dateTime!);
  const end = allDay ? localDate(e.end.date!) : Date.parse(e.end.dateTime!);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return {
    id: e.id,
    calendarId: cal.id,
    title: e.summary || t().events.noTitle,
    untitled: !e.summary,
    color: cal.color,
    start,
    end,
    allDay,
    writable: !!cal.writable,
    // `self` defaults to false, so an organizer without it is someone else.
    shared: (e.attendees ?? []).some((a) => !a.self) || (!!e.organizer && !e.organizer.self),
    recurring: !!e.recurringEventId,
    joinUrl: conferenceLink(e) ?? locationLink(e.location),
    location: e.location ?? "",
  };
}

export async function eventsBetween(cals: GoogleCalendar[], from: number, to: number): Promise<CalendarEvent[]> {
  const q = `timeMin=${enc(new Date(from).toISOString())}&timeMax=${enc(new Date(to).toISOString())}&singleEvents=true&orderBy=startTime&maxResults=250`;
  const lists = await Promise.all(
    cals.map((c) =>
      request<{ items?: ApiEvent[] }>("GET", `/calendars/${enc(c.id)}/events?${q}`)
        .then((r) => (r.items ?? []).map((e) => toCalendarEvent(e, c)).filter((e): e is CalendarEvent => e !== null))
        .catch(() => [] as CalendarEvent[]),
    ),
  );
  return lists.flat().sort((a, b) => a.start - b.start);
}

// Google's fixed event colours, by colorId.
const eventColors: [string, string][] = [
  ["1", "#7986cb"],
  ["2", "#33b679"],
  ["3", "#8e24aa"],
  ["4", "#e67c73"],
  ["5", "#f6bf26"],
  ["6", "#f4511e"],
  ["7", "#039be5"],
  ["8", "#616161"],
  ["9", "#3f51b5"],
  ["10", "#0b8043"],
  ["11", "#d50000"],
];

const rgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** The Google event colour closest to a category colour. */
export function nearestColorId(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "7";
  const [r, g, b] = rgb(hex);
  let best = eventColors[0];
  let bestD = Infinity;
  for (const c of eventColors) {
    const [r2, g2, b2] = rgb(c[1]);
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (d < bestD) [best, bestD] = [c, d];
  }
  return best[0];
}

/** Whether a session belongs on Google Calendar: breaks only when asked for, and not from a skipped category. */
export function syncs(s: SessionRecord, cal: Pick<CalendarSettings, "syncBreaks" | "skipCategories">): boolean {
  if (s.kind === "break") return cal.syncBreaks;
  return s.categoryId === null || !cal.skipCategories.includes(s.categoryId);
}

/**
 * The calendar event that stands for a session. A session with several tasks
 * (`parts`, in order) is one event named after the first task, with the
 * others counted, and every task listed with its times.
 */
export function sessionEvent(s: SessionRecord, category: Category | undefined, parts: SessionRecord[] = [s]) {
  const isBreak = s.kind === "break";
  const text = t();
  const name = isBreak ? text.break : category?.name ?? text.focus;
  const first = parts[0] ?? s;
  const last = parts[parts.length - 1] ?? s;
  const tasks = parts.length > 1;
  const focusedMs = tasks ? parts.reduce((a, p) => a + p.focusedMs, 0) : s.focusedMs;
  const note = parts.map((p) => p.reflection).filter(Boolean).join("\n");
  const lines = [
    isBreak ? text.event.break(formatDuration(focusedMs)) : text.event.focused(formatDuration(focusedMs)),
    s.rating > 0 ? text.event.mood(text.ratings[s.rating]) : "",
    tasks ? `\n${parts.map((p) => `${timeSpan(p.startedAt, p.endedAt)}  ${p.intention || text.focus} (${formatDuration(p.focusedMs)})`).join("\n")}` : "",
    note ? `\n${note}` : "",
  ].filter(Boolean);
  const title = tasks ? text.event.moreTasks(first.intention || name, parts.length - 1) : s.intention;
  return {
    summary: !isBreak && title ? `${title} · ${name}` : name,
    description: `${lines.join("\n")}\n\n${text.event.addedBy}`,
    start: { dateTime: new Date(first.startedAt).toISOString() },
    end: { dateTime: new Date(Math.max(last.endedAt, first.startedAt + 60_000)).toISOString() },
    colorId: isBreak ? "8" : nearestColorId(category?.color ?? ""),
    transparency: "transparent",
    reminders: { useDefault: false },
    extendedProperties: { private: { stint: "1", stintId: String(first.id) } },
  };
}

export async function createEvent(calendarId: string, s: SessionRecord, c: Category | undefined, parts?: SessionRecord[]): Promise<string> {
  const r = await request<{ id: string }>("POST", `/calendars/${enc(calendarId)}/events`, sessionEvent(s, c, parts));
  return r.id;
}

export async function updateEvent(calendarId: string, eventId: string, s: SessionRecord, c: Category | undefined, parts?: SessionRecord[]) {
  await request("PUT", `/calendars/${enc(calendarId)}/events/${enc(eventId)}`, sessionEvent(s, c, parts));
}

export async function deleteEvent(calendarId: string, eventId: string) {
  await request("DELETE", `/calendars/${enc(calendarId)}/events/${enc(eventId)}`);
}

/** An id for an event not yet on Google. Google allows only a-v and 0-9 here, which a UUID without its dashes keeps to. */
export const newEventId = () => crypto.randomUUID().replaceAll("-", "");

/** Asks Google for a Meet link; it only listens with conferenceDataVersion=1 on the request. */
const meetRequest = (requestId: string) => ({ createRequest: { requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } });

/**
 * An event the user added from Stint. No `extendedProperties`: toCalendarEvent
 * hides anything tagged `stint`, so the event would vanish. No `transparency`
 * or `reminders`: Google's defaults apply (busy, the user's default reminders).
 * No `id`: changeEvent sends this too, and only addEvent names the event.
 */
export function eventBody(d: EventDraft) {
  return {
    summary: d.title,
    start: { dateTime: new Date(d.start).toISOString() },
    end: { dateTime: new Date(d.end).toISOString() },
    ...(d.link !== undefined && { location: d.link }),
  };
}

type MeetFields = {
  hangoutLink?: string;
  conferenceData?: { createRequest?: { status?: { statusCode?: string } }; entryPoints?: { entryPointType: string; uri: string }[] };
};

/** How far Google has got with a Meet link it was asked for. */
export function meetState(r: MeetFields): MeetState {
  const code = r.conferenceData?.createRequest?.status?.statusCode;
  if (r.hangoutLink || code === "success") return "ready";
  return code === "failure" ? "failed" : "pending";
}

/** A look that fails says nothing about the link, and the event exists either way, so it never rejects. */
const readEvent = (calendarId: string, eventId: string) =>
  request<MeetFields>("GET", `/calendars/${enc(calendarId)}/events/${enc(eventId)}`).catch((): MeetFields => ({}));

export async function addEvent(calendarId: string, d: EventDraft): Promise<string> {
  try {
    const r = await request<{ id: string }>("POST", `/calendars/${enc(calendarId)}/events`, { id: d.id, ...eventBody(d) });
    return r.id;
  } catch (err) {
    // The id is already taken: an earlier try got through and only its answer was lost.
    if (errorStatus(err) !== 409 || !d.id) throw err;
    // The form may have changed since that try, and what's in it now is what the user saved.
    await changeEvent(calendarId, d.id, d);
    return d.id;
  }
}

/** Google makes the Meet link in the background: looks every 1.5 seconds, six times at most, until the answer isn't "pending". */
async function poll<T>(look: () => Promise<T | "pending">): Promise<T | "pending"> {
  for (let tries = 0; tries < 6; tries++) {
    await new Promise((done) => setTimeout(done, 1500));
    const answer = await look();
    if (answer !== "pending") return answer;
  }
  return "pending";
}

/** The event's Meet link once Google has made it; null if it failed or is taking too long. */
export async function waitForLink(calendarId: string, eventId: string): Promise<string | null> {
  const link = await poll(async () => {
    const r = await readEvent(calendarId, eventId);
    return conferenceLink(r) ?? (meetState(r) === "failed" ? null : "pending");
  });
  return link === "pending" ? null : link;
}

/** Saves a new event with a Meet link, so the link exists before the form is done. */
export async function addMeeting(calendarId: string, d: EventDraft): Promise<{ id: string; link: string | null }> {
  const body = { id: d.id, ...eventBody(d), conferenceData: meetRequest(d.id ?? crypto.randomUUID()) };
  let r: MeetFields & { id: string };
  try {
    r = await request("POST", `/calendars/${enc(calendarId)}/events?conferenceDataVersion=1`, body);
  } catch (err) {
    // The id is already taken: an earlier try got through and only its answer was lost.
    if (errorStatus(err) !== 409 || !d.id) throw err;
    r = { ...(await readEvent(calendarId, d.id)), id: d.id };
  }
  return { id: r.id, link: conferenceLink(r) ?? (await waitForLink(calendarId, r.id)) };
}

/** Gives an event already on Google a Meet link, sending only that so nothing else about it changes. */
export async function addMeetTo(calendarId: string, eventId: string): Promise<string | null> {
  const r = await request<MeetFields>("PATCH", `/calendars/${enc(calendarId)}/events/${enc(eventId)}?conferenceDataVersion=1`, {
    conferenceData: meetRequest(crypto.randomUUID()),
  });
  return conferenceLink(r) ?? waitForLink(calendarId, eventId);
}

/**
 * PATCH, not PUT: PUT replaces the whole event and would wipe its description, location and reminders.
 * No conferenceDataVersion: version 0 leaves any existing conference alone, and writing with version 1 can remove one.
 */
export async function changeEvent(calendarId: string, eventId: string, d: EventDraft) {
  await request("PATCH", `/calendars/${enc(calendarId)}/events/${enc(eventId)}`, eventBody(d));
}

/** Calendars an event can be added to; one added to a hidden calendar would seem to vanish. */
export const addableCalendars = (cals: GoogleCalendar[], hidden: string[]) => cals.filter((c) => c.writable && !hidden.includes(c.id));

/**
 * Where a new event goes, from the addable calendars. The session sync target
 * is deliberately not used: it may be a dedicated calendar, not where meetings belong.
 */
export const defaultEventCalendar = (cals: GoogleCalendar[], lastId: string | null) =>
  cals.find((c) => c.id === lastId) ?? cals.find((c) => c.primary) ?? cals[0] ?? null;

/**
 * Side-by-side columns for overlapping events: each event gets a lane, and
 * `lanes` is how many share its cluster of overlaps.
 */
export function eventLanes<E extends { start: number; end: number }>(events: E[]): { event: E; lane: number; lanes: number }[] {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: { event: E; lane: number; lanes: number }[] = [];
  let cluster: typeof out = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;
  const close = () => {
    for (const c of cluster) c.lanes = laneEnds.length;
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };
  for (const event of sorted) {
    if (event.start >= clusterEnd) close();
    let lane = laneEnds.findIndex((end) => end <= event.start);
    if (lane === -1) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = event.end;
    clusterEnd = Math.max(clusterEnd, event.end);
    cluster.push({ event, lane, lanes: 0 });
  }
  close();
  return out;
}
