import { useState } from "react";
import * as T from "../timer";
import { atTime, clockTime, startOfDay } from "../dates";
import { t } from "../i18n";

type Props = {
  timer: Exclude<T.Timer, { status: "idle" }>;
  now: number;
  /** When the last saved session today ended, to warn about an overlap. */
  previousEnd: number | null;
  onSave(startedAt: number): void;
  onClose(): void;
};

const earlier = [5, 10, 15, 30];
const MIN = 60_000;
// Far enough back for a forgotten timer, near enough to stay on the same stretch of work.
const MAX_BACK = 12 * 60 * MIN;

/**
 * "When did you start?" for a timer that's already running: for the times
 * the timer gets started a while after the work did.
 */
export function StartEditor({ timer, now, previousEnd, onSave, onClose }: Props) {
  const text = t().timer;
  const [picked, setPicked] = useState(timer.startedAt);
  const [field, setField] = useState(clockTime(timer.startedAt));

  const pick = (ms: number) => {
    setPicked(ms);
    setField(clockTime(ms));
  };

  const typed = (value: string) => {
    setField(value);
    let ms = atTime(startOfDay(now), value);
    if (ms === null) return;
    // A time later than now means last night, for a session that crossed midnight.
    if (ms > now) ms -= 86_400_000;
    // Typing the same minute back keeps the exact start, seconds and all.
    setPicked(value === clockTime(timer.startedAt) ? timer.startedAt : ms);
  };

  const valid = atTime(0, field) !== null;
  const error = !valid ? text.startBadTime : picked < now - MAX_BACK ? text.startTooEarly : "";
  const moved = T.moveStart(timer, picked, now);
  const left = T.remaining(moved, now);
  const preview =
    moved.status !== "running"
      ? text.startPreviewPaused(T.formatDuration(T.elapsed(moved, now)))
      : left > 0
        ? text.startPreview(clockTime(moved.startedAt), clockTime(moved.endsAt))
        : text.startPreviewOver(clockTime(moved.endsAt));
  const overlaps = previousEnd !== null && picked < previousEnd;

  return (
    <div
      className="confirm-overlay"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <form
        className="confirm-card start-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!error) onSave(picked);
        }}
      >
        <h3 id="start-title">{timer.kind === "focus" ? text.startTitle : text.startTitleBreak}</h3>
        <p>{text.startBody}</p>
        <div className="start-chips" role="group" aria-label={text.earlierBy}>
          <span>{text.earlierBy}</span>
          <div className="segmented round">
            {earlier.map((m) => (
              <button
                type="button"
                key={m}
                aria-pressed={picked === timer.startedAt - m * MIN}
                onClick={() => pick(timer.startedAt - m * MIN)}
              >
                {text.minutes(m)}
              </button>
            ))}
          </div>
        </div>
        <label className="field start-field">
          <span>{text.startedAtLabel}</span>
          <input type="time" value={field} autoFocus onChange={(e) => typed(e.target.value)} required />
        </label>
        <p className={error ? "start-preview error" : "start-preview"} aria-live="polite">
          {error || preview}
        </p>
        {!error && overlaps && <p className="start-note">{text.startOverlaps(clockTime(previousEnd))}</p>}
        <div className="confirm-actions">
          <button type="button" className="secondary" onClick={onClose}>
            {text.cancel}
          </button>
          <button type="submit" className="primary" disabled={!!error}>
            {text.save}
          </button>
        </div>
      </form>
    </div>
  );
}
