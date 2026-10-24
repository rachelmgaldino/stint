import { useState } from "react";
import type { Category, SessionRecord } from "../store";
import { atTime, inputTime, startOfDay, timeRange, timeSpan } from "../dates";
import { formatDuration } from "../timer";
import { soft } from "../colors";
import { Pip, RatingFace } from "./Pip";
import { t } from "../i18n";
import { IntentionField } from "./IntentionField";
import type { PastIntention } from "../intentions";
import { moveSwitch } from "../tasks";
import { PencilIcon } from "./icons";

/** The session just ended; `parts` holds its tasks, saved one per record, when it had more than one. */
export type PendingReflection = SessionRecord & { parts?: SessionRecord[] };

export type ReflectionUpdate = {
  reflection?: string;
  rating?: number;
  intention?: string;
  categoryId?: number | null;
  /** The tasks as named and timed in the drawer, for a session with several. */
  parts?: SessionRecord[];
};

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
  onSave(update: ReflectionUpdate): void;
  /** Skips the reflection; a changed intention (or task) is still kept. */
  onSkip(update: ReflectionUpdate): void;
}) {
  const [text, setText] = useState("");
  const [rating, setRating] = useState(pending.rating);
  // Started without knowing what it'd be? Say it here.
  const [intention, setIntention] = useState(pending.intention);
  const [categoryId, setCategoryId] = useState(pending.categoryId);
  const category = categories.find((c) => c.id === categoryId);
  const [parts, setParts] = useState(pending.parts);
  const what: ReflectionUpdate = parts ? { parts } : { intention: intention.trim(), categoryId };
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
              {parts && ` · ${words.tasksCount(parts.length)}`}
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
        {parts ? (
          <TaskList parts={parts} categories={categories} past={past} onChange={setParts} />
        ) : (
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
        )}
        <label className="field">
          <span>{words.whatDidYouGetDone}</span>
          <textarea autoFocus={!!pending.intention || !!parts} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={words.placeholder} />
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

/** The tasks of a session with several: each with its times, opened one at a time to rename it or move when it began. */
function TaskList({ parts, categories, past, onChange }: {
  parts: SessionRecord[];
  categories: Category[];
  past: PastIntention[];
  onChange(parts: SessionRecord[]): void;
}) {
  const words = t().reflection;
  const [open, setOpen] = useState<number | null>(null);
  const set = (i: number, change: Partial<SessionRecord>) => onChange(parts.map((p, k) => (k === i ? { ...p, ...change } : p)));
  return (
    <div className="field">
      <span>{words.tasks}</span>
      <ul className="task-list">
        {parts.map((p, i) => {
          const c = categories.find((x) => x.id === p.categoryId);
          const name = p.intention || c?.name || t().focus;
          return (
            <li key={p.id} className={open === i ? "task-row open" : "task-row"}>
              <button type="button" className="task-row-head" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                <span className="dot" style={{ background: soft(c?.color ?? "#f4a988") }} />
                <span className="task-row-name">{name}</span>
                <span className="task-row-time">
                  {timeSpan(p.startedAt, p.endedAt)} · {formatDuration(p.focusedMs)}
                </span>
                <PencilIcon />
              </button>
              {open === i && (
                <div className="task-row-edit">
                  <IntentionField
                    value={p.intention}
                    categoryId={p.categoryId}
                    categories={categories}
                    past={past}
                    now={p.endedAt}
                    label={words.taskName}
                    placeholder={words.intentionPlaceholder}
                    chips={false}
                    autoFocus
                    onChange={(v) => set(i, { intention: v })}
                    onPick={(v, cat) => set(i, { intention: v, categoryId: cat })}
                    onDone={() => {}}
                  />
                  {i > 0 && (
                    <label className="field task-switch">
                      <span>{words.switchedAt}</span>
                      <input
                        type="time"
                        value={inputTime(p.startedAt)}
                        onChange={(e) => {
                          const at = atTime(startOfDay(p.startedAt), e.target.value);
                          if (at !== null) onChange(moveSwitch(parts, i, at));
                        }}
                      />
                    </label>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="task-hint">{words.tasksHint}</p>
    </div>
  );
}
