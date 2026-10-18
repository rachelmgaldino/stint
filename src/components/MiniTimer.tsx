import type { Category } from "../store";
import * as T from "../timer";
import { soft } from "../colors";
import { dialClock } from "./TimerPane";
import { PauseIcon, PlayIcon } from "./icons";

type Props = {
  timer: T.Timer;
  now: number;
  kind: T.Kind;
  intention: string;
  category: Category | undefined;
  onPause(): void;
  onResume(): void;
  onAdjust(minutes: number): void;
  onFinish(): void;
  onOpenTimer(): void;
};

/** The running timer as a floating bar, shown while on other screens. */
export function MiniTimer(p: Props) {
  const left = T.remaining(p.timer, p.now);
  return (
    <footer className={p.kind === "break" ? "mini-timer break" : "mini-timer"} aria-label="Timer">
      <button className="mini-info" onClick={p.onOpenTimer} title="Open the timer">
        {p.kind === "focus" && p.category && <span className="dot" style={{ background: soft(p.category.color) }} />}
        <span className="mini-intention">{p.kind === "break" ? "Break" : p.intention.trim() || p.category?.name || "Focus"}</span>
      </button>
      <span className={left < 0 ? "mini-clock overtime" : "mini-clock"}>{dialClock(left)}</span>
      <button className="mini-step" aria-label="5 minutes less" disabled={left <= 60_000} onClick={() => p.onAdjust(-5)}>
        −
      </button>
      {p.timer.status === "running" ? (
        <button className="mini-play" aria-label="Pause" onClick={p.onPause}>
          <PauseIcon />
        </button>
      ) : (
        <button className="mini-play" aria-label="Resume" onClick={p.onResume}>
          <PlayIcon />
        </button>
      )}
      <button className="mini-step" aria-label="5 minutes more" onClick={() => p.onAdjust(5)}>
        +
      </button>
      <button className="mini-finish" onClick={p.onFinish}>
        {p.kind === "focus" ? "End session" : "End break"}
      </button>
    </footer>
  );
}
