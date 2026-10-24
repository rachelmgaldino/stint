import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import * as T from "../timer";
import { soft } from "../colors";
import { lapAt } from "../dial";
import { setLanguage, t } from "../i18n";
import { setLook } from "../look";
import type { FloatAction, FloatState } from "../float";
import { dialClock, upClock } from "./TimerPane";
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

/** How much of the window runs off the screen on each side, from src-tauri/src/float.rs. */
export type FloatEdges = { left: number; right: number; top: number; bottom: number };
type Opened = FloatEdges & { open: boolean };

const NO_EDGES: FloatEdges = { left: 0, right: 0, top: 0, bottom: 0 };
// The window and the bubble inside it, matching OPEN, SHIFT and BUBBLE in float.rs.
const WIN = { w: 300, h: 340 };
const BUB = { x: 104, y: 124, size: 92 };
const GAP = 8;
const PAD = 4;

/**
 * Where the category and the shelf of buttons go: centred on the bubble,
 * the category above and the buttons below, nudged sideways or moved to the
 * other side of the bubble when that part of the window is off the screen.
 * The bubble itself never moves.
 */
function layout(tag: DOMRect, shelf: DOMRect, e: FloatEdges, ring: number): { tag: CSSProperties; shelf: CSSProperties } {
  const cx = BUB.x + BUB.size / 2;
  const x = (w: number) => Math.max(e.left + PAD, Math.min(cx - w / 2, WIN.w - e.right - PAD - w));
  // The looks' outline ring is drawn outside each part, so the gaps grow by
  // it on both sides and stay as wide as in the plain look.
  const gap = GAP + 2 * ring;
  const near = 6 + 2 * ring;
  let shelfTop = BUB.y + BUB.size + gap;
  let tagTop = BUB.y - gap - tag.height;
  if (shelfTop + shelf.height + ring > WIN.h - e.bottom - PAD) {
    shelfTop = BUB.y - gap - shelf.height;
    tagTop = shelfTop - near - tag.height;
  } else if (tagTop - ring < e.top + PAD) {
    tagTop = shelfTop + shelf.height + near;
  }
  return {
    tag: { left: x(tag.width), top: tagTop },
    shelf: { left: x(shelf.width), top: shelfTop },
  };
}

/**
 * The floating timer's own window: a round bubble with the mascot, the time
 * and a ring that fills like the dial. With the pointer on it, the category
 * and a shelf of buttons show around it. The Rust side watches the pointer,
 * since the window lets clicks through to other apps while resting.
 */
export function FloatTimer({ preview }: { preview?: { state: FloatState; open: boolean; now: number; edges?: FloatEdges } }) {
  const [state, setState] = useState<FloatState | null>(preview?.state ?? null);
  const [now, setNow] = useState(preview?.now ?? Date.now());
  const [opened, setOpened] = useState<Opened>({ open: preview?.open ?? false, ...(preview?.edges ?? NO_EDGES) });
  const [place, setPlace] = useState<{ tag: CSSProperties; shelf: CSSProperties } | null>(null);
  const tagRef = useRef<HTMLSpanElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const open = opened.open;

  useEffect(() => {
    document.documentElement.classList.add("float-window");
    if (preview) return;
    const off = listen<FloatState>("float-state", (e) => setState(e.payload));
    const offOpen = listen<Opened>("float-open", (e) => setOpened(e.payload));
    void emitTo("main", "float-ready").catch(() => {});
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => {
      void off.then((f) => f());
      void offOpen.then((f) => f());
      clearInterval(id);
    };
  }, []);

  // Measured before painting, so the parts appear straight in their place.
  useLayoutEffect(() => {
    if (!open || !tagRef.current || !shelfRef.current) return setPlace(null);
    const ring = parseFloat(getComputedStyle(tagRef.current).getPropertyValue("--float-ring")) || 0;
    setPlace(layout(tagRef.current.getBoundingClientRect(), shelfRef.current.getBoundingClientRect(), opened, ring));
  }, [opened, state]);

  useEffect(() => {
    if (!state) return;
    const root = document.documentElement;
    root.dataset.look = state.look;
    if (state.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", state.theme);
  }, [state]);

  if (!state || state.timer.status === "idle") return null;
  setLanguage(state.language);
  setLook(state.look);
  const text = t();
  const { timer } = state;
  const focus = timer.kind === "focus";
  const left = T.remaining(timer, now);
  const over = left < 0;
  const paused = timer.status === "paused";
  // Flow counts up, and its ring fills once an hour, like the dial's laps.
  const flow = T.isFlow(timer);
  const spent = T.elapsed(timer, now);
  const done = flow ? lapAt(spent / 60_000).fraction : over ? 1 : Math.min(1, Math.max(0, 1 - left / Math.max(1, timer.plannedMs)));
  const clock = flow ? upClock(spent) : dialClock(left);
  const color = focus && state.category ? soft(state.category.color) : undefined;
  const tag = focus ? (state.category?.name ?? text.focus) : state.long ? text.float.longBreak : text.float.shortBreak;

  // Stint moves the window itself while the bubble is held (see float_drag
  // in float.rs), so the bubble can reach the very top of the screen.
  const drag = (e: PointerEvent) => {
    if (e.button !== 0 || e.detail > 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    void invoke("float_drag", { start: true }).catch(() => {});
  };
  const drop = () => void invoke("float_drag", { start: false }).catch(() => {});

  return (
    <div
      className={["float", focus ? "" : "break", open ? "open" : "", paused ? "paused" : ""].join(" ")}
    >
      {open && (
        <span className="float-tag" ref={tagRef} style={place?.tag ?? { visibility: "hidden" }}>
          {color && <span className="dot" style={{ background: color }} />}
          <span className="float-tag-name">{tag}</span>
        </span>
      )}
      <div
        className="float-bubble"
        role="timer"
        aria-label={`${tag} ${clock}`}
        title={text.float.open}
        onPointerDown={drag}
        onPointerUp={drop}
        onLostPointerCapture={drop}
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
        <span className={over ? "float-clock over" : "float-clock"}>{clock}</span>
        {state.onTop && !open && (
          <span className="float-pinned" aria-hidden="true">
            <PinIcon on />
          </span>
        )}
      </div>
      {open && (
        <div className="float-shelf" ref={shelfRef} style={place?.shelf ?? { visibility: "hidden" }}>
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
