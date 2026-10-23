import { useState } from "react";
import type { Category, SessionRecord } from "../store";
import { timeRange } from "../dates";
import { formatDuration } from "../timer";
import { soft } from "../colors";
import { Pip, RatingFace } from "./Pip";
import { t } from "../i18n";
import { IntentionField } from "./IntentionField";
import type { PastIntention } from "../intentions";

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
  categories,
  past,
  sessionNumber,
  dailyGoal,
  onSave,
  onSkip,
}: {
  pending: PendingReflection;
  categories: Category[];
  past: PastIntention[];
  sessionNumber: number;
  dailyGoal: number;
  onSave(update: { reflection: string; rating: number; intention: string; categoryId: number | null }): void;
  /** Skips the reflection; a changed intention is still kept. */
  onSkip(update: { intention: string; categoryId: number | null }): void;
}) {
  const [text, setText] = useState("");
  const [rating, setRating] = useState(pending.rating);
  // Started without knowing what it'd be? Say it here.
  const [intention, setIntention] = useState(pending.intention);
  const [categoryId, setCategoryId] = useState(pending.categoryId);
  const category = categories.find((c) => c.id === categoryId);
  const what = { intention: intention.trim(), categoryId };
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
          onSave({ ...what, reflection: text.trim(), rating });
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
            <div className="strong">{category?.name || t().focusSession}</div>
            <div className="small muted">{words.sessionOf(sessionNumber, Math.max(dailyGoal, sessionNumber))}</div>
          </div>
        </div>
        <IntentionField
          value={intention}
          categoryId={categoryId}
          categories={categories}
          past={past}
          now={pending.endedAt}
          label={words.whatDidYouWorkOn}
          placeholder={words.intentionPlaceholder}
          chips={false}
          autoFocus={!pending.intention}
          onChange={setIntention}
          onPick={(v, c) => {
            setIntention(v);
            setCategoryId(c);
          }}
          onDone={() => {}}
        />
        <label className="field">
          <span>{words.whatDidYouGetDone}</span>
          <textarea autoFocus={!!pending.intention} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={words.placeholder} />
        </label>
        <div className="field">
          <span>{words.howDidItGo}</span>
          <RatingPicker value={rating} onChange={setRating} />
        </div>
        <span className="grow" />
        <div className="drawer-actions">
          <button type="button" className="quiet-link" onClick={() => onSkip(what)}>
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
