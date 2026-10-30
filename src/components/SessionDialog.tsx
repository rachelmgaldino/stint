import { useEffect, useState } from "react";
import type { Category, SessionRecord } from "../store";
import type { Kind as SessionKind } from "../timer";
import { addDays, atTime, dayLabel, inputTime, fromIsoDate, isoDate, startOfDay, timeSpan } from "../dates";
import { soft } from "../colors";
import { splitRecord } from "../tasks";
import { ScissorsIcon } from "./icons";
import { formatDuration } from "../timer";
import { RatingPicker } from "./Reflection";
import { useTimeFields } from "./useTimeFields";
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
  /** Saves a focus session cut in two tasks: the first as edited, the second new. */
  onSplit(first: SessionRecord, second: SessionRecord): void;
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
  // A line saying what moved on its own, and which field to light up for a moment.
  const [moved, setMoved] = useState<{ field: "end" | "duration" | null; note: string; n: number } | null>(null);
  const [touched, setTouched] = useState(false);
  const { start, end, duration, startMs, nextDay, endMs, minutes, changeStart, changeDuration, changeEnd, tidyDuration, stepDuration, setLength } =
    useTimeFields({
      day,
      start: session.startedAt,
      end: session.endedAt,
      // A new entry starts by keeping its length; a saved one keeps the end it recorded.
      held: isNew ? "duration" : "end",
      onTouched: () => setTouched(true),
      onMoved: (field, note) => setMoved((m) => ({ field, note, n: (m?.n ?? 0) + 1 })),
    });
  const [reflection, setReflection] = useState(session.reflection);
  const [rating, setRating] = useState(session.rating);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [splitAt, setSplitAt] = useState("");
  const [secondName, setSecondName] = useState("");
  const [secondCategory, setSecondCategory] = useState(session.categoryId);
  const text = t().dialog;
  // On a phone the switch sits in the title row, where it doesn't crowd the buttons.
  const phone = typeof matchMedia === "function" && matchMedia("(max-width: 640px)").matches;

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
              : "";
  useEffect(() => {
    if (!moved?.field) return;
    const id = setTimeout(() => setMoved((m) => (m === moved ? { ...m, field: null } : m)), 1200);
    return () => clearTimeout(id);
  }, [moved]);

  const isFocus = kind === "focus";

  // Switching type on a new entry resizes it to that type's usual length,
  // unless the times were already set by hand.
  const changeKind = (k: SessionKind) => {
    if (k === kind) return;
    setKind(k);
    if (touched) return;
    setLength(startMs ?? session.startedAt, p.lengths[k]);
  };

  /** The session as the fields have it now, or null while they don't make sense. */
  const edited = (): SessionRecord | null => {
    if (error || startMs === null || endMs === null) return null;
    // Keep the measured focus time (which excludes pauses) unless the times were edited.
    const timesChanged = startMs !== startOfMinute(session.startedAt) || endMs !== startOfMinute(session.endedAt);
    return {
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
    };
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = edited();
    if (s) onSave(s);
  };

  // Split: the minute the second task began, on the session's own day or, past midnight, the next.
  const whole = splitting ? edited() : null;
  const splitMs = (() => {
    if (!whole) return null;
    const same = atTime(day, splitAt);
    if (same === null) return null;
    const ms = same < whole.startedAt ? atTime(addDays(day, 1), splitAt) : same;
    return ms !== null && ms >= whole.startedAt + 60_000 && ms <= whole.endedAt - 60_000 ? ms : null;
  })();
  const parts = whole && splitMs !== null ? splitRecord(whole, splitMs, secondName, secondCategory) : null;
  const openSplit = () => {
    const s = edited();
    if (!s) return;
    // Starts halfway, on the minute.
    setSplitAt(inputTime(startOfMinute((s.startedAt + s.endedAt) / 2)));
    setSecondName("");
    setSecondCategory(s.categoryId);
    setSplitting(true);
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
              onKeyDown={stepDuration}
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
          {!isNew && isFocus && (
            <button type="button" className="split-link" disabled={!!error} onClick={openSplit}>
              <ScissorsIcon />
              {text.split}
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
      {splitting && whole && (
        <div
          className="confirm-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setSplitting(false);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            e.stopPropagation();
            setSplitting(false);
          }}
        >
          <form
            className="confirm-card split-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="split-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (parts) p.onSplit(parts[0], parts[1]);
            }}
          >
            <h3 id="split-title">{text.splitTitle}</h3>
            <p>{text.splitBody}</p>
            <label className="split-field">
              {text.splitAt}
              <input type="time" value={splitAt} onChange={(e) => setSplitAt(e.target.value)} required />
            </label>
            <label className="split-field">
              {text.secondTask}
              <input
                value={secondName}
                maxLength={120}
                placeholder={text.secondPlaceholder}
                autoFocus
                onChange={(e) => setSecondName(e.target.value)}
              />
            </label>
            <div className="chips split-categories" role="group" aria-label={text.category}>
              {categories.map((c) => (
                <button key={c.id} type="button" className="chip" aria-pressed={c.id === secondCategory} onClick={() => setSecondCategory(c.id)}>
                  <span className="dot" style={{ background: soft(c.color) }} />
                  {c.name}
                </button>
              ))}
            </div>
            {parts ? (
              <ol className="split-preview">
                {parts.map((part, i) => (
                  <li key={i}>
                    <span className="dot" style={{ background: soft(categories.find((c) => c.id === part.categoryId)?.color ?? "#999") }} />
                    <span className="split-name">{part.intention || (i === 0 ? t().focus : text.secondPlaceholder)}</span>
                    <span className="split-time">
                      {timeSpan(part.startedAt, part.endedAt)} · {formatDuration(part.focusedMs)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="error">{text.badSplit}</p>
            )}
            <div className="confirm-actions">
              <button type="button" className="secondary" onClick={() => setSplitting(false)}>
                {text.cancel}
              </button>
              <button type="submit" className="primary" disabled={!parts}>
                {text.splitButton}
              </button>
            </div>
          </form>
        </div>
      )}
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
