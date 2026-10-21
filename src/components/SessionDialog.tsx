import { useEffect, useState } from "react";
import type { Category, SessionRecord } from "../store";
import type { Kind as SessionKind } from "../timer";
import { addDays, atTime, clockTime, dayLabel, inputTime, fromIsoDate, isoDate, startOfDay } from "../dates";
import { formatDuration, parseDuration } from "../timer";
import { RatingPicker } from "./Reflection";
import { t } from "../i18n";

type Props = {
  /** The session to edit, or a new one to add (id 0). */
  session: SessionRecord;
  categories: Category[];
  /** Default length in minutes for a new focus session and a new break. */
  lengths: Record<SessionKind, number>;
  /** Keep the dialog open, cleared, after adding one (new entries only). */
  keepAdding: boolean;
  onKeepAdding(on: boolean): void;
  /** Shown above the buttons after adding one with keep adding on. */
  justAdded?: string;
  onSave(s: SessionRecord): void;
  onDelete(id: number): void;
  onClose(): void;
};

export function SessionDialog(p: Props) {
  const { session, categories, onSave, onDelete, onClose } = p;
  const isNew = session.id === 0;
  // A new session made from a calendar event is always focus, one at a time.
  const fromEvent = isNew && !!session.fromEvent;
  const [date, setDate] = useState(isoDate(session.startedAt));
  const today = startOfDay(Date.now());
  const pickedDay = fromIsoDate(date);
  // Only a new entry can move to another day; an edit stays on its own.
  const day = isNew && pickedDay !== null ? pickedDay : startOfDay(session.startedAt);
  const [kind, setKind] = useState<SessionKind>(session.kind);
  const [categoryId, setCategoryId] = useState(session.categoryId);
  const [intention, setIntention] = useState(session.intention);
  const [start, setStart] = useState(inputTime(session.startedAt));
  const [end, setEnd] = useState(inputTime(session.endedAt));
  const [duration, setDuration] = useState(formatDuration(session.endedAt - session.startedAt));
  // Which of Duration and End stays put when Start changes: the one typed last.
  // A new entry starts by keeping its length; a saved one keeps the end it recorded.
  const [held, setHeld] = useState<"duration" | "end">(isNew ? "duration" : "end");
  // A line saying what moved on its own, and which field to light up for a moment.
  const [moved, setMoved] = useState<{ field: "end" | "duration" | null; note: string; n: number } | null>(null);
  const [touched, setTouched] = useState(false);
  const [reflection, setReflection] = useState(session.reflection);
  const [rating, setRating] = useState(session.rating);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const text = t().dialog;
  // On a phone the switch sits in the title row, where it doesn't crowd the buttons.
  const phone = typeof matchMedia === "function" && matchMedia("(max-width: 640px)").matches;

  const startMs = atTime(day, start);
  const sameDayEnd = atTime(day, end);
  // An end before the start is on the next day: 23:30 to 00:30 is an hour.
  const nextDay = startMs !== null && sameDayEnd !== null && sameDayEnd <= startMs;
  const endMs = sameDayEnd !== null && nextDay ? atTime(addDays(day, 1), end) : sameDayEnd;
  const minutes = parseDuration(duration);
  const error =
    isNew && pickedDay === null
      ? text.badDate
      : day > today
        ? text.futureDate
        : startMs === null || endMs === null
          ? text.badTime
          : minutes === null || minutes < 1
            ? text.badDuration
            : minutes >= 24 * 60
              ? text.tooLong
              : endMs === startMs
                ? text.endBeforeStart
                : "";
  useEffect(() => {
    if (!moved?.field) return;
    const id = setTimeout(() => setMoved((m) => (m === moved ? { ...m, field: null } : m)), 1200);
    return () => clearTimeout(id);
  }, [moved]);
  const flash = (field: "end" | "duration", note: string) => setMoved((m) => ({ field, note, n: (m?.n ?? 0) + 1 }));

  /** The end that keeps a length from a start, as HH:MM. */
  const endFor = (from: number, min: number) => inputTime(from + min * 60_000);
  /** The length from a start to an end, rolling past midnight. */
  const lengthOf = (from: number, to: string) => {
    let toMs = atTime(day, to);
    if (toMs === null) return null;
    if (toMs <= from) toMs = atTime(addDays(day, 1), to) ?? toMs;
    return toMs - from;
  };

  const changeStart = (v: string) => {
    setStart(v);
    setTouched(true);
    const from = atTime(day, v);
    if (from === null) return;
    if (held === "duration" && minutes !== null && minutes > 0) {
      setEnd(endFor(from, minutes));
      flash("end", text.keptLength(formatDuration(minutes * 60_000)));
    } else {
      const ms = lengthOf(from, end);
      if (ms === null) return;
      setDuration(formatDuration(ms));
      flash("duration", text.keptEnd(clockTime(from + ms)));
    }
  };
  const changeDuration = (v: string) => {
    setDuration(v);
    setHeld("duration");
    setTouched(true);
    const min = parseDuration(v);
    if (startMs === null || min === null || min < 1 || min >= 24 * 60) return;
    setEnd(endFor(startMs, min));
    flash("end", "");
  };
  const changeEnd = (v: string) => {
    setEnd(v);
    setHeld("end");
    setTouched(true);
    if (startMs === null) return;
    const ms = lengthOf(startMs, v);
    if (ms === null) return;
    setDuration(formatDuration(ms));
    flash("duration", "");
  };
  // Tidy what was typed ("90" becomes "1h 30m") once the field is left.
  const tidyDuration = () => {
    if (minutes !== null && minutes > 0) setDuration(formatDuration(minutes * 60_000));
  };
  const isFocus = kind === "focus";

  // Switching type on a new entry resizes it to that type's usual length,
  // unless the times were already set by hand.
  const changeKind = (k: SessionKind) => {
    if (k === kind) return;
    setKind(k);
    if (touched) return;
    const from = startMs ?? session.startedAt;
    setEnd(endFor(from, p.lengths[k]));
    setDuration(formatDuration(p.lengths[k] * 60_000));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (error || startMs === null || endMs === null) return;
    // Keep the measured focus time (which excludes pauses) unless the times were edited.
    const timesChanged = startMs !== startOfMinute(session.startedAt) || endMs !== startOfMinute(session.endedAt);
    onSave({
      ...session,
      kind,
      categoryId: isFocus ? categoryId : null,
      intention: isFocus ? intention.trim() : "",
      startedAt: timesChanged ? startMs : session.startedAt,
      endedAt: timesChanged ? endMs : session.endedAt,
      plannedMs: isNew ? endMs - startMs : session.plannedMs,
      focusedMs: timesChanged || isNew ? endMs - startMs : session.focusedMs,
      reflection: isFocus ? reflection.trim() : session.reflection,
      rating: isFocus ? rating : session.rating,
    });
  };

  const keepAddingSwitch = (
    <label className="keep-adding">
      <span className="toggle">
        <input type="checkbox" role="switch" checked={p.keepAdding} onChange={(e) => p.onKeepAdding(e.target.checked)} />
        <span className="switch" aria-hidden="true" />
      </span>
      {text.keepAdding}
    </label>
  );
  const title = (
    <h2 id="session-title">
      {fromEvent
        ? t().events.dialogTitle
        : isNew
          ? isFocus
            ? text.addSession
            : text.addBreak
          : `${isFocus ? text.session : text.break} · ${dayLabel(day)}`}
    </h2>
  );

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="session-title" onClick={onClose}>
      <form className="sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        {isNew && phone && !fromEvent ? (
          <div className="sheet-head">
            {title}
            {keepAddingSwitch}
          </div>
        ) : (
          title
        )}
        {!isNew && <p className="muted">{text.focused(formatDuration(session.focusedMs))}</p>}
        {fromEvent && <p className="muted">{t().events.dialogNote}</p>}
        {isNew && !fromEvent && (
          <div className="segmented small kind-switch" role="group" aria-label={text.type}>
            <button type="button" aria-pressed={isFocus} onClick={() => changeKind("focus")}>
              {t().focus}
            </button>
            <button type="button" aria-pressed={!isFocus} onClick={() => changeKind("break")}>
              {t().break}
            </button>
          </div>
        )}

        {isFocus && (
          <>
            <label htmlFor="sd-category">{text.category}</label>
            <select id="sd-category" value={categoryId ?? ""} onChange={(e) => setCategoryId(Number(e.target.value))}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label htmlFor="sd-intention">{text.intention}</label>
            <input id="sd-intention" value={intention} maxLength={120} onChange={(e) => setIntention(e.target.value)} />
          </>
        )}

        {isNew && (
          <>
            <label htmlFor="sd-date">{text.date}</label>
            <input id="sd-date" type="date" value={date} max={isoDate(today)} onChange={(e) => setDate(e.target.value)} required />
          </>
        )}
        <div className="time-fields">
          <label>
            {text.start}
            <input type="time" value={start} onChange={(e) => changeStart(e.target.value)} required />
          </label>
          <label className="duration-field">
            {text.duration}
            <input
              key={moved?.field === "duration" ? `d${moved.n}` : "d"}
              className={moved?.field === "duration" ? "auto-set" : undefined}
              value={duration}
              inputMode="text"
              placeholder={text.durationPlaceholder}
              maxLength={12}
              onChange={(e) => changeDuration(e.target.value)}
              onBlur={tidyDuration}
              onKeyDown={(e) => {
                // Arrow keys step by 5 minutes.
                if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                e.preventDefault();
                const now = minutes ?? 0;
                const next = e.key === "ArrowUp" ? Math.floor(now / 5) * 5 + 5 : Math.ceil(now / 5) * 5 - 5;
                if (next >= 5) changeDuration(formatDuration(next * 60_000));
              }}
              required
            />
          </label>
          <label>
            {text.end}
            <input
              key={moved?.field === "end" ? `e${moved.n}` : "e"}
              className={moved?.field === "end" ? "auto-set" : undefined}
              type="time"
              value={end}
              onChange={(e) => changeEnd(e.target.value)}
              required
            />
          </label>
        </div>
        {error ? (
          <p className="error">{error}</p>
        ) : (
          (nextDay || moved?.note) && (
            <p className="time-note" role="status">
              {[moved?.note, nextDay && endMs !== null ? text.endsNextDay(dayLabel(startOfDay(endMs))) : ""].filter(Boolean).join(" ")}
            </p>
          )
        )}

        {isFocus && (
          <>
            <label htmlFor="sd-reflection">{text.whatDidYouGetDone}</label>
            <textarea id="sd-reflection" rows={3} value={reflection} onChange={(e) => setReflection(e.target.value)} />
            <RatingPicker value={rating} onChange={setRating} />
          </>
        )}

        {isNew && p.justAdded && (
          <p className="just-added" role="status">
            {p.justAdded}
          </p>
        )}
        <div className="sheet-actions">
          {!isNew && (
            <button type="button" className="danger-link" onClick={() => setConfirmDelete(true)}>
              {isFocus ? text.deleteSession : text.deleteBreak}
            </button>
          )}
          {isNew && !phone && !fromEvent && keepAddingSwitch}
          <span className="spacer" />
          <button type="button" className="secondary" onClick={onClose}>
            {text.cancel}
          </button>
          <button type="submit" className="primary" disabled={!!error}>
            {isNew ? text.add : text.save}
          </button>
        </div>
      </form>
      {confirmDelete && (
        <div
          className="confirm-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDelete(false);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            e.stopPropagation();
            setConfirmDelete(false);
          }}
        >
          <div
            className="confirm-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-body"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-title">{isFocus ? text.deleteSessionTitle : text.deleteBreakTitle}</h3>
            <p id="confirm-body">{text.deleteBody}</p>
            <div className="confirm-actions">
              <button type="button" className="secondary" autoFocus onClick={() => setConfirmDelete(false)}>
                {text.cancel}
              </button>
              <button type="button" className="danger-button" onClick={() => onDelete(session.id)}>
                {text.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function startOfMinute(ms: number): number {
  return Math.floor(ms / 60_000) * 60_000;
}
