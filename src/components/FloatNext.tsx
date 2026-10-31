import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { soft } from "../colors";
import { timeSpan } from "../dates";
import type { FloatAction, FloatState } from "../float";
import { t } from "../i18n";
import { fold, matching, type PastIntention } from "../intentions";
import { currentTaskMs, currentTaskStart } from "../tasks";
import { formatDuration } from "../timer";
import { CheckIcon } from "./icons";
import { highlight } from "./IntentionField";

/**
 * The card's steps: the task in hand, naming the next one, the moment right
 * after the switch (with the tasks before it), and fixing the new task's name.
 */
export type FloatStep = "current" | "next" | "done" | "fix";

// After a switch the card stays this long, and longer while the pointer is on
// it, so a wrong pick or a typo can still be fixed.
const CHECK_MS = 6_000;
// What the card needs around the part this component draws, at size 1: the
// 9px gap above it, its top row and bar, and room for its shadow.
const AROUND = 64;

type Props = {
  state: FloatState;
  now: number;
  /** On the dev preview page there's no window to hold open, and this is the step it shows. */
  preview?: FloatStep;
  onAction(a: FloatAction): void;
  onClose(): void;
};

type FieldProps = {
  label: string;
  placeholder?: string;
  value: string;
  past: PastIntention[];
  color?: string;
  onChange(v: string): void;
  /** Enter, or a click on a suggestion. */
  onDone(text: string): void;
};

/**
 * The name field: suggestions show from the second letter, and nothing is
 * chosen until an arrow chooses it, so Enter starts what was typed. Tab fills
 * in the only suggestion, or the chosen one.
 */
function TaskField({ label, placeholder, value, past, color, onChange, onDone }: FieldProps) {
  const [active, setActive] = useState(-1);
  const rows = useMemo(() => matching(past, value), [past, value]);

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && rows.length) {
      e.preventDefault();
      const by = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a < 0 ? (by > 0 ? 0 : rows.length - 1) : (a + by + rows.length) % rows.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      onDone(rows[active]?.text ?? value);
    } else if (e.key === "Tab" && rows.length) {
      e.preventDefault();
      const row = rows.length === 1 ? rows[0] : rows[active];
      if (!row) return;
      onChange(row.text);
      setActive(-1);
    }
  };

  return (
    <>
      <span className="float-next-label">{label}</span>
      <input
        className="float-next-input"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        maxLength={120}
        role="combobox"
        aria-expanded={rows.length > 0}
        aria-autocomplete="list"
        autoFocus
        onChange={(e) => {
          onChange(e.target.value);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
      />
      {rows.length > 0 && (
        <div className="float-next-list" role="listbox">
          {rows.map((i, k) => (
            <button
              key={i.text}
              role="option"
              aria-selected={k === active}
              className={k === active ? "float-next-row active" : "float-next-row"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onDone(i.text)}
            >
              <span className="dot" style={{ background: color }} />
              <span>{highlight(i.text, value)}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Next task on the floating timer: shows the task in hand, names the next one
 * without opening Stint, and leaves a few seconds to fix it afterwards. The
 * timer keeps going all along. It tells float_card in float.rs how tall the
 * window must be, whether the card stays open wherever the pointer goes, and
 * whether it has the keyboard.
 */
export function FloatNext({ state, now, preview, onAction, onClose }: Props) {
  const text = t();
  const [step, setStep] = useState<FloatStep>(preview ?? "current");
  const [name, setName] = useState("");
  // When Next task was pressed, which is when the task in hand ended, as in the main window.
  const [at, setAt] = useState(0);
  // The moments to check the switch have passed, so the pointer can close the card.
  const [checked, setChecked] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  const hold = step === "next" || step === "fix" || (step === "done" && !checked);
  const keys = step !== "done";

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight + AROUND);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  useEffect(() => {
    if (preview || height === null) return;
    // The window only takes the keyboard here, after the field has mounted,
    // so autoFocus alone isn't enough.
    invoke("float_card", { height, hold, keys })
      .then(() => {
        if (keys) root.current?.querySelector("input")?.focus();
      })
      .catch(() => {});
  }, [height, hold, keys]);

  useEffect(() => {
    if (preview) return;
    return () => void invoke("float_card", { height: null, hold: false, keys: false }).catch(() => {});
  }, []);

  useEffect(() => {
    if (step !== "done") return;
    setChecked(false);
    const id = setTimeout(() => setChecked(true), CHECK_MS);
    return () => clearTimeout(id);
  }, [step]);

  useEffect(() => {
    const back = () => (step === "fix" ? setStep("done") : step === "next" ? setStep("current") : step === "current" && close.current());
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") back();
    };
    // Focus can blink while the window takes the keyboard, so losing it only
    // counts once it stays lost.
    let wait = 0;
    const away = () => {
      clearTimeout(wait);
      wait = window.setTimeout(() => {
        if (document.hasFocus()) return;
        if (step === "fix") setStep("done");
        else if (step !== "done") close.current();
      }, 200);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", away);
    return () => {
      clearTimeout(wait);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", away);
    };
  }, [step]);

  const { timer, done, categories } = state;
  const category = categories.find((c) => c.id === state.categoryId);
  const color = category ? soft(category.color) : undefined;
  const named = state.intention.trim();
  // Only this category's tasks: a task never changes category from here. The task in hand isn't offered.
  const past = useMemo(
    () => state.past.filter((i) => i.categoryId === state.categoryId && fold(i.text) !== fold(named)),
    [state.past, state.categoryId, named],
  );
  const earlier = done.map((d, i) => ({ ...d, startedAt: i === 0 ? currentTaskStart(timer, []) : done[i - 1].endedAt })).slice(-3);

  const openNext = () => {
    setAt(Date.now());
    setName("");
    setStep("next");
  };
  const startNext = (next: string) => {
    if (!next.trim()) return setStep("current");
    onAction({ next: next.trim(), at });
    setStep("done");
  };
  const openFix = () => {
    setName(named);
    setStep("fix");
  };
  const saveFix = (fixed: string) => {
    if (fixed.trim()) onAction({ rename: fixed.trim() });
    setStep("done");
  };

  if (step === "next" || step === "fix") {
    const next = step === "next";
    return (
      <div className="float-next" ref={root}>
        <TaskField
          key={step}
          label={next ? text.timer.whatsNext : text.float.working}
          placeholder={next ? text.float.taskName : undefined}
          value={name}
          past={past}
          color={color}
          onChange={setName}
          onDone={next ? startNext : saveFix}
        />
      </div>
    );
  }

  return (
    <div className="float-next" ref={root}>
      <span className="float-next-label">{text.float.working}</span>
      {step === "done" ? (
        <button className="float-next-name" title={text.timer.renameTask} onClick={openFix}>
          {named || text.timer.focusing}
        </button>
      ) : (
        <p className="float-next-name">{named || text.timer.focusing}</p>
      )}
      {step === "current" ? (
        <div className="float-next-foot">
          <span>{text.timer.onThisTask(formatDuration(currentTaskMs(timer, done, now)))}</span>
          <button className="next-task-button" onClick={openNext}>
            <CheckIcon /> {text.timer.nextTask}
          </button>
        </div>
      ) : (
        earlier.length > 0 && (
          <div className="float-next-earlier">
            <span className="float-next-label">{text.timer.earlierThisSession}</span>
            <ul>
              {earlier.map((d) => {
                const c = categories.find((x) => x.id === d.categoryId);
                return (
                  <li key={d.endedAt}>
                    <span className="dot" style={{ background: soft(c?.color ?? "#f4a988") }} />
                    <span className="float-next-task">{d.intention || c?.name || text.focus}</span>
                    <span className="float-next-time">
                      {timeSpan(d.startedAt, d.endedAt)} · {formatDuration(d.focusedMs)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      )}
    </div>
  );
}
