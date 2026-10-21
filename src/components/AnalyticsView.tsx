import { useState, type CSSProperties } from "react";
import { compactDuration, computeStats, shortDuration, nextRange, previousRange, rangeFor, type Range, type RangeKind } from "../analytics";
import { clockTime, dayLabel, startOfDay, weekDays } from "../dates";
import type { Category, SessionRecord } from "../store";
import { soft } from "../colors";
import { CalendarIcon, ChevronLeft, ChevronRight, CoffeeIcon, PlusIcon } from "./icons";
import { countable, eventKey, eventLanes, type CalendarEvent } from "../google";
import { Pip, RatingFace } from "./Pip";
import { capitalize, formatDate, locale, t } from "../i18n";
import { DayAnalytics } from "./DayAnalytics";

type Props = {
  range: Range;
  /** Sessions in the range and in the period before it, for the change figures. */
  sessions: SessionRecord[];
  previous: SessionRecord[];
  week: SessionRecord[];
  categories: Category[];
  now: number;
  dailyGoal: number;
  /** Google Calendar events in the range, without the ones already made into sessions. */
  events: CalendarEvent[];
  onRange(r: Range): void;
  onOpen(s: SessionRecord): void;
  onEvent(e: CalendarEvent): void;
  /** Makes a past event into a focus session. */
  onCountEvent(e: CalendarEvent): void;
  /** Opens the picker for counting several past events as focus. */
  onCountEvents(list: CalendarEvent[]): void;
  onAdd(): void;
};

/** "Saturday 17 October", or "Sábado, 17 de outubro" in Portuguese. */
const longDay = (ms: number) => capitalize(formatDate(ms, { weekday: "long", day: "numeric", month: "long" }));

/** "Today", "Saturday 17 October", "12 to 18 October" or "October 2026". */
function periodLabel(r: Range, now: number): string {
  const text = t().analytics;
  if (r.kind === "day") {
    if (r.from === startOfDay(now)) return text.today;
    return longDay(r.from);
  }
  if (r.kind === "week") {
    const a = new Date(r.from);
    const b = new Date(r.to - 1);
    const month = (d: Date) => formatDate(d.getTime(), { month: "long" });
    return a.getMonth() === b.getMonth()
      ? text.weekSpan(a.getDate(), b.getDate(), month(b))
      : text.weekSpanAcross(a.getDate(), month(a), b.getDate(), month(b));
  }
  return capitalize(formatDate(r.from, { month: "long", year: "numeric" }));
}

/** A friendly line about when most of the focus happened. */
function peakLine(focus: SessionRecord[]): string {
  const parts = [0, 0, 0];
  for (const s of focus) {
    const h = new Date(s.startedAt).getHours();
    parts[h < 12 ? 0 : h < 17 ? 1 : 2] += s.focusedMs;
  }
  if (!parts.some((v) => v > 0)) return t().analytics.nothingYet;
  return t().analytics.peak[parts.indexOf(Math.max(...parts))];
}

/** Each day of the week as a column, with its focus sessions placed by time of day. */
function WhenChart({
  days,
  sessions,
  events,
  selected,
  now,
  goal,
  colorOf,
  onDay,
  onOpen,
  onEvent,
}: {
  days: number[];
  sessions: SessionRecord[];
  /** Calendar events, drawn beside the sessions with a dashed edge. */
  events: CalendarEvent[];
  selected: number | null;
  now: number;
  /** Focus sessions per day; each column gets a dot per session towards it. */
  goal: number;
  colorOf(s: SessionRecord): string;
  onDay(d: number): void;
  onOpen(s: SessionRecord): void;
  onEvent(e: CalendarEvent): void;
}) {
  const focus = sessions.filter((s) => s.kind === "focus");
  const hourOf = (ms: number) => (ms - startOfDay(ms)) / 3_600_000;
  // Each timed event, cut to the day it falls on, so one past midnight shows on both.
  const timed = days.flatMap((d) =>
    events
      .filter((e) => !e.allDay && e.end > d && e.start < d + 86_400_000)
      .map((e) => ({ e, day: d, start: Math.max(e.start, d), end: Math.min(e.end, d + 86_400_000) })),
  );
  const spans = [
    ...focus.map((s) => ({ start: s.startedAt, end: s.endedAt })),
    ...timed.map((x) => ({ start: x.start, end: x.end })),
  ];
  const from = Math.max(0, Math.min(8, ...spans.map((s) => Math.floor(hourOf(s.start)))));
  const to = Math.min(24, Math.max(20, ...spans.map((s) => Math.ceil(hourOf(s.start) + (s.end - s.start) / 3_600_000))));
  const span = to - from;
  const step = span > 12 ? 4 : 3;
  const labels = Array.from({ length: Math.floor(span / step) + 1 }, (_, i) => from + i * step);
  const today = startOfDay(now);
  const totals = days.map((d) => focus.filter((s) => startOfDay(s.startedAt) === d).reduce((a, s) => a + s.focusedMs, 0));
  const best = Math.max(...totals) > 0 ? days[totals.indexOf(Math.max(...totals))] : null;

  return (
    <div className="when-chart">
      <div className="when-hours" aria-hidden="true">
        {labels.map((h) => (
          <span key={h} style={{ top: `${((h - from) / span) * 100}%` }}>
            {String(h % 24).padStart(2, "0")}
          </span>
        ))}
      </div>
      <div className="when-days">
        {days.map((d) => {
          const list = focus.filter((s) => startOfDay(s.startedAt) === d);
          const total = list.reduce((a, s) => a + s.focusedMs, 0);
          const date = new Date(d);
          return (
            <div key={d} className="when-day">
              <button
                className={d === selected ? "when-head selected" : d === today ? "when-head today" : "when-head"}
                onClick={() => onDay(d)}
                aria-pressed={d === selected}
              >
                <span className="t-long">{capitalize(formatDate(d, { weekday: "short" }))}</span>
                <span className="t-short">{capitalize(formatDate(d, { weekday: "narrow" }))}</span> {date.getDate()}
              </button>
              <div className="when-col">
                {eventLanes([
                  ...list.map((x) => ({ start: x.startedAt, end: x.endedAt, session: x })),
                  ...timed.filter((x) => x.day === d).map((x) => ({ start: x.start, end: x.end, event: x.e })),
                ]).map(({ event: item, lane, lanes }) => {
                  const top = ((hourOf(item.start) - from) / span) * 100;
                  const height = ((item.end - item.start) / 3_600_000 / span) * 100;
                  const place = { top: `${top}%`, height: `max(8px, ${height}%)`, "--lane": lane, "--lanes": lanes } as CSSProperties;
                  if ("event" in item) {
                    const e = item.event;
                    const label = `${e.title}, ${t().timer.fromTo(clockTime(e.start), clockTime(e.end))}`;
                    return (
                      <button
                        key={eventKey(e)}
                        className="when-event"
                        style={{ ...place, "--event": e.color } as CSSProperties}
                        onClick={() => onEvent(e)}
                        title={t().events.hint(label)}
                        aria-label={label}
                      >
                        <span>{e.title}</span>
                      </button>
                    );
                  }
                  const s = item.session;
                  return (
                    <button
                      key={s.id}
                      className="when-block"
                      style={{ ...place, background: colorOf(s) }}
                      onClick={() => onOpen(s)}
                      title={`${s.intention || t().focus}, ${t().timer.fromTo(clockTime(s.startedAt), clockTime(s.endedAt))}`}
                      aria-label={`${s.intention || t().focus}, ${t().timer.fromTo(clockTime(s.startedAt), clockTime(s.endedAt))}`}
                    />
                  );
                })}
              </div>
              <div className={d === best ? "when-total best" : "when-total"} title={d === best ? t().analytics.bestDay : undefined}>
                {total ? (
                  <>
                    <span className="t-long">{compactDuration(total)}</span>
                    <span className="t-short">{shortDuration(total)}</span>
                  </>
                ) : (
                  "–"
                )}
              </div>
              <div className="when-goal" aria-hidden="true">
                {Array.from({ length: Math.max(goal, list.length) }, (_, i) => (
                  <span key={i} className={i < list.length ? "on" : ""} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="change muted">–</span>;
  const rounded = Math.round(value);
  const arrow = rounded > 0 ? "↑" : rounded < 0 ? "↓" : "→";
  return (
    <span className="change">
      {rounded > 0 ? "+" : rounded < 0 ? "−" : ""}
      {Math.abs(rounded)}% {arrow}
    </span>
  );
}

function Bar({ ratio, color }: { ratio: number; color: string }) {
  return (
    <div className="ratio-bar" aria-hidden="true">
      <span style={{ width: `${Math.max(ratio > 0 ? 1 : 0, ratio * 100)}%`, background: color }} />
    </div>
  );
}

function DayChart({ perDay, kind, color }: { perDay: { day: number; ms: number }[]; kind: RangeKind; color: string }) {
  const max = Math.max(...perDay.map((d) => d.ms), 60 * 60_000);
  // Gridlines every hour, or every 2 hours when the tallest day is long.
  const step = max > 6 * 3_600_000 ? 2 * 3_600_000 : 3_600_000;
  const lines = Array.from({ length: Math.floor(max / step) }, (_, i) => (i + 1) * step);
  return (
    <div className="day-chart-wrap">
      <div className="day-chart" role="img" aria-label={t().analytics.perDayChart}>
        {lines.map((v) => (
          <div key={v} className="grid-line" style={{ bottom: `${(v / max) * 100}%` }}>
            <span>{v / 3_600_000}h</span>
          </div>
        ))}
        <div className={kind === "month" ? "bars dense" : "bars"}>
          {perDay.map((d) => {
            const date = new Date(d.day);
            const label =
              kind === "week" ? capitalize(formatDate(d.day, { weekday: "short" })) : String(date.getDate());
            return (
              <div key={d.day} className="bar-slot" tabIndex={0} aria-label={`${dayLabel(d.day)}: ${compactDuration(d.ms)}`}>
                <div className="bar" style={{ height: `${(d.ms / max) * 100}%`, background: color }} />
                <div className="bar-tip">
                  {dayLabel(d.day)}
                  <strong>{compactDuration(d.ms)}</strong>
                </div>
                <span className={kind === "month" && date.getDate() % 5 !== 1 ? "bar-label faint" : "bar-label"}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsView({ range, sessions, previous, week, categories, now, dailyGoal, events, onRange, onOpen, onEvent, onCountEvent, onCountEvents, onAdd }: Props) {
  const [notesOnly, setNotesOnly] = useState(false);
  const [filter, setFilter] = useState<number | "all">("all");
  const [showAll, setShowAll] = useState(false);
  // On a phone the list runs inside the page, so it shows a few and a button for the rest.
  const phone = typeof matchMedia === "function" && matchMedia("(max-width: 640px)").matches;
  const PHONE_LIMIT = 5;

  const matches = (s: SessionRecord) => filter === "all" || (s.kind === "focus" && s.categoryId === filter);
  const shown = sessions.filter(matches);
  const stats = computeStats(range, shown, previous.filter(matches), categories, now);
  const byId = new Map(categories.map((c) => [c.id, c]));

  const allListed = shown.filter((s) => !notesOnly || s.reflection).sort((a, b) => b.startedAt - a.startedAt);
  const clamped = phone && !showAll && allListed.length > PHONE_LIMIT;
  const listed = clamped ? allListed.slice(0, PHONE_LIMIT) : allListed;
  const days: { day: number; items: SessionRecord[] }[] = [];
  for (const s of listed) {
    const d = startOfDay(s.startedAt);
    const last = days[days.length - 1];
    if (last && last.day === d) last.items.push(s);
    else days.push({ day: d, items: [s] });
  }

  const colorOf = (s: SessionRecord) =>
    s.kind === "break" ? "var(--matcha)" : soft((s.categoryId !== null && byId.get(s.categoryId)?.color) || "#f4a988");
  const rated = stats.ratings.focused + stats.ratings.neutral + stats.ratings.distracted;
  const pct = (n: number) => `${rated ? (n / rated) * 100 : 0}%`;
  const weekStart = range.kind === "month" ? null : weekDays(range.from);
  const focusCats = stats.categories.filter((c) => c.key !== "break");
  const text = t().analytics;
  const ratingName = t().ratings;
  const toCount = events.filter((e) => countable(e, now));

  return (
    <main className={`analytics ${range.kind}-range`}>
      <div className="page-head">
        <h1>{periodLabel(range, now)}</h1>
        <div className="period-nav">
          <button className="round-button" aria-label={text.previous} onClick={() => onRange(previousRange(range))}>
            <ChevronLeft />
          </button>
          <div className="segmented dark" role="group" aria-label={text.range}>
            {(["day", "week", "month"] as RangeKind[]).map((k) => (
              <button
                key={k}
                aria-pressed={range.kind === k}
                onClick={() => onRange(rangeFor(k, k === "day" && range.kind !== "day" ? Math.min(now, range.to - 1) : range.from))}
              >
                {text.kinds[k]}
              </button>
            ))}
          </div>
          <button className="round-button" aria-label={text.next} onClick={() => onRange(nextRange(range))}>
            <ChevronRight />
          </button>
        </div>
      </div>

      {range.kind === "day" ? (
        <DayAnalytics
          day={range.from}
          sessions={shown}
          week={week.filter(matches)}
          stats={stats}
          categories={categories}
          now={now}
          dailyGoal={dailyGoal}
          events={events}
          onDay={(d) => onRange(rangeFor("day", d))}
          onOpen={onOpen}
          onEvent={onEvent}
          onCountEvent={onCountEvent}
          onAdd={onAdd}
        />
      ) : (
      <>
      <div className="tiles">
        <div className="tile apricot">
          <div>
            <div className="eyebrow">{text.focused}</div>
            <div className="tile-value">{compactDuration(stats.totalFocus)}</div>
            <div className="tile-sub">
              {text.aDay(compactDuration(stats.avgFocusPerDay))}
              <Change value={stats.focusChange} />
            </div>
          </div>
          <Pip mood={stats.totalFocus > 0 ? "cheer" : "awake"} size={60} />
        </div>
        <div className="tile">
          <div className="eyebrow muted">{text.howItFelt}</div>
          <div className="felt-bar" role="img" aria-label={text.feltCounts(stats.ratings.focused, stats.ratings.neutral, stats.ratings.distracted)}>
            <span className="r3" style={{ width: pct(stats.ratings.focused) }} />
            <span className="r2" style={{ width: pct(stats.ratings.neutral) }} />
            <span className="r1" style={{ width: pct(stats.ratings.distracted) }} />
          </div>
          <div className="tile-sub">
            {text.feltCounts(stats.ratings.focused, stats.ratings.neutral, stats.ratings.distracted)}
          </div>
          {(stats.mostFocused || stats.mostDistracted) && (
            <div className="tile-sub muted">
              {stats.mostFocused && text.mostFocused(stats.mostFocused)}
              {stats.mostFocused && stats.mostDistracted && " · "}
              {stats.mostDistracted && text.mostDistracted(stats.mostDistracted)}
            </div>
          )}
        </div>
        <div className="tile matcha">
          <div className="eyebrow">{text.breaks}</div>
          <div className="tile-value">{compactDuration(stats.totalBreak)}</div>
          <div className="tile-sub">
            {stats.focusPerBreak === null
              ? text.noBreaks
              : text.focusPerBreak(stats.focusPerBreak.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }))}
          </div>
        </div>
      </div>

      <div className="analytics-row top-row">
        <section className="card when-card" aria-label={text.whenYouFocused}>
          <div className="card-head">
            <h2>{text.whenYouFocused}</h2>
            {weekStart && toCount.length > 0 ? (
              <button className="chip-button count-events" onClick={() => onCountEvents(toCount)}>
                <CalendarIcon />
                {t().events.countEvents(toCount.length)}
              </button>
            ) : (
              <span className="muted small strong">{peakLine(shown.filter((s) => s.kind === "focus"))}</span>
            )}
          </div>
          {weekStart ? (
            <WhenChart
              days={weekStart}
              sessions={shown}
              events={events}
              selected={null}
              now={now}
              goal={dailyGoal}
              colorOf={colorOf}
              onDay={(d) => onRange(rangeFor("day", d))}
              onOpen={onOpen}
              onEvent={onEvent}
            />
          ) : (
            <DayChart
              perDay={stats.perDay}
              kind={range.kind}
              color={soft((filter !== "all" && byId.get(filter)?.color) || "#a7aeec")}
            />
          )}
          {focusCats.length > 0 && (
            <div className="chips">
              {focusCats.map((c) => (
                <span key={c.key} className="chip static">
                  <span className="dot" style={{ background: soft(c.color) }} />
                  {c.name} {compactDuration(c.ms)}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="card list-card" aria-label={text.sessions}>
          <div className="card-head">
            <h2>{text.sessions}</h2>
            <div className="list-tools">
              <button className="chip-button" aria-pressed={notesOnly} onClick={() => setNotesOnly(!notesOnly)}>
                {text.notesOnly}
              </button>
              <button className="add-button" aria-label={text.addSession} title={text.addSession} onClick={onAdd}>
                <PlusIcon />
              </button>
            </div>
          </div>
          <label className="select-pill">
            <select
              aria-label={text.filter}
              value={filter}
              onChange={(e) => setFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              <option value="all">{text.allCategories}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="entries">
            {days.length === 0 && (
              <div className="entries-empty">
                <Pip mood="asleep" size={72} />
                <p>{notesOnly ? text.noNotes : text.noSessions}</p>
              </div>
            )}
            {days.map(({ day, items }) => (
              <div key={day} className="entry-day">
                {range.kind !== "day" && (
                  <h3>{longDay(day)}</h3>
                )}
                {items.map((s) => {
                  const c = s.categoryId !== null ? byId.get(s.categoryId) : undefined;
                  const isBreak = s.kind === "break";
                  const extra = [isBreak ? null : c?.name, isBreak || !s.rating ? null : ratingName[s.rating]].filter(Boolean);
                  return (
                    <button key={s.id} className={isBreak ? "entry break" : "entry"} onClick={() => onOpen(s)}>
                      <span className="entry-top">
                        <span className="entry-title">
                          {isBreak ? <CoffeeIcon /> : <span className="dot" style={{ background: colorOf(s) }} />}
                          {isBreak ? t().break : s.intention || c?.name || t().focus}
                        </span>
                        <span className="entry-len">{compactDuration(s.focusedMs)}</span>
                      </span>
                      <span className="entry-when">
                        {t().timer.fromTo(clockTime(s.startedAt), clockTime(s.endedAt))}
                        {extra.length > 0 && ` · ${extra.join(" · ")}`}
                        {!isBreak && s.rating > 0 && <RatingFace value={s.rating} size={18} />}
                      </span>
                      {s.reflection && <span className="entry-note">{s.reflection}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {clamped && (
            <button className="show-all" onClick={() => setShowAll(true)}>
              {text.showAll(allListed.length)}
            </button>
          )}
        </section>
      </div>

      <div className="analytics-row bottom-row">
        <section className="card table-card">
          <div className="card-head">
            <h2>{text.whereTimeWent}</h2>
          </div>
          {stats.categories.length === 0 ? (
            <div className="entries-empty">
              <Pip mood="asleep" size={72} />
              <p>{text.noSessions}</p>
            </div>
          ) : (
            <table className="breakdown">
              <thead>
                <tr>
                  <th>{text.category}</th>
                  <th>{text.share}</th>
                  <th>{text.change}</th>
                  <th>{text.time}</th>
                </tr>
              </thead>
              <tbody>
                {stats.categories.map((c) => (
                  <tr key={c.key}>
                    <td>
                      <span className="row-name">
                        {c.key === "break" ? <CoffeeIcon /> : <span className="dot" style={{ background: soft(c.color) }} />}
                        {c.name}
                      </span>
                      <Bar ratio={c.ratio} color={c.key === "break" ? "var(--matcha)" : soft(c.color)} />
                    </td>
                    <td>{Math.round(c.ratio * 100)}%</td>
                    <td>
                      <Change value={c.change} />
                    </td>
                    <td>{compactDuration(c.ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card table-card">
          <div className="card-head">
            <h2>{text.byIntention}</h2>
          </div>
          {stats.intentions.length === 0 ? (
            <div className="entries-empty">
              <Pip mood="asleep" size={72} />
              <p>{text.noFocusSessions}</p>
            </div>
          ) : (
            <table className="breakdown intentions">
              <thead>
                <tr>
                  <th>{text.intention}</th>
                  <th>{text.share}</th>
                  <th>{text.sessionsCol}</th>
                  <th>{text.time}</th>
                </tr>
              </thead>
              <tbody>
                {stats.intentions.map((i) => (
                  <tr key={i.name}>
                    <td>
                      <span className="row-name">{i.name}</span>
                      <Bar ratio={i.ratio} color={soft(i.color)} />
                    </td>
                    <td>{Math.round(i.ratio * 100)}%</td>
                    <td>{i.sessions}</td>
                    <td>{compactDuration(i.ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
      </>
      )}
    </main>
  );
}
