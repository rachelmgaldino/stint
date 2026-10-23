import { isTauri } from "@tauri-apps/api/core";
import type { Kind } from "./timer";
import type { Language } from "./i18n";
import type { Look } from "./look";
import { DEMO, DEMO_KEY, demoData } from "./demo";

export type Category = { id: number; name: string; color: string };

export type SessionRecord = {
  id: number;
  kind: Kind;
  intention: string;
  categoryId: number | null;
  startedAt: number;
  endedAt: number;
  plannedMs: number;
  focusedMs: number;
  reflection: string;
  /** 1 = distracted, 2 = neutral, 3 = focused. 0 when not rated. */
  rating: number;
  /** The Google Calendar event made for this session, once synced. */
  googleEventId?: string | null;
  googleCalendarId?: string | null;
  /** The Google Calendar event this session was made from ("calendarId/eventId"). */
  fromEvent?: string | null;
};

export type Theme = "system" | "light" | "dark";

export type Settings = {
  focusMinutes: number;
  /** The usual (short) break. */
  breakMinutes: number;
  longBreakMinutes: number;
  /** Minutes of focus, since the last long break, that earn a long break. */
  longBreakAfter: number;
  /** Focus counts up with no time limit (flow) instead of down from a length. Remembers the last choice. */
  flow: boolean;
  /** Which button is the big one during focus. */
  focusAction: "break" | "end";
  /** Which button is the big one on a break. */
  breakAction: "focus" | "end";
  theme: Theme;
  look: Look;
  /** How big the desktop app draws, in percent, on top of fitting the window. */
  size: number;
  language: Language;
  sound: boolean;
  /** Start a break automatically after the reflection is saved. */
  autoBreak: boolean;
  /** Focus sessions per day, shown as dots above the timer. */
  dailyGoal: number;
  /** Open the reflection dialog when a focus session ends. */
  askReflection: boolean;
  /** The mood a session gets when it isn't rated, and the dialog's preset. */
  defaultRating: number;
  notifyFocusEnd: boolean;
  notifyBreakEnd: boolean;
  /** A heads-up a few minutes before a session or break ends. */
  notifySoon: boolean;
  soonMinutes: number;
  soonSound: boolean;
  /** A soft sound every few minutes of focus, to pull attention back. */
  presence: boolean;
  presenceMinutes: number;
  /** Nudges once a session or break runs this far over, or stays paused this long. */
  overflowFocus: boolean;
  overflowFocusMinutes: number;
  overflowPause: boolean;
  overflowPauseMinutes: number;
  overflowBreak: boolean;
  overflowBreakMinutes: number;
  calendar: CalendarSettings;
  /** Look for a new version when Stint opens and every few hours. */
  checkUpdates: boolean;
  /** Also offer the "PR #N test" builds of open pull requests. */
  testBuilds: boolean;
  /** Show a small floating timer while Stint is minimized or in the tray. */
  floatTimer: boolean;
  /** Keep the floating timer above other apps (the pin on the pill). */
  floatOnTop: boolean;
};

export type CalendarSettings = {
  /** Add each finished session to Google Calendar. */
  syncSessions: boolean;
  /** Also add breaks, not only focus sessions. */
  syncBreaks: boolean;
  /** The Google calendar sessions are added to. */
  targetId: string | null;
  /** Sessions from this time on are synced; earlier ones are left alone. */
  syncSince: number;
  /** Show Google Calendar events on the day timeline. */
  showEvents: boolean;
  /** Calendars whose events are not shown. */
  hidden: string[];
};

export const defaultSettings: Settings = {
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  longBreakAfter: 90,
  flow: false,
  focusAction: "break",
  breakAction: "focus",
  theme: "system",
  look: "lavender",
  size: 100,
  language: "en",
  sound: true,
  autoBreak: false,
  dailyGoal: 4,
  askReflection: true,
  defaultRating: 2,
  notifyFocusEnd: true,
  notifyBreakEnd: true,
  notifySoon: true,
  soonMinutes: 1,
  soonSound: true,
  presence: false,
  presenceMinutes: 10,
  overflowFocus: true,
  overflowFocusMinutes: 10,
  overflowPause: true,
  overflowPauseMinutes: 10,
  overflowBreak: true,
  overflowBreakMinutes: 10,
  checkUpdates: true,
  testBuilds: false,
  floatTimer: true,
  floatOnTop: true,
  calendar: { syncSessions: false, syncBreaks: false, targetId: null, syncSince: 0, showEvents: false, hidden: [] },
};

function withDefaults(saved: Partial<Settings> | undefined): Settings {
  return { ...defaultSettings, ...saved, calendar: { ...defaultSettings.calendar, ...saved?.calendar } };
}

export interface Store {
  categories(): Promise<Category[]>;
  addCategory(name: string, color: string): Promise<Category>;
  updateCategory(c: Category): Promise<void>;
  removeCategory(id: number): Promise<void>;
  /** Saves the order categories are listed in everywhere, first to last. */
  reorderCategories(ids: number[]): Promise<void>;
  addSession(s: Omit<SessionRecord, "id">): Promise<number>;
  updateSession(s: SessionRecord): Promise<void>;
  deleteSession(id: number): Promise<void>;
  sessionsBetween(from: number, to: number): Promise<SessionRecord[]>;
  /** Sessions started since `since` that have no calendar event yet, leaving out ones made from an event. */
  unsynced(since: number): Promise<SessionRecord[]>;
  setGoogleEvent(id: number, calendarId: string | null, eventId: string | null): Promise<void>;
  settings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
}

type SessionRow = {
  id: number;
  kind: Kind;
  intention: string;
  category_id: number | null;
  started_at: number;
  ended_at: number;
  planned_ms: number;
  focused_ms: number;
  reflection: string;
  rating: number;
  google_event_id: string | null;
  google_calendar_id: string | null;
  from_event: string | null;
};

function fromRow(r: SessionRow): SessionRecord {
  return {
    id: r.id,
    kind: r.kind,
    intention: r.intention,
    categoryId: r.category_id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    plannedMs: r.planned_ms,
    focusedMs: r.focused_ms,
    reflection: r.reflection,
    rating: r.rating,
    googleEventId: r.google_event_id,
    googleCalendarId: r.google_calendar_id,
    fromEvent: r.from_event,
  };
}

// The tables are created by the migrations in src-tauri/src/lib.rs.
async function sqliteStore(): Promise<Store> {
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  const db = await Database.load("sqlite:stint.db");
  return {
    categories: () =>
      db.select<Category[]>(
        "SELECT id, name, color FROM categories WHERE archived = 0 ORDER BY position, id",
      ),
    async addCategory(name, color) {
      // New categories go to the end of the list.
      const r = await db.execute(
        "INSERT INTO categories (name, color, position) VALUES ($1, $2, (SELECT COALESCE(MAX(position), 0) + 1 FROM categories))",
        [name, color],
      );
      return { id: r.lastInsertId ?? 0, name, color };
    },
    async updateCategory(c) {
      await db.execute("UPDATE categories SET name = $1, color = $2 WHERE id = $3", [
        c.name,
        c.color,
        c.id,
      ]);
    },
    async removeCategory(id) {
      // Archived rather than deleted so past sessions keep their category.
      await db.execute("UPDATE categories SET archived = 1 WHERE id = $1", [id]);
    },
    async reorderCategories(ids) {
      for (const [i, id] of ids.entries()) {
        await db.execute("UPDATE categories SET position = $1 WHERE id = $2", [i + 1, id]);
      }
    },
    async addSession(s) {
      const r = await db.execute(
        `INSERT INTO sessions
           (kind, intention, category_id, started_at, ended_at, planned_ms, focused_ms, reflection, rating, from_event)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          s.kind,
          s.intention,
          s.categoryId,
          s.startedAt,
          s.endedAt,
          s.plannedMs,
          s.focusedMs,
          s.reflection,
          s.rating,
          s.fromEvent ?? null,
        ],
      );
      return r.lastInsertId ?? 0;
    },
    async updateSession(s) {
      await db.execute(
        `UPDATE sessions SET intention = $1, category_id = $2, started_at = $3, ended_at = $4,
           focused_ms = $5, reflection = $6, rating = $7
         WHERE id = $8`,
        [s.intention, s.categoryId, s.startedAt, s.endedAt, s.focusedMs, s.reflection, s.rating, s.id],
      );
    },
    async deleteSession(id) {
      await db.execute("DELETE FROM sessions WHERE id = $1", [id]);
    },
    async sessionsBetween(from, to) {
      const rows = await db.select<SessionRow[]>(
        "SELECT * FROM sessions WHERE started_at >= $1 AND started_at < $2 ORDER BY started_at DESC",
        [from, to],
      );
      return rows.map(fromRow);
    },
    async unsynced(since) {
      const rows = await db.select<SessionRow[]>(
        // A session made from an event is on the calendar already.
        "SELECT * FROM sessions WHERE started_at >= $1 AND google_event_id IS NULL AND from_event IS NULL ORDER BY started_at",
        [since],
      );
      return rows.map(fromRow);
    },
    async setGoogleEvent(id, calendarId, eventId) {
      await db.execute("UPDATE sessions SET google_calendar_id = $1, google_event_id = $2 WHERE id = $3", [
        calendarId,
        eventId,
        id,
      ]);
    },
    async settings() {
      const rows = await db.select<{ value: string }[]>(
        "SELECT value FROM settings WHERE key = 'app'",
      );
      return withDefaults(rows[0] ? JSON.parse(rows[0].value) : undefined);
    },
    async saveSettings(s) {
      await db.execute(
        "INSERT INTO settings (key, value) VALUES ('app', $1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [JSON.stringify(s)],
      );
    },
  };
}

type Saved = { categories: (Category & { archived?: boolean })[]; sessions: SessionRecord[]; settings: Settings };

const seedCategories: Category[] = [
  { id: 1, name: "Work", color: "#e8594f" },
  { id: 2, name: "Study", color: "#4f8ee8" },
  { id: 3, name: "Personal", color: "#52b788" },
];

// Used when the UI runs in a plain browser (npm run dev, or the web demo), so
// the app can be tried without the desktop shell.
function browserStore(): Store {
  const key = DEMO ? DEMO_KEY : "stint-data";
  const load = (): Saved => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      // Fall through to a fresh store.
    }
    if (DEMO) {
      const fresh = demoData(defaultSettings);
      save(fresh);
      return fresh;
    }
    return { categories: seedCategories, sessions: [], settings: defaultSettings };
  };
  const save = (d: Saved) => {
    try {
      localStorage.setItem(key, JSON.stringify(d));
    } catch {
      // Storage can be unavailable; the app still works for this visit.
    }
  };
  const nextId = (items: { id: number }[]) => items.reduce((m, i) => Math.max(m, i.id), 0) + 1;
  return {
    async categories() {
      return load().categories.filter((c) => !c.archived);
    },
    async addCategory(name, color) {
      const d = load();
      const c = { id: nextId(d.categories), name, color };
      d.categories.push(c);
      save(d);
      return c;
    },
    async updateCategory(c) {
      const d = load();
      d.categories = d.categories.map((x) => (x.id === c.id ? { ...x, ...c } : x));
      save(d);
    },
    async removeCategory(id) {
      const d = load();
      d.categories = d.categories.map((x) => (x.id === id ? { ...x, archived: true } : x));
      save(d);
    },
    async reorderCategories(ids) {
      // The stored array order is the list order; archived ones keep their place at the end.
      const d = load();
      const rank = (c: Category) => (ids.includes(c.id) ? ids.indexOf(c.id) : ids.length);
      d.categories = [...d.categories].sort((a, b) => rank(a) - rank(b));
      save(d);
    },
    async addSession(s) {
      const d = load();
      const id = nextId(d.sessions);
      d.sessions.push({ ...s, id });
      save(d);
      return id;
    },
    async updateSession(s) {
      const d = load();
      d.sessions = d.sessions.map((x) => (x.id === s.id ? { ...x, ...s } : x));
      save(d);
    },
    async deleteSession(id) {
      const d = load();
      d.sessions = d.sessions.filter((x) => x.id !== id);
      save(d);
    },
    async sessionsBetween(from, to) {
      return load()
        .sessions.filter((s) => s.startedAt >= from && s.startedAt < to)
        .sort((a, b) => b.startedAt - a.startedAt);
    },
    async unsynced(since) {
      return load()
        .sessions.filter((s) => s.startedAt >= since && !s.googleEventId && !s.fromEvent)
        .sort((a, b) => a.startedAt - b.startedAt);
    },
    async setGoogleEvent(id, calendarId, eventId) {
      const d = load();
      d.sessions = d.sessions.map((x) => (x.id === id ? { ...x, googleCalendarId: calendarId, googleEventId: eventId } : x));
      save(d);
    },
    async settings() {
      return withDefaults(load().settings);
    },
    async saveSettings(s) {
      const d = load();
      d.settings = s;
      save(d);
    },
  };
}

export function openStore(): Promise<Store> {
  return isTauri() ? sqliteStore() : Promise.resolve(browserStore());
}
