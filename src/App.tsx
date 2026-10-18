import { useCallback, useEffect, useRef, useState } from "react";
import { chime, notify, setTrayTooltip } from "./platform";
import {
  defaultSettings,
  openStore,
  type Category,
  type SessionRecord,
  type Settings,
  type Store,
} from "./store";
import * as T from "./timer";
import { addDays, startOfDay, startOfWeek } from "./dates";
import { TimerPane } from "./components/TimerPane";
import { DayPane, type LiveBlock } from "./components/DayPane";
import { SettingsView } from "./components/SettingsView";
import { Reflection, type PendingReflection } from "./components/Reflection";
import { SessionDialog } from "./components/SessionDialog";
import { ClockIcon, GearIcon } from "./components/icons";

type View = "timer" | "settings";

// The running timer and what it's for, kept in localStorage so a restart of
// the app doesn't lose a session in progress.
type Live = { timer: T.Timer; intention: string; categoryId: number | null };
const liveKey = "stint-live";

function loadLive(): Live {
  try {
    const raw = localStorage.getItem(liveKey);
    if (raw) return JSON.parse(raw);
  } catch {
    // Start fresh.
  }
  return { timer: T.idle, intention: "", categoryId: null };
}

function saveLive(l: Live) {
  try {
    localStorage.setItem(liveKey, JSON.stringify(l));
  } catch {
    // Not critical.
  }
}

export default function App() {
  const [store, setStore] = useState<Store | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [categories, setCategories] = useState<Category[]>([]);
  const [view, setView] = useState<View>("timer");
  const [live, setLive] = useState<Live>(loadLive);
  const [plannedMin, setPlannedMin] = useState(defaultSettings.focusMinutes);
  const [idleKind, setIdleKind] = useState<T.Kind>("focus");
  const [pending, setPending] = useState<PendingReflection | null>(null);
  const [editing, setEditing] = useState<SessionRecord | null>(null);
  const [day, setDay] = useState(() => startOfDay(Date.now()));
  const [week, setWeek] = useState<SessionRecord[]>([]);
  const [today, setToday] = useState<SessionRecord[]>([]);
  const [now, setNow] = useState(Date.now());
  const endedNotified = useRef(false);

  const { timer } = live;

  useEffect(() => {
    openStore().then(async (s) => {
      const [st, cats] = await Promise.all([s.settings(), s.categories()]);
      setSettings(st);
      setPlannedMin(st.focusMinutes);
      setCategories(cats);
      setLive((l) =>
        cats[0] && !cats.some((c) => c.id === l.categoryId) ? { ...l, categoryId: cats[0].id } : l,
      );
      setStore(s);
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!store) return;
    const from = startOfWeek(day);
    const t = startOfDay(Date.now());
    const [w, td] = await Promise.all([
      store.sessionsBetween(from, addDays(from, 7)),
      store.sessionsBetween(t, addDays(t, 1)),
    ]);
    setWeek(w);
    setToday(td);
  }, [store, day]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => saveLive(live), [live]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  const left = T.remaining(timer, now);

  useEffect(() => {
    if (timer.status === "idle") {
      setTrayTooltip("Stint: not running");
      return;
    }
    const label = timer.kind === "focus" ? live.intention || "Focus" : "Break";
    const paused = timer.status === "paused" ? " (paused)" : "";
    setTrayTooltip(`${label}: ${T.formatClock(left)}${paused}`);
  }, [timer, left, live.intention]);

  const startTimer = (kind: T.Kind, minutes: number) => {
    endedNotified.current = false;
    setLive((l) => ({ ...l, timer: T.start(kind, minutes * 60_000, Date.now()) }));
  };

  const chooseKind = useCallback(
    (k: T.Kind) => {
      setIdleKind(k);
      setPlannedMin(k === "focus" ? settings.focusMinutes : settings.breakMinutes);
    },
    [settings],
  );

  const finish = useCallback(async () => {
    if (timer.status === "idle" || !store) return;
    const end = Date.now();
    const record = {
      kind: timer.kind,
      intention: timer.kind === "focus" ? live.intention.trim() : "",
      categoryId: timer.kind === "focus" ? live.categoryId : null,
      startedAt: timer.startedAt,
      endedAt: end,
      plannedMs: timer.plannedMs,
      focusedMs: T.elapsed(timer, end),
      reflection: "",
      rating: 0,
    };
    setLive((l) => ({ ...l, timer: T.idle }));
    const id = await store.addSession(record);
    if (record.kind === "focus") setPending({ ...record, id });
    chooseKind(record.kind === "focus" ? "break" : "focus");
    setDay(startOfDay(end));
    refresh();
  }, [timer, store, live, chooseKind, refresh]);

  // Fire once when the countdown reaches zero. A focus session keeps counting
  // into overtime until it is finished; a break ends on its own.
  useEffect(() => {
    if (timer.status !== "running" || left > 0 || endedNotified.current) return;
    endedNotified.current = true;
    if (settings.sound) chime();
    if (timer.kind === "focus") {
      notify("Session complete", live.intention || "Time to wrap up and reflect.");
    } else {
      notify("Break's over", "Ready for the next session?");
      finish();
    }
  }, [timer, left, settings.sound, live.intention, finish]);

  const setRemaining = (minutes: number) => {
    const n = Date.now();
    const delta = minutes * 60_000 - T.remaining(timer, n);
    if (minutes * 60_000 > 0) endedNotified.current = false;
    setLive((l) => ({ ...l, timer: T.scrub(l.timer, delta, n) }));
  };

  const saveReflection = async (reflection: string, rating: number) => {
    if (!store || !pending) return;
    await store.updateSession({ ...pending, reflection, rating });
    setPending(null);
    refresh();
    if (settings.autoBreak) startTimer("break", settings.breakMinutes);
  };

  const saveSession = async (s: SessionRecord) => {
    if (!store) return;
    if (s.id === 0) {
      const { id: _new, ...rest } = s;
      await store.addSession(rest);
    } else {
      await store.updateSession(s);
    }
    setEditing(null);
    refresh();
  };

  const deleteSession = async (id: number) => {
    if (!store) return;
    await store.deleteSession(id);
    setEditing(null);
    refresh();
  };

  const newSession = (): SessionRecord => {
    // Default to the hour before now on today, or 9:00 on another day.
    const n = Date.now();
    const start = day === startOfDay(n) ? Math.max(day, Math.floor((n - 3_600_000) / 60_000) * 60_000) : day + 9 * 3_600_000;
    const end = Math.min(start + settings.focusMinutes * 60_000, addDays(day, 1) - 60_000);
    return {
      id: 0,
      kind: "focus",
      intention: "",
      categoryId: live.categoryId ?? categories[0]?.id ?? null,
      startedAt: start,
      endedAt: end,
      plannedMs: end - start,
      focusedMs: end - start,
      reflection: "",
      rating: 0,
    };
  };

  const updateSettings = async (s: Settings) => {
    setSettings(s);
    if (timer.status === "idle") setPlannedMin(idleKind === "focus" ? s.focusMinutes : s.breakMinutes);
    await store?.saveSettings(s);
  };

  const reloadCategories = async () => {
    if (!store) return;
    const cats = await store.categories();
    setCategories(cats);
    setLive((l) => (cats[0] && !cats.some((c) => c.id === l.categoryId) ? { ...l, categoryId: cats[0].id } : l));
  };

  // Space starts, pauses and resumes, unless the user is typing or a dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code !== "Space" || pending || editing || view !== "timer") return;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(el.tagName)) return;
      e.preventDefault();
      const n = Date.now();
      if (timer.status === "idle") startTimer(idleKind, plannedMin);
      else if (timer.status === "running") setLive((l) => ({ ...l, timer: T.pause(l.timer, n) }));
      else setLive((l) => ({ ...l, timer: T.resume(l.timer, n) }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!store) return <div className="loading">Loading…</div>;

  const category = categories.find((c) => c.id === live.categoryId);
  const liveBlock: LiveBlock | null =
    timer.status === "idle"
      ? null
      : {
          startedAt: timer.startedAt,
          kind: timer.kind,
          title: timer.kind === "break" ? "Break" : category?.name ?? "Focus",
          color: timer.kind === "break" ? "var(--break-block)" : category?.color ?? "var(--accent)",
        };

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Sections">
        <button
          className={view === "timer" ? "side-button active" : "side-button"}
          onClick={() => setView("timer")}
          aria-current={view === "timer" ? "page" : undefined}
          title="Timer"
          aria-label="Timer"
        >
          <ClockIcon />
          {timer.status !== "idle" && <span className="side-dot" />}
        </button>
        <span className="side-spacer" />
        <button
          className={view === "settings" ? "side-button active" : "side-button"}
          onClick={() => setView("settings")}
          aria-current={view === "settings" ? "page" : undefined}
          title="Settings"
          aria-label="Settings"
        >
          <GearIcon />
        </button>
      </nav>

      {view === "timer" ? (
        <div className="panes">
          <TimerPane
            timer={timer}
            now={now}
            intention={live.intention}
            categoryId={live.categoryId}
            categories={categories}
            idleKind={idleKind}
            plannedMin={plannedMin}
            todayCount={today.filter((s) => s.kind === "focus").length}
            dailyGoal={settings.dailyGoal}
            onIntention={(intention) => setLive((l) => ({ ...l, intention }))}
            onCategory={(categoryId) => setLive((l) => ({ ...l, categoryId }))}
            onIdleKind={chooseKind}
            onPlannedMin={setPlannedMin}
            onStart={() => startTimer(idleKind, plannedMin)}
            onPause={() => setLive((l) => ({ ...l, timer: T.pause(l.timer, Date.now()) }))}
            onResume={() => setLive((l) => ({ ...l, timer: T.resume(l.timer, Date.now()) }))}
            onSetRemaining={setRemaining}
            onFinish={finish}
            onDiscard={() => setLive((l) => ({ ...l, timer: T.idle }))}
          />
          <DayPane
            day={day}
            now={now}
            week={week}
            categories={categories}
            live={liveBlock}
            onDay={setDay}
            onOpen={setEditing}
            onAdd={() => setEditing(newSession())}
          />
        </div>
      ) : (
        <main className="settings-page">
          <SettingsView
            settings={settings}
            categories={categories}
            store={store}
            onSettings={updateSettings}
            onCategoriesChanged={reloadCategories}
          />
        </main>
      )}

      {pending && <Reflection pending={pending} onSave={saveReflection} onSkip={() => setPending(null)} />}
      {editing && (
        <SessionDialog
          session={editing}
          categories={categories}
          onSave={saveSession}
          onDelete={deleteSession}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
