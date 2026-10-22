import { useEffect, useRef, useState, type MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import * as T from "../timer";
import { soft } from "../colors";
import { setLanguage, t } from "../i18n";
import { setLook } from "../look";
import type { FloatAction, FloatState } from "../float";
import { dialClock } from "./TimerPane";
import { Pip } from "./Pip";
import { CoffeeIcon, PlayIcon } from "./icons";
import "../float.css";

const R = 38;
const RING = 2 * Math.PI * R;

const PinIcon = ({ on }: { on: boolean }) => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill={on ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3z" />
    <path d="M12 14v6" fill="none" />
  </svg>
);

const OpenIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 5h5v5M19 5l-8 8" />
    <path d="M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" />
  </svg>
);

const StopIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" />
  </svg>
);

const send = (a: FloatAction) => void emitTo("main", "float-action", a).catch(() => {});

/**
 * The floating timer's own window: a round bubble with the mascot, the time
 * and a ring that fills like the dial. With the pointer on it, the window
 * grows to show the category above and the buttons below.
 */
export function FloatTimer({ preview }: { preview?: { state: FloatState; open: boolean; now: number } }) {
  const [state, setState] = useState<FloatState | null>(preview?.state ?? null);
  const [now, setNow] = useState(preview?.now ?? Date.now());
  const [open, setOpen] = useState(preview?.open ?? false);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("float-window");
    if (preview) return;
    const off = listen<FloatState>("float-state", (e) => setState(e.payload));
    void emitTo("main", "float-ready").catch(() => {});
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => {
      void off.then((f) => f());
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    const root = document.documentElement;
    root.dataset.look = state.look;
    if (state.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", state.theme);
  }, [state]);

  const show = (v: boolean) => {
    if (closing.current) clearTimeout(closing.current);
    closing.current = null;
    if (v === open) return;
    if (v) {
      setOpen(true);
      void invoke("float_expand", { open: true }).catch(() => {});
      return;
    }
    // A short wait, so brushing past the edge doesn't make it jump.
    closing.current = setTimeout(() => {
      setOpen(false);
      void invoke("float_expand", { open: false }).catch(() => {});
    }, 350);
  };

  if (!state || state.timer.status === "idle") return null;
  setLanguage(state.language);
  setLook(state.look);
  const text = t();
  const { timer } = state;
  const focus = timer.kind === "focus";
  const left = T.remaining(timer, now);
  const over = left < 0;
  const paused = timer.status === "paused";
  const done = over ? 1 : Math.min(1, Math.max(0, 1 - left / Math.max(1, timer.plannedMs)));
  const color = focus && state.category ? soft(state.category.color) : undefined;
  const tag = focus ? (state.category?.name ?? text.focus) : state.long ? text.float.longBreak : text.float.shortBreak;

  const drag = (e: MouseEvent) => {
    if (e.button !== 0 || e.detail > 1) return;
    void getCurrentWindow().startDragging().catch(() => {});
  };

  return (
    <div
      className={["float", focus ? "" : "break", open ? "open" : "", paused ? "paused" : ""].join(" ")}
      onMouseLeave={() => show(false)}
      onMouseEnter={() => open && show(true)}
    >
      {open && (
        <span className="float-tag">
          {color && <span className="dot" style={{ background: color }} />}
          <span className="float-tag-name">{tag}</span>
        </span>
      )}
      <div
        className="float-bubble"
        role="timer"
        aria-label={`${tag} ${dialClock(left)}`}
        title={text.float.open}
        onMouseEnter={() => show(true)}
        onMouseDown={drag}
        onDoubleClick={() => send("open")}
      >
        <svg className="float-ring" width="92" height="92" viewBox="0 0 92 92" aria-hidden="true">
          <circle cx="46" cy="46" r={R} className="track" />
          <circle
            cx="46"
            cy="46"
            r={R}
            className={over ? "fill over" : "fill"}
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - done)}
            style={color && !over ? { stroke: color } : undefined}
          />
        </svg>
        <span className="float-face">
          <Pip size={30} mood={paused ? "asleep" : focus ? "awake" : "break"} />
        </span>
        <span className={over ? "float-clock over" : "float-clock"}>{dialClock(left)}</span>
        {state.onTop && !open && (
          <span className="float-pinned" aria-hidden="true">
            <PinIcon on />
          </span>
        )}
      </div>
      {open && (
        <div className="float-shelf">
          {focus ? (
            <button className="float-btn" title={text.timer.takeBreak} aria-label={text.timer.takeBreak} onClick={() => send("break")}>
              <CoffeeIcon />
            </button>
          ) : (
            <button className="float-btn main" title={text.timer.backToFocus} aria-label={text.timer.backToFocus} onClick={() => send("focus")}>
              <PlayIcon />
            </button>
          )}
          <button
            className={focus ? "float-btn main" : "float-btn"}
            title={focus ? text.timer.endSession : text.timer.endBreak}
            aria-label={focus ? text.timer.endSession : text.timer.endBreak}
            onClick={() => send("end")}
          >
            <StopIcon />
          </button>
          <button
            className={state.onTop ? "float-btn pin on" : "float-btn pin"}
            title={state.onTop ? text.float.pinOn : text.float.pinOff}
            aria-label={state.onTop ? text.float.pinOn : text.float.pinOff}
            aria-pressed={state.onTop}
            onClick={() => send("pin")}
          >
            <PinIcon on={state.onTop} />
          </button>
          <button className="float-btn" title={text.float.open} aria-label={text.float.open} onClick={() => send("open")}>
            <OpenIcon />
          </button>
        </div>
      )}
    </div>
  );
}
