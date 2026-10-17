import type { Category } from "../store";
import * as T from "../timer";

type Props = {
  timer: T.Timer;
  now: number;
  intention: string;
  categoryId: number | null;
  categories: Category[];
  idleKind: T.Kind;
  plannedMin: number;
  todayFocusMs: number;
  onIntention(v: string): void;
  onCategory(id: number | null): void;
  onIdleKind(k: T.Kind): void;
  onPlannedMin(m: number): void;
  onStart(): void;
  onPause(): void;
  onResume(): void;
  onScrub(minutes: number): void;
  onFinish(): void;
  onDiscard(): void;
};

const presets = { focus: [15, 25, 45, 60, 90], break: [5, 10, 15, 30] };

function Ring({ fraction, color, children }: { fraction: number; color: string; children: React.ReactNode }) {
  const r = 108;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring">
      <svg viewBox="0 0 240 240" aria-hidden="true">
        <circle cx="120" cy="120" r={r} className="ring-track" />
        {fraction > 0 && (
          <circle
            cx="120"
            cy="120"
            r={r}
            className="ring-fill"
            style={{ stroke: color, strokeDasharray: c, strokeDashoffset: c * (1 - fraction) }}
          />
        )}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function TimerView(p: Props) {
  const { timer, now } = p;
  const active = timer.status !== "idle";
  const kind = active ? timer.kind : p.idleKind;
  const left = active ? T.remaining(timer, now) : p.plannedMin * 60_000;
  const category = p.categories.find((c) => c.id === p.categoryId);
  const color = kind === "break" ? "var(--break)" : (category?.color ?? "var(--accent)");
  const overtime = active && left <= 0;
  const clamp = (m: number) => Math.min(240, Math.max(1, m));

  return (
    <section className="timer-view">
      {!active && (
        <div className="segmented" role="group" aria-label="Timer type">
          {(["focus", "break"] as T.Kind[]).map((k) => (
            <button key={k} className={p.idleKind === k ? "seg active" : "seg"} onClick={() => p.onIdleKind(k)}>
              {k === "focus" ? "Focus" : "Break"}
            </button>
          ))}
        </div>
      )}

      {kind === "focus" && (
        <div className="intention">
          <input
            aria-label="What will you focus on?"
            placeholder="What will you focus on?"
            value={p.intention}
            maxLength={120}
            onChange={(e) => p.onIntention(e.target.value)}
          />
          <div className="chips" role="group" aria-label="Category">
            {p.categories.map((c) => (
              <button
                key={c.id}
                className={c.id === p.categoryId ? "chip active" : "chip"}
                style={{ "--chip": c.color } as React.CSSProperties}
                onClick={() => p.onCategory(c.id)}
              >
                <span className="dot" />
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <Ring fraction={active ? T.progress(timer, now) : 0} color={color}>
        <div className={overtime ? "clock overtime" : "clock"}>{T.formatClock(left)}</div>
        <div className="clock-label">
          {!active && (kind === "focus" ? "Ready to focus" : "Ready for a break")}
          {timer.status === "running" && (overtime ? "Over time" : kind === "focus" ? "Focusing" : "On a break")}
          {timer.status === "paused" && "Paused"}
        </div>
      </Ring>

      {!active ? (
        <>
          <div className="scrubber">
            <button className="round" aria-label="5 minutes less" onClick={() => p.onPlannedMin(clamp(p.plannedMin - 5))}>
              −5
            </button>
            <input
              type="range"
              min={1}
              max={kind === "focus" ? 120 : 60}
              value={p.plannedMin}
              aria-label="Duration in minutes"
              onChange={(e) => p.onPlannedMin(Number(e.target.value))}
            />
            <button className="round" aria-label="5 minutes more" onClick={() => p.onPlannedMin(clamp(p.plannedMin + 5))}>
              +5
            </button>
          </div>
          <div className="presets">
            {presets[kind].map((m) => (
              <button key={m} className={m === p.plannedMin ? "preset active" : "preset"} onClick={() => p.onPlannedMin(m)}>
                {m}m
              </button>
            ))}
          </div>
          <button className="primary" onClick={p.onStart}>
            Start {kind === "focus" ? "session" : "break"}
          </button>
        </>
      ) : (
        <>
          <div className="scrubber">
            <button className="round" aria-label="5 minutes less" disabled={left <= 60_000} onClick={() => p.onScrub(-5)}>
              −5
            </button>
            <button className="round" aria-label="1 minute less" disabled={left <= 60_000} onClick={() => p.onScrub(-1)}>
              −1
            </button>
            <button className="round" aria-label="1 minute more" onClick={() => p.onScrub(1)}>
              +1
            </button>
            <button className="round" aria-label="5 minutes more" onClick={() => p.onScrub(5)}>
              +5
            </button>
          </div>
          <div className="actions">
            {timer.status === "running" ? (
              <button className="secondary" onClick={p.onPause}>
                Pause
              </button>
            ) : (
              <button className="secondary" onClick={p.onResume}>
                Resume
              </button>
            )}
            <button className="primary" onClick={p.onFinish}>
              {kind === "focus" ? "Finish" : "End break"}
            </button>
          </div>
          <button className="link" onClick={p.onDiscard}>
            Discard without saving
          </button>
        </>
      )}

      <p className="today-total">Focused today: {T.formatDuration(p.todayFocusMs)}</p>
    </section>
  );
}
