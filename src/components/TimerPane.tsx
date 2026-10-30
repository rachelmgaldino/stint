import { useState, type CSSProperties } from "react";
import type { Category } from "../store";
import type { CalendarEvent } from "../google";
import { clockTime, timeRange, timeSpan } from "../dates";
import { soft } from "../colors";
import * as T from "../timer";
import { formatDuration } from "../timer";
import { lapAt } from "../dial";
import { Dial, type Lap } from "./Dial";
import { Pip } from "./Pip";
import { CalendarIcon, CheckIcon, ClockIcon, CoffeeIcon, InfinityIcon, PencilIcon, PlayIcon, StopIcon } from "./icons";
import { StartEditor } from "./StartEditor";
import { IntentionField } from "./IntentionField";
import { fold, type PastIntention } from "../intentions";
import { currentTaskMs, currentTaskStart, type DoneTask } from "../tasks";
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
  /** Focus is set to flow: it counts up with no planned length. */
  flow: boolean;
  /** The break running (or planned) is a long one. */
  longBreak: boolean;
  focusAction: "break" | "end";
  breakAction: "focus" | "end";
  /** The next Google Calendar event today, if any. */
  nextEvent: CalendarEvent | null;
  /** When the last saved session today ended, if any. */
  previousEnd: number | null;
  /** Intentions used before, for the suggestions under the field. */
  past: PastIntention[];
  onIntention(v: string): void;
  /** A past intention was picked: fills the field and its category. */
  onPickIntention(text: string, categoryId: number | null): void;
  onCategory(id: number): void;
  onIdleKind(k: T.Kind): void;
  onPlannedMin(m: number): void;
  onFlow(on: boolean): void;
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
  /** Tasks finished earlier in this focus session with Next task. */
  done: DoneTask[];
  /** Next task: the current one ends at `at` and this one starts. */
  onNextTask(intention: string, categoryId: number | null, at: number): void;
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

/** "0:42" style count-up for flow: whole seconds gone, never rounded up. */
export function upClock(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(total / 3600);
  const rest = `${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
  return h ? `${h}:${rest}` : rest;
}

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
  // Flow counts up, so the dial shows the time gone instead of the time left.
  const flow = active ? T.isFlow(timer) : kind === "focus" && p.flow;
  const spent = active ? T.elapsed(timer, now) : 0;
  const left = active ? T.remaining(timer, now) : p.plannedMin * 60_000;
  const category = p.categories.find((c) => c.id === p.categoryId);
  const overtime = active && left <= 0;
  const maxMinutes = kind === "focus" ? 180 : 60;
  const minutes = flow ? spent / 60_000 : Math.max(0, left) / 60_000;
  const plannedEnd = timer.status === "running" ? timer.endsAt : now + Math.max(0, left);
  const text = t().timer;
  const [editingStart, setEditingStart] = useState(false);
  // Renaming the task being worked on, or naming the next one.
  const [editing, setEditing] = useState<false | "rename" | "next">(false);
  const [next, setNext] = useState<{ at: number; name: string; categoryId: number | null }>({ at: 0, name: "", categoryId: null });

  const subline = flow
    ? !active
      ? text.flowIdleSub
      : timer.status === "paused"
        ? text.paused
        : text.flowRunning
    : !active
    ? text.endsAt(clockTime(now + left))
    : timer.status === "paused"
      ? text.paused
      : overtime
        ? text.overSince(clockTime(plannedEnd))
        : kind === "focus"
          ? "" // The times sit in the pill between − and + instead.
          : timeRange(timer.startedAt, plannedEnd);

  // The dial stops at the longest length; say so under the clock.
  const atMax = !flow && left > 0 && Math.round(minutes) >= maxMinutes;

  // Pip grows a leaf for every full hour on the dial, and gets hot after a long focus.
  // Flow has no length to pick, so the mascot starts calm and heats up as time goes by.
  const hot = active ? T.heat(timer, now) : kind === "focus" && !flow ? T.heatFor(p.plannedMin) : 0;
  const extraLeaves = kind === "focus" ? lapAt(minutes).lap - 1 : 0;

  const dial = (pipSize: number) => (
    <Dial
      minutes={minutes}
      laps={kind === "focus" ? focusLaps : breakLaps}
      maxMinutes={maxMinutes}
      label={flow ? text.dialFlow : active ? text.dialRunning : text.dialIdle}
      // A running flow can't be dragged: there's no end to move. Dragging the
      // idle dial picks a length, which turns flow off.
      onChange={flow && active ? undefined : active ? p.onSetRemaining : p.onPlannedMin}
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
          <span className={overtime ? "dial-time overtime" : "dial-time"}>{flow ? upClock(spent) : dialClock(left)}</span>
          {atMax && <span className="dial-max">{text.max}</span>}
          <span className="dial-sub">{subline}</span>
        </>
      )}
    </Dial>
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

  // − and + move the end by 5 minutes; the times between them open the start editor.
  const adjustRow = active && (
    <div className="button-row adjust-row">
      <button className="soft-button step" aria-label={t().mini.less} disabled={left <= 60_000} onClick={() => p.onAdjust(-5)}>
        −
      </button>
      <button
        className="start-edit-button time-range"
        aria-label={text.changeStartLabel(clockTime(timer.startedAt))}
        onClick={() => setEditingStart(true)}
      >
        <PencilIcon />
        {timer.status === "running" ? timeRange(timer.startedAt, plannedEnd) : text.startedAt(clockTime(timer.startedAt))}
      </button>
      <button className="soft-button step" aria-label={t().mini.more} onClick={() => p.onAdjust(5)}>
        +
      </button>
    </div>
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
          <TaskCard
            {...p}
            category={category}
            editing={editing}
            next={next}
            onEditing={setEditing}
            onNext={setNext}
            start={flow ? { at: timer.startedAt, edit: () => setEditingStart(true) } : undefined}
          />
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
          {/* Flow has no end to move, so its start sits on the task card instead. */}
          {!flow && adjustRow}
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
          {p.done.length > 0 && <Earlier timer={timer} done={p.done} categories={p.categories} />}
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
                <button className="squishy ink big grow" onClick={p.onBackToFocus}>
                  <PlayIcon /> {text.backToFocus}
                </button>
                <button className="soft-button big" onClick={p.onFinish}>
                  {text.endBreak}
                </button>
              </>
            ) : (
              <>
                <button className="squishy ink big grow" onClick={p.onFinish}>
                  <StopIcon /> {text.endBreak}
                </button>
                <button className="soft-button big" onClick={p.onBackToFocus}>
                  {text.backToFocus}
                </button>
              </>
            )}
          </div>
          {adjustRow}
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
        {startEditor}
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
            <IntentionField
              value={p.intention}
              categoryId={p.categoryId}
              categories={p.categories}
              past={p.past}
              now={now}
              onChange={p.onIntention}
              onPick={p.onPickIntention}
            />
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
        <div className="plan-foot">
          {p.nextEvent && <NextEvent event={p.nextEvent} />}
          <button className={kind === "focus" ? "squishy apricot huge" : "squishy matcha huge"} onClick={p.onStart}>
            <PlayIcon />
            {flow ? text.startFlow : kind === "focus" ? text.startFocusing : text.startBreak}
          </button>
        </div>
      </section>

      <section className="card dial-card" aria-label={text.sessionLength}>
        {dial(80)}
        {/* How the session ends: at the length set on the dial, or when you stop. Breaks only have the dial. */}
        {kind === "focus" && (
          <div className="segmented round mode-switch" role="group" aria-label={text.endsHow}>
            <button aria-pressed={!flow} onClick={() => p.onFlow(false)}>
              <ClockIcon /> {text.timerMode}
            </button>
            <button aria-pressed={flow} title={text.flowNote} onClick={() => p.onFlow(true)}>
              <InfinityIcon /> {text.flow}
            </button>
          </div>
        )}
        <p className="hint">{flow ? text.flowHint : text.dialHints[look()]}</p>
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

type TaskCardProps = Props & {
  category: Category | undefined;
  editing: false | "rename" | "next";
  next: { at: number; name: string; categoryId: number | null };
  onEditing(e: false | "rename" | "next"): void;
  onNext(n: { at: number; name: string; categoryId: number | null }): void;
  /** In flow, the session's start shows on the card and opens the start editor. */
  start?: { at: number; edit(): void };
};

/**
 * The task being worked on in a focus session: its category, its name (the
 * pencil renames it), the time spent on it, and Next task, which names the
 * next one while the timer keeps going.
 */
function TaskCard(p: TaskCardProps) {
  const { timer, now, category, editing, next } = p;
  const text = t().timer;
  const taskMs = currentTaskMs(timer, p.done, now);
  const minutes = formatDuration(taskMs);
  const named = p.intention.trim();

  const openNext = () => {
    p.onNext({ at: Date.now(), name: "", categoryId: p.categoryId });
    p.onEditing("next");
  };
  const startNext = (name = next.name, categoryId = next.categoryId) => {
    if (!name.trim()) return;
    p.onNextTask(name, categoryId, next.at);
    p.onEditing(false);
  };

  if (editing === "next") {
    // The task just finished isn't offered again.
    const past = named ? p.past.filter((i) => fold(i.text) !== fold(named)) : p.past;
    return (
      <div className="stage-what task-card naming-next">
        <div className="stage-intention">
          <IntentionField
            value={next.name}
            categoryId={next.categoryId}
            categories={p.categories}
            past={past}
            now={now}
            label={text.whatsNext}
            placeholder={text.nextPlaceholder}
            autoFocus
            doneOnBlur={false}
            onChange={(name) => p.onNext({ ...next, name })}
            onPick={(name, categoryId) => startNext(name, categoryId)}
            onDone={() => (next.name.trim() ? startNext() : p.onEditing(false))}
            onCancel={() => p.onEditing(false)}
          />
        </div>
        <div className="chips next-categories" role="group" aria-label={text.category}>
          {p.categories.map((c) => (
            <button
              key={c.id}
              className="chip"
              aria-pressed={c.id === next.categoryId}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => p.onNext({ ...next, categoryId: c.id })}
            >
              <span className="dot" style={{ background: soft(c.color) }} />
              {c.name}
            </button>
          ))}
        </div>
        <p className="next-note">{text.nextNote(named, formatDuration(currentTaskMs(timer, p.done, next.at)))}</p>
        <div className="next-actions">
          <button className="soft-button" onMouseDown={(e) => e.preventDefault()} onClick={() => p.onEditing(false)}>
            {text.cancel}
          </button>
          <button className="next-task-button" disabled={!next.name.trim()} onMouseDown={(e) => e.preventDefault()} onClick={() => startNext()}>
            <CheckIcon /> {text.startNext}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stage-what task-card">
      <div className="task-card-top">
        {category ? (
          <span className="cat-pill">
            <span className="dot" style={{ background: soft(category.color) }} />
            {category.name}
          </span>
        ) : (
          <span />
        )}
        <span className="task-card-tools">
          {p.start && (
            // The session's start, not this task's: after Next task the card shows a later task.
            <button
              className="task-start"
              title={text.changeStartLabel(clockTime(p.start.at))}
              aria-label={text.changeStartLabel(clockTime(p.start.at))}
              onClick={p.start.edit}
            >
              <ClockIcon />
              {text.since(clockTime(p.start.at))}
            </button>
          )}
          <button
            className="task-pen"
            title={named ? text.renameTask : text.addIntention}
            aria-label={named ? text.renameTask : text.addIntention}
            onClick={() => p.onEditing("rename")}
          >
            <PencilIcon />
          </button>
        </span>
      </div>
      {editing === "rename" ? (
        <div className="stage-intention">
          <IntentionField
            value={p.intention}
            categoryId={p.categoryId}
            categories={p.categories}
            past={p.past}
            now={now}
            label={text.intention}
            autoFocus
            onChange={p.onIntention}
            onPick={(v, c) => {
              p.onPickIntention(v, c);
              p.onEditing(false);
            }}
            onDone={() => p.onEditing(false)}
            onCancel={() => p.onEditing(false)}
          />
        </div>
      ) : (
        <button
          className={named ? "stage-title" : "stage-title is-empty"}
          title={named ? text.renameTask : text.addIntention}
          onClick={() => p.onEditing("rename")}
        >
          <h1>{named || text.focusing}</h1>
        </button>
      )}
      <div className="task-card-foot">
        <span className="task-time">
          <span className="desk-only">{text.onThisTask(minutes)}</span>
          <span className="phone-only">{p.done.length ? text.earlierCount(minutes, p.done.length) : text.onThisTask(minutes)}</span>
        </span>
        <button className="next-task-button" onClick={openNext}>
          <CheckIcon /> {text.nextTask}
        </button>
      </div>
    </div>
  );
}

/** On a desktop, the tasks finished earlier in this session, under the buttons. */
function Earlier({ timer, done, categories }: { timer: T.Timer; done: DoneTask[]; categories: Category[] }) {
  const text = t().timer;
  return (
    <div className="earlier desk-only">
      <span className="earlier-label">{text.earlierThisSession}</span>
      <ul>
        {done.map((d, i) => {
          const start = i === 0 ? currentTaskStart(timer, []) : done[i - 1].endedAt;
          const c = categories.find((x) => x.id === d.categoryId);
          return (
            <li key={d.endedAt}>
              <span className="dot" style={{ background: soft(c?.color ?? "#f4a988") }} />
              <span className="earlier-name">{d.intention || c?.name || t().focus}</span>
              <span className="earlier-time">
                {timeSpan(start, d.endedAt)} · {formatDuration(d.focusedMs)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
