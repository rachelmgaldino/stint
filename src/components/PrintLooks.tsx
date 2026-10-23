// The Notebook and Riso looks: their mascots, goal marks and dials.
// Notebook is drawn in pen on a ruled page; Riso is printed in two inks that never quite line up.

import type { Look } from "../look";
import type { Heat } from "../timer";
import { GhostHeat, MemoHeat, ShroomHeat } from "./PrintHeat";

export const PRINT_LOOKS = ["notebook", "riso"] as const;
export type PrintLook = (typeof PRINT_LOOKS)[number];
export const isPrintLook = (l: Look): l is PrintLook => (PRINT_LOOKS as readonly string[]).includes(l);

type Mood = "awake" | "asleep" | "break" | "cheer";

function Face({ mood, l, r, y, m, ink, eye = 6, cx = 60, shine = "#fff" }: { mood: Mood; l: number; r: number; y: number; m: number; ink: string; eye?: number; cx?: number; shine?: string }) {
  return (
    <>
      {mood === "awake" && (
        <>
          <circle cx={l} cy={y} r={eye} fill={ink} stroke="none" />
          <circle cx={r} cy={y} r={eye} fill={ink} stroke="none" />
          <circle cx={l + eye / 3} cy={y - eye / 3} r={eye / 3} fill={shine} stroke="none" />
          <circle cx={r + eye / 3} cy={y - eye / 3} r={eye / 3} fill={shine} stroke="none" />
          <path d={`M${cx - 5} ${m} q5 5 10 0`} stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      )}
      {mood === "asleep" && (
        <>
          <path d={`M${l - eye} ${y} q${eye} ${eye} ${eye * 2} 0 M${r - eye} ${y} q${eye} ${eye} ${eye * 2} 0`} stroke={ink} strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <ellipse cx={cx} cy={m + 2} rx="3" ry="2.2" fill={ink} stroke="none" />
        </>
      )}
      {(mood === "break" || mood === "cheer") && (
        <path d={`M${l - eye} ${y + 2} q${eye} ${-eye - 1} ${eye * 2} 0 M${r - eye} ${y + 2} q${eye} ${-eye - 1} ${eye * 2} 0`} stroke={ink} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      )}
      {mood === "cheer" && <path d={`M${cx - 8} ${m - 2} Q${cx} ${m + 10} ${cx + 8} ${m - 2} Z`} fill={ink} stroke={ink} strokeWidth="1" />}
    </>
  );
}

function Cup({ x = 0, y = 96, rim = "#fff", tea = "#9fcba4", stroke }: { x?: number; y?: number; rim?: string; tea?: string; stroke?: string }) {
  return (
    <g transform={`translate(${x} 0)`} stroke={stroke} strokeWidth={stroke ? 2 : 0}>
      <path d={`M44 ${y} h30 v9 a10 10 0 0 1 -10 10 h-10 a10 10 0 0 1 -10 -10 Z`} fill={rim} />
      <path d={`M74 ${y + 3} h4 a5 5 0 0 1 0 10 h-4`} stroke={stroke ?? rim} strokeWidth="4" fill="none" />
      <path d={`M52 ${y + 5} h14`} stroke={tea} strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

const Zz = ({ x, y, ink }: { x: number; y: number; ink: string }) => (
  <path d={`M${x} ${y} h9 l-9 9 h9 M${x + 12} ${y - 10} h6 l-6 6 h6`} stroke={ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
);

/* ---------------- Notebook: Memo the sticky note ---------------- */

const PEN = "var(--pen, #263a6e)";
// Memo's face stays dark blue on the yellow note, even on graphite nights.
const FACE = "#263a6e";
const pen = { stroke: PEN, strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function Memo({ mood, heat }: { mood: Mood; heat: Heat }) {
  return (
    <g {...pen} transform="rotate(-5 60 64)">
      <path d="M18 20 H102 V86 L84 106 H18 Z" fill="#ffdf5e" />
      <path d="M102 86 L84 88 L84 106 Z" fill="#f2c94c" />
      <path d="M44 14 h32 v14 h-32 Z" fill="rgb(169 196 245 / 0.8)" strokeWidth="0" />
      {heat ? <MemoHeat heat={heat} /> : <Face mood={mood} l={46} r={74} y={58} m={72} ink={FACE} eye={5.5} />}
      <path d="M30 70 q5 -3 9 0 M81 70 q5 -3 9 0" stroke="#f28da6" strokeWidth="3.5" fill="none" />
      <path d="M28 92 h30" stroke={FACE} strokeWidth="2" />
      <path d="M26 36 c0 -4 6 -4 6 0 c0 -4 6 -4 6 0 c0 5 -6 8 -6 8 c0 0 -6 -3 -6 -8 Z" fill="#ffb3c7" strokeWidth="2" />
      {mood === "asleep" && !heat && <Zz x={90} y={0} ink={PEN} />}
      {mood === "break" && <Cup x={-4} y={84} rim="#fffdf6" tea="#b7e3a1" stroke={PEN} />}
    </g>
  );
}

/* ---------------- Riso: the mushroom by day, the ghost by night ---------------- */

const BLUE = "#4a63ff";
const PINK = "#ff6fa8";
const YELLOW = "#ffd23f";
const MINT = "#4fd1a1";
const RISO_INK = "#1d2a78";
const PAPER = "#fbf8f0";

/** Prints a shape twice: once in the offset ink a little down-right, then in its own. */
function Print({ d, fill, under = PINK, dx = 4, dy = 3 }: { d: string; fill: string; under?: string; dx?: number; dy?: number }) {
  return (
    <>
      <path d={d} fill={under} transform={`translate(${dx} ${dy})`} />
      <path d={d} fill={fill} />
    </>
  );
}

function Shroom({ mood, heat }: { mood: Mood; heat: Heat }) {
  return (
    <>
      <Print d="M38 58 H82 V100 a14 14 0 0 1 -14 14 H52 a14 14 0 0 1 -14 -14 Z" fill={YELLOW} under={BLUE} />
      <Print d="M10 64 C10 30 34 14 60 14 C86 14 110 30 110 64 C110 70 104 72 96 70 C72 64 48 64 24 70 C16 72 10 70 10 64 Z" fill={PINK} under={BLUE} />
      <circle cx="36" cy="40" r="7" fill={PAPER} />
      <circle cx="62" cy="28" r="5" fill={PAPER} />
      <circle cx="86" cy="44" r="8" fill={PAPER} />
      {heat ? <ShroomHeat heat={heat} /> : <Face mood={mood} l={50} r={70} y={84} m={96} ink={RISO_INK} eye={4.5} shine={PAPER} />}
      <path d="M42 94 q4 -2 7 0 M71 94 q4 -2 7 0" stroke={PINK} strokeWidth="3" fill="none" strokeLinecap="round" />
      {mood === "asleep" && !heat && <Zz x={94} y={4} ink={RISO_INK} />}
      {mood === "break" && <Cup x={30} y={92} rim={PAPER} tea={MINT} />}
    </>
  );
}

function Ghost({ mood, heat }: { mood: Mood; heat: Heat }) {
  return (
    <>
      <Print d="M20 60 C20 32 38 16 60 16 C82 16 100 32 100 60 V108 Q92 98 84 108 Q76 118 68 108 Q60 98 52 108 Q44 118 36 108 Q28 98 20 108 Z" fill={BLUE} under={PINK} />
      <path d="M100 66 C110 62 114 54 112 46" stroke={BLUE} strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M20 66 C10 62 6 54 8 46" stroke={BLUE} strokeWidth="8" strokeLinecap="round" fill="none" />
      <circle cx="47" cy="56" r="10" fill={PAPER} />
      <circle cx="73" cy="56" r="10" fill={PAPER} />
      {heat ? <GhostHeat heat={heat} /> : <Face mood={mood} l={47} r={73} y={56} m={76} ink={RISO_INK} eye={5} shine={PAPER} />}
      <ellipse cx="38" cy="72" rx="6" ry="3.5" fill={PINK} />
      <ellipse cx="82" cy="72" rx="6" ry="3.5" fill={PINK} />
      <path d="M104 18 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z" fill={YELLOW} />
      {mood === "asleep" && !heat && <Zz x={86} y={10} ink={RISO_INK} />}
      {mood === "break" && <Cup y={90} rim={PAPER} tea={MINT} />}
    </>
  );
}

export function PrintMascot({ look, mood, size, a11y, heat = 0 }: { look: PrintLook; mood: Mood; size: number; a11y: object; heat?: Heat }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="pip" overflow="visible" {...a11y}>
      {look === "notebook" ? (
        <Memo mood={mood} heat={heat} />
      ) : (
        // Both are drawn; riso.css shows the mushroom by day and the ghost by night.
        <>
          <g className="by-day">
            <Shroom mood={mood} heat={heat} />
          </g>
          <g className="by-night">
            <Ghost mood={mood} heat={heat} />
          </g>
        </>
      )}
    </svg>
  );
}

/** One mark per session of the daily goal: a pen star or a two-ink dot. */
export function PrintGoalMark({ look, done }: { look: PrintLook; done: boolean }) {
  const off = "var(--seed)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24">
      {look === "notebook" ? (
        <path
          d="M12 2.5 l2.6 6 6.6 .7 -5 4.4 1.5 6.5 -5.7 -3.4 -5.8 3.4 1.6 -6.5 -5 -4.4 6.6 -.7 Z"
          fill={done ? "#ffdf5e" : "none"}
          stroke={done ? "var(--pen)" : off}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeDasharray={done ? undefined : "3 2.5"}
        />
      ) : (
        <>
          <circle cx="13.5" cy="13.5" r="8" fill={done ? PINK : "none"} />
          <circle cx="11" cy="11" r="8" fill={done ? BLUE : "none"} stroke={done ? "none" : off} strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

const C = 180;
const ring = (r: (a: number) => number, steps = 240) => {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rr = r(a);
    d += `${i ? "L" : "M"}${(C + rr * Math.sin(a)).toFixed(1)} ${(C - rr * Math.cos(a)).toFixed(1)}`;
  }
  return d + "Z";
};
// Two hand-drawn circles that don't quite meet, like a doodle in the margin.
const WOBBLE = ring((a) => 169 + 4 * Math.sin(a * 3 + 0.4) + 2.5 * Math.sin(a * 7 + 1));
const WOBBLE2 = ring((a) => 171 + 3 * Math.sin(a * 4 + 2) + 2.5 * Math.sin(a * 6));

export function PrintDialBack({ look }: { look: PrintLook }) {
  if (look === "notebook") {
    return (
      <>
        <path d={WOBBLE} className="dial-petals" />
        <path d={WOBBLE} fill="none" stroke="var(--pen)" strokeWidth="2.6" />
        <path d={WOBBLE2} fill="none" stroke="var(--pen)" strokeWidth="1.4" opacity="0.6" />
      </>
    );
  }
  // A halftone circle printed slightly off from the paper one on top.
  return (
    <>
      <defs>
        <pattern id="riso-dots" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
          <circle cx="4.5" cy="4.5" r="2.6" fill="var(--apricot)" />
        </pattern>
      </defs>
      <circle cx={C + 7} cy={C + 6} r="170" fill="url(#riso-dots)" opacity="0.8" />
      <circle cx={C} cy={C} r="168" className="dial-petals" />
    </>
  );
}

/** Notebook's knob is a ticked box, Riso's a dot printed slightly off its ring. */
export function PrintKnob({ look, x, y }: { look: PrintLook; x: number; y: number }) {
  if (look === "notebook") {
    return (
      <>
        <circle cx={x} cy={y} r="16" className="dial-knob" stroke="var(--pen)" strokeWidth="2.5" />
        <path d={`M${x - 6} ${y + 1} l4 4 l8 -9`} stroke="var(--pen)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </>
    );
  }
  return (
    <>
      <circle cx={x + 4} cy={y + 3} r="16" fill="var(--apricot-lip)" />
      <circle cx={x} cy={y} r="16" className="dial-knob" stroke="var(--text)" strokeWidth="3" />
      <circle cx={x} cy={y} r="6" fill="var(--apricot)" />
    </>
  );
}
