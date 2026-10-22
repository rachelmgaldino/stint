// Throwaway prototype of the floating timer, for mockup screenshots only.
// Open with ?float=a|b|c&look=lavender|mochi&theme=light|dark&kind=focus|break
// &over=1&hover=1&pin=1&bare=1

import { Pip } from "./Pip";
import { CoffeeIcon } from "./icons";
import { setLook, type Look } from "../look";
import "../float-proto.css";

const q = new URLSearchParams(location.search);
const variant = q.get("float") ?? "a";
const lookId = (q.get("look") ?? "lavender") as Look;
const theme = q.get("theme") ?? "light";
const kind = q.get("kind") ?? "focus";
const over = q.get("over") === "1";
const hover = q.get("hover") === "1";
const pinned = q.get("pin") === "1";
const bare = q.get("bare") === "1";

const PinIcon = ({ on }: { on: boolean }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3z" />
    <path d="M12 14v6" fill="none" />
  </svg>
);

const OpenIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 5h5v5M19 5l-8 8" />
    <path d="M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" />
  </svg>
);

const StopIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
    <rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" />
  </svg>
);

type S = { focus: boolean; over: boolean; hover: boolean; pinned: boolean };
const dot = "#f4a988";
const derive = (s: S) => ({
  ...s,
  clock: s.over ? "+04:12" : s.focus ? "18:42" : "03:15",
  label: s.focus ? "Write chapter 3" : "Break",
  progress: s.over ? 1 : s.focus ? 0.25 : 0.35,
});

function Tools({ pinned }: { pinned: boolean }) {
  return (
    <span className="fp-tools">
      <button className={pinned ? "fp-icon on" : "fp-icon"} title={pinned ? "On top of other apps: on" : "Keep on top of other apps"}>
        <PinIcon on={pinned} />
      </button>
      <button className="fp-icon" title="Open Stint">
        <OpenIcon />
      </button>
    </span>
  );
}

function Actions({ small, focus }: { small?: boolean; focus: boolean }) {
  return (
    <>
      {focus && (
        <button className="fp-break" title="Take a break">
          <CoffeeIcon />
          {!small && <span>Break</span>}
        </button>
      )}
      <button className="fp-end" title={focus ? "End session" : "End break"}>
        {small ? <StopIcon /> : focus ? "End session" : "End break"}
      </button>
    </>
  );
}

/** A: the in-app mini bar, taken outside. */
function BarPill(props: S) {
  const { focus, over, hover, pinned, clock, label, progress } = derive(props);
  return (
    <div className={`fp fp-a ${focus ? "" : "break"}`}>
      <span className="fp-grip" aria-hidden>
        ⋮⋮
      </span>
      {focus && <span className="dot" style={{ background: dot }} />}
      <span className="fp-label">{label}</span>
      <span className={over ? "fp-clock over" : "fp-clock"}>{clock}</span>
      <Actions focus={focus} />
      <span className="fp-sep" />
      <Tools pinned={pinned} />
    </div>
  );
}

/** B: a small clock chip; the buttons slide out while the pointer is on it. */
function ChipPill(props: S) {
  const { focus, over, hover, pinned, clock, label, progress } = derive(props);
  return (
    <div className={`fp fp-b ${focus ? "" : "break"} ${hover ? "open" : ""}`}>
      <span className="fp-face">
        <Pip size={34} mood={focus ? "awake" : "break"} />
      </span>
      <span className="fp-stack">
        <span className={over ? "fp-clock over" : "fp-clock"}>{clock}</span>
        <span className="fp-sub">
          {focus && <span className="dot" style={{ background: dot }} />}
          {focus ? "Writing" : "Break"}
          {pinned && !hover && (
            <span className="fp-pinned" title="On top">
              <PinIcon on />
            </span>
          )}
        </span>
      </span>
      {hover && (
        <>
          <Actions small focus={focus} />
          <span className="fp-sep" />
          <Tools pinned={pinned} />
        </>
      )}
    </div>
  );
}

/** C: a round bubble with the time as a ring; a little shelf of buttons opens under it. */
function BubblePill(props: S) {
  const { focus, over, hover, pinned, clock, label, progress } = derive(props);
  const r = 38;
  const c = 2 * Math.PI * r;
  return (
    <div className={`fp-c ${focus ? "" : "break"} ${hover ? "open" : ""}`}>
      <div className="fp-bubble">
        <svg className="fp-ring" width="92" height="92" viewBox="0 0 92 92" aria-hidden>
          <circle cx="46" cy="46" r={r} className="track" />
          <circle
            cx="46"
            cy="46"
            r={r}
            className={over ? "fill over" : "fill"}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - progress)}
            style={{ stroke: focus && !over ? dot : undefined }}
          />
        </svg>
        <span className="fp-bubble-face">
          <Pip size={30} mood={focus ? "awake" : "break"} />
        </span>
        <span className={over ? "fp-clock over" : "fp-clock"}>{clock}</span>
        {pinned && (
          <span className="fp-bubble-pin">
            <PinIcon on />
          </span>
        )}
      </div>
      {hover && (
        <div className="fp-shelf">
          <Actions small focus={focus} />
          <Tools pinned={pinned} />
        </div>
      )}
    </div>
  );
}

function Desktop({ children }: { children: React.ReactNode }) {
  return (
    <div className="fp-desktop">
      <div className="fp-app">
        <div className="fp-app-bar">
          <span />
          <span />
          <span />
          <b>Chapter 3 draft.docx</b>
        </div>
        <div className="fp-app-body">
          <h2>Chapter 3</h2>
          {Array.from({ length: 9 }, (_, i) => (
            <p key={i} style={{ width: `${70 + ((i * 37) % 28)}%` }} />
          ))}
        </div>
      </div>
      <div className="fp-spot">{children}</div>
      <div className="fp-taskbar">
        <span className="fp-start" />
        <span className="fp-task" />
        <span className="fp-task stint" />
        <span className="fp-task" />
        <span className="fp-time">14:32</span>
      </div>
    </div>
  );
}

const pills = { a: BarPill, b: ChipPill, c: BubblePill } as const;

function Board({ v }: { v: keyof typeof pills }) {
  const P = pills[v];
  const states: [string, S][] = [
    ["Focus", { focus: true, over: false, hover: false, pinned: false }],
    [v === "a" ? "Pinned on top" : "Pointer on it, pinned", { focus: true, over: false, hover: v !== "a", pinned: true }],
    ["Over time", { focus: true, over: true, hover: false, pinned: false }],
    ["Break", { focus: false, over: false, hover: v !== "a", pinned: false }],
  ];
  return (
    <div className={`fp-board fp-board-${v}`}>
      {states.map(([name, st]) => (
        <figure key={name}>
          <P {...st} />
          <figcaption>{name}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function FloatProto() {
  setLook(lookId);
  const root = document.documentElement;
  root.dataset.look = lookId;
  root.setAttribute("data-theme", theme);
  const v = (variant in pills ? variant : "a") as keyof typeof pills;
  if (q.get("board") === "1") return <Board v={v} />;
  const P = pills[v];
  const pill = <P focus={kind === "focus"} over={over} hover={hover} pinned={pinned} />;
  if (bare) return <div className="fp-bare">{pill}</div>;
  return <Desktop>{pill}</Desktop>;
}
