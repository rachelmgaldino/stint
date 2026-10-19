import { useState, type CSSProperties } from "react";
import type { Category } from "../store";
import type { CalendarEvent } from "../google";
import { clockTime } from "../dates";
import { soft } from "../colors";
import * as T from "../timer";
import { lapAt } from "../dial";
import { Dial, type Lap } from "./Dial";
import { Pip } from "./Pip";
import { CalendarIcon, CoffeeIcon, PencilIcon, PlayIcon, StopIcon } from "./icons";
import { StartEditor } from "./StartEditor";
import { t } from "../i18n";
import { look } from "../look";

type Props = {
  timer: T.Timer;
  now: number;
  intention: string;
  categoryId: number | null;
  categories: Category[];
  idleKind: T.Kind;
  plannedMin: number;
  /** The break running (or planned) is a long one. */
  longBreak: boolean;
  focusAction: "break" | "end";
  breakAction: "focus" | "end";
  /** The next Google Calendar event today, if any. */
  nextEvent: CalendarEvent | null;
  /** When the last saved session today ended, if any. */
  previousEnd: number | null;
  onIntention(v: string): void;
  onCategory(id: number): void;
  onIdleKind(k: T.Kind): void;
  onPlannedMin(m: number): void;
  onStart(): void;
  onPause(): void;
  onResume(): void;
  /** Save the focus session up to now and start a break. */
  onTakeBreak(): void;
  onSetRemaining(minutes: number): void;
  onAdjust(minutes: number): void;
  /** Say the running session really began at another time. */
  onMoveStart(startedAt: number): void;
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

// Peach for the first hour, then pink, then periwinkle.
const focusLaps: Lap[] = [
  { color: "var(--apricot)", lip: "var(--apricot-lip)" },
  { color: "var(--bubblegum)", lip: "var(--bubblegum-lip)" },
  { color: "var(--peri)", lip: "var(--peri-lip)" },
];
const breakLaps: Lap[] = [{ color: "var(--lemon)", lip: "var(--lemon-lip)" }];

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
  const text = t().timer;
  const [editingStart, setEditingStart] = useState(false);

  const subline = !active
    ? text.endsAt(clockTime(now + left))
    : timer.status === "paused"
      ? text.paused
      : overtime
        ? text.overSince(clockTime(plannedEnd))
        : text.fromTo(clockTime(timer.startedAt), clockTime(plannedEnd));

  // The dial stops at the longest length; say so under the clock.
  const atMax = left > 0 && Math.round(minutes) >= maxMinutes;

  // Pip grows a leaf for every full hour on the dial, and gets hot after a long focus.
  const hot = T.heat(timer, now);
  const extraLeaves = kind === "focus" ? lapAt(minutes).lap - 1 : 0;

  const dial = (pipSize: number) => (
    <Dial
      minutes={minutes}
      laps={kind === "focus" ? focusLaps : breakLaps}
      maxMinutes={maxMinutes}
      label={active ? text.dialRunning : text.dialIdle}
      onChange={active ? p.onSetRemaining : p.onPlannedMin}
    >
      <span className="dial-pip">
        <Pip
          mood={kind === "break" ? "break" : active && timer.status === "running" ? "asleep" : "awake"}
          size={pipSize}
          extraLeaves={extraLeaves}
          heat={hot}
        />
        {kind === "focus" && timer.status === "running" && !hot && (
          <span className="zz" aria-hidden="true">
            z<small>z</small>
          </span>
        )}
      </span>
      {!(kind === "break" && active) && (
        <>
          <span className={overtime ? "dial-time overtime" : "dial-time"}>{dialClock(left)}</span>
          {atMax && <span className="dial-max">{text.max}</span>}
          <span className="dial-sub">{subline}</span>
        </>
      )}
    </Dial>
  );

  const startLink = active && (
    <button
      className="start-edit-button"
      aria-label={text.changeStartLabel(clockTime(timer.startedAt))}
      onClick={() => setEditingStart(true)}
    >
      <PencilIcon />
      {text.startedAt(clockTime(timer.startedAt))}
    </button>
  );

  const startEditor = active && editingStart && (
    <StartEditor
      timer={timer}
      now={now}
      previousEnd={p.previousEnd}
      onSave={(ms) => {
        p.onMoveStart(ms);
        setEditingStart(false);
      }}
      onClose={() => setEditingStart(false)}
    />
  );

  if (active && kind === "focus") {
    // The big button is the one chosen in Settings; the other sits beside it,
    // or under it as a link while paused, when Resume takes its place.
    const breakButton = (big: boolean) => (
      <button
        className={big ? "squishy apricot big grow" : "soft-button big"}
        title={text.takeBreakHint}
        onClick={p.onTakeBreak}
      >
        {big && <CoffeeIcon />} {text.takeBreak}
      </button>
    );
    const endButton = (big: boolean) => (
      <button className={big ? "squishy apricot big grow" : "soft-button big"} onClick={p.onFinish}>
        {big && <StopIcon />} {text.endSession}
      </button>
    );
    const breakFirst = p.focusAction === "break";
    const running = timer.status === "running";
    return (
      <section className="stage focus-stage" aria-label={text.focusing}>
        <div className="stage-dial">{dial(88)}</div>
        <div className="stage-side">
          <div className="stage-what">
            {category && (
              <span className="cat-pill">
                <span className="dot" style={{ background: soft(category.color) }} />
                {category.name}
              </span>
            )}
            <h1>{p.intention.trim() || text.focusing}</h1>
          </div>
          <div className="button-row">
            {breakFirst ? breakButton(true) : endButton(true)}
            {!running ? (
              <button className="soft-button big" onClick={p.onResume}>
                {text.resume}
              </button>
            ) : breakFirst ? (
              endButton(false)
            ) : (
              breakButton(false)
            )}
          </div>
          <div className="button-row">
            <button className="soft-button grow" disabled={left <= 60_000} onClick={() => p.onAdjust(-5)}>
              {text.minus5}
            </button>
            <button className="soft-button grow" onClick={() => p.onAdjust(5)}>
              {text.plus5}
            </button>
          </div>
          {p.nextEvent && <NextEvent event={p.nextEvent} />}
          <div className="stage-links">
            {running ? (
              <button className="quiet-link" onClick={p.onPause}>
                {text.pauseSession}
              </button>
            ) : breakFirst ? (
              <button className="quiet-link" onClick={p.onFinish}>
                {text.endSession}
              </button>
            ) : (
              <button className="quiet-link" onClick={p.onTakeBreak}>
                {text.takeBreakLink}
              </button>
            )}
            <button className="quiet-link" onClick={p.onDiscard}>
              {text.discard}
            </button>
          </div>
          {startLink}
        </div>
        {startEditor}
      </section>
    );
  }

  if (active && kind === "break") {
    return (
      <section className="stage break-stage" aria-label={t().break}>
        <div className="stage-side">
          <div className="eyebrow">{overtime ? text.breakOver : timer.status === "paused" ? text.breakPaused : p.longBreak ? text.longBreakLeft : text.breakLeft}</div>
          <div className="break-clock">{dialClock(left)}</div>
          <p className="break-note">
            {overtime
              ? text.breakOvertimeNote
              : text.breakNote(clockTime(plannedEnd))}
          </p>
          <div className="button-row">
            {p.breakAction === "focus" ? (
              <>
                <button className="squishy ink big" onClick={p.onBackToFocus}>
                  <PlayIcon /> {text.backToFocus}
                </button>
                <button className="soft-button big" onClick={p.onFinish}>
                  {text.endBreak}
                </button>
              </>
            ) : (
              <>
                <button className="squishy ink big" onClick={p.onFinish}>
                  <StopIcon /> {text.endBreak}
                </button>
                <button className="soft-button big" onClick={p.onBackToFocus}>
                  {text.backToFocus}
                </button>
              </>
            )}
          </div>
          <div className="stage-links">
            {timer.status === "running" ? (
              <button className="quiet-link" onClick={p.onPause}>
                {text.pauseBreak}
              </button>
            ) : (
              <button className="quiet-link" onClick={p.onResume}>
                {text.resumeBreak}
              </button>
            )}
            <button className="quiet-link" onClick={p.onDiscard}>
              {text.discard}
            </button>
          </div>
        </div>
        <div className="stage-dial">{dial(150)}</div>
      </section>
    );
  }

  return (
    <div className="plan-row">
      <section className="card plan-card" aria-label={text.plan}>
        <div className="segmented" role="group" aria-label={text.sessionType}>
          <button aria-pressed={kind === "focus"} onClick={() => p.onIdleKind("focus")}>
            {t().focus}
          </button>
          <button aria-pressed={kind === "break"} onClick={() => p.onIdleKind("break")}>
            {t().break}
          </button>
        </div>
        {kind === "focus" ? (
          <>
            <h1>{text.whatAreWeWorkingOn}</h1>
            <label className="field">
              <span>{text.intention}</span>
              <input
                aria-label={text.intention}
                placeholder={text.intentionPlaceholder}
                value={p.intention}
                maxLength={120}
                onChange={(e) => p.onIntention(e.target.value)}
              />
            </label>
            <div className="field" role="group" aria-label={text.category}>
              <span>{text.category}</span>
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
            <h1>{p.longBreak ? text.longBreakTime : text.breakTime}</h1>
            <p className="plan-note">{text.breakPlanNote}</p>
          </>
        )}
        <span className="grow" />
        {p.nextEvent && <NextEvent event={p.nextEvent} />}
        <button className={kind === "focus" ? "squishy apricot huge" : "squishy matcha huge"} onClick={p.onStart}>
          <PlayIcon />
          {kind === "focus" ? text.startFocusing : text.startBreak}
        </button>
      </section>

      <section className="card dial-card" aria-label={text.sessionLength}>
        {dial(80)}
        <div className="segmented round" role="group" aria-label={text.quickLengths}>
          {lengths[kind].map((m) => (
            <button key={m} aria-pressed={p.plannedMin === m} onClick={() => p.onPlannedMin(m)}>
              {text.minutes(m)}
            </button>
          ))}
        </div>
        <p className="hint">{look() === "mochi" ? text.dialHintMochi : text.dialHint}</p>
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
          {t().timer.eventAt(event.title, clockTime(event.start))}
        </div>
        <div className="next-sub">{t().timer.nextOnCalendar}</div>
      </div>
    </div>
  );
}
