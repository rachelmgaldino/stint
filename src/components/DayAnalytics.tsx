import { compactDuration, type Stats } from "../analytics";
import { clockTime, startOfDay, weekDays } from "../dates";
import type { Category, SessionRecord } from "../store";
import { soft } from "../colors";
import { useEffect, useState } from "react";
import { CalendarIcon, CoffeeIcon, CopyIcon, DownloadIcon, PlusIcon } from "./icons";
import { countable, eventKey, type CalendarEvent } from "../google";
import type { CSSProperties } from "react";
import { GoalSprouts, Pip, RatingFace } from "./Pip";
import { capitalize, formatDate, t } from "../i18n";
import { copyText, saveReport } from "../platform";
import { dayCsv, daySummary, isoDay } from "../report";

type Props = {
  day: number;
  /** The day's sessions, focus and breaks. */
  sessions: SessionRecord[];
  /** Every session of the week the day is in. */
  week: SessionRecord[];
  stats: Stats;
  categories: Category[];
  now: number;
  dailyGoal: number;
  /** The day's calendar events that haven't been made into sessions. */
  events: CalendarEvent[];
  onDay(d: number): void;
  onOpen(s: SessionRecord): void;
  onEvent(e: CalendarEvent): void;
  /** Makes a past event into a focus session. */
  onCountEvent(e: CalendarEvent): void;
  onAdd(): void;
};

const focusOf = (list: SessionRecord[]) => list.filter((s) => s.kind === "focus").reduce((a, s) => a + s.focusedMs, 0);

function weekTotals(day: number, week: SessionRecord[]) {
  const days = weekDays(day);
  const totals = days.map((d) => focusOf(week.filter((s) => startOfDay(s.startedAt) === d)));
  return { days, totals, max: Math.max(...totals, 3_600_000) };
}

/** On a phone, the week as seven small buttons, each with a bar for its focus time. */
function WeekStrip({ day, week, now, onDay }: { day: number; week: SessionRecord[]; now: number; onDay(d: number): void }) {
  const { days, totals, max } = weekTotals(day, week);
  const today = startOfDay(now);
  return (
    <nav className="week-strip" aria-label={t().analytics.kinds.week}>
      {days.map((d, i) => (
        <button
          key={d}
          className={d === day ? "strip-day selected" : d === today ? "strip-day today" : "strip-day"}
          aria-pressed={d === day}
          onClick={() => onDay(d)}
        >
          <span className="strip-name">
            {capitalize(formatDate(d, { weekday: "short" }))} {new Date(d).getDate()}
          </span>
          <span className="strip-bar" aria-hidden="true">
            <span style={{ height: `${(totals[i] / max) * 100}%` }} />
          </span>
          <span className="strip-total">{totals[i] ? compactDuration(totals[i]) : "–"}</span>
        </button>
      ))}
    </nav>
  );
}

/** On a desktop, the week as a list in the side column: a row per day with a sideways bar. */
function WeekList({ day, week, onDay }: { day: number; week: SessionRecord[]; onDay(d: number): void }) {
  const { days, totals, max } = weekTotals(day, week);
  return (
    <section className="card week-list" aria-label={t().analytics.kinds.week}>
      <div className="card-head">
        <h2>{t().analytics.thisWeek}</h2>
      </div>
      {days.map((d, i) => (
        <button
          key={d}
          className={d === day ? "wl-day selected" : "wl-day"}
          aria-pressed={d === day}
          onClick={() => onDay(d)}
        >
          <span className="wl-name">
            {capitalize(formatDate(d, { weekday: "short" }))} {new Date(d).getDate()}
          </span>
          <span className="wl-bar" aria-hidden="true">
            <span style={{ width: `${(totals[i] / max) * 100}%` }} />
          </span>
          <span className="wl-total">{totals[i] ? compactDuration(totals[i]) : "–"}</span>
        </button>
      ))}
    </section>
  );
}

/** The day told in order: each session with its note, breaks between, calendar events, and the free time in the gaps. */
function DayStory({ sessions, events, now, colorOf, byId, onOpen, onEvent, onCount }: {
  sessions: SessionRecord[];
  events: CalendarEvent[];
  now: number;
  colorOf(s: SessionRecord): string;
  byId: Map<number, Category>;
  onOpen(s: SessionRecord): void;
  onEvent(e: CalendarEvent): void;
  onCount(e: CalendarEvent): void;
}) {
  type Item = { start: number; end: number; session?: SessionRecord; event?: CalendarEvent };
  const ordered: Item[] = [
    ...sessions.map((s) => ({ start: s.startedAt, end: s.endedAt, session: s })),
    ...events.filter((e) => !e.allDay).map((e) => ({ start: e.start, end: e.end, event: e })),
  ].sort((a, b) => a.start - b.start);
  const ratingName = t().ratings;
  const text = t().events;
  let reached = -Infinity;
  return (
    <ol className="story">
      {ordered.map((item) => {
        const gap = reached > -Infinity ? item.start - reached : 0;
        reached = Math.max(reached, item.end);
        const free = gap >= 30 * 60_000 && <div className="story-gap">{t().analytics.free(compactDuration(gap))}</div>;
        if (item.event) {
          const e = item.event;
          return (
            <li key={eventKey(e)} className="story-item">
              {free}
              <div className="story-row event" style={{ "--event": e.color } as CSSProperties}>
                <span className="story-time">{clockTime(e.start)}</span>
                <span className="story-dot" aria-hidden="true" />
                <div className="story-card story-event">
                  <button className="story-event-open" onClick={() => onEvent(e)}>
                    <span className="story-top">
                      <span className="story-title">{e.title}</span>
                      <span className="story-len phone-only">{compactDuration(e.end - e.start)}</span>
                    </span>
                    <span className="story-meta">
                      <span className="story-cal">
                        <CalendarIcon />
                        {text.onCalendar} · {t().timer.fromTo(clockTime(e.start), clockTime(e.end))}
                      </span>
                    </span>
                  </button>
                  <span className="story-event-side">
                    <span className="story-len desk-only">{compactDuration(e.end - e.start)}</span>
                    {countable(e, now) && (
                      <button className="chip-button story-count" onClick={() => onCount(e)}>
                        {text.count}
                      </button>
                    )}
                  </span>
                </div>
              </div>
            </li>
          );
        }
        const s = item.session!;
        const c = s.categoryId !== null ? byId.get(s.categoryId) : undefined;
        const isBreak = s.kind === "break";
        return (
          <li key={s.id} className="story-item">
            {free}
            <div className={isBreak ? "story-row break" : "story-row"}>
              <span className="story-time">{clockTime(s.startedAt)}</span>
              <span className="story-dot" style={{ background: colorOf(s) }} aria-hidden="true" />
              {isBreak ? (
                <button className="story-break" onClick={() => onOpen(s)}>
                  <CoffeeIcon />
                  {t().break} · {compactDuration(s.focusedMs)}
                </button>
              ) : (
                <button className="story-card" onClick={() => onOpen(s)}>
                  <span className="story-top">
                    <span className="story-title">{s.intention || c?.name || t().focus}</span>
                    <span className="story-len">{compactDuration(s.focusedMs)}</span>
                  </span>
                  <span className="story-meta">
                    {c && (
                      <span className="story-tag" style={{ background: soft(c.color) }}>
                        {c.name}
                      </span>
                    )}
                    {s.fromEvent && (
                      <span className="story-from" title={text.madeFrom} aria-label={text.madeFrom}>
                        <CalendarIcon />
                      </span>
                    )}
                    {t().timer.fromTo(clockTime(s.startedAt), clockTime(s.endedAt))}
                    {s.rating > 0 && (
                      <>
                        {" · "}
                        {ratingName[s.rating]}
                        <RatingFace value={s.rating} size={18} />
                      </>
                    )}
                  </span>
                  {s.reflection && <span className="story-note">{s.reflection}</span>}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Saves the day as a CSV or copies a short summary, each saying so for a moment. */
function DayExport({ day, sessions, categories }: { day: number; sessions: SessionRecord[]; categories: Category[] }) {
  const text = t().report;
  const [done, setDone] = useState<"csv" | "copy" | "failed" | null>(null);
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(null), 1800);
    return () => clearTimeout(id);
  }, [done]);

  const save = async () => {
    try {
      if (await saveReport(`stint-${isoDay(day)}.csv`, dayCsv(day, sessions, categories))) setDone("csv");
    } catch (e) {
      console.warn("export failed", e);
      setDone("failed");
    }
  };
  const copy = async () => {
    await copyText(daySummary(day, sessions, categories));
    setDone("copy");
  };

  return (
    <div className="day-export">
      <button className="export-button" title={text.csvTitle} aria-label={text.csvTitle} onClick={save} disabled={!sessions.length}>
        <DownloadIcon />
        {done === "csv" ? text.saved : done === "failed" ? text.failed : text.csv}
      </button>
      <button className="export-button" title={text.copyTitle} aria-label={text.copyTitle} onClick={copy} disabled={!sessions.length}>
        <CopyIcon />
        {done === "copy" ? text.copied : text.copy}
      </button>
    </div>
  );
}

export function DayAnalytics({ day, sessions, week, stats, categories, now, dailyGoal, events, onDay, onOpen, onEvent, onCountEvent, onAdd }: Props) {
  const text = t().analytics;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const colorOf = (s: SessionRecord) =>
    s.kind === "break" ? "var(--matcha)" : soft((s.categoryId !== null && byId.get(s.categoryId)?.color) || "#f4a988");
  const focus = sessions.filter((s) => s.kind === "focus");
  const rated = stats.ratings.focused + stats.ratings.neutral + stats.ratings.distracted;
  const pct = (n: number) => `${rated ? (n / rated) * 100 : 0}%`;

  // The week's average, over the days up to this one that had any focus.
  const weekDaysSoFar = weekDays(day).filter((d) => d <= Math.min(day, startOfDay(now)));
  const weekFocus = focusOf(week.filter((s) => startOfDay(s.startedAt) <= day));
  const weekAvg = weekFocus / Math.max(1, weekDaysSoFar.length);
  const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  const longest = Math.max(0, ...focus.map((s) => s.focusedMs));
  const all = stats.totalFocus + stats.totalBreak;

  return (
    <>
      <div className="phone-only">
        <WeekStrip day={day} week={week} now={now} onDay={onDay} />
      </div>

      <div className="tiles">
        <div className="tile apricot">
          <div>
            <div className="eyebrow">{text.focused}</div>
            <div className="tile-value">{compactDuration(stats.totalFocus)}</div>
            <div className="tile-sub">{text.weekAverage(compactDuration(weekAvg))}</div>
          </div>
          <div className="tile-goal">
            <GoalSprouts done={focus.length} goal={dailyGoal} />
          </div>
        </div>
        <div className="tile">
          <div className="eyebrow muted">{text.howItFelt}</div>
          <div className="felt-faces" aria-label={text.feltCounts(stats.ratings.focused, stats.ratings.neutral, stats.ratings.distracted)}>
            {focus
              .filter((s) => s.rating > 0)
              .sort((a, b) => a.startedAt - b.startedAt)
              .map((s) => (
                <RatingFace key={s.id} value={s.rating} size={30} />
              ))}
          </div>
          <div className="felt-bar" aria-hidden="true">
            <span className="r3" style={{ width: pct(stats.ratings.focused) }} />
            <span className="r2" style={{ width: pct(stats.ratings.neutral) }} />
            <span className="r1" style={{ width: pct(stats.ratings.distracted) }} />
          </div>
          <div className="tile-sub">
            {text.feltCounts(stats.ratings.focused, stats.ratings.neutral, stats.ratings.distracted)}
          </div>
        </div>
        <div className="tile matcha">
          <div className="eyebrow">{text.rhythm}</div>
          <div className="tile-value">
            {ordered.length ? `${clockTime(ordered[0].startedAt)}–${clockTime(ordered[ordered.length - 1].endedAt)}` : "–"}
          </div>
          <div className="tile-sub">
            {text.longest(compactDuration(longest))} · {text.breaksTotal(compactDuration(stats.totalBreak))}
          </div>
        </div>
      </div>

      <div className="analytics-row top-row">
        <section className="card story-card-wrap" aria-label={text.yourDay}>
          <div className="card-head">
            <h2>{text.yourDay}</h2>
            <DayExport day={day} sessions={sessions} categories={categories} />
            <button className="add-button" aria-label={text.addSession} title={text.addSession} onClick={onAdd}>
              <PlusIcon />
            </button>
          </div>
          {sessions.length === 0 && !events.some((e) => !e.allDay) ? (
            <div className="entries-empty">
              <Pip mood="asleep" size={72} />
              <p>{text.noSessions}</p>
            </div>
          ) : (
            <div className="story-scroll">
              <DayStory sessions={sessions} events={events} now={now} colorOf={colorOf} byId={byId} onOpen={onOpen} onEvent={onEvent} onCount={onCountEvent} />
            </div>
          )}
        </section>

        <div className="day-side">
          <div className="desk-only">
            <WeekList day={day} week={week} onDay={onDay} />
          </div>
          <section className="card went-card" aria-label={text.whereTimeWent}>
            <div className="card-head">
              <h2>{text.whereTimeWent}</h2>
            </div>
            {stats.categories.length > 0 && (
              <div className="went-bar" aria-hidden="true">
                {stats.categories.map((c) => (
                  <span
                    key={c.key}
                    style={{ flex: c.ms / all, background: c.key === "break" ? "var(--matcha)" : soft(c.color) }}
                  />
                ))}
              </div>
            )}
            <ul className="went-list">
              {stats.categories.map((c) => (
                <li key={c.key}>
                  <span className="row-name">
                    {c.key === "break" ? <CoffeeIcon /> : <span className="dot" style={{ background: soft(c.color) }} />}
                    {c.name}
                  </span>
                  <span className="muted">{Math.round(c.ratio * 100)}%</span>
                  <strong>{compactDuration(c.ms)}</strong>
                </li>
              ))}
            </ul>
            {stats.intentions.length > 0 && (
              <>
                <h3 className="went-sub">{text.byIntention}</h3>
                <ul className="went-list">
                  {stats.intentions.map((i) => (
                    <li key={i.name}>
                      <span className="row-name">
                        <span className="dot" style={{ background: soft(i.color) }} />
                        {i.name}
                      </span>
                      <span className="muted">×{i.sessions}</span>
                      <strong>{compactDuration(i.ms)}</strong>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="went-pip">
              <Pip mood={stats.totalFocus > 0 ? "cheer" : "asleep"} size={64} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
