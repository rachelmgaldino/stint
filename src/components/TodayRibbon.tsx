import type { CSSProperties } from "react";
import type { Category, SessionRecord } from "../store";
import { addDays, clockTime, dayLabel, startOfDay, weekDays } from "../dates";
import { formatDuration } from "../timer";
import { eventLanes, type CalendarEvent } from "../google";
import { soft } from "../colors";
import { PlusIcon } from "./icons";
import { formatDate, t } from "../i18n";

const HOUR = 3_600_000;

/** The session in progress, drawn on the ribbon as it grows. */
export type LiveBlock = { startedAt: number; kind: "focus" | "break"; title: string; color: string };

type Props = {
  day: number;
  now: number;
  week: SessionRecord[];
  categories: Category[];
  live: LiveBlock | null;
  /** Google Calendar events for this day. */
  events: CalendarEvent[];
  /** A slim bar without events, hours or the week, shown during a session. */
  compact?: boolean;
  /** Set up a session from an event; absent while a timer runs. */
  onEvent?(e: CalendarEvent): void;
  onDay(day: number): void;
  onOpen(s: SessionRecord): void;
  onAdd(): void;
};

const focusTotal = (list: SessionRecord[]) =>
  list.filter((s) => s.kind === "focus").reduce((a, s) => a + s.focusedMs, 0);

/** The day as a horizontal ribbon, from 08 to 20 unless sessions fall outside that. */
export function TodayRibbon({ day, now, week, categories, live, events, compact, onEvent, onDay, onOpen, onAdd }: Props) {
  const today = startOfDay(now);
  const isToday = day === today;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const text = t();
  const sessions = week.filter((s) => startOfDay(s.startedAt) === day).sort((a, b) => a.startedAt - b.startedAt);
  const showLive = live && isToday;
  const timed = eventLanes(events.filter((e) => !e.allDay && e.end > day && e.start < addDays(day, 1)));

  // Hours shown: 08 to 20, widened to fit everything on the day, in steps of two.
  const hoursOf = (ms: number) => Math.min(24, Math.max(0, (ms - day) / HOUR));
  const marks = [
    ...sessions.flatMap((s) => [hoursOf(s.startedAt), hoursOf(s.endedAt)]),
    ...timed.flatMap(({ event: e }) => [hoursOf(e.start), hoursOf(e.end)]),
    ...(showLive ? [hoursOf(live.startedAt), hoursOf(now)] : []),
  ];
  let from = Math.min(8, ...marks.map((h) => Math.floor(h / 2) * 2));
  let to = Math.max(20, ...marks.map((h) => Math.ceil(h / 2) * 2));
  from = Math.max(0, from);
  to = Math.min(24, to);
  const span = to - from;
  const pos = (ms: number) => ((hoursOf(ms) - from) / span) * 100;
  const place = (start: number, end: number): CSSProperties => {
    const left = pos(start);
    return { left: `${left}%`, width: `max(4px, calc(${Math.max(0, pos(end) - left)}% - 2px))` };
  };
  const labels = Array.from({ length: span / 2 + 1 }, (_, i) => from + i * 2);

  const colorOf = (s: SessionRecord) =>
    s.kind === "break" ? "var(--matcha)" : soft((s.categoryId !== null && byId.get(s.categoryId)?.color) || "#f4a988");
  const titleOf = (s: SessionRecord) =>
    s.kind === "break" ? text.break : (s.categoryId !== null && byId.get(s.categoryId)?.name) || text.focus;

  const segments = (
    <>
      {sessions.map((s) => (
        <button
          key={s.id}
          className="ribbon-seg"
          style={{ ...place(s.startedAt, s.endedAt), background: colorOf(s) }}
          onClick={() => onOpen(s)}
          title={`${titleOf(s)}${s.intention ? `: ${s.intention}` : ""}, ${text.timer.fromTo(clockTime(s.startedAt), clockTime(s.endedAt))}`}
          aria-label={`${titleOf(s)}${s.intention ? `: ${s.intention}` : ""}, ${text.timer.fromTo(clockTime(s.startedAt), clockTime(s.endedAt))}`}
        />
      ))}
      {showLive && (
        <div
          className="ribbon-seg live"
          style={{ ...place(live.startedAt, now), "--seg": live.color } as CSSProperties}
          title={text.ribbon.since(live.title, clockTime(live.startedAt))}
        />
      )}
      {isToday && <i className="ribbon-now" style={{ left: `${pos(now)}%` }} />}
    </>
  );

  if (compact) {
    return (
      <section className="ribbon compact" aria-label={text.ribbon.today}>
        <span className="ribbon-title">{text.ribbon.today}</span>
        <div className="ribbon-track">{segments}</div>
        <span className="ribbon-total">{formatDuration(focusTotal(sessions))}</span>
      </section>
    );
  }

  const days = weekDays(day);
  const totals = days.map((d) => focusTotal(week.filter((s) => startOfDay(s.startedAt) === d)));
  const most = Math.max(...totals, 1);

  return (
    <section className="ribbon" aria-label={text.ribbon.day}>
      <div className="ribbon-main">
        <div className="ribbon-head">
          <h2>
            {isToday ? text.ribbon.today : dayLabel(day)}
            <span className="ribbon-sum">{text.ribbon.focused(formatDuration(focusTotal(sessions)))}</span>
          </h2>
          <div className="ribbon-tools">
            {!isToday && (
              <button className="chip-button" onClick={() => onDay(today)}>
                {text.ribbon.backToToday}
              </button>
            )}
            <button className="add-button" aria-label={text.ribbon.addSession} title={text.ribbon.addSession} onClick={onAdd}>
              <PlusIcon />
            </button>
          </div>
        </div>
        <div className="ribbon-body">
          <div className="ribbon-events">
            {timed.map(({ event: e, lane, lanes }) => {
              const label = `${e.title}, ${text.timer.fromTo(clockTime(e.start), clockTime(e.end))}`;
              return (
                <button
                  key={`${e.calendarId}/${e.id}`}
                  className="ribbon-event"
                  style={{ ...place(e.start, e.end), "--lane": lane, "--lanes": lanes, "--event": e.color } as CSSProperties}
                  disabled={!onEvent}
                  onClick={() => onEvent?.(e)}
                  title={onEvent ? text.ribbon.eventHint(label) : label}
                  aria-label={label}
                />
              );
            })}
          </div>
          <div className="ribbon-track">{segments}</div>
          <div className="ribbon-hours" aria-hidden="true">
            {labels.map((h) => (
              <span key={h}>{String(h % 24).padStart(2, "0")}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="ribbon-week">
        <span className="ribbon-week-title">{text.ribbon.thisWeek}</span>
        <div className="week-bars">
          {days.map((d, i) => {
            const label = `${dayLabel(d)}: ${totals[i] ? formatDuration(totals[i]) : text.ribbon.noFocus}`;
            return (
              <button
                key={d}
                className={d === day ? "week-bar selected" : "week-bar"}
                aria-label={label}
                aria-pressed={d === day}
                title={label}
                onClick={() => onDay(d)}
              >
                <span
                  className={d === today ? "bar today" : totals[i] ? "bar" : "bar empty"}
                  style={{ height: Math.max(6, Math.round((totals[i] / most) * 50)) }}
                />
                <span className="dow">{formatDate(d, { weekday: "narrow" }).toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

