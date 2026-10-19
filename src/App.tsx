import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { playSound, setTrayMenu, setTrayTooltip, syncAlarms, type Sound } from "./platform";
import { plannedAlarms } from "./alarms";
import * as G from "./google";
import {
  defaultSettings,
  openStore,
  type Category,
  type SessionRecord,
  type Settings,
  type Store,
} from "./store";
import * as T from "./timer";
import { addDays, clockTime, startOfDay, startOfWeek } from "./dates";
import { previousRange, rangeFor, type Range } from "./analytics";
import { TimerPane } from "./components/TimerPane";
import { TodayRibbon, type LiveBlock } from "./components/TodayRibbon";
import { SettingsView } from "./components/SettingsView";
import { Reflection, type PendingReflection } from "./components/Reflection";
import { SessionDialog } from "./components/SessionDialog";
import { AnalyticsView } from "./components/AnalyticsView";
import { MiniTimer } from "./components/MiniTimer";
import { ChartIcon, ClockIcon, SlidersIcon } from "./components/icons";
import { GoalSprouts, Pip } from "./components/Pip";
import { soft } from "./colors";
import { setLanguage, t } from "./i18n";
import { setLook } from "./look";
import { DEMO } from "./demo";
import { SIZE_STEP, cleanSize, setUiSize } from "./fit";
import { DemoBanner } from "./components/DemoBanner";

type View = "timer" | "analytics" | "settings";

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
  // "Keep adding" in the add dialog: on for the rest of the run once switched on.
  const [keepAdding, setKeepAdding] = useState(false);
  const [justAdded, setJustAdded] = useState<{ text: string; n: number } | null>(null);
  const [day, setDay] = useState(() => startOfDay(Date.now()));
  const [week, setWeek] = useState<SessionRecord[]>([]);
  const [today, setToday] = useState<SessionRecord[]>([]);
  const [range, setRange] = useState<Range>(() => rangeFor("day", Date.now()));
  const [rangeData, setRangeData] = useState<{ sessions: SessionRecord[]; previous: SessionRecord[]; week: SessionRecord[] }>({
    sessions: [],
    previous: [],
    week: [],
  });
  const [now, setNow] = useState(Date.now());
  const [google, setGoogle] = useState<{ connected: boolean; calendars: G.GoogleCalendar[] }>({ connected: false, calendars: [] });
  const [events, setEvents] = useState<G.CalendarEvent[]>([]);
  const syncing = useRef(false);

  const { timer } = live;
  // Set before the children render, so they all read the chosen language and look.
  setLanguage(settings.language);
  setLook(settings.look);
  const text = t();

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
    loadGoogle();
  }, []);

  const loadGoogle = useCallback(async () => {
    const connected = await G.isConnected().catch(() => false);
    const calendars = connected ? await G.listCalendars().catch(() => []) : [];
    setGoogle({ connected, calendars });
  }, []);

  // Adds sessions that have no calendar event yet, oldest first. Running it
  // again later retries anything that failed, for example while offline.
  const syncPending = useCallback(async () => {
    const cal = settings.calendar;
    if (!store || !google.connected || !cal.syncSessions || !cal.targetId || syncing.current) return;
    syncing.current = true;
    try {
      const since = Math.max(cal.syncSince, Date.now() - 30 * 86_400_000);
      for (const s of await store.unsynced(since)) {
        if (s.kind === "break" && !cal.syncBreaks) continue;
        const c = categories.find((x) => x.id === s.categoryId);
        const eventId = await G.createEvent(cal.targetId, s, c);
        await store.setGoogleEvent(s.id, cal.targetId, eventId);
      }
    } catch (e) {
      console.warn("calendar sync failed", e);
    } finally {
      syncing.current = false;
    }
  }, [store, google.connected, settings.calendar, categories]);

  useEffect(() => {
    syncPending();
  }, [syncPending]);

  /** Keeps a session's existing calendar event in step with an edit. */
  const syncEdit = async (s: SessionRecord) => {
    if (!google.connected || !s.googleEventId || !s.googleCalendarId) return;
    const c = categories.find((x) => x.id === s.categoryId);
    await G.updateEvent(s.googleCalendarId, s.googleEventId, s, c).catch((e) => console.warn("calendar update failed", e));
  };

  // Events from the visible Google calendars for the day on screen.
  useEffect(() => {
    const cal = settings.calendar;
    if (!google.connected || !cal.showEvents) {
      setEvents([]);
      return;
    }
    const shown = google.calendars.filter((c) => !cal.hidden.includes(c.id));
    let stale = false;
    const load = () =>
      G.eventsBetween(shown, day, addDays(day, 1)).then((e) => {
        if (!stale) setEvents(e);
      });
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => {
      stale = true;
      clearInterval(id);
    };
  }, [google, settings.calendar.showEvents, settings.calendar.hidden, day]);

  const refresh = useCallback(async () => {
    if (!store) return;
    const from = startOfWeek(day);
    const t = startOfDay(Date.now());
    const prev = previousRange(range);
    const rangeWeek = startOfWeek(range.from);
    const [w, td, rs, ps, rw] = await Promise.all([
      store.sessionsBetween(from, addDays(from, 7)),
      store.sessionsBetween(t, addDays(t, 1)),
      store.sessionsBetween(range.from, range.to),
      store.sessionsBetween(prev.from, prev.to),
      store.sessionsBetween(rangeWeek, addDays(rangeWeek, 7)),
    ]);
    setWeek(w);
    setToday(td);
    setRangeData({ sessions: rs, previous: ps, week: rw });
  }, [store, day, range]);

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

  useEffect(() => {
    setUiSize(settings.size);
  }, [settings.size]);

  useEffect(() => {
    document.documentElement.dataset.look = settings.look;
  }, [settings.look]);

  const left = T.remaining(timer, now);

  useEffect(() => {
    if (timer.status === "idle") {
      setTrayTooltip(text.tray.idle);
      return;
    }
    const label = timer.kind === "focus" ? live.intention || text.focus : text.break;
    const paused = timer.status === "paused" ? text.tray.paused : "";
    setTrayTooltip(`${label}: ${T.formatClock(left)}${paused}`);
  }, [timer, left, live.intention, text]);

  useEffect(() => {
    setTrayMenu(text.tray.open, text.tray.quit);
  }, [text]);

  const startTimer = (kind: T.Kind, minutes: number) => {
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
    const asking = timer.kind === "focus" && settings.askReflection;
    const record = {
      kind: timer.kind,
      intention: timer.kind === "focus" ? live.intention.trim() : "",
      categoryId: timer.kind === "focus" ? live.categoryId : null,
      startedAt: timer.startedAt,
      endedAt: end,
      plannedMs: timer.plannedMs,
      focusedMs: T.elapsed(timer, end),
      reflection: "",
      rating: timer.kind === "focus" ? settings.defaultRating : 0,
    };
    setLive((l) => ({ ...l, timer: T.idle }));
    const id = await store.addSession(record);
    chooseKind(record.kind === "focus" ? "break" : "focus");
    setDay(startOfDay(end));
    refresh();
    if (asking) {
      // Synced once the reflection is saved, so the event carries it.
      setPending({ ...record, id });
      return;
    }
    syncPending();
    if (record.kind === "focus" && settings.autoBreak) startTimer("break", settings.breakMinutes);
  }, [timer, store, live, settings, chooseKind, refresh, syncPending]);

  const backToFocus = async () => {
    await finish();
    setIdleKind("focus");
    setPlannedMin(settings.focusMinutes);
    startTimer("focus", settings.focusMinutes);
  };

  // Every alarm the timer needs (end, heads-up, overflow, presence) is kept
  // scheduled with the desktop shell, which fires them on time even while this
  // window is hidden. Each one that fires bumps `fired`, so repeating alarms
  // (presence) schedule their next turn.
  const [fired, setFired] = useState(0);
  const alarmSounds = useRef(new Map<string, Sound | undefined>());
  useEffect(() => {
    const alarms = plannedAlarms(timer, settings, live.intention, Date.now());
    alarmSounds.current = new Map(alarms.map((a) => [a.key, a.sound]));
    syncAlarms(alarms, (key) => {
      const sound = alarmSounds.current.get(key);
      if (sound) playSound(sound);
      setFired((n) => n + 1);
    });
  }, [timer, settings, live.intention, text, fired]);

  const setRemaining = (minutes: number) => {
    const n = Date.now();
    const delta = minutes * 60_000 - T.remaining(timer, n);
    setLive((l) => ({ ...l, timer: T.scrub(l.timer, delta, n) }));
  };

  const closeReflection = async (update?: { reflection: string; rating: number }) => {
    if (!store || !pending) return;
    if (update) await store.updateSession({ ...pending, ...update });
    setPending(null);
    refresh();
    syncPending();
    if (settings.autoBreak) startTimer("break", settings.breakMinutes);
  };

  const saveSession = async (s: SessionRecord) => {
    if (!store) return;
    if (s.id === 0) {
      const { id: _new, ...rest } = s;
      await store.addSession(rest);
    } else {
      await store.updateSession(s);
      syncEdit(s);
    }
    if (s.id === 0 && keepAdding) {
      // Stay open, cleared, with the next entry starting where this one ended.
      const text = t().dialog.added(s.kind === "focus" ? t().dialog.session : t().dialog.break, clockTime(s.startedAt), clockTime(s.endedAt));
      setJustAdded((j) => ({ text, n: (j?.n ?? 0) + 1 }));
      setEditing(nextEntry(s));
    } else {
      setEditing(null);
      setJustAdded(null);
    }
    refresh();
    syncPending();
  };

  const deleteSession = async (id: number) => {
    if (!store) return;
    const gone = editing?.id === id ? editing : null;
    await store.deleteSession(id);
    setEditing(null);
    refresh();
    if (google.connected && gone?.googleEventId && gone.googleCalendarId) {
      G.deleteEvent(gone.googleCalendarId, gone.googleEventId).catch((e) => console.warn("calendar delete failed", e));
    }
  };

  // Clicking a calendar event sets up a session for it.
  const planFromEvent = (e: G.CalendarEvent) => {
    if (timer.status !== "idle") return;
    setIdleKind("focus");
    // An event under way gets the time it has left, any other its full length.
    const n = Date.now();
    const from = e.start < n && e.end > n ? n : e.start;
    setPlannedMin(Math.min(180, Math.max(1, Math.round((e.end - from) / 60_000))));
    setLive((l) => ({ ...l, intention: e.title }));
  };

  const nextEntry = (prev: SessionRecord): SessionRecord => {
    const day = startOfDay(prev.startedAt);
    const lastMinute = addDays(day, 1) - 60_000;
    const start = Math.min(prev.endedAt, lastMinute - 60_000);
    const minutes = prev.kind === "focus" ? settings.focusMinutes : settings.breakMinutes;
    const end = Math.min(start + minutes * 60_000, lastMinute);
    return {
      ...newSession(day),
      kind: prev.kind,
      categoryId: prev.categoryId,
      startedAt: start,
      endedAt: end,
      plannedMs: end - start,
      focusedMs: end - start,
    };
  };

  const newSession = (day: number): SessionRecord => {
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

  const adjust = (minutes: number) => {
    if (timer.status === "idle") {
      const max = idleKind === "focus" ? 180 : 60;
      setPlannedMin((m) => Math.min(max, Math.max(1, m + minutes)));
    } else {
      setRemaining(Math.max(1, Math.ceil(T.remaining(timer, Date.now()) / 60_000) + minutes));
    }
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

  // Ctrl + and Ctrl − change the Size setting, Ctrl 0 resets it, like zoom in a browser.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || innerWidth <= 640) return;
      const step = ["=", "+", "Add"].includes(e.key) || e.code === "NumpadAdd" ? 1 : ["-", "_", "Subtract"].includes(e.key) || e.code === "NumpadSubtract" ? -1 : e.key === "0" || e.code === "Numpad0" ? 0 : null;
      if (step === null) return;
      e.preventDefault();
      const size = step === 0 ? 100 : cleanSize(cleanSize(settings.size) + step * SIZE_STEP);
      if (size !== settings.size) updateSettings({ ...settings, size });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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

  if (!store) return <div className="loading">{text.loading}</div>;

  const category = categories.find((c) => c.id === live.categoryId);
  const liveBlock: LiveBlock | null =
    timer.status === "idle"
      ? null
      : {
          startedAt: timer.startedAt,
          kind: timer.kind,
          title: timer.kind === "break" ? text.break : category?.name ?? text.focus,
          color: timer.kind === "break" ? "var(--matcha)" : soft(category?.color ?? "#f4a988"),
        };
  const focusCount = today.filter((s) => s.kind === "focus").length;
  // Focus sessions turn the whole window to night; breaks get a green stage.
  const mode = view === "timer" && timer.status !== "idle" ? timer.kind : "plan";
  const nextEvent =
    events
      .filter((e) => !e.allDay && e.start > now && startOfDay(e.start) === startOfDay(now))
      .sort((a, b) => a.start - b.start)[0] ?? null;

  const tabs: { id: View; label: string; icon: ReactNode }[] = [
    { id: "timer", label: text.tabs.timer, icon: <ClockIcon /> },
    { id: "analytics", label: text.tabs.analytics, icon: <ChartIcon /> },
    { id: "settings", label: text.tabs.settings, icon: <SlidersIcon /> },
  ];

  return (
    <div className="shell" data-mode={mode}>
      <header className="topbar">
        <div className="brand">
          <Pip size={40} label="Pip" heat={T.heat(timer, now)} />
          <span>Stint</span>
          {DEMO && <DemoBanner language={settings.language} />}
        </div>
        <nav className="tabs" aria-label={text.tabs.main}>
          {tabs.map((t) => (
            <button
              key={t.id}
              className={t.id === "settings" ? "tab settings-tab" : "tab"}
              aria-current={view === t.id ? "page" : undefined}
              onClick={() => setView(t.id)}
            >
              {t.icon}
              {t.label}
              {t.id === "timer" && view !== "timer" && timer.status !== "idle" && <span className="tab-dot" />}
            </button>
          ))}
        </nav>
        {mode === "focus" ? (
          <span className="status-pill focus">
            <span className="dot" />
            {text.sessionOf(focusCount + 1, Math.max(settings.dailyGoal, focusCount + 1))}
          </span>
        ) : mode === "break" ? (
          <span className="status-pill break">{text.onABreak}</span>
        ) : (
          <GoalSprouts done={focusCount} goal={settings.dailyGoal} />
        )}
      </header>

      {view === "timer" ? (
        <main className="timer-page">
          <TimerPane
            timer={timer}
            now={now}
            intention={live.intention}
            categoryId={live.categoryId}
            categories={categories}
            idleKind={idleKind}
            plannedMin={plannedMin}
            nextEvent={nextEvent}
            onIntention={(intention) => setLive((l) => ({ ...l, intention }))}
            onCategory={(categoryId) => setLive((l) => ({ ...l, categoryId }))}
            onIdleKind={chooseKind}
            onPlannedMin={setPlannedMin}
            onStart={() => startTimer(idleKind, plannedMin)}
            onPause={() => setLive((l) => ({ ...l, timer: T.pause(l.timer, Date.now()) }))}
            onResume={() => setLive((l) => ({ ...l, timer: T.resume(l.timer, Date.now()) }))}
            onSetRemaining={setRemaining}
            onAdjust={adjust}
            onFinish={finish}
            onBackToFocus={backToFocus}
            onDiscard={() => setLive((l) => ({ ...l, timer: T.idle }))}
          />
          <TodayRibbon
            day={day}
            now={now}
            week={week}
            categories={categories}
            live={liveBlock}
            events={events}
            compact={mode !== "plan"}
            onEvent={timer.status === "idle" ? planFromEvent : undefined}
            onDay={setDay}
            onOpen={setEditing}
            onAdd={() => setEditing(newSession(day))}
          />
        </main>
      ) : view === "analytics" ? (
        <AnalyticsView
          range={range}
          sessions={rangeData.sessions}
          previous={rangeData.previous}
          week={rangeData.week}
          categories={categories}
          now={now}
          dailyGoal={settings.dailyGoal}
          onRange={setRange}
          onOpen={setEditing}
          onAdd={() => setEditing(newSession(range.kind === "day" ? range.from : startOfDay(Date.now())))}
        />
      ) : (
        <main className="settings-page">
          <SettingsView
            settings={settings}
            categories={categories}
            store={store}
            google={google}
            onGoogleChanged={loadGoogle}
            onSettings={updateSettings}
            onCategoriesChanged={reloadCategories}
          />
        </main>
      )}

      {view !== "timer" && timer.status !== "idle" && (
        <MiniTimer
          timer={timer}
          now={now}
          kind={timer.kind}
          intention={live.intention}
          category={category}
          onPause={() => setLive((l) => ({ ...l, timer: T.pause(l.timer, Date.now()) }))}
          onResume={() => setLive((l) => ({ ...l, timer: T.resume(l.timer, Date.now()) }))}
          onAdjust={adjust}
          onFinish={finish}
          onOpenTimer={() => setView("timer")}
        />
      )}

      {pending && (
        <Reflection
          pending={pending}
          category={categories.find((c) => c.id === pending.categoryId)}
          sessionNumber={today.filter((s) => s.kind === "focus" && s.id !== pending.id && s.startedAt < pending.startedAt).length + 1}
          dailyGoal={settings.dailyGoal}
          onSave={(reflection, rating) => closeReflection({ reflection, rating })}
          onSkip={() => closeReflection()}
        />
      )}
      {editing && (
        <SessionDialog
          key={justAdded?.n ?? 0}
          session={editing}
          categories={categories}
          lengths={{ focus: settings.focusMinutes, break: settings.breakMinutes }}
          keepAdding={keepAdding}
          onKeepAdding={setKeepAdding}
          justAdded={justAdded?.text}
          onSave={saveSession}
          onDelete={deleteSession}
          onClose={() => {
            setEditing(null);
            setJustAdded(null);
          }}
        />
      )}
    </div>
  );
}
