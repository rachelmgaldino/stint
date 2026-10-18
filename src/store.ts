import { isTauri } from "@tauri-apps/api/core";
import type { Kind } from "./timer";

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
  /** 1 = rough, 2 = okay, 3 = great. 0 when not rated. */
  rating: number;
};

export type Theme = "system" | "light" | "dark";

export type Settings = {
  focusMinutes: number;
  breakMinutes: number;
  theme: Theme;
  sound: boolean;
  /** Start a break automatically after the reflection is saved. */
  autoBreak: boolean;
};

export const defaultSettings: Settings = {
  focusMinutes: 25,
  breakMinutes: 5,
  theme: "system",
  sound: true,
  autoBreak: false,
};

export interface Store {
  categories(): Promise<Category[]>;
  addCategory(name: string, color: string): Promise<Category>;
  updateCategory(c: Category): Promise<void>;
  removeCategory(id: number): Promise<void>;
  addSession(s: Omit<SessionRecord, "id">): Promise<number>;
  updateReflection(id: number, reflection: string, rating: number): Promise<void>;
  sessionsBetween(from: number, to: number): Promise<SessionRecord[]>;
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
  };
}

// The tables are created by the migrations in src-tauri/src/lib.rs.
async function sqliteStore(): Promise<Store> {
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  const db = await Database.load("sqlite:stint.db");
  return {
    categories: () =>
      db.select<Category[]>(
        "SELECT id, name, color FROM categories WHERE archived = 0 ORDER BY id",
      ),
    async addCategory(name, color) {
      const r = await db.execute("INSERT INTO categories (name, color) VALUES ($1, $2)", [
        name,
        color,
      ]);
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
    async addSession(s) {
      const r = await db.execute(
        `INSERT INTO sessions
           (kind, intention, category_id, started_at, ended_at, planned_ms, focused_ms, reflection, rating)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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
        ],
      );
      return r.lastInsertId ?? 0;
    },
    async updateReflection(id, reflection, rating) {
      await db.execute("UPDATE sessions SET reflection = $1, rating = $2 WHERE id = $3", [
        reflection,
        rating,
        id,
      ]);
    },
    async sessionsBetween(from, to) {
      const rows = await db.select<SessionRow[]>(
        "SELECT * FROM sessions WHERE started_at >= $1 AND started_at < $2 ORDER BY started_at DESC",
        [from, to],
      );
      return rows.map(fromRow);
    },
    async settings() {
      const rows = await db.select<{ value: string }[]>(
        "SELECT value FROM settings WHERE key = 'app'",
      );
      return rows[0] ? { ...defaultSettings, ...JSON.parse(rows[0].value) } : defaultSettings;
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

// Used when the UI runs in a plain browser (npm run dev), so the app can be
// tried without the desktop shell.
function browserStore(): Store {
  const key = "stint-data";
  const load = (): Saved => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      // Fall through to a fresh store.
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
    async addSession(s) {
      const d = load();
      const id = nextId(d.sessions);
      d.sessions.push({ ...s, id });
      save(d);
      return id;
    },
    async updateReflection(id, reflection, rating) {
      const d = load();
      d.sessions = d.sessions.map((x) => (x.id === id ? { ...x, reflection, rating } : x));
      save(d);
    },
    async sessionsBetween(from, to) {
      return load()
        .sessions.filter((s) => s.startedAt >= from && s.startedAt < to)
        .sort((a, b) => b.startedAt - a.startedAt);
    },
    async settings() {
      return { ...defaultSettings, ...load().settings };
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
