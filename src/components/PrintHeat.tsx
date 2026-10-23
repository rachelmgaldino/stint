// Long-focus faces for Memo, the mushroom and the ghost: worried past one hour, desperate past two.

import type { Heat } from "../timer";

type Hot = Exclude<Heat, 0>;
type Geo = { l: number; r: number; y: number; m: number; ink: string; eye: number; shine: string };

const DROP = "#a9d8f2";
const FLUSH = "#f29bb4";
const FLUSH_LINE = "#d9708f";
const PEN = "var(--pen, #263a6e)";

const cx = (g: Geo) => (g.l + g.r) / 2;

function Steam({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M-7 4 a4 4 0 0 1 2 -7.5 a5 5 0 0 1 9.5 0 a4 4 0 0 1 2.5 7.5 Z"
      fill="#fff"
      stroke="#cfc9e4"
      strokeWidth="1.2"
    />
  );
}

function Drop({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke="none">
      <path d="M0 -9 C5 -2 6 2 6 4 A6 6 0 0 1 -6 4 C-6 2 -5 -2 0 -9 Z" fill={DROP} />
      <ellipse cx="-2" cy="3" rx="1.5" ry="2.2" fill="#fff" opacity="0.85" />
    </g>
  );
}

function OpenEyes({ g, dx = 0, dy = 0 }: { g: Geo; dx?: number; dy?: number }) {
  const e = g.eye;
  return (
    <>
      {[g.l, g.r].map((x) => (
        <g key={x} stroke="none">
          <circle cx={x + dx} cy={g.y + dy} r={e} fill={g.ink} />
          <circle cx={x + dx + e / 3} cy={g.y + dy - e / 3} r={e / 2.8} fill={g.shine} />
        </g>
      ))}
    </>
  );
}

function SqueezedEyes({ g }: { g: Geo }) {
  const e = g.eye;
  return (
    <path
      d={`M${g.l - e} ${g.y - e} l${e * 1.6} ${e} l${-e * 1.6} ${e} M${g.r + e} ${g.y - e} l${-e * 1.6} ${e} l${e * 1.6} ${e}`}
      stroke={g.ink}
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

function SpiralEyes({ g }: { g: Geo }) {
  return (
    <>
      {[g.l, g.r].map((x) => (
        <path
          key={x}
          d={`M${x} ${g.y} m0.5 0 a1.5 1.5 0 1 1 -2 -1 a3.5 3.5 0 1 1 -1.5 6 a6 6 0 1 1 8 -8`}
          stroke={g.ink}
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
      ))}
    </>
  );
}

function TearyEyes({ g, r }: { g: Geo; r: number }) {
  return (
    <>
      {[g.l, g.r].map((x) => (
        <g key={x} stroke="none">
          <ellipse cx={x} cy={g.y + r * 0.55} rx={r + 1.5} ry={r * 0.55} fill={DROP} />
          <circle cx={x} cy={g.y} r={r} fill={g.ink} />
          <circle cx={x + r * 0.35} cy={g.y - r * 0.4} r={r * 0.38} fill={g.shine} />
          <circle cx={x - r * 0.35} cy={g.y + r * 0.35} r={r * 0.18} fill={g.shine} />
        </g>
      ))}
    </>
  );
}

/** Worried brows: the inner ends lift. */
function Brows({ g }: { g: Geo }) {
  return (
    <path
      d={`M${g.l - 6} ${g.y - 9} L${g.l + 5} ${g.y - 13} M${g.r + 6} ${g.y - 9} L${g.r - 5} ${g.y - 13}`}
      stroke={g.ink}
      strokeWidth="2.8"
      strokeLinecap="round"
    />
  );
}

function SmallSmile({ g }: { g: Geo }) {
  return <path d={`M${cx(g) - 5} ${g.m} q5 3 10 0`} stroke={g.ink} strokeWidth="3" strokeLinecap="round" fill="none" />;
}

function Wobble({ g }: { g: Geo }) {
  const x = cx(g) - 9;
  return <path d={`M${x} ${g.m + 1} q3 -4 6 0 q3 4 6 0 q3 -4 6 0`} stroke={g.ink} strokeWidth="2.8" strokeLinecap="round" fill="none" />;
}

function Oh({ g, r = 3.2 }: { g: Geo; r?: number }) {
  return <ellipse cx={cx(g)} cy={g.m + 1} rx={r} ry={r * 1.2} fill={g.ink} stroke="none" />;
}

function Flush({ g, heat }: { g: Geo; heat: Hot }) {
  const cy = g.y + 13;
  return (
    <>
      {[g.l - 11, g.r + 11].map((x) => (
        <g key={x} stroke="none">
          <ellipse cx={x} cy={cy} rx={heat === 1 ? 7 : 9.5} ry={heat === 1 ? 4 : 5.5} fill={FLUSH} opacity={heat === 1 ? 0.8 : 0.95} />
          {heat === 2 && <path d={`M${x - 4} ${cy + 2} l2.5 -4 M${x - 0.5} ${cy + 2} l2.5 -4 M${x + 3} ${cy + 2} l2.5 -4`} stroke={FLUSH_LINE} strokeWidth="1.5" strokeLinecap="round" />}
        </g>
      ))}
    </>
  );
}

/** The overheating face Pip and Mochi have: flushed, > < eyes, steam. */
function HotFace({ g, heat, steam }: { g: Geo; heat: Hot; steam: [number, number, number][] }) {
  return (
    <>
      {heat === 1 ? <OpenEyes g={g} /> : <SqueezedEyes g={g} />}
      {heat === 1 ? <SmallSmile g={g} /> : <Wobble g={g} />}
      <Flush g={g} heat={heat} />
      {(heat === 1 ? steam.slice(0, 1) : steam).map(([x, y, s]) => (
        <Steam key={`${x}-${y}`} x={x} y={y} s={s} />
      ))}
    </>
  );
}

const MEMO: Geo = { l: 46, r: 74, y: 58, m: 72, ink: "#263a6e", eye: 5.5, shine: "#fff" };

/** Memo: a worried look with a pen "!" doodle, then overheating. */
export function MemoHeat({ heat }: { heat: Hot }) {
  const g = MEMO;
  if (heat === 2) return <HotFace g={g} heat={2} steam={[[92, 8, 1], [26, 12, 1.1], [104, 26, 0.7]]} />;
  return (
    <>
      <OpenEyes g={g} />
      <Brows g={g} />
      <Wobble g={g} />
      <path d="M113 26 v14 M113 47 v0.1" stroke={PEN} strokeWidth="3.4" strokeLinecap="round" />
    </>
  );
}

const SHROOM: Geo = { l: 50, r: 70, y: 84, m: 96, ink: "#1d2a78", eye: 4.5, shine: "#fbf8f0" };

/** The mushroom: teary eyes as a few spores puff out, then overheating. */
export function ShroomHeat({ heat }: { heat: Hot }) {
  const g = SHROOM;
  if (heat === 2) return <HotFace g={g} heat={2} steam={[[94, 6, 1], [28, 8, 1.1], [108, 24, 0.7]]} />;
  return (
    <>
      <TearyEyes g={g} r={4.5} />
      <Oh g={g} r={2.4} />
      {[[96, 8, 2.5], [104, -2, 2], [88, -4, 1.6]].map(([x, y, r]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x + 1.5} cy={y + 1.5} r={r} fill="#4a63ff" />
          <circle cx={x} cy={y} r={r} fill="#ffd23f" />
        </g>
      ))}
    </>
  );
}

const GHOST: Geo = { l: 47, r: 73, y: 56, m: 76, ink: "#1d2a78", eye: 5, shine: "#fbf8f0" };

/** The ghost: a sweaty side-eye at the clock, then dizzy spiral eyes. */
export function GhostHeat({ heat }: { heat: Hot }) {
  const g = GHOST;
  if (heat === 2)
    return (
      <>
        <SpiralEyes g={g} />
        <Wobble g={g} />
      </>
    );
  return (
    <>
      <OpenEyes g={g} dx={3.5} dy={1} />
      <path d={`M${g.l - 6} ${g.y - 11} l10 -2 M${g.r - 4} ${g.y - 13} l10 2`} stroke={g.ink} strokeWidth="2.6" strokeLinecap="round" />
      <Wobble g={g} />
      <Drop x={30} y={36} s={0.85} />
    </>
  );
}
