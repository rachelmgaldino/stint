import { useState } from "react";
import type { Category, SessionRecord } from "../store";
import { timeRange } from "../dates";
import { formatDuration } from "../timer";
import { soft } from "../colors";
import { Pip, RatingFace } from "./Pip";
import { t } from "../i18n";

export type PendingReflection = SessionRecord;

/** The ratings with their names in the current language. */
export const ratings = () => [1, 2, 3].map((value) => ({ value, label: t().ratings[value] }));

/** Buttons for picking how a session went; picking the chosen one again clears it. */
export function RatingPicker({ value, onChange }: { value: number; onChange(v: number): void }) {
  return (
    <div className="rating-picker" role="group" aria-label={t().reflection.howDidItGo}>
      {ratings().map((r) => (
        <button
          type="button"
          key={r.value}
          className={`rating-option r${r.value}`}
          aria-pressed={value === r.value}
          onClick={() => onChange(value === r.value ? 0 : r.value)}
        >
          <RatingFace value={r.value} size={36} />
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function Reflection({
  pending,
  category,
  sessionNumber,
  dailyGoal,
  onSave,
  onSkip,
}: {
  pending: PendingReflection;
  category: Category | undefined;
  sessionNumber: number;
  dailyGoal: number;
  onSave(reflection: string, rating: number): void;
  onSkip(): void;
}) {
  const [text, setText] = useState("");
  const [rating, setRating] = useState(pending.rating);
  const words = t().reflection;

  return (
    <div className="drawer-backdrop">
      <form
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reflect-title"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(text.trim(), rating);
        }}
      >
        <div className="drawer-head">
          <Pip mood="cheer" size={96} />
          <div>
            <h2 id="reflect-title">{words.niceWork}</h2>
            <p>
              {formatDuration(pending.focusedMs)} · {timeRange(pending.startedAt, pending.endedAt)}
            </p>
          </div>
        </div>
        <div className="drawer-session">
          <span className="dot" style={{ background: soft(category?.color ?? "#f4a988") }} />
          <div>
            <div className="strong">{pending.intention || category?.name || t().focusSession}</div>
            <div className="small muted">
              {category && pending.intention ? `${category.name} · ` : ""}
              {words.sessionOf(sessionNumber, Math.max(dailyGoal, sessionNumber))}
            </div>
          </div>
        </div>
        <label className="field">
          <span>{words.whatDidYouGetDone}</span>
          <textarea autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={words.placeholder} />
        </label>
        <div className="field">
          <span>{words.howDidItGo}</span>
          <RatingPicker value={rating} onChange={setRating} />
        </div>
        <span className="grow" />
        <div className="drawer-actions">
          <button type="button" className="quiet-link" onClick={onSkip}>
            {words.skip}
          </button>
          <button type="submit" className="squishy apricot big grow">
            {words.save}
          </button>
        </div>
      </form>
    </div>
  );
}
