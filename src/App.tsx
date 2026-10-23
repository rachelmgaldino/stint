import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { TimerPane, upClock } from "./components/TimerPane";
import { TodayRibbon, type LiveBlock } from "./components/TodayRibbon";
import { SettingsView } from "./components/SettingsView";
import { Reflection, type PendingReflection } from "./components/Reflection";
import { SessionDialog } from "./components/SessionDialog";
import { CountEventsDialog, EventCard } from "./components/EventDialogs";
import { AnalyticsView } from "./components/AnalyticsView";
import { MiniTimer } from "./components/MiniTimer";
import { ChartIcon, ClockIcon, SlidersIcon } from "./components/icons";
import { GoalSprouts, Pip } from "./components/Pip";
import { soft } from "./colors";
import { setLanguage, t } from "./i18n";
import { setLook } from "./look";
import { DEMO, demoEvents } from "./demo";
import { nextBreak } from "./breaks";
import { pastIntentions } from "./intentions";
import { SIZE_STEP, cleanSize, setUiSize } from "./fit";
import { DemoBanner } from "./components/DemoBanner";
import { UpdatePill } from "./components/UpdatePill";
import { useUpdater } from "./updates";
import { openMain, useFloatTimer, type FloatAction, type FloatState } from "./float";

type View = "timer" | "analytics" | "settings";

/** Leaves out the events that already have a session made from them. */
function unconverted(events: G.CalendarEvent[], sessions: SessionRecord[]): G.CalendarEvent[] {
  const done = new Set(sessions.map((s) => s.fromEvent).filter(Boolean));
  return done.size ? events.filter((e) => !done.has(G.eventKey(e))) : events;
}

// The running timer and what it's for, kept in localStorage so a restart of
// the app doesn't lose a session in progress.
// `long` marks a break that is a long one.
type Live = { timer: T.Timer; intention: string; categoryId: number | null; long?: boolean };
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

/** Keeps `set` filled with the events between two times, checking again every five minutes. */
function useEvents(
  fetch: (from: number, to: number) => Promise<G.CalendarEvent[]>,
  from: number,
  to: number,
  set: (e: G.CalendarEvent[]) => void,
  skip = false,
) {
  useEffect(() => {
    if (skip) {
      set([]);
      return;
    }
    let stale = false;
    const load = () =>
      fetch(from, to)
        .then((e) => {
          if (!stale) set(e);
        })
        .catch((e) => console.warn("calendar events failed", e));
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => {
      stale = true;
      clearInterval(id);
    };
  }, [fetch, from, to, skip, set]);
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
  // The last 90 days, for the intention suggestions.
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [range, setRange] = useState<Range>(() => rangeFor("day", Date.now()));
  const [rangeData, setRangeData] = useState<{ sessions: SessionRecord[]; previous: SessionRecord[]; week: SessionRecord[] }>({
    sessions: [],
    previous: [],
    week: [],
  });
  const [now, setNow] = useState(Date.now());
  const [google, setGoogle] = useState<{ connected: boolean; calendars: G.GoogleCalendar[] }>({ connected: false, calendars: [] });
  const [events, setEvents] = useState<G.CalendarEvent[]>([]);
  const [rangeEvents, setRangeEvents] = useState<G.CalendarEvent[]>([]);
  // An event opened from Analytics, and the list for counting several at once.
  const [openEvent, setOpenEvent] = useState<G.CalendarEvent | null>(null);
  const [counting, setCounting] = useState<G.CalendarEvent[] | null>(null);
  const syncing = useRef(false);
  // Waits for the saved settings, so a switched-off automatic check never runs.
  const updater = useUpdater(store !== null && settings.checkUpdates);

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

  // Events from the visible Google calendars, or the demo's pretend calendar.
  const fetchEvents = useCallback(
    async (from: number, to: number): Promise<G.CalendarEvent[]> => {
      if (DEMO) return demoEvents(from, to, settings.language);
      const cal = settings.calendar;
      if (!google.connected || !cal.showEvents) return [];
      return G.eventsBetween(google.calendars.filter((c) => !cal.hidden.includes(c.id)), from, to);
    },
    [google, settings.calendar.showEvents, settings.calendar.hidden, settings.language],
  );

  // The day on the Today ribbon, and the day or week open in Analytics.
  useEvents(fetchEvents, day, addDays(day, 1), setEvents);
  useEvents(fetchEvents, range.from, range.to, setRangeEvents, range.kind === "month");

  // Changes at midnight, so the lists below reload even while Stint sits in the tray.
  const todayStart = startOfDay(now);
  const refresh = useCallback(async () => {
    if (!store) return;
    const from = startOfWeek(day);
    const t = todayStart;
    const prev = previousRange(range);
    const rangeWeek = startOfWeek(range.from);
    const [w, td, rs, ps, rw, h] = await Promise.all([
      store.sessionsBetween(from, addDays(from, 7)),
      store.sessionsBetween(t, addDays(t, 1)),
      store.sessionsBetween(range.from, range.to),
      store.sessionsBetween(prev.from, prev.to),
      store.sessionsBetween(rangeWeek, addDays(rangeWeek, 7)),
      store.sessionsBetween(addDays(t, -90), addDays(t, 1)),
    ]);
    setHistory(h);
    setWeek(w);
    setToday(td);
    setRangeData({ sessions: rs, previous: ps, week: rw });
  }, [store, day, range, todayStart]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // The Today ribbon follows the date over to the new day when it was on today.
  const lastToday = useRef(todayStart);
  useEffect(() => {
    const before = lastToday.current;
    lastToday.current = todayStart;
    setDay((d) => (d === before ? todayStart : d));
  }, [todayStart]);

  useEffect(() => saveLive(live), [live]);
  const past = useMemo(() => pastIntentions(history, todayStart), [history, todayStart]);

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
  // A break started from the plan card is long when it's set to the long length.
  const idleLong = idleKind === "break" && settings.longBreakMinutes > settings.breakMinutes && plannedMin >= settings.longBreakMinutes;

  useEffect(() => {
    if (timer.status === "idle") {
      setTrayTooltip(text.tray.idle);
      return;
    }
    const label = timer.kind === "focus" ? live.intention || text.focus : text.break;
    const paused = timer.status === "paused" ? text.tray.paused : "";
    const clock = T.isFlow(timer) ? upClock(T.elapsed(timer, now)) : T.formatClock(left);
    setTrayTooltip(`${label}: ${clock}${paused}`);
  }, [timer, left, now, live.intention, text]);

  useEffect(() => {
    setTrayMenu(text.tray.open, text.tray.quit);
  }, [text]);

  const startTimer = (kind: T.Kind, minutes: number, long = false, flow = false) => {
    const n = Date.now();
    setLive((l) => ({ ...l, timer: flow && kind === "focus" ? T.startFlow(n) : T.start(kind, minutes * 60_000, n), long }));
  };
  // Focus is set to flow on the plan card.
  const idleFlow = idleKind === "focus" && settings.flow;

  const chooseKind = useCallback(
    (k: T.Kind) => {
      setIdleKind(k);
      setPlannedMin(k === "focus" ? settings.focusMinutes : nextBreak(today, settings).minutes);
    },
    [settings, today],
  );

  // `thenBreak` ends a focus session and starts a break straight away, whatever
  // the auto-break setting says. The reflection, if asked for, opens over the break.
  // The intention is cleared once you're back at the plan card, and kept when
  // the session goes on: through a break taken with Break, and Back to focus.
  const finish = useCallback(async (thenBreak = false, goingOn = false) => {
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
    const breakNow = thenBreak && record.kind === "focus";
    const next = nextBreak(today, settings, record.kind === "focus" ? record.focusedMs : 0);
    setLive((l) =>
      breakNow
        ? { ...l, timer: T.start("break", next.minutes * 60_000, end), long: next.long }
        : { ...l, timer: T.idle, intention: goingOn ? l.intention : "" },
    );
    const id = await store.addSession(record);
    chooseKind(record.kind === "focus" ? "break" : "focus");
    if (record.kind === "focus") setPlannedMin(next.minutes);
    setDay(startOfDay(end));
    refresh();
    if (asking) {
      // Synced once the reflection is saved, so the event carries it.
      setPending({ ...record, id });
      return;
    }
    syncPending();
    if (record.kind === "focus" && settings.autoBreak && !breakNow) startTimer("break", next.minutes, next.long);
  }, [timer, store, live, settings, today, chooseKind, refresh, syncPending]);

  /** Pause on a focus session: save it up to now and go on a break. */
  const takeBreak = () => finish(true);

  const backToFocus = async () => {
    await finish(false, true);
    setIdleKind("focus");
    setPlannedMin(settings.focusMinutes);
    startTimer("focus", settings.focusMinutes, false, settings.flow);
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

  const closeReflection = async (
    update?: Partial<Pick<SessionRecord, "reflection" | "rating" | "intention" | "categoryId">>,
  ) => {
    if (!store || !pending) return;
    if (update) await store.updateSession({ ...pending, ...update });
    // On a break taken with Break, Back to focus carries on with what was just named.
    if (update?.intention !== undefined && timer.status !== "idle" && timer.kind === "break") {
      setLive((l) => ({ ...l, intention: update.intention ?? l.intention, categoryId: update.categoryId ?? l.categoryId }));
    }
    setPending(null);
    refresh();
    syncPending();
    // Not when a break (or a new focus session) is already under way.
    if (settings.autoBreak && timer.status === "idle") {
      const next = nextBreak(today, settings);
      startTimer("break", next.minutes, next.long);
    }
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
    if (s.id === 0 && keepAdding && !s.fromEvent) {
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
    // An event has an end, so it gets a timer, not flow.
    if (settings.flow) void updateSettings({ ...settings, flow: false });
    setPlannedMin(Math.min(180, Math.max(1, Math.round((e.end - from) / 60_000))));
    setLive((l) => ({ ...l, intention: e.title }));
  };

  // An event that's over becomes a focus session with its times, its title as
  // the intention, and the category picked in the dialog.
  const eventSession = (e: G.CalendarEvent, categoryId: number | null): SessionRecord => {
    const end = Math.min(e.end, addDays(startOfDay(e.start), 1) - 60_000);
    return {
      ...newSession(startOfDay(e.start)),
      categoryId,
      intention: e.title,
      startedAt: e.start,
      endedAt: end,
      plannedMs: end - e.start,
      focusedMs: end - e.start,
      fromEvent: G.eventKey(e),
    };
  };

  const countEvent = (e: G.CalendarEvent) => {
    setOpenEvent(null);
    setEditing(eventSession(e, live.categoryId ?? categories[0]?.id ?? null));
  };

  const countEvents = async (list: G.CalendarEvent[], categoryId: number | null) => {
    if (!store) return;
    for (const e of list) {
      const { id: _new, ...rest } = eventSession(e, categoryId);
      await store.addSession(rest);
    }
    setCounting(null);
    refresh();
  };

  const nextEntry = (prev: SessionRecord): SessionRecord => {
    // Same length as the one just added, so a run of 25 min blocks is quick to log.
    const start = prev.endedAt;
    const end = start + (prev.endedAt - prev.startedAt);
    return {
      ...newSession(startOfDay(start)),
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

  // Space starts, sends a focus session to a break, pauses and resumes breaks, unless the user is typing or a dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code !== "Space" || pending || editing || view !== "timer") return;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(el.tagName)) return;
      e.preventDefault();
      const n = Date.now();
      if (timer.status === "idle") startTimer(idleKind, plannedMin, idleLong, idleFlow);
      else if (timer.status === "running" && timer.kind === "focus") takeBreak();
      else if (timer.status === "running") setLive((l) => ({ ...l, timer: T.pause(l.timer, n) }));
      else setLive((l) => ({ ...l, timer: T.resume(l.timer, n) }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // The floating timer, shown by the desktop shell while this window is away.
  const floatCategory = categories.find((c) => c.id === live.categoryId);
  const floatState = useMemo<FloatState>(
    () => ({
      timer,
      long: !!live.long,
      category: floatCategory ? { name: floatCategory.name, color: floatCategory.color } : null,
      look: settings.look,
      theme: settings.theme,
      language: settings.language,
      onTop: settings.floatOnTop,
    }),
    [timer, live.long, floatCategory, settings.look, settings.theme, settings.language, settings.floatOnTop],
  );
  useFloatTimer(floatState, settings.floatTimer, (action: FloatAction) => {
    // The reflection opens in this window, so bring it back for it.
    const reflecting = timer.status !== "idle" && timer.kind === "focus" && settings.askReflection;
    switch (action) {
      case "break":
        void takeBreak();
        if (reflecting) openMain();
        break;
      case "end":
        void finish();
        if (reflecting) openMain();
        break;
      case "focus":
        void backToFocus();
        break;
      case "open":
        openMain();
        break;
      case "pin":
        void updateSettings({ ...settings, floatOnTop: !settings.floatOnTop });
        break;
    }
  });

  if (!store) return <div className="loading">{text.loading}</div>;

  const category = floatCategory;
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
  const previousEnd =
    timer.status === "idle"
      ? null
      : today.reduce<number | null>((m, s) => (s.endedAt <= timer.startedAt && (m === null || s.endedAt > m) ? s.endedAt : m), null);
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
          <Pip size={40} label="Pip" heat={timer.status !== "idle" ? T.heat(timer, now) : idleFlow ? 0 : idleKind === "focus" ? T.heatFor(plannedMin) : 0} />
          <span>Stint</span>
          {DEMO && <DemoBanner language={settings.language} />}
          <UpdatePill updater={updater} />
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
            past={past}
            onPickIntention={(intention, categoryId) => setLive((l) => ({ ...l, intention, categoryId }))}
            onCategory={(categoryId) => setLive((l) => ({ ...l, categoryId }))}
            onIdleKind={chooseKind}
            onPlannedMin={(m) => {
              // Picking a length turns flow off.
              if (idleFlow) void updateSettings({ ...settings, flow: false });
              setPlannedMin(m);
            }}
            flow={settings.flow}
            onFlow={(flow) => {
              if (flow !== settings.flow) void updateSettings({ ...settings, flow });
            }}
            onStart={() => startTimer(idleKind, plannedMin, idleLong, idleFlow)}
            longBreak={timer.status === "idle" ? idleLong : !!live.long}
            focusAction={settings.focusAction}
            breakAction={settings.breakAction}
            onPause={() => setLive((l) => ({ ...l, timer: T.pause(l.timer, Date.now()) }))}
            onResume={() => setLive((l) => ({ ...l, timer: T.resume(l.timer, Date.now()) }))}
            onSetRemaining={setRemaining}
            onAdjust={adjust}
            onMoveStart={(ms) => setLive((l) => ({ ...l, timer: T.moveStart(l.timer, ms, Date.now()) }))}
            previousEnd={previousEnd}
            onTakeBreak={takeBreak}
            onFinish={() => finish()}
            onBackToFocus={backToFocus}
            onDiscard={() => setLive((l) => ({ ...l, timer: T.idle }))}
          />
          <TodayRibbon
            day={day}
            now={now}
            week={week}
            categories={categories}
            live={liveBlock}
            events={unconverted(events, week)}
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
          events={unconverted(rangeEvents, rangeData.sessions)}
          onRange={setRange}
          onOpen={setEditing}
          onEvent={setOpenEvent}
          onCountEvent={countEvent}
          onCountEvents={setCounting}
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
            updater={updater}
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
          onTakeBreak={takeBreak}
          onAdjust={adjust}
          onFinish={() => finish()}
          onOpenTimer={() => setView("timer")}
        />
      )}

      {pending && (
        <Reflection
          pending={pending}
          categories={categories}
          past={past}
          sessionNumber={today.filter((s) => s.kind === "focus" && s.id !== pending.id && s.startedAt < pending.startedAt).length + 1}
          dailyGoal={settings.dailyGoal}
          onSave={closeReflection}
          onSkip={closeReflection}
        />
      )}
      {openEvent && (
        <EventCard event={openEvent} now={now} onCount={() => countEvent(openEvent)} onClose={() => setOpenEvent(null)} />
      )}
      {counting && (
        <CountEventsDialog
          events={counting}
          categories={categories}
          categoryId={live.categoryId ?? categories[0]?.id ?? null}
          onAdd={countEvents}
          onClose={() => setCounting(null)}
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
