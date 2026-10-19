import { useState } from "react";
import type { Category, SessionRecord } from "../store";
import type { Kind as SessionKind } from "../timer";
import { atTime, dayLabel, inputTime, fromIsoDate, isoDate, startOfDay } from "../dates";
import { formatDuration } from "../timer";
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
  const [reflection, setReflection] = useState(session.reflection);
  const [rating, setRating] = useState(session.rating);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const text = t().dialog;
  // On a phone the switch sits in the title row, where it doesn't crowd the buttons.
  const phone = typeof matchMedia === "function" && matchMedia("(max-width: 640px)").matches;

  const startMs = atTime(day, start);
  const endMs = atTime(day, end);
  const error =
    isNew && pickedDay === null
      ? text.badDate
      : day > today
        ? text.futureDate
        : startMs === null || endMs === null
          ? text.badTime
          : endMs <= startMs
            ? text.endBeforeStart
            : "";
  const isFocus = kind === "focus";

  // Switching type on a new entry resizes it to that type's usual length.
  const changeKind = (k: SessionKind) => {
    if (k === kind) return;
    setKind(k);
    const from = startMs ?? session.startedAt;
    const to = Math.min(from + p.lengths[k] * 60_000, day + 86_400_000 - 60_000);
    if (to > from) setEnd(inputTime(to));
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
      {isNew ? (isFocus ? text.addSession : text.addBreak) : `${isFocus ? text.session : text.break} · ${dayLabel(day)}`}
    </h2>
  );

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="session-title" onClick={onClose}>
      <form className="sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        {isNew && phone ? (
          <div className="sheet-head">
            {title}
            {keepAddingSwitch}
          </div>
        ) : (
          title
        )}
        {!isNew && <p className="muted">{text.focused(formatDuration(session.focusedMs))}</p>}
        {isNew && (
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
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label>
            {text.end}
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </label>
        </div>
        {error && <p className="error">{error}</p>}

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
          {isNew && !phone && keepAddingSwitch}
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
