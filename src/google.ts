import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Category, SessionRecord } from "./store";
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
  color: string;
  start: number;
  end: number;
  allDay: boolean;
};

export const googleAvailable = isTauri;

/** Names an event across calendars; a session made from it keeps this. */
export const eventKey = (e: CalendarEvent) => `${e.calendarId}/${e.id}`;

/** An event can count as focus once it is over, if it has a time of day. */
export const countable = (e: CalendarEvent, now: number) => !e.allDay && e.end <= now;

export const connect = (clientId: string, clientSecret: string) =>
  invoke<void>("google_connect", { clientId, clientSecret });
export const isConnected = () => (isTauri() ? invoke<boolean>("google_status") : Promise.resolve(false));
export const disconnect = () => invoke<void>("google_disconnect");

function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  return invoke<T>("google_request", { method, path, body: body ?? null });
}

const enc = encodeURIComponent;

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
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

/** Parses "2026-10-18" as local midnight, the way an all-day event means it. */
function localDate(d: string): number {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).getTime();
}

export function toCalendarEvent(e: ApiEvent, cal: { id: string; color: string }): CalendarEvent | null {
  // Skip cancelled events and the ones Stint itself added for sessions.
  if (e.status === "cancelled" || e.extendedProperties?.private?.stint) return null;
  const allDay = !e.start.dateTime;
  const start = allDay ? localDate(e.start.date!) : Date.parse(e.start.dateTime!);
  const end = allDay ? localDate(e.end.date!) : Date.parse(e.end.dateTime!);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return { id: e.id, calendarId: cal.id, title: e.summary || "(No title)", color: cal.color, start, end, allDay };
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
