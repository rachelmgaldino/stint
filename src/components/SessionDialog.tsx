import { useState } from "react";
import type { Category, SessionRecord } from "../store";
import { atTime, clockTime, dayLabel, startOfDay } from "../dates";
import { formatDuration } from "../timer";
import { RatingPicker } from "./Reflection";
import { t } from "../i18n";

type Props = {
  /** The session to edit, or a new one to add (id 0). */
  session: SessionRecord;
  categories: Category[];
  onSave(s: SessionRecord): void;
  onDelete(id: number): void;
  onClose(): void;
};

export function SessionDialog({ session, categories, onSave, onDelete, onClose }: Props) {
  const isNew = session.id === 0;
  const day = startOfDay(session.startedAt);
  const [categoryId, setCategoryId] = useState(session.categoryId);
  const [intention, setIntention] = useState(session.intention);
  const [start, setStart] = useState(clockTime(session.startedAt));
  const [end, setEnd] = useState(clockTime(session.endedAt));
  const [reflection, setReflection] = useState(session.reflection);
  const [rating, setRating] = useState(session.rating);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const text = t().dialog;

  const startMs = atTime(day, start);
  const endMs = atTime(day, end);
  const error = startMs === null || endMs === null ? text.badTime : endMs <= startMs ? text.endBeforeStart : "";
  const isFocus = session.kind === "focus";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (error || startMs === null || endMs === null) return;
    // Keep the measured focus time (which excludes pauses) unless the times were edited.
    const timesChanged = startMs !== startOfMinute(session.startedAt) || endMs !== startOfMinute(session.endedAt);
    onSave({
      ...session,
      categoryId: isFocus ? categoryId : null,
      intention: isFocus ? intention.trim() : "",
      startedAt: timesChanged ? startMs : session.startedAt,
      endedAt: timesChanged ? endMs : session.endedAt,
      plannedMs: isNew ? endMs - startMs : session.plannedMs,
      focusedMs: timesChanged || isNew ? endMs - startMs : session.focusedMs,
      reflection: reflection.trim(),
      rating,
    });
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="session-title" onClick={onClose}>
      <form className="sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2 id="session-title">
          {isNew ? text.addSession : isFocus ? text.session : text.break} · {dayLabel(day)}
        </h2>
        {!isNew && <p className="muted">{text.focused(formatDuration(session.focusedMs))}</p>}

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

        <div className="sheet-actions">
          {!isNew &&
            (confirmDelete ? (
              <span className="confirm">
                {text.deleteForGood}
                <button type="button" className="danger" onClick={() => onDelete(session.id)}>
                  {text.delete}
                </button>
                <button type="button" className="link" onClick={() => setConfirmDelete(false)}>
                  {text.keep}
                </button>
              </span>
            ) : (
              <button type="button" className="danger-link" onClick={() => setConfirmDelete(true)}>
                {text.deleteSession}
              </button>
            ))}
          <span className="spacer" />
          <button type="button" className="secondary" onClick={onClose}>
            {text.cancel}
          </button>
          <button type="submit" className="primary" disabled={!!error}>
            {isNew ? text.add : text.save}
          </button>
        </div>
      </form>
    </div>
  );
}

function startOfMinute(ms: number): number {
  return Math.floor(ms / 60_000) * 60_000;
}
