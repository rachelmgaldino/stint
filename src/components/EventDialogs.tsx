import { useState, type CSSProperties } from "react";
import type { Category } from "../store";
import {
  canDelete,
  canEdit,
  countable,
  eventErrorKey,
  eventKey,
  linkHost,
  newEventId,
  openMeeting,
  type CalendarEvent,
  type EventDraft,
  type EventErrorKey,
  type GoogleCalendar,
} from "../google";
import { compactDuration } from "../analytics";
import { atTime, dayLabel, fromIsoDate, isoDate, nextHalfHour, startOfDay, timeRange } from "../dates";
import { capitalize, formatDate, t } from "../i18n";
import { CalendarIcon } from "./icons";
import { useTimeFields } from "./useTimeFields";

const when = (e: CalendarEvent) =>
  e.allDay
    ? `${capitalize(formatDate(e.start, { weekday: "long", day: "numeric", month: "long" }))} · ${t().events.allDay}`
    : `${capitalize(formatDate(e.start, { weekday: "long", day: "numeric", month: "long" }))} · ${timeRange(e.start, e.end)}`;

/** A calendar event opened from Analytics, with a way to count it as focus once it's over. */
export function EventCard({
  event,
  now,
  onCount,
  onEdit,
  onDelete,
  onClose,
}: {
  event: CalendarEvent;
  now: number;
  onCount(): void;
  onEdit?(): void;
  /** Rejects if Google refuses; on success the parent closes the card. */
  onDelete?(): Promise<void>;
  onClose(): void;
}) {
  const text = t().events;
  const canCount = countable(event, now);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<EventErrorKey | null>(null);

  const closeConfirm = () => {
    if (deleting) return;
    setConfirmDelete(false);
    setDeleteError(null);
  };
  const join = (url: string) => {
    openMeeting(url).catch((err) => console.warn("Couldn't open the meeting link", err));
  };
  const remove = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete?.();
    } catch (err) {
      console.warn("Couldn't delete the calendar event", err);
      setDeleteError(eventErrorKey(err));
      setDeleting(false);
    }
  };

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
        {event.joinUrl && (
          <button
            type="button"
            className="chip-button event-join"
            title={linkHost(event.joinUrl)}
            aria-label={text.joinMeetingAt(linkHost(event.joinUrl))}
            onClick={() => join(event.joinUrl!)}
          >
            {text.joinMeeting}
          </button>
        )}
        <p className="muted event-note">{canCount ? text.countNote : event.allDay ? text.allDayNote : text.laterNote}</p>
        <div className="sheet-actions">
          {onDelete && canDelete(event) && (
            <button type="button" className="danger-link" onClick={() => setConfirmDelete(true)}>
              {t().dialog.delete}
            </button>
          )}
          <span className="spacer" />
          {onEdit && canEdit(event) && (
            <button type="button" className="secondary" onClick={onEdit}>
              {text.edit}
            </button>
          )}
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
      {confirmDelete && (
        <div
          className="confirm-overlay"
          onClick={(e) => {
            e.stopPropagation();
            closeConfirm();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            e.stopPropagation();
            closeConfirm();
          }}
        >
          <div
            className="confirm-card event-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-body"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-title">{text.deleteTitle}</h3>
            <p id="confirm-body">{text.deleteBody}</p>
            {deleteError && <p className="error">{deleteError === "saveFailed" ? text.deleteFailed : text[deleteError]}</p>}
            <div className="confirm-actions">
              <button type="button" className="secondary" autoFocus disabled={deleting} onClick={closeConfirm}>
                {t().dialog.cancel}
              </button>
              <button type="button" className="danger-button" disabled={deleting} onClick={remove}>
                {t().dialog.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Where a new event starts: the next half hour today, 09:00 on any other day. */
function firstStart(day: number): number {
  const now = Date.now();
  return startOfDay(day) === startOfDay(now) ? nextHalfHour(now) : (atTime(day, "09:00") ?? day);
}

/** Adds an event to Google Calendar, or edits one that's already there. */
export function EventForm({
  event,
  day,
  calendars,
  calendarId,
  onSave,
  onClose,
}: {
  /** The event to edit; absent when adding a new one. */
  event?: CalendarEvent;
  /** The day to start from when adding. */
  day: number;
  /** Calendars a new event can go to. */
  calendars: GoogleCalendar[];
  /** The calendar picked at first when adding. */
  calendarId: string | null;
  /**
   * Rejects if Google refuses, and the form stays open with what was typed.
   * "meetNotReady" means the event was added without its Meet link, so the form stays open to say so.
   */
  onSave(draft: EventDraft, calendarId: string): Promise<"meetNotReady" | void>;
  onClose(): void;
}) {
  const text = t().events;
  const dialog = t().dialog;
  const [from] = useState(() => event?.start ?? firstStart(day));
  const [to] = useState(() => event?.end ?? from + 30 * 60_000);
  const [title, setTitle] = useState(event?.untitled ? "" : (event?.title ?? ""));
  const [date, setDate] = useState(isoDate(from));
  const [picked, setPicked] = useState(calendarId);
  const [meet, setMeet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<EventErrorKey | null>(null);
  const [meetNotReady, setMeetNotReady] = useState(false);
  // One id for every try, so Google can tell a retry from a new event.
  const [newId] = useState(newEventId);

  const pickedDay = fromIsoDate(date);
  const eventDay = pickedDay ?? startOfDay(from);
  const { start, end, duration, startMs, nextDay, endMs, minutes, changeStart, changeDuration, changeEnd, tidyDuration, stepDuration } = useTimeFields({
    day: eventDay,
    start: from,
    end: to,
    // A new event starts by keeping its length; a saved one keeps its end.
    held: event ? "end" : "duration",
  });
  const error =
    pickedDay === null
      ? dialog.badDate
      : startMs === null || endMs === null
        ? dialog.badTime
        : minutes === null || minutes < 1
          ? dialog.badDuration
          : minutes >= 24 * 60
            ? dialog.tooLong
            : "";
  const target = event?.calendarId ?? picked;
  // An untitled event stays open to edit, so its time can change without inventing a title.
  const titled = title.trim() !== "" || !!event?.untitled;
  const ready = !saving && !meetNotReady && !error && titled && target !== null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || startMs === null || endMs === null) return;
    setSaving(true);
    setFailed(null);
    try {
      const draft = { title: title.trim(), start: startMs, end: endMs, ...(meet && { meet }), ...(!event && { id: newId }) };
      if ((await onSave(draft, target)) === "meetNotReady") {
        setMeetNotReady(true);
        setSaving(false);
      }
    } catch (err) {
      console.warn("Couldn't save the calendar event", err);
      setFailed(eventErrorKey(err));
      setSaving(false);
    }
  };

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-form-title"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <form className="sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2 id="event-form-title">{event ? text.editEvent : text.addEvent}</h2>
        <label htmlFor="ef-title">{text.eventTitle}</label>
        <input
          id="ef-title"
          value={title}
          maxLength={120}
          placeholder={text.titlePlaceholder}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          required={!event?.untitled}
        />
        <label htmlFor="ef-date">{dialog.date}</label>
        <input id="ef-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <div className="time-fields">
          <label>
            {dialog.start}
            <input type="time" value={start} onChange={(e) => changeStart(e.target.value)} required />
          </label>
          <label className="duration-field">
            {dialog.duration}
            <input
              value={duration}
              inputMode="text"
              placeholder={dialog.durationPlaceholder}
              maxLength={12}
              onChange={(e) => changeDuration(e.target.value)}
              onBlur={tidyDuration}
              onKeyDown={stepDuration}
              required
            />
          </label>
          <label>
            {dialog.end}
            <input type="time" value={end} onChange={(e) => changeEnd(e.target.value)} required />
          </label>
        </div>
        {!error && nextDay && endMs !== null && (
          <p className="time-note" role="status">
            {dialog.endsNextDay(dayLabel(startOfDay(endMs)))}
          </p>
        )}
        {!event && calendars.length > 1 && (
          <>
            <label htmlFor="ef-calendar">{text.calendar}</label>
            <select id="ef-calendar" value={picked ?? ""} onChange={(e) => setPicked(e.target.value)}>
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        )}
        {!event && (
          <label className="keep-adding event-meet">
            <span className="toggle">
              <input type="checkbox" role="switch" checked={meet} onChange={(e) => setMeet(e.target.checked)} />
              <span className="switch" aria-hidden="true" />
            </span>
            {text.addMeet}
          </label>
        )}
        {meetNotReady ? (
          <p className="time-note" role="status">
            {text.meetNotReady}
          </p>
        ) : saving && meet ? (
          <p className="time-note" role="status">
            {text.creatingMeet}
          </p>
        ) : (
          (error || failed) && <p className="error">{error || (failed && text[failed])}</p>
        )}
        <div className="sheet-actions">
          <span className="spacer" />
          {meetNotReady ? (
            <button type="button" className="primary" autoFocus onClick={onClose}>
              {text.close}
            </button>
          ) : (
            <>
              <button type="button" className="secondary" disabled={saving} onClick={onClose}>
                {dialog.cancel}
              </button>
              <button type="submit" className="primary" disabled={!ready}>
                {event ? dialog.save : dialog.add}
              </button>
            </>
          )}
        </div>
      </form>
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
                      {dayLabel(e.start)} · {timeRange(e.start, e.end)}
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
