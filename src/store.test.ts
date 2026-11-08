import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSettings, openStore, withDefaults, type SessionRecord } from "./store";

describe("withDefaults", () => {
  it("loads nothing saved, and the defaults themselves, as the defaults", () => {
    expect(withDefaults(undefined)).toEqual(defaultSettings);
    expect(withDefaults(null)).toEqual(defaultSettings);
    expect(withDefaults(JSON.parse(JSON.stringify(defaultSettings)))).toEqual(defaultSettings);
  });

  it("puts a value of the wrong type back to its default", () => {
    // A stepper would add 1 to "5" and get "51".
    const s = withDefaults({ focusMinutes: null, breakMinutes: "5", sound: "no" });
    expect(s.focusMinutes).toBe(25);
    expect(s.breakMinutes).toBe(5);
    expect(s.sound).toBe(true);
    // JSON reads 1e999 as Infinity.
    expect(withDefaults(JSON.parse('{"focusMinutes": 1e999}')).focusMinutes).toBe(25);
  });

  it("keeps numbers within the Settings steppers' ranges", () => {
    const s = withDefaults({ focusMinutes: 500, dailyGoal: 0, size: 500, defaultRating: 2.4, longBreakMinutes: 90 });
    expect([s.focusMinutes, s.dailyGoal, s.size, s.defaultRating, s.longBreakMinutes]).toEqual([180, 1, 150, 2, 60]);
  });

  it("puts a look, language, theme or floating timer it doesn't know back to the default", () => {
    const s = withDefaults({ look: "neon", language: "fr", theme: "blue", floatStyle: "corner" });
    expect([s.look, s.language, s.theme, s.floatStyle]).toEqual(["lavender", "en", "system", "bubble"]);
    const kept = withDefaults({ look: "riso", language: "pt-BR", theme: "dark", floatStyle: "pill" });
    expect([kept.look, kept.language, kept.theme, kept.floatStyle]).toEqual(["riso", "pt-BR", "dark", "pill"]);
  });

  it("checks the calendar settings the same way", () => {
    expect(withDefaults({ calendar: null }).calendar).toEqual(defaultSettings.calendar);
    const c = withDefaults({ calendar: { targetId: 5, syncSessions: "yes", hidden: "work", skipCategories: [2] } }).calendar;
    expect(c).toEqual({ ...defaultSettings.calendar, skipCategories: [2] });
    expect(withDefaults({ calendar: { targetId: "abc@group" } }).calendar.targetId).toBe("abc@group");
  });

  it("keeps settings it doesn't know, so going back to an older version doesn't lose a newer one's", () => {
    expect((withDefaults({ later: true }) as unknown as Record<string, unknown>).later).toBe(true);
  });

  it("puts a big button it doesn't know back to the default", () => {
    const s = withDefaults({ focusAction: "nap", breakAction: "snack" });
    expect([s.focusAction, s.breakAction]).toEqual(["break", "focus"]);
  });
});

// Outside the desktop app (no `isTauri`), openStore gives the browser store, kept in localStorage.
describe("browser store", () => {
  const T0 = new Date(2026, 10, 8, 9, 0).getTime();
  const session: Omit<SessionRecord, "id"> = {
    kind: "focus",
    intention: "Write report",
    categoryId: 1,
    startedAt: T0,
    endedAt: T0 + 25 * 60_000,
    plannedMs: 25 * 60_000,
    focusedMs: 25 * 60_000,
    reflection: "",
    rating: 2,
  };
  const fail = () => {
    throw new Error("storage unavailable");
  };
  // Adds a session, changes a setting and adds a category, then reads them back.
  const visit = async () => {
    const store = await openStore();
    await store.addSessions([session]);
    await store.saveSettings({ ...defaultSettings, focusMinutes: 50 });
    await store.addCategory("Mine", "#000000");
    return {
      sessions: (await store.sessionsBetween(T0, T0 + 86_400_000)).map((s) => s.intention),
      focus: (await store.settings()).settings.focusMinutes,
      categories: (await store.categories()).map((c) => c.name),
    };
  };
  const visited = { sessions: ["Write report"], focus: 50, categories: ["Work", "Study", "Personal", "Mine"] };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps this visit's changes when localStorage can't be used, and leaves the seed categories alone", async () => {
    // Before: 0 sessions, focus 25, and the seed list itself gained "Mine".
    vi.stubGlobal("localStorage", { getItem: fail, setItem: fail });
    expect(await visit()).toEqual(visited);
    expect((await (await openStore()).categories()).map((c) => c.name)).toEqual(["Work", "Study", "Personal"]);
  });

  it("keeps this visit's changes when storage is full", async () => {
    const saved = JSON.stringify({ categories: [{ id: 1, name: "Work", color: "#e8594f" }], sessions: [], settings: defaultSettings });
    vi.stubGlobal("localStorage", { getItem: () => saved, setItem: fail });
    expect(await visit()).toEqual({ ...visited, categories: ["Work", "Mine"] });
  });

  it("reads localStorage on every call while it works, so two windows see each other's changes", async () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
    const [a, b] = [await openStore(), await openStore()];
    await a.addSessions([session]);
    await b.addSessions([{ ...session, startedAt: T0 + 60_000 }]);
    expect((await a.sessionsBetween(T0, T0 + 86_400_000)).map((s) => s.id)).toEqual([2, 1]);
  });

  it("starts with the defaults when the saved settings can't be read, and saves them over the bad value once", async () => {
    const work = [{ id: 1, name: "Work", color: "#e8594f" }];
    const data = new Map([["stint-data", JSON.stringify({ categories: work, sessions: [], settings: "{oops" })]]);
    vi.stubGlobal("localStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
    const store = await openStore();
    expect(await store.settings()).toEqual({ settings: defaultSettings, unreadable: true });
    expect(JSON.parse(data.get("stint-data")!).settings).toEqual(defaultSettings);
    // So the notice shows on that start only.
    expect(await store.settings()).toEqual({ settings: defaultSettings, unreadable: false });
  });

  it("puts a single bad setting back to its default without a notice", async () => {
    const saved = JSON.stringify({ categories: [], sessions: [], settings: { focusMinutes: null, look: "neon" } });
    vi.stubGlobal("localStorage", { getItem: () => saved, setItem: () => {} });
    expect(await (await openStore()).settings()).toEqual({ settings: defaultSettings, unreadable: false });
  });
});
