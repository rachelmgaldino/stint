import { useState, type CSSProperties } from "react";
import type { Category } from "../store";
import { countable, eventKey, type CalendarEvent } from "../google";
import { compactDuration } from "../analytics";
import { clockTime, dayLabel } from "../dates";
import { capitalize, formatDate, t } from "../i18n";
import { CalendarIcon } from "./icons";

const when = (e: CalendarEvent) =>
  e.allDay
    ? `${capitalize(formatDate(e.start, { weekday: "long", day: "numeric", month: "long" }))} · ${t().events.allDay}`
    : `${capitalize(formatDate(e.start, { weekday: "long", day: "numeric", month: "long" }))} · ${t().timer.fromTo(clockTime(e.start), clockTime(e.end))}`;

/** A calendar event opened from Analytics, with a way to count it as focus once it's over. */
export function EventCard({ event, now, onCount, onClose }: { event: CalendarEvent; now: number; onCount(): void; onClose(): void }) {
  const text = t().events;
  const canCount = countable(event, now);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="event-title" onClick={onClose}>
      <div className="sheet event-sheet" style={{ "--event": event.color } as CSSProperties} onClick={(e) => e.stopPropagation()}>
        <span className="event-from">
          <CalendarIcon />
          {text.fromCalendar}
        </span>
        <h2 id="event-title">{event.title}</h2>
        <p className="event-when">
          {when(event)}
          {!event.allDay && <strong> · {compactDuration(event.end - event.start)}</strong>}
        </p>
        <p className="muted event-note">{canCount ? text.countNote : event.allDay ? text.allDayNote : text.laterNote}</p>
        <div className="sheet-actions">
          <span className="spacer" />
          <button type="button" className="secondary" onClick={onClose}>
            {canCount ? t().dialog.cancel : text.close}
          </button>
          {canCount && (
            <button type="button" className="primary" autoFocus onClick={onCount}>
              {text.count}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Picks several past events at once and adds a focus session for each, all in one category. */
export function CountEventsDialog({
  events,
  categories,
  categoryId,
  onAdd,
  onClose,
}: {
  events: CalendarEvent[];
  categories: Category[];
  categoryId: number | null;
  onAdd(list: CalendarEvent[], categoryId: number | null): void;
  onClose(): void;
}) {
  const text = t().events;
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState(categoryId);
  const all = picked.size === events.length;
  const toggle = (key: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="count-title" onClick={onClose}>
      <form
        className="sheet count-sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (picked.size) onAdd(events.filter((x) => picked.has(eventKey(x))), category);
        }}
      >
        <div className="sheet-head">
          <h2 id="count-title">{text.countTitle}</h2>
          <button type="button" className="chip-button" onClick={() => setPicked(all ? new Set() : new Set(events.map(eventKey)))}>
            {all ? text.selectNone : text.selectAll}
          </button>
        </div>
        <p className="muted">{text.countIntro}</p>
        <ul className="count-list">
          {events.map((e) => {
            const key = eventKey(e);
            return (
              <li key={key}>
                <label className="count-row" style={{ "--event": e.color } as CSSProperties}>
                  <input type="checkbox" checked={picked.has(key)} onChange={() => toggle(key)} />
                  <span className="count-swatch" aria-hidden="true" />
                  <span className="count-text">
                    <span className="count-title">{e.title}</span>
                    <span className="count-when">
                      {dayLabel(e.start)} · {t().timer.fromTo(clockTime(e.start), clockTime(e.end))}
                    </span>
                  </span>
                  <span className="count-len">{compactDuration(e.end - e.start)}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <label htmlFor="count-category">{t().dialog.category}</label>
        <select id="count-category" value={category ?? ""} onChange={(e) => setCategory(Number(e.target.value))}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="sheet-actions">
          <span className="spacer" />
          <button type="button" className="secondary" onClick={onClose}>
            {t().dialog.cancel}
          </button>
          <button type="submit" className="primary" disabled={!picked.size}>
            {text.addN(picked.size)}
          </button>
        </div>
      </form>
    </div>
  );
}
