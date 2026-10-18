import type { CSSProperties } from "react";
import type { Category } from "../store";
import type { CalendarEvent } from "../google";
import { clockTime } from "../dates";
import { soft } from "../colors";
import * as T from "../timer";
import { Dial } from "./Dial";
import { Pip } from "./Pip";
import { CalendarIcon, PlayIcon, StopIcon } from "./icons";

type Props = {
  timer: T.Timer;
  now: number;
  intention: string;
  categoryId: number | null;
  categories: Category[];
  idleKind: T.Kind;
  plannedMin: number;
  /** The next Google Calendar event today, if any. */
  nextEvent: CalendarEvent | null;
  onIntention(v: string): void;
  onCategory(id: number): void;
  onIdleKind(k: T.Kind): void;
  onPlannedMin(m: number): void;
  onStart(): void;
  onPause(): void;
  onResume(): void;
  onSetRemaining(minutes: number): void;
  onAdjust(minutes: number): void;
  onFinish(): void;
  /** End the break and start a focus session straight away. */
  onBackToFocus(): void;
  onDiscard(): void;
};

/** "50:00", "1:30:00", or "+03:12" in overtime. */
export function dialClock(ms: number): string {
  if (ms < 0) return T.formatClock(ms);
  const total = Math.ceil(ms / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(total / 3600);
  const rest = `${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
  return h ? `${h}:${rest}` : rest;
}

const lengths = { focus: [25, 50, 60, 90], break: [5, 10, 15, 20] };

export function TimerPane(p: Props) {
  const { timer, now } = p;
  const active = timer.status !== "idle";
  const kind = active ? timer.kind : p.idleKind;
  const left = active ? T.remaining(timer, now) : p.plannedMin * 60_000;
  const category = p.categories.find((c) => c.id === p.categoryId);
  const overtime = active && left <= 0;
  const maxMinutes = kind === "focus" ? 180 : 60;
  const minutes = Math.max(0, left) / 60_000;
  const plannedEnd = timer.status === "running" ? timer.endsAt : now + Math.max(0, left);

  const subline = !active
    ? `ends at ${clockTime(now + left)}`
    : timer.status === "paused"
      ? "Paused"
      : overtime
        ? `Over time since ${clockTime(plannedEnd)}`
        : `${clockTime(timer.startedAt)} to ${clockTime(plannedEnd)}`;

  const dialColor = kind === "focus" ? "var(--apricot)" : "var(--lemon)";
  const dialLip = kind === "focus" ? "var(--apricot-lip)" : "var(--lemon-lip)";

  const dial = (pipSize: number) => (
    <Dial
      minutes={minutes}
      color={dialColor}
      lip={dialLip}
      maxMinutes={maxMinutes}
      label={active ? "Time remaining, drag to adjust" : "Session length, drag to set"}
      onChange={active ? p.onSetRemaining : p.onPlannedMin}
    >
      <span className="dial-pip">
        <Pip mood={kind === "break" ? "break" : active && timer.status === "running" ? "asleep" : "awake"} size={pipSize} />
        {kind === "focus" && timer.status === "running" && (
          <span className="zz" aria-hidden="true">
            z<small>z</small>
          </span>
        )}
      </span>
      {!(kind === "break" && active) && (
        <>
          <span className={overtime ? "dial-time overtime" : "dial-time"}>{dialClock(left)}</span>
          <span className="dial-sub">{subline}</span>
        </>
      )}
    </Dial>
  );

  if (active && kind === "focus") {
    return (
      <section className="stage focus-stage" aria-label="Focusing">
        <div className="stage-dial">{dial(88)}</div>
        <div className="stage-side">
          <div className="stage-what">
            {category && (
              <span className="cat-pill">
                <span className="dot" style={{ background: soft(category.color) }} />
                {category.name}
              </span>
            )}
            <h1>{p.intention.trim() || "Focusing"}</h1>
          </div>
          <div className="button-row">
            <button className="squishy apricot big grow" onClick={p.onFinish}>
              <StopIcon /> End session
            </button>
            {timer.status === "running" ? (
              <button className="soft-button big" onClick={p.onPause}>
                Pause
              </button>
            ) : (
              <button className="soft-button big" onClick={p.onResume}>
                Resume
              </button>
            )}
          </div>
          <div className="button-row">
            <button className="soft-button grow" disabled={left <= 60_000} onClick={() => p.onAdjust(-5)}>
              −5 min
            </button>
            <button className="soft-button grow" onClick={() => p.onAdjust(5)}>
              +5 min
            </button>
          </div>
          {p.nextEvent && <NextEvent event={p.nextEvent} />}
          <button className="quiet-link" onClick={p.onDiscard}>
            Discard without saving
          </button>
        </div>
      </section>
    );
  }

  if (active && kind === "break") {
    return (
      <section className="stage break-stage" aria-label="Break">
        <div className="stage-side">
          <div className="eyebrow">{overtime ? "BREAK'S UP · OVER BY" : timer.status === "paused" ? "BREAK · PAUSED" : "BREAK · TIME LEFT"}</div>
          <div className="break-clock">{dialClock(left)}</div>
          <p className="break-note">
            {overtime
              ? "No rush. Your break keeps going until you end it, and the extra time counts as break."
              : `Step away from the screen for a bit. Back at ${clockTime(plannedEnd)}.`}
          </p>
          <div className="button-row">
            <button className="squishy ink big" onClick={p.onBackToFocus}>
              <PlayIcon /> Back to focus
            </button>
            <button className="soft-button big" onClick={p.onFinish}>
              End break
            </button>
          </div>
          <div className="button-row">
            {timer.status === "running" ? (
              <button className="quiet-link" onClick={p.onPause}>
                Pause break
              </button>
            ) : (
              <button className="quiet-link" onClick={p.onResume}>
                Resume break
              </button>
            )}
            <button className="quiet-link" onClick={p.onDiscard}>
              Discard without saving
            </button>
          </div>
        </div>
        <div className="stage-dial">{dial(150)}</div>
      </section>
    );
  }

  return (
    <div className="plan-row">
      <section className="card plan-card" aria-label="Plan your session">
        <div className="segmented" role="group" aria-label="Session type">
          <button aria-pressed={kind === "focus"} onClick={() => p.onIdleKind("focus")}>
            Focus
          </button>
          <button aria-pressed={kind === "break"} onClick={() => p.onIdleKind("break")}>
            Break
          </button>
        </div>
        {kind === "focus" ? (
          <>
            <h1>What are we working on?</h1>
            <label className="field">
              <span>Intention</span>
              <input
                aria-label="Intention"
                placeholder="I'm going to…"
                value={p.intention}
                maxLength={120}
                onChange={(e) => p.onIntention(e.target.value)}
              />
            </label>
            <div className="field" role="group" aria-label="Category">
              <span>Category</span>
              <div className="chips">
                {p.categories.map((c) => (
                  <button
                    key={c.id}
                    className="chip"
                    aria-pressed={c.id === p.categoryId}
                    onClick={() => p.onCategory(c.id)}
                  >
                    <span className="dot" style={{ background: soft(c.color) }} />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <h1>Time for a break</h1>
            <p className="plan-note">Step away from the screen for a bit. Breaks keep going until you end them.</p>
          </>
        )}
        <span className="grow" />
        {p.nextEvent && <NextEvent event={p.nextEvent} />}
        <button className={kind === "focus" ? "squishy apricot huge" : "squishy matcha huge"} onClick={p.onStart}>
          <PlayIcon />
          {kind === "focus" ? "Start focusing" : "Start break"}
        </button>
      </section>

      <section className="card dial-card" aria-label="Session length">
        {dial(80)}
        <div className="segmented round" role="group" aria-label="Quick lengths">
          {lengths[kind].map((m) => (
            <button key={m} aria-pressed={p.plannedMin === m} onClick={() => p.onPlannedMin(m)}>
              {m} min
            </button>
          ))}
        </div>
        <p className="hint">Drag the dot around the flower to pick any length.</p>
      </section>
    </div>
  );
}

function NextEvent({ event }: { event: CalendarEvent }) {
  return (
    <div className="next-event" style={{ "--event": event.color } as CSSProperties}>
      <CalendarIcon />
      <div>
        <div className="next-title">
          {event.title} at {clockTime(event.start)}
        </div>
        <div className="next-sub">Next on your Google Calendar</div>
      </div>
    </div>
  );
}
