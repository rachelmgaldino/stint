import { useState } from "react";
import { compactDuration, computeStats, nextRange, previousRange, rangeFor, type Range, type RangeKind } from "../analytics";
import { clockTime, dayLabel, startOfDay, weekDays } from "../dates";
import type { Category, SessionRecord } from "../store";
import { soft } from "../colors";
import { ChevronLeft, ChevronRight, CoffeeIcon, PlusIcon } from "./icons";
import { Pip, RatingFace } from "./Pip";

type Props = {
  range: Range;
  /** Sessions in the range and in the period before it, for the change figures. */
  sessions: SessionRecord[];
  previous: SessionRecord[];
  week: SessionRecord[];
  categories: Category[];
  now: number;
  onRange(r: Range): void;
  onOpen(s: SessionRecord): void;
  onAdd(): void;
};

const ratingName = ["Not rated", "Distracted", "Neutral", "Focused"];

/** "Today", "Saturday 17 October", "12 to 18 October" or "October 2026". */
function periodLabel(r: Range, now: number): string {
  if (r.kind === "day") {
    if (r.from === startOfDay(now)) return "Today";
    return new Date(r.from).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  }
  if (r.kind === "week") {
    const a = new Date(r.from);
    const b = new Date(r.to - 1);
    const month = (d: Date) => d.toLocaleDateString("en-GB", { month: "long" });
    return a.getMonth() === b.getMonth()
      ? `${a.getDate()} to ${b.getDate()} ${month(b)}`
      : `${a.getDate()} ${month(a)} to ${b.getDate()} ${month(b)}`;
  }
  return new Date(r.from).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** A friendly line about when most of the focus happened. */
function peakLine(focus: SessionRecord[]): string {
  const parts = [0, 0, 0];
  for (const s of focus) {
    const h = new Date(s.startedAt).getHours();
    parts[h < 12 ? 0 : h < 17 ? 1 : 2] += s.focusedMs;
  }
  if (!parts.some((v) => v > 0)) return "Nothing yet";
  return ["Mornings are your thing", "Afternoons are your thing", "Evenings are your thing"][parts.indexOf(Math.max(...parts))];
}

/** Each day of the week as a column, with its focus sessions placed by time of day. */
function WhenChart({
  days,
  sessions,
  selected,
  now,
  colorOf,
  onDay,
  onOpen,
}: {
  days: number[];
  sessions: SessionRecord[];
  selected: number | null;
  now: number;
  colorOf(s: SessionRecord): string;
  onDay(d: number): void;
  onOpen(s: SessionRecord): void;
}) {
  const focus = sessions.filter((s) => s.kind === "focus");
  const hourOf = (ms: number) => (ms - startOfDay(ms)) / 3_600_000;
  const from = Math.max(0, Math.min(8, ...focus.map((s) => Math.floor(hourOf(s.startedAt)))));
  const to = Math.min(24, Math.max(20, ...focus.map((s) => Math.ceil(hourOf(s.startedAt) + (s.endedAt - s.startedAt) / 3_600_000))));
  const span = to - from;
  const step = span > 12 ? 4 : 3;
  const labels = Array.from({ length: Math.floor(span / step) + 1 }, (_, i) => from + i * step);
  const today = startOfDay(now);

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
                {date.toLocaleDateString("en-GB", { weekday: "short" })} {date.getDate()}
              </button>
              <div className="when-col">
                {list.map((s) => {
                  const top = ((hourOf(s.startedAt) - from) / span) * 100;
                  const height = ((s.endedAt - s.startedAt) / 3_600_000 / span) * 100;
                  return (
                    <button
                      key={s.id}
                      className="when-block"
                      style={{ top: `${top}%`, height: `max(8px, ${height}%)`, background: colorOf(s) }}
                      onClick={() => onOpen(s)}
                      title={`${s.intention || "Focus"}, ${clockTime(s.startedAt)} to ${clockTime(s.endedAt)}`}
                      aria-label={`${s.intention || "Focus"}, ${clockTime(s.startedAt)} to ${clockTime(s.endedAt)}`}
                    />
                  );
                })}
              </div>
              <div className="when-total">{total ? compactDuration(total) : "–"}</div>
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
      <div className="day-chart" role="img" aria-label="Focus time for each day of the period">
        {lines.map((v) => (
          <div key={v} className="grid-line" style={{ bottom: `${(v / max) * 100}%` }}>
            <span>{v / 3_600_000}h</span>
          </div>
        ))}
        <div className={kind === "month" ? "bars dense" : "bars"}>
          {perDay.map((d) => {
            const date = new Date(d.day);
            const label =
              kind === "week" ? date.toLocaleDateString("en-GB", { weekday: "short" }) : String(date.getDate());
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

export function AnalyticsView({ range, sessions, previous, week, categories, now, onRange, onOpen, onAdd }: Props) {
  const [notesOnly, setNotesOnly] = useState(false);
  const [filter, setFilter] = useState<number | "all">("all");

  const matches = (s: SessionRecord) => filter === "all" || (s.kind === "focus" && s.categoryId === filter);
  const shown = sessions.filter(matches);
  const stats = computeStats(range, shown, previous.filter(matches), categories, now);
  const byId = new Map(categories.map((c) => [c.id, c]));

  const listed = shown.filter((s) => !notesOnly || s.reflection).sort((a, b) => b.startedAt - a.startedAt);
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

  return (
    <main className="analytics">
      <div className="page-head">
        <h1>{periodLabel(range, now)}</h1>
        <div className="period-nav">
          <button className="round-button" aria-label="Previous period" onClick={() => onRange(previousRange(range))}>
            <ChevronLeft />
          </button>
          <div className="segmented dark" role="group" aria-label="Range">
            {(["day", "week", "month"] as RangeKind[]).map((k) => (
              <button
                key={k}
                aria-pressed={range.kind === k}
                onClick={() => onRange(rangeFor(k, k === "day" && range.kind !== "day" ? Math.min(now, range.to - 1) : range.from))}
              >
                {k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
          <button className="round-button" aria-label="Next period" onClick={() => onRange(nextRange(range))}>
            <ChevronRight />
          </button>
        </div>
      </div>

      <div className="tiles">
        <div className="tile apricot">
          <div>
            <div className="eyebrow">FOCUSED</div>
            <div className="tile-value">{compactDuration(stats.totalFocus)}</div>
            <div className="tile-sub">
              {range.kind !== "day" && <>{compactDuration(stats.avgFocusPerDay)} a day · </>}
              <Change value={stats.focusChange} />
            </div>
          </div>
          <Pip mood={stats.totalFocus > 0 ? "cheer" : "awake"} size={60} />
        </div>
        <div className="tile">
          <div className="eyebrow muted">HOW IT FELT</div>
          <div className="felt-bar" role="img" aria-label={`${stats.ratings.focused} focused, ${stats.ratings.neutral} neutral, ${stats.ratings.distracted} distracted`}>
            <span className="r3" style={{ width: pct(stats.ratings.focused) }} />
            <span className="r2" style={{ width: pct(stats.ratings.neutral) }} />
            <span className="r1" style={{ width: pct(stats.ratings.distracted) }} />
          </div>
          <div className="tile-sub">
            {stats.ratings.focused} focused · {stats.ratings.neutral} neutral · {stats.ratings.distracted} distracted
          </div>
          {(stats.mostFocused || stats.mostDistracted) && (
            <div className="tile-sub muted">
              {stats.mostFocused && <>Most focused: {stats.mostFocused}</>}
              {stats.mostFocused && stats.mostDistracted && " · "}
              {stats.mostDistracted && <>Most distracted: {stats.mostDistracted}</>}
            </div>
          )}
        </div>
        <div className="tile matcha">
          <div className="eyebrow">BREAKS</div>
          <div className="tile-value">{compactDuration(stats.totalBreak)}</div>
          <div className="tile-sub">
            {stats.focusPerBreak === null
              ? "No breaks taken"
              : `${stats.focusPerBreak.toFixed(1)} minutes of focus per break minute`}
          </div>
        </div>
      </div>

      <div className="analytics-row">
        <section className="card when-card" aria-label="When you focused">
          <div className="card-head">
            <h2>When you focused</h2>
            <span className="muted small strong">{peakLine(shown.filter((s) => s.kind === "focus"))}</span>
          </div>
          {weekStart ? (
            <WhenChart
              days={weekStart}
              sessions={range.kind === "week" ? shown : week.filter(matches)}
              selected={range.kind === "day" ? range.from : null}
              now={now}
              colorOf={colorOf}
              onDay={(d) => onRange(rangeFor("day", d))}
              onOpen={onOpen}
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

        <section className="card list-card" aria-label="Sessions">
          <div className="card-head">
            <h2>Sessions</h2>
            <div className="list-tools">
              <button className="chip-button" aria-pressed={notesOnly} onClick={() => setNotesOnly(!notesOnly)}>
                Notes only
              </button>
              <button className="add-button" aria-label="Add a session" title="Add a session" onClick={onAdd}>
                <PlusIcon />
              </button>
            </div>
          </div>
          <label className="select-pill">
            <select
              aria-label="Filter by category"
              value={filter}
              onChange={(e) => setFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="entries">
            {days.length === 0 && (
              <p className="empty">{notesOnly ? "No sessions with notes in this period." : "No sessions in this period."}</p>
            )}
            {days.map(({ day, items }) => (
              <div key={day} className="entry-day">
                {range.kind !== "day" && (
                  <h3>{new Date(day).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h3>
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
                          {isBreak ? "Break" : s.intention || c?.name || "Focus"}
                        </span>
                        <span className="entry-len">{compactDuration(s.focusedMs)}</span>
                      </span>
                      <span className="entry-when">
                        {clockTime(s.startedAt)} to {clockTime(s.endedAt)}
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
        </section>
      </div>

      <div className="analytics-row">
        <section className="card table-card">
          <div className="card-head">
            <h2>Where the time went</h2>
          </div>
          {stats.categories.length === 0 ? (
            <p className="empty">No sessions in this period.</p>
          ) : (
            <table className="breakdown">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Share</th>
                  <th>Change</th>
                  <th>Time</th>
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
            <h2>By intention</h2>
          </div>
          {stats.intentions.length === 0 ? (
            <p className="empty">No focus sessions in this period.</p>
          ) : (
            <table className="breakdown">
              <thead>
                <tr>
                  <th>Intention</th>
                  <th>Share</th>
                  <th>Sessions</th>
                  <th>Time</th>
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
    </main>
  );
}
