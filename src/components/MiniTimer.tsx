import type { Category } from "../store";
import * as T from "../timer";
import { MoreIcon, PauseIcon, PlayIcon } from "./icons";

type Props = {
  timer: T.Timer;
  now: number;
  kind: T.Kind;
  plannedMin: number;
  intention: string;
  category: Category | undefined;
  onStart(): void;
  onPause(): void;
  onResume(): void;
  onAdjust(minutes: number): void;
  onOpenTimer(): void;
};

/** The timer as a bar along the bottom, shown while on other screens. */
export function MiniTimer(p: Props) {
  const active = p.timer.status !== "idle";
  const left = active ? T.remaining(p.timer, p.now) : p.plannedMin * 60_000;
  const total = Math.ceil(Math.abs(left) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${left < 0 ? "+" : ""}${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;

  return (
    <footer className="mini-timer" aria-label="Timer">
      <div className="mini-info">
        <span className="mini-intention">{p.kind === "break" ? "Break" : p.intention || "–"}</span>
        {p.kind === "focus" && p.category && (
          <span className="mini-category">
            <span className="dot" style={{ background: p.category.color }} />
            {p.category.name}
          </span>
        )}
      </div>
      <span className={left < 0 ? "mini-clock overtime" : "mini-clock"}>{clock}</span>
      <button className="mini-step" aria-label="5 minutes less" disabled={active && left <= 60_000} onClick={() => p.onAdjust(-5)}>
        −
      </button>
      {p.timer.status === "running" ? (
        <button className="mini-play" aria-label="Pause" onClick={p.onPause}>
          <PauseIcon />
        </button>
      ) : (
        <button
          className="mini-play"
          aria-label={p.timer.status === "paused" ? "Resume" : p.kind === "focus" ? "Start session" : "Start break"}
          onClick={p.timer.status === "paused" ? p.onResume : p.onStart}
        >
          <PlayIcon />
        </button>
      )}
      <button className="mini-step" aria-label="5 minutes more" onClick={() => p.onAdjust(5)}>
        +
      </button>
      <button className="mini-more" aria-label="Open the timer" title="Open the timer" onClick={p.onOpenTimer}>
        <MoreIcon />
      </button>
    </footer>
  );
}
