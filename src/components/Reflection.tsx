import { useState } from "react";
import type { SessionRecord } from "../store";
import { formatDuration } from "../timer";

export type PendingReflection = SessionRecord;

export const ratings = [
  { value: 1, label: "↓ Distracted" },
  { value: 2, label: "→ Neutral" },
  { value: 3, label: "↑ Focused" },
];

export function Reflection({
  pending,
  onSave,
  onSkip,
}: {
  pending: PendingReflection;
  onSave(reflection: string, rating: number): void;
  onSkip(): void;
}) {
  const [text, setText] = useState("");
  const [rating, setRating] = useState(pending.rating);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="reflect-title">
      <form
        className="sheet"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(text.trim(), rating);
        }}
      >
        <h2 id="reflect-title">Nice work. {formatDuration(pending.focusedMs)} focused.</h2>
        {pending.intention && <p className="muted">{pending.intention}</p>}
        <label htmlFor="reflection">What did you get done?</label>
        <textarea
          id="reflection"
          autoFocus
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="A sentence or two is plenty"
        />
        <div className="rating" role="group" aria-label="How did it go?">
          {ratings.map((r) => (
            <button
              type="button"
              key={r.value}
              className={rating === r.value ? "preset active" : "preset"}
              onClick={() => setRating(rating === r.value ? 0 : r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={onSkip}>
            Skip
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
