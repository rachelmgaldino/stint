import type { Category } from "../store";
import { clockTime } from "../dates";
import * as T from "../timer";
import { Dial } from "./Dial";
import { CoffeeIcon } from "./icons";

type Props = {
  timer: T.Timer;
  now: number;
  intention: string;
  categoryId: number | null;
  categories: Category[];
  idleKind: T.Kind;
  plannedMin: number;
  todayCount: number;
  dailyGoal: number;
  onIntention(v: string): void;
  onCategory(id: number): void;
  onIdleKind(k: T.Kind): void;
  onPlannedMin(m: number): void;
  onStart(): void;
  onPause(): void;
  onResume(): void;
  onSetRemaining(minutes: number): void;
  onFinish(): void;
  onDiscard(): void;
};

/** "01:00:00", or "+03:12" in overtime. */
function longClock(ms: number): string {
  if (ms < 0) return T.formatClock(ms);
  const total = Math.ceil(ms / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(total / 3600))}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
}

export function TimerPane(p: Props) {
  const { timer, now } = p;
  const active = timer.status !== "idle";
  const kind = active ? timer.kind : p.idleKind;
  const left = active ? T.remaining(timer, now) : p.plannedMin * 60_000;
  const category = p.categories.find((c) => c.id === p.categoryId);
  const color = kind === "break" ? "var(--break)" : (category?.color ?? "var(--accent)");
  const overtime = active && left <= 0;
  const maxMinutes = kind === "focus" ? 180 : 60;

  const start = timer.status === "idle" ? now : timer.startedAt;
  const end = timer.status === "running" ? timer.endsAt : now + Math.max(0, left);
  const dots = Math.max(p.dailyGoal, p.todayCount);

  return (
    <section className="timer-pane" aria-label="Timer">
      <button
        className={kind === "break" ? "icon-button break-toggle active" : "icon-button break-toggle"}
        title={kind === "break" ? "Back to focus" : "Take a break"}
        aria-label={kind === "break" ? "Back to focus" : "Take a break"}
        aria-pressed={kind === "break"}
        disabled={active}
        onClick={() => p.onIdleKind(kind === "break" ? "focus" : "break")}
      >
        <CoffeeIcon />
      </button>

      <div className="goal-dots" aria-label={`${p.todayCount} of ${p.dailyGoal} sessions today`}>
        {Array.from({ length: dots }, (_, i) => (
          <span key={i} className={i < p.todayCount ? "goal-dot done" : "goal-dot"} />
        ))}
      </div>

      {kind === "focus" ? (
        <>
          <h1 className="pane-title">What's your focus?</h1>
          <label className="category-pill" style={{ "--chip": category?.color ?? "var(--accent)" } as React.CSSProperties}>
            <span className="dot" />
            <select
              aria-label="Category"
              value={p.categoryId ?? ""}
              onChange={(e) => p.onCategory(Number(e.target.value))}
            >
              {p.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <input
            className="intention-input"
            aria-label="Intention"
            placeholder="Intention"
            value={p.intention}
            maxLength={120}
            onChange={(e) => p.onIntention(e.target.value)}
          />
        </>
      ) : (
        <>
          <h1 className="pane-title">Time for a break</h1>
          <p className="muted pane-sub">Step away from the screen for a bit.</p>
        </>
      )}

      <div className="dial-wrap">
        <Dial
          minutes={Math.max(0, left) / 60_000}
          color={color}
          maxMinutes={maxMinutes}
          label={active ? "Time remaining, drag to adjust" : "Session length, drag to set"}
          onChange={active ? p.onSetRemaining : p.onPlannedMin}
        />
      </div>

      <div className={overtime ? "big-clock overtime" : "big-clock"}>{longClock(left)}</div>
      <div className="time-range">
        {timer.status === "paused"
          ? "Paused"
          : overtime
            ? `Over time since ${clockTime(end)}`
            : `${clockTime(start)} → ${clockTime(end)}`}
      </div>

      <div className="pane-actions">
        {!active ? (
          <button className="primary pill-button" onClick={p.onStart}>
            {kind === "focus" ? "Start session" : "Start break"}
          </button>
        ) : (
          <>
            <div className="action-row">
              {timer.status === "running" ? (
                <button className="secondary pill-button" onClick={p.onPause}>
                  Pause
                </button>
              ) : (
                <button className="secondary pill-button" onClick={p.onResume}>
                  Resume
                </button>
              )}
              <button className="primary pill-button" onClick={p.onFinish}>
                {kind === "focus" ? "Finish" : "End break"}
              </button>
            </div>
            <button className="link" onClick={p.onDiscard}>
              Discard without saving
            </button>
          </>
        )}
      </div>
    </section>
  );
}
