import { useEffect, useRef } from "react";
import type { Category, SessionRecord } from "../store";
import { addDays, clockTime, dayLabel, msIntoDay, startOfDay, weekDays } from "../dates";
import { formatDuration } from "../timer";
import { ChevronLeft, ChevronRight, PlusIcon } from "./icons";

const HOUR_PX = 64;
const DAY_MS = 86_400_000;

/** The session in progress, drawn on today's timeline as it grows. */
export type LiveBlock = { startedAt: number; kind: "focus" | "break"; title: string; color: string };

type Props = {
  day: number;
  now: number;
  week: SessionRecord[];
  categories: Category[];
  live: LiveBlock | null;
  onDay(day: number): void;
  onOpen(s: SessionRecord): void;
  onAdd(): void;
};

/** "3:18" for 3 h 18 min, as in the week strip. */
function hoursMinutes(ms: number): string {
  const m = Math.round(ms / 60_000);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

function focusTotal(list: SessionRecord[]): number {
  return list.filter((s) => s.kind === "focus").reduce((a, s) => a + s.focusedMs, 0);
}

export function DayPane({ day, now, week, categories, live, onDay, onOpen, onAdd }: Props) {
  const today = startOfDay(now);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const sessions = week.filter((s) => startOfDay(s.startedAt) === day).sort((a, b) => a.startedAt - b.startedAt);
  const focus = sessions.filter((s) => s.kind === "focus");
  const count = (r: number) => focus.filter((s) => s.rating === r).length;
  const showLive = live && day === today;
  const scroller = useRef<HTMLDivElement>(null);

  const colorOf = (s: SessionRecord) =>
    s.kind === "break" ? "var(--break-block)" : ((s.categoryId !== null && byId.get(s.categoryId)?.color) || "var(--accent)");
  const titleOf = (s: SessionRecord) =>
    s.kind === "break" ? "Break" : (s.categoryId !== null && byId.get(s.categoryId)?.name) || "Focus";

  // Scroll to the first session of the day, or to the current hour.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const first = sessions[0]?.startedAt;
    const anchor = first !== undefined ? msIntoDay(first) : day === today ? msIntoDay(Date.now()) : 8 * 3_600_000;
    el.scrollTop = Math.max(0, (anchor / 3_600_000 - 1) * HOUR_PX);
    // Only when the day or its sessions change, not on every tick.
  }, [day, sessions.length]);

  const block = (start: number, end: number) => {
    const top = (msIntoDay(start) / 3_600_000) * HOUR_PX;
    const bottom = Math.min(24 * HOUR_PX, top + ((end - start) / 3_600_000) * HOUR_PX);
    return { top, height: Math.max(20, bottom - top) };
  };

  return (
    <section className="day-pane" aria-label="Day">
      <header className="day-nav">
        <button className="nav-button" aria-label="Previous day" onClick={() => onDay(addDays(day, -1))}>
          <ChevronLeft />
        </button>
        <button className="nav-today" onClick={() => onDay(today)} title="Go to today">
          {day === today ? "Today" : dayLabel(day)}
        </button>
        <button className="nav-button" aria-label="Next day" onClick={() => onDay(addDays(day, 1))}>
          <ChevronRight />
        </button>
      </header>

      <div className="week-strip" role="tablist" aria-label="Week">
        {weekDays(day).map((d) => {
          const total = focusTotal(week.filter((s) => startOfDay(s.startedAt) === d));
          const date = new Date(d);
          return (
            <button
              key={d}
              role="tab"
              aria-selected={d === day}
              className={d === day ? "week-day selected" : "week-day"}
              onClick={() => onDay(d)}
            >
              <span className="wd">{date.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</span>
              <span className="dn">{date.getDate()}</span>
              {d === today && <span className="today-dot" />}
              <span className="wt">{hoursMinutes(total)}</span>
            </button>
          );
        })}
      </div>

      <div className="day-summary">
        <span title="Great">{count(3)} ↑</span> · <span title="Okay">{count(2)} →</span> ·{" "}
        <span title="Rough">{count(1)} ↓</span>
        <strong>{formatDuration(focusTotal(sessions)).toUpperCase()} FOCUS</strong>
      </div>

      <div className="day-bar" aria-hidden="true">
        {sessions.map((s) => (
          <span
            key={s.id}
            style={{
              left: `${(msIntoDay(s.startedAt) / DAY_MS) * 100}%`,
              width: `${Math.max(0.3, ((s.endedAt - s.startedAt) / DAY_MS) * 100)}%`,
              background: colorOf(s),
            }}
          />
        ))}
        {day === today && <i className="now-mark" style={{ left: `${(msIntoDay(now) / DAY_MS) * 100}%` }} />}
      </div>

      <div className="timeline" ref={scroller}>
        <div className="timeline-inner" style={{ height: 24 * HOUR_PX }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="hour" style={{ top: h * HOUR_PX }}>
              <span>{String(h).padStart(2, "0")}:00</span>
            </div>
          ))}
          {sessions.map((s) => {
            const pos = block(s.startedAt, s.endedAt);
            const roomy = pos.height >= 56;
            return (
              <button
                key={s.id}
                className={`block${s.kind === "break" ? " break" : ""}${pos.height < 30 ? " compact" : ""}`}
                style={{ top: pos.top, height: pos.height, background: colorOf(s) }}
                onClick={() => onOpen(s)}
                title={`${titleOf(s)}${s.intention ? `: ${s.intention}` : ""}, ${clockTime(s.startedAt)} to ${clockTime(s.endedAt)}`}
              >
                <span className="block-head">
                  {roomy && <span className="block-time">{clockTime(s.startedAt)}</span>}
                  <span className="block-title">
                    {titleOf(s)}
                    {s.intention && <span className="block-intent"> · {s.intention}</span>}
                  </span>
                </span>
                {roomy && <span className="block-dur">{formatDuration(s.focusedMs)}</span>}
              </button>
            );
          })}
          {showLive && (
            <div
              className={live.kind === "break" ? "block live break" : "block live"}
              style={{ ...block(live.startedAt, now), background: live.color }}
            >
              <span className="block-head">
                <span className="block-title">{live.title}</span>
              </span>
            </div>
          )}
          {day === today && <div className="now-line" style={{ top: (msIntoDay(now) / 3_600_000) * HOUR_PX }} />}
        </div>
      </div>

      <button className="fab" aria-label="Add a session" title="Add a session" onClick={onAdd}>
        <PlusIcon />
      </button>
    </section>
  );
}
