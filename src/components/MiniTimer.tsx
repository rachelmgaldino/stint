import type { Category } from "../store";
import * as T from "../timer";
import { soft } from "../colors";
import { dialClock } from "./TimerPane";
import { PauseIcon, PlayIcon } from "./icons";
import { t } from "../i18n";

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
  const text = t();
  return (
    <footer className={p.kind === "break" ? "mini-timer break" : "mini-timer"} aria-label={text.mini.label}>
      <button className="mini-info" onClick={p.onOpenTimer} title={text.mini.open}>
        {p.kind === "focus" && p.category && <span className="dot" style={{ background: soft(p.category.color) }} />}
        <span className="mini-intention">{p.kind === "break" ? text.break : p.intention.trim() || p.category?.name || text.focus}</span>
      </button>
      <span className={left < 0 ? "mini-clock overtime" : "mini-clock"}>{dialClock(left)}</span>
      <button className="mini-step" aria-label={text.mini.less} disabled={left <= 60_000} onClick={() => p.onAdjust(-5)}>
        −
      </button>
      {p.timer.status === "running" ? (
        <button className="mini-play" aria-label={text.timer.pause} onClick={p.onPause}>
          <PauseIcon />
        </button>
      ) : (
        <button className="mini-play" aria-label={text.timer.resume} onClick={p.onResume}>
          <PlayIcon />
        </button>
      )}
      <button className="mini-step" aria-label={text.mini.more} onClick={() => p.onAdjust(5)}>
        +
      </button>
      <button className="mini-finish" onClick={p.onFinish}>
        {p.kind === "focus" ? text.timer.endSession : text.timer.endBreak}
      </button>
    </footer>
  );
}
