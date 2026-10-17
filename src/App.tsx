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
import { TimerView } from "./components/TimerView";
import { TodayView } from "./components/TodayView";
import { SettingsView } from "./components/SettingsView";
import { Reflection, type PendingReflection } from "./components/Reflection";

type Tab = "timer" | "today" | "settings";

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

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function App() {
  const [store, setStore] = useState<Store | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [categories, setCategories] = useState<Category[]>([]);
  const [today, setToday] = useState<SessionRecord[]>([]);
  const [tab, setTab] = useState<Tab>("timer");
  const [live, setLive] = useState<Live>(loadLive);
  const [plannedMin, setPlannedMin] = useState(defaultSettings.focusMinutes);
  const [idleKind, setIdleKind] = useState<T.Kind>("focus");
  const [pending, setPending] = useState<PendingReflection | null>(null);
  const [now, setNow] = useState(Date.now());
  const endedNotified = useRef(false);

  const { timer } = live;

  useEffect(() => {
    openStore().then(async (s) => {
      const [st, cats] = await Promise.all([s.settings(), s.categories()]);
      setSettings(st);
      setPlannedMin(st.focusMinutes);
      setCategories(cats);
      setLive((l) => (l.categoryId === null && cats[0] ? { ...l, categoryId: cats[0].id } : l));
      setStore(s);
    });
  }, []);

  const refreshToday = useCallback(async () => {
    if (!store) return;
    const from = startOfDay(Date.now());
    setToday(await store.sessionsBetween(from, from + 86_400_000));
  }, [store]);

  useEffect(() => {
    refreshToday();
  }, [refreshToday]);

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
    if (record.kind === "focus") {
      setPending({ id, intention: record.intention, focusedMs: record.focusedMs });
      setIdleKind("break");
      setPlannedMin(settings.breakMinutes);
    } else {
      setIdleKind("focus");
      setPlannedMin(settings.focusMinutes);
    }
    refreshToday();
  }, [timer, store, live, settings, refreshToday]);

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

  const discard = () => {
    setLive((l) => ({ ...l, timer: T.idle }));
  };

  const saveReflection = async (reflection: string, rating: number) => {
    if (!store || !pending) return;
    await store.updateReflection(pending.id, reflection, rating);
    setPending(null);
    refreshToday();
    if (settings.autoBreak) startTimer("break", settings.breakMinutes);
  };

  const updateSettings = async (s: Settings) => {
    setSettings(s);
    if (timer.status === "idle") setPlannedMin(idleKind === "focus" ? s.focusMinutes : s.breakMinutes);
    await store?.saveSettings(s);
  };

  const reloadCategories = async () => {
    if (store) setCategories(await store.categories());
  };

  // Space starts, pauses and resumes, unless the user is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code !== "Space" || pending || tab !== "timer") return;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return;
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

  return (
    <div className="app">
      <nav className="tabs" aria-label="Sections">
        {(["timer", "today", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            className={tab === t ? "tab active" : "tab"}
            onClick={() => setTab(t)}
            aria-current={tab === t ? "page" : undefined}
          >
            {t === "timer" ? "Timer" : t === "today" ? "Today" : "Settings"}
          </button>
        ))}
      </nav>

      <main>
        {tab === "timer" && (
          <TimerView
            timer={timer}
            now={now}
            intention={live.intention}
            categoryId={live.categoryId}
            categories={categories}
            idleKind={idleKind}
            plannedMin={plannedMin}
            todayFocusMs={today.filter((s) => s.kind === "focus").reduce((a, s) => a + s.focusedMs, 0)}
            onIntention={(intention) => setLive((l) => ({ ...l, intention }))}
            onCategory={(categoryId) => setLive((l) => ({ ...l, categoryId }))}
            onIdleKind={(k) => {
              setIdleKind(k);
              setPlannedMin(k === "focus" ? settings.focusMinutes : settings.breakMinutes);
            }}
            onPlannedMin={setPlannedMin}
            onStart={() => startTimer(idleKind, plannedMin)}
            onPause={() => setLive((l) => ({ ...l, timer: T.pause(l.timer, Date.now()) }))}
            onResume={() => setLive((l) => ({ ...l, timer: T.resume(l.timer, Date.now()) }))}
            onScrub={(minutes) => {
              if (T.remaining(timer, Date.now()) + minutes * 60_000 > 0) endedNotified.current = false;
              setLive((l) => ({ ...l, timer: T.scrub(l.timer, minutes * 60_000, Date.now()) }));
            }}
            onFinish={finish}
            onDiscard={discard}
          />
        )}
        {tab === "today" && <TodayView sessions={today} categories={categories} />}
        {tab === "settings" && (
          <SettingsView
            settings={settings}
            categories={categories}
            store={store}
            onSettings={updateSettings}
            onCategoriesChanged={reloadCategories}
          />
        )}
      </main>

      {pending && (
        <Reflection pending={pending} onSave={saveReflection} onSkip={() => setPending(null)} />
      )}
    </div>
  );
}
