import { useState } from "react";
import { compactDuration, computeStats, nextRange, previousRange, rangeFor, type Range, type RangeKind } from "../analytics";
import { clockTime, dayLabel, startOfDay } from "../dates";
import type { Category, SessionRecord } from "../store";
import { ChevronLeft, ChevronRight, CoffeeIcon, PlusIcon } from "./icons";
import { WeekStrip } from "./WeekStrip";

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

const ratingArrow = ["–", "↓", "→", "↑"];
const ratingName = ["Not rated", "Distracted", "Neutral", "Focused"];

function periodLabel(r: Range, now: number): string {
  const current = rangeFor(r.kind, now).from === r.from;
  if (r.kind === "day") return current ? "Today" : dayLabel(r.from);
  if (r.kind === "week") {
    if (current) return "This week";
    const end = new Date(r.to - 1);
    return `${new Date(r.from).getDate()} – ${dayLabel(end.getTime()).split(" ").slice(1).join(" ")}`;
  }
  return new Date(r.from).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
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

function Stat({ label, value, change }: { label: string; value: string; change?: number | null }) {
  return (
    <div className="stat-cell">
      <div className="stat-change">{change === undefined ? " " : <Change value={change} />}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
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
    <div className="card">
      <div className="card-head">
        <span className="card-title">Focus by day</span>
      </div>
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

  return (
    <div className="analytics">
      <header className="analytics-head">
        <div className="day-nav">
          <button className="nav-button" aria-label="Previous period" onClick={() => onRange(previousRange(range))}>
            <ChevronLeft />
          </button>
          <label className="nav-today nav-select">
            <span>{periodLabel(range, now)}</span>
            <select
              aria-label="Period"
              value={range.kind}
              onChange={(e) => onRange(rangeFor(e.target.value as RangeKind, range.from))}
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </label>
          <button className="nav-button" aria-label="Next period" onClick={() => onRange(nextRange(range))}>
            <ChevronRight />
          </button>
        </div>
        {range.kind !== "month" && (
          <WeekStrip
            day={range.from}
            now={now}
            week={week}
            wholeWeek={range.kind === "week"}
            onDay={(d) => onRange(rangeFor("day", d))}
          />
        )}
      </header>

      <div className="toolbar">
        <label className="toggle">
          <input type="checkbox" checked={notesOnly} onChange={(e) => setNotesOnly(e.target.checked)} />
          <span className="switch" aria-hidden="true" />
          Show notes only
        </label>
        <label className="filter">
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
      </div>

      <div className="analytics-body">
        <div className="analytics-cards">
          <div className="card stats-grid">
            <Stat label="Total focus" value={compactDuration(stats.totalFocus)} change={stats.focusChange} />
            <Stat
              label={range.kind === "day" ? "Focus this day" : "Avg focus/day"}
              value={compactDuration(stats.avgFocusPerDay)}
              change={range.kind === "day" ? undefined : stats.avgChange}
            />
            <Stat label="Most focused" value={stats.mostFocused ?? "–"} />
            <Stat label="Total break" value={compactDuration(stats.totalBreak)} change={stats.breakChange} />
            <Stat
              label="Focus/break"
              value={stats.focusPerBreak === null ? "–" : `${stats.focusPerBreak.toFixed(1)}/1`}
            />
            <Stat label="Most distracted" value={stats.mostDistracted ?? "–"} />
          </div>

          <div className="card ratings-row">
            <div>
              <div className="rating-count">{stats.ratings.focused}</div>
              <div className="muted">Focused ↑</div>
            </div>
            <div>
              <div className="rating-count">{stats.ratings.neutral}</div>
              <div className="muted">Neutral →</div>
            </div>
            <div>
              <div className="rating-count">{stats.ratings.distracted}</div>
              <div className="muted">Distracted ↓</div>
            </div>
          </div>

          {range.kind !== "day" && (
            <DayChart
              perDay={stats.perDay}
              kind={range.kind}
              color={(filter !== "all" && byId.get(filter)?.color) || "var(--accent)"}
            />
          )}

          <div className="card">
            <div className="card-head">
              <span className="card-title">Category distribution</span>
            </div>
            {stats.categories.length === 0 ? (
              <p className="empty">No sessions in this period.</p>
            ) : (
              <table className="breakdown">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Ratio</th>
                    <th>Change</th>
                    <th>Time spent</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.categories.map((c) => (
                    <tr key={c.key}>
                      <td>
                        <span className="row-name">
                          {c.key === "break" ? <CoffeeIcon /> : <span className="dot" style={{ background: c.color }} />}
                          {c.name}
                        </span>
                        <Bar ratio={c.ratio} color={c.color} />
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
          </div>

          <div className="card">
            <div className="card-head">
              <span className="card-title">By intention</span>
            </div>
            {stats.intentions.length === 0 ? (
              <p className="empty">No focus sessions in this period.</p>
            ) : (
              <table className="breakdown">
                <thead>
                  <tr>
                    <th>Intention</th>
                    <th>Ratio</th>
                    <th>Sessions</th>
                    <th>Time spent</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.intentions.map((i) => (
                    <tr key={i.name}>
                      <td>
                        <span className="row-name">{i.name}</span>
                        <Bar ratio={i.ratio} color={i.color} />
                      </td>
                      <td>{Math.round(i.ratio * 100)}%</td>
                      <td>{i.sessions}</td>
                      <td>{compactDuration(i.ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="session-list">
          {days.length === 0 && (
            <p className="empty">{notesOnly ? "No sessions with notes in this period." : "No sessions in this period."}</p>
          )}
          {days.map(({ day, items }) => (
            <section key={day}>
              <h2 className="list-day">
                {new Date(day).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </h2>
              <ul className="card entries">
                {items.map((s) => {
                  const c = s.categoryId !== null ? byId.get(s.categoryId) : undefined;
                  const isBreak = s.kind === "break";
                  return (
                    <li key={s.id}>
                      <button className="entry-row" onClick={() => onOpen(s)}>
                        <span className="entry-icon" title={isBreak ? "Break" : ratingName[s.rating]}>
                          {isBreak ? <CoffeeIcon /> : ratingArrow[s.rating]}
                        </span>
                        <span
                          className="entry-rule"
                          style={{
                            background: isBreak ? "var(--break)" : (c?.color ?? "var(--accent)"),
                            height: Math.min(96, Math.max(16, s.focusedMs / 60_000)),
                          }}
                        />
                        <span className="entry-main">
                          <span className="entry-title">{isBreak ? "Break" : s.intention || "–"}</span>
                          <span className="entry-time">
                            {clockTime(s.startedAt)} → {clockTime(s.endedAt)}
                          </span>
                          {s.reflection && <span className="entry-note">{s.reflection}</span>}
                        </span>
                        <span className="entry-side">
                          {!isBreak && c && (
                            <span className="cat-chip">
                              <span className="dot" style={{ background: c.color }} />
                              {c.name}
                            </span>
                          )}
                          <strong>{compactDuration(s.focusedMs)}</strong>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <button className="fab" aria-label="Add a session" title="Add a session" onClick={onAdd}>
            <PlusIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
