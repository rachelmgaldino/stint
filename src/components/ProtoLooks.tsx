// Prototype looks for the theme mockups: Notebook, Riso and Luna, each with
// several mascot candidates picked with ?m=<name> in the address.

import type { Look } from "../look";

export const PROTO_LOOKS = ["notebook", "riso", "luna"] as const;
export type ProtoLook = (typeof PROTO_LOOKS)[number];
export const isProto = (l: Look): l is ProtoLook => (PROTO_LOOKS as readonly string[]).includes(l);

export const MASCOTS: Record<ProtoLook, string[]> = {
  notebook: ["memo", "crane", "blot", "worm", "snail"],
  riso: ["daynight", "fish", "shroom", "ghost", "cactus", "whale"],
  luna: ["rabbit", "moth", "owl"],
};

const param = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("m");
const mascotFor = (look: ProtoLook) => (param && MASCOTS[look].includes(param) ? param : MASCOTS[look][0]);

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

/* ---------------- Notebook: drawn in pen by day, chalk by night ---------------- */

const PEN = "var(--pen, #263a6e)";
const FACE = "#263a6e";
const pen = { stroke: PEN, strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function Crane({ mood }: { mood: Mood }) {
  return (
    <g {...pen}>
      <path d="M58 52 L36 10 L70 58 Z" fill="#ffd6e0" />
      <path d="M62 52 L98 16 L74 60 Z" fill="#ffc2d2" />
      <path d="M100 80 L116 46 L94 72 Z" fill="#fffdf6" />
      <path d="M22 80 L8 48 L16 46 L30 74 Z" fill="#fffdf6" />
      <path d="M8 48 L2 54 L12 52" fill="#ffdf5e" />
      <path d="M18 80 L60 50 L102 80 L60 108 Z" fill="#fffdf6" />
      <path d="M32 86 L88 86 M38 94 L82 94" stroke="#a9c4f5" strokeWidth="1.6" />
      <Face mood={mood} l={48} r={72} y={76} m={88} ink={FACE} eye={5} />
      <path d="M34 84 q5 -3 9 0 M77 84 q5 -3 9 0" stroke="#f28da6" strokeWidth="3.5" fill="none" />
      {mood === "asleep" && <Zz x={90} y={30} ink={PEN} />}
      {mood === "break" && <Cup y={100} rim="#fffdf6" tea="#b7e3a1" stroke={PEN} />}
    </g>
  );
}

function Blot({ mood }: { mood: Mood }) {
  const ink = "#263a6e";
  return (
    <g {...pen}>
      <path d="M60 12 C66 30 100 56 100 80 C100 102 82 114 60 114 C38 114 20 102 20 80 C20 56 54 30 60 12 Z" fill={ink} />
      <circle cx="104" cy="48" r="5" fill={ink} />
      <circle cx="16" cy="58" r="3.5" fill={ink} />
      <circle cx="98" cy="30" r="2.5" fill={ink} />
      <ellipse cx="44" cy="60" rx="5" ry="9" fill="#fff" stroke="none" opacity="0.35" transform="rotate(25 44 60)" />
      <Face mood={mood} l={47} r={73} y={80} m={94} ink="#fffdf6" eye={6} shine={ink} />
      <path d="M32 92 q5 -3 9 0 M79 92 q5 -3 9 0" stroke="#f28da6" strokeWidth="3.5" fill="none" />
      {mood === "asleep" && <Zz x={84} y={14} ink={PEN} />}
      {mood === "break" && <Cup y={100} rim="#fffdf6" tea="#b7e3a1" stroke={PEN} />}
    </g>
  );
}

function Worm({ mood }: { mood: Mood }) {
  return (
    <g {...pen}>
      <path d="M44 100 C44 84 40 76 44 66" fill="none" stroke="#b7e3a1" strokeWidth="18" />
      <path d="M36 101 C36 82 34 74 40 60 M52 101 C52 84 52 76 56 66" fill="none" />
      <circle cx="62" cy="50" r="27" fill="#b7e3a1" />
      <path d="M58 24 q-4 -10 -12 -12 M68 24 q4 -10 12 -12" fill="none" />
      <circle cx="45" cy="11" r="3.5" fill="#ffb3c7" />
      <circle cx="81" cy="11" r="3.5" fill="#ffb3c7" />
      <Face mood={mood} l={52} r={72} y={50} m={62} ink={FACE} eye={4.5} cx={62} />
      <circle cx="52" cy="50" r="9" fill="none" stroke={FACE} strokeWidth="2.4" />
      <circle cx="72" cy="50" r="9" fill="none" stroke={FACE} strokeWidth="2.4" />
      <path d="M61 49 h2" stroke={FACE} strokeWidth="2.4" />
      <path d="M6 116 L12 92 Q36 86 60 96 Q84 86 108 92 L114 116 Q86 108 60 116 Q34 108 6 116 Z" fill="#fffdf6" />
      <path d="M60 96 V116 M20 100 q16 -4 32 2 M68 102 q16 -6 32 -2 M22 107 q14 -3 30 1" fill="none" strokeWidth="1.6" />
      {mood === "asleep" && <Zz x={90} y={30} ink={PEN} />}
      {mood === "break" && <Cup x={30} y={64} rim="#fffdf6" tea="#b7e3a1" stroke={PEN} />}
    </g>
  );
}

function Memo({ mood }: { mood: Mood }) {
  return (
    <g {...pen} transform="rotate(-5 60 64)">
      <path d="M18 20 H102 V86 L84 106 H18 Z" fill="#ffdf5e" />
      <path d="M102 86 L84 88 L84 106 Z" fill="#f2c94c" />
      <path d="M44 14 h32 v14 h-32 Z" fill="rgb(169 196 245 / 0.8)" strokeWidth="0" />
      <Face mood={mood} l={46} r={74} y={58} m={72} ink={FACE} eye={5.5} />
      <path d="M30 70 q5 -3 9 0 M81 70 q5 -3 9 0" stroke="#f28da6" strokeWidth="3.5" fill="none" />
      <path d="M28 92 h30" stroke={FACE} strokeWidth="2" />
      <path d="M26 36 c0 -4 6 -4 6 0 c0 -4 6 -4 6 0 c0 5 -6 8 -6 8 c0 0 -6 -3 -6 -8 Z" fill="#ffb3c7" strokeWidth="2" />
      {mood === "asleep" && <Zz x={90} y={0} ink={PEN} />}
      {mood === "break" && <Cup x={-4} y={84} rim="#fffdf6" tea="#b7e3a1" stroke={PEN} />}
    </g>
  );
}

function Snail({ mood }: { mood: Mood }) {
  return (
    <g {...pen}>
      <path d="M8 108 C8 92 18 80 30 80 L96 86 C108 88 114 98 112 108 Z" fill="#b7e3a1" />
      <circle cx="74" cy="64" r="34" fill="#ffc99a" />
      <path d="M74 64 m-4 0 a4 4 0 1 1 8 0 a9 9 0 1 1 -18 0 a14 14 0 1 1 28 0 a20 20 0 1 1 -40 2" fill="none" strokeWidth="2.6" />
      <path d="M22 82 L16 54 M34 80 L36 52" fill="none" strokeWidth="2.6" />
      <circle cx="16" cy="52" r="7" fill="#fffdf6" />
      <circle cx="36" cy="50" r="7" fill="#fffdf6" />
      {mood === "awake" ? (
        <>
          <circle cx="17" cy="52" r="3" fill={FACE} stroke="none" />
          <circle cx="37" cy="50" r="3" fill={FACE} stroke="none" />
        </>
      ) : (
        <path d={mood === "asleep" ? "M12 52 q4 4 8 0 M32 50 q4 4 8 0" : "M12 54 q4 -5 8 0 M32 52 q4 -5 8 0"} stroke={FACE} strokeWidth="2.4" fill="none" />
      )}
      <path d={mood === "cheer" ? "M20 92 q6 8 12 0 Z" : "M22 92 q4 4 8 0"} fill={mood === "cheer" ? FACE : "none"} stroke={FACE} strokeWidth="2.4" />
      <path d="M12 96 q4 -2 7 0" stroke="#f28da6" strokeWidth="3" fill="none" />
      {mood === "asleep" && <Zz x={90} y={14} ink={PEN} />}
      {mood === "break" && <Cup x={40} y={92} rim="#fffdf6" tea="#b7e3a1" stroke={PEN} />}
    </g>
  );
}

/* ---------------- Riso: two inks that never quite line up ---------------- */

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

function Fish({ mood }: { mood: Mood }) {
  return (
    <>
      <Print d="M88 66 L116 42 L110 66 L116 92 Z" fill={BLUE} under={YELLOW} />
      <Print d="M14 66 C14 40 40 30 62 30 C84 30 98 48 98 66 C98 86 84 102 62 102 C40 102 14 92 14 66 Z" fill={PINK} under={BLUE} />
      <path d="M54 32 C60 22 74 20 82 26 L74 38 Z" fill={BLUE} />
      <path d="M62 80 q8 -6 16 0 M70 70 q8 -6 16 0 M62 60 q8 -6 16 0" stroke={YELLOW} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <circle cx="30" cy="58" r="9" fill={PAPER} />
      <circle cx="50" cy="58" r="9" fill={PAPER} />
      <Face mood={mood} l={30} r={50} y={58} m={76} ink={RISO_INK} eye={4.5} cx={40} shine={PAPER} />
      <circle cx="10" cy="40" r="4" fill="none" stroke={BLUE} strokeWidth="2" />
      <circle cx="4" cy="26" r="2.5" fill="none" stroke={BLUE} strokeWidth="2" />
      {mood === "asleep" && <Zz x={92} y={14} ink={RISO_INK} />}
      {mood === "break" && <Cup x={-8} y={98} rim={PAPER} tea={MINT} />}
    </>
  );
}

function Shroom({ mood }: { mood: Mood }) {
  return (
    <>
      <Print d="M38 58 H82 V100 a14 14 0 0 1 -14 14 H52 a14 14 0 0 1 -14 -14 Z" fill={YELLOW} under={BLUE} />
      <Print d="M10 64 C10 30 34 14 60 14 C86 14 110 30 110 64 C110 70 104 72 96 70 C72 64 48 64 24 70 C16 72 10 70 10 64 Z" fill={PINK} under={BLUE} />
      <circle cx="36" cy="40" r="7" fill={PAPER} />
      <circle cx="62" cy="28" r="5" fill={PAPER} />
      <circle cx="86" cy="44" r="8" fill={PAPER} />
      <Face mood={mood} l={50} r={70} y={84} m={96} ink={RISO_INK} eye={4.5} shine={PAPER} />
      <path d="M42 94 q4 -2 7 0 M71 94 q4 -2 7 0" stroke={PINK} strokeWidth="3" fill="none" strokeLinecap="round" />
      {mood === "asleep" && <Zz x={94} y={4} ink={RISO_INK} />}
      {mood === "break" && <Cup x={30} y={92} rim={PAPER} tea={MINT} />}
    </>
  );
}

function Ghost({ mood }: { mood: Mood }) {
  return (
    <>
      <Print d="M20 60 C20 32 38 16 60 16 C82 16 100 32 100 60 V108 Q92 98 84 108 Q76 118 68 108 Q60 98 52 108 Q44 118 36 108 Q28 98 20 108 Z" fill={BLUE} under={PINK} />
      <path d="M100 66 C110 62 114 54 112 46" stroke={BLUE} strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M20 66 C10 62 6 54 8 46" stroke={BLUE} strokeWidth="8" strokeLinecap="round" fill="none" />
      <circle cx="47" cy="56" r="10" fill={PAPER} />
      <circle cx="73" cy="56" r="10" fill={PAPER} />
      <Face mood={mood} l={47} r={73} y={56} m={76} ink={RISO_INK} eye={5} shine={PAPER} />
      <ellipse cx="38" cy="72" rx="6" ry="3.5" fill={PINK} />
      <ellipse cx="82" cy="72" rx="6" ry="3.5" fill={PINK} />
      <path d="M104 18 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z" fill={YELLOW} />
      {mood === "asleep" && <Zz x={86} y={10} ink={RISO_INK} />}
      {mood === "break" && <Cup y={90} rim={PAPER} tea={MINT} />}
    </>
  );
}

function Cactus({ mood }: { mood: Mood }) {
  return (
    <>
      <Print d="M24 52 a10 10 0 0 1 20 0 V64 H40 V52 Z" fill={MINT} under={BLUE} />
      <Print d="M76 44 a10 10 0 0 1 20 0 V70 H80 V44 Z" fill={MINT} under={BLUE} />
      <Print d="M38 40 C38 22 48 14 60 14 C72 14 82 22 82 40 V96 H38 Z" fill={MINT} under={BLUE} />
      <path d="M26 62 H40 M80 66 H94" stroke={MINT} strokeWidth="12" strokeLinecap="round" />
      <Print d="M28 90 H92 L86 118 H34 Z" fill={PINK} under={BLUE} />
      <path d="M50 8 c4 -8 16 -8 20 0 c-4 6 -16 6 -20 0 Z" fill={YELLOW} />
      <circle cx="60" cy="8" r="3" fill={PINK} />
      <path d="M46 30 l-4 -2 M74 30 l4 -2 M44 82 l-4 1 M76 82 l4 1" stroke={RISO_INK} strokeWidth="2" strokeLinecap="round" />
      <Face mood={mood} l={50} r={70} y={52} m={66} ink={RISO_INK} eye={4.5} />
      <path d="M41 62 q4 -2 7 0 M72 62 q4 -2 7 0" stroke={PINK} strokeWidth="3" fill="none" strokeLinecap="round" />
      {mood === "asleep" && <Zz x={96} y={8} ink={RISO_INK} />}
      {mood === "break" && <Cup x={0} y={98} rim={PAPER} tea={MINT} />}
    </>
  );
}

function Whale({ mood }: { mood: Mood }) {
  return (
    <>
      <path d="M58 30 C54 18 46 14 40 16 M62 30 C66 18 74 14 80 16 M60 30 V12" stroke={PINK} strokeWidth="5" strokeLinecap="round" fill="none" />
      <Print d="M96 74 L116 56 C118 66 114 76 108 80 C114 84 118 92 116 100 Z" fill={BLUE} />
      <Print d="M8 76 C8 50 30 34 58 34 C88 34 104 54 104 76 C104 98 84 110 56 110 C28 110 8 98 8 76 Z" fill={BLUE} />
      <path d="M16 88 C30 104 80 106 98 90 C90 104 76 110 56 110 C34 110 20 102 16 88 Z" fill={YELLOW} />
      <path d="M36 98 v8 M48 101 v8 M60 102 v8 M72 101 v8" stroke={BLUE} strokeWidth="2" />
      <Face mood={mood} l={40} r={66} y={68} m={82} ink={PAPER} eye={5} cx={53} shine={BLUE} />
      <ellipse cx="30" cy="80" rx="6" ry="3.5" fill={PINK} />
      <ellipse cx="76" cy="80" rx="6" ry="3.5" fill={PINK} />
      {mood === "asleep" && <Zz x={94} y={22} ink={RISO_INK} />}
      {mood === "break" && <Cup x={-6} y={98} rim={PAPER} tea={MINT} />}
    </>
  );
}

/* ---------------- Luna: moonstone by day, moonlit night ---------------- */

const LUNA_INK = "#262848";
const STAR = "M0 -6 L1.6 -1.6 6 0 1.6 1.6 0 6 -1.6 1.6 -6 0 -1.6 -1.6 Z";

function Rabbit({ mood }: { mood: Mood }) {
  return (
    <>
      <path d="M84 36 A30 30 0 1 1 96 92 A24 24 0 1 0 84 36 Z" fill="#f1cf7d" opacity="0.9" />
      <ellipse cx="44" cy="30" rx="10" ry="26" fill="#fbf8f2" stroke="#d6d1e6" strokeWidth="2.5" transform="rotate(-12 44 30)" />
      <ellipse cx="74" cy="30" rx="10" ry="26" fill="#fbf8f2" stroke="#d6d1e6" strokeWidth="2.5" transform="rotate(14 74 30)" />
      <ellipse cx="44" cy="32" rx="5" ry="18" fill="#f2c4d6" transform="rotate(-12 44 32)" />
      <ellipse cx="74" cy="32" rx="5" ry="18" fill="#f2c4d6" transform="rotate(14 74 32)" />
      <ellipse cx="58" cy="78" rx="40" ry="34" fill="#fbf8f2" stroke="#d6d1e6" strokeWidth="2.5" />
      <ellipse cx="58" cy="100" rx="26" ry="10" fill="#ece8f4" />
      <Face mood={mood} l={44} r={72} y={74} m={90} ink={LUNA_INK} eye={5} cx={58} />
      <path d="M55 84 h6 l-3 3 Z" fill="#e58fa9" />
      <ellipse cx="32" cy="86" rx="7" ry="4" fill="#f2c4d6" />
      <ellipse cx="84" cy="86" rx="7" ry="4" fill="#f2c4d6" />
      {mood === "asleep" && (
        <g fill="#f1cf7d">
          <path d={STAR} transform="translate(100 20)" />
          <path d={STAR} transform="translate(110 38) scale(0.6)" />
        </g>
      )}
      {mood === "break" && <Cup x={-2} y={98} rim="#fff" tea="#b6dccb" />}
    </>
  );
}

function Moth({ mood }: { mood: Mood }) {
  return (
    <>
      <path d="M56 50 C40 18 6 14 8 40 C10 60 34 66 54 62 Z" fill="#c9ecd6" />
      <path d="M64 50 C80 18 114 14 112 40 C110 60 86 66 66 62 Z" fill="#c9ecd6" />
      <path d="M54 66 C36 74 26 100 34 112 C42 118 52 96 56 76 Z" fill="#b2e0c4" />
      <path d="M66 66 C84 74 94 100 86 112 C78 118 68 96 64 76 Z" fill="#b2e0c4" />
      <circle cx="28" cy="40" r="7" fill="#f1cf7d" />
      <circle cx="92" cy="40" r="7" fill="#f1cf7d" />
      <circle cx="28" cy="40" r="3" fill="#b3b8f0" />
      <circle cx="92" cy="40" r="3" fill="#b3b8f0" />
      <path d="M54 34 C48 20 42 14 34 12 M66 34 C72 20 78 14 86 12" stroke="#c9a24a" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M38 12 l-3 6 M44 16 l-4 5 M82 12 l3 6 M76 16 l4 5" stroke="#c9a24a" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="60" cy="68" rx="20" ry="34" fill="#fbf8f2" stroke="#d6d1e6" strokeWidth="2" />
      <path d="M44 84 q16 6 32 0 M46 94 q14 5 28 0" stroke="#ece8f4" strokeWidth="3" fill="none" />
      <Face mood={mood} l={52} r={68} y={58} m={70} ink={LUNA_INK} eye={4} />
      <ellipse cx="46" cy="66" rx="4.5" ry="3" fill="#f2c4d6" />
      <ellipse cx="74" cy="66" rx="4.5" ry="3" fill="#f2c4d6" />
      {mood === "asleep" && <path d={STAR} fill="#f1cf7d" transform="translate(106 72)" />}
      {mood === "break" && <Cup x={-2} y={100} rim="#fff" tea="#b6dccb" />}
    </>
  );
}

function Owl({ mood }: { mood: Mood }) {
  return (
    <>
      <path d="M22 36 L30 14 L44 30 Z M98 36 L90 14 L76 30 Z" fill="#8f88c9" />
      <path d="M16 70 C16 36 36 24 60 24 C84 24 104 36 104 70 C104 98 86 114 60 114 C34 114 16 98 16 70 Z" fill="#a39cd8" />
      <path d="M38 84 C38 72 48 66 60 66 C72 66 82 72 82 84 C82 100 72 110 60 110 C48 110 38 100 38 84 Z" fill="#ece8f4" />
      <path d="M50 86 q4 4 8 0 M62 86 q4 4 8 0 M56 96 q4 4 8 0" stroke="#c9c3ea" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="44" cy="54" r="15" fill="#fbf8f2" />
      <circle cx="76" cy="54" r="15" fill="#fbf8f2" />
      <Face mood={mood} l={44} r={76} y={54} m={200} ink={LUNA_INK} eye={7} />
      <path d="M55 64 L65 64 L60 72 Z" fill="#f1cf7d" />
      <path d="M92 86 A10 10 0 1 1 92 104 A8 8 0 1 0 92 86 Z" fill="#f1cf7d" />
      {mood === "cheer" && <path d="M54 76 Q60 82 66 76" stroke={LUNA_INK} strokeWidth="3" fill="none" strokeLinecap="round" />}
      {mood === "asleep" && <Zz x={96} y={12} ink="var(--text)" />}
      {mood === "break" && <Cup x={-2} y={98} rim="#fff" tea="#b6dccb" />}
    </>
  );
}

const DRAW: Record<string, (p: { mood: Mood }) => React.ReactElement> = {
  crane: Crane, blot: Blot, worm: Worm, memo: Memo, snail: Snail,
  fish: Fish, shroom: Shroom, ghost: Ghost, cactus: Cactus, whale: Whale,
  rabbit: Rabbit, moth: Moth, owl: Owl,
  // Riso's pick: the mushroom by day and the ghost by night; CSS shows one.
  daynight: ({ mood }) => (
    <>
      <g className="by-day"><Shroom mood={mood} /></g>
      <g className="by-night"><Ghost mood={mood} /></g>
    </>
  ),
};

export function ProtoMascot({ look, mood, size, a11y, as }: { look: ProtoLook; mood: Mood; size: number; a11y: object; as?: string }) {
  const Draw = DRAW[as ?? mascotFor(look)];
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="pip" overflow="visible" {...a11y}>
      <Draw mood={mood} />
    </svg>
  );
}

/** A moon `lit` part full (0..1), lit from the right, as a path in a 24 x 24 box. */
function phase(lit: number, r = 9, cx = 12, cy = 12) {
  const rx = Math.abs(1 - 2 * lit) * r;
  const sweep = lit > 0.5 ? 1 : 0;
  return `M${cx} ${cy - r} A${r} ${r} 0 0 1 ${cx} ${cy + r} A${rx} ${r} 0 0 ${sweep} ${cx} ${cy - r} Z`;
}

/** One mark per session of the daily goal. */
export function ProtoGoalMark({ look, done, index, total }: { look: ProtoLook; done: boolean; index: number; total: number }) {
  const off = "var(--seed)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24">
      {look === "notebook" && (
        <path
          d="M12 2.5 l2.6 6 6.6 .7 -5 4.4 1.5 6.5 -5.7 -3.4 -5.8 3.4 1.6 -6.5 -5 -4.4 6.6 -.7 Z"
          fill={done ? "#ffdf5e" : "none"}
          stroke={done ? "var(--pen)" : off}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeDasharray={done ? undefined : "3 2.5"}
        />
      )}
      {look === "riso" && (
        <>
          <circle cx="13.5" cy="13.5" r="8" fill={done ? "#ff6fa8" : "none"} />
          <circle cx="11" cy="11" r="8" fill={done ? "#4a63ff" : "none"} stroke={done ? "none" : off} strokeWidth="2" />
        </>
      )}
      {look === "luna" && (
        // The goal grows from a thin crescent to a full moon.
        <>
          <circle cx="12" cy="12" r="9" fill={done ? "var(--moon-dark)" : "none"} stroke={done ? "none" : off} strokeWidth="1.6" />
          {done && <path d={phase(Math.min(1, 0.22 + (0.78 * index) / Math.max(1, total - 1)))} fill="#f1cf7d" />}
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
const WOBBLE = ring((a) => 169 + 4 * Math.sin(a * 3 + 0.4) + 2.5 * Math.sin(a * 7 + 1));
const WOBBLE2 = ring((a) => 171 + 3 * Math.sin(a * 4 + 2) + 2.5 * Math.sin(a * 6));

export function ProtoDialBack({ look }: { look: ProtoLook }) {
  switch (look) {
    case "notebook":
      return (
        <>
          <path d={WOBBLE} className="dial-petals" />
          <path d={WOBBLE} fill="none" stroke="var(--pen)" strokeWidth="2.6" />
          <path d={WOBBLE2} fill="none" stroke="var(--pen)" strokeWidth="1.4" opacity="0.6" />
        </>
      );
    case "riso":
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
    case "luna":
      // A lunar month around the dial: new moon at the top, full at the bottom.
      return (
        <>
          <circle cx={C} cy={C} r="176" className="dial-petals" />
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            const x = C + 164 * Math.sin(a) - 12;
            const y = C - 164 * Math.cos(a) - 12;
            const lit = i <= 8 ? i / 8 : (16 - i) / 8;
            const flip = i > 8;
            return (
              <g key={i} transform={`translate(${x} ${y})${flip ? " translate(24 0) scale(-1 1)" : ""}`}>
                <circle cx="12" cy="12" r="6.5" fill="var(--moon-dark)" />
                {lit > 0 && <path d={phase(lit, 6.5)} fill="var(--moon-lit)" />}
              </g>
            );
          })}
        </>
      );
  }
}

export function ProtoDialOver(_: { look: ProtoLook }) {
  return null;
}

export function ProtoKnob({ look, x, y, lip }: { look: ProtoLook; x: number; y: number; lip: string }) {
  switch (look) {
    case "notebook":
      return (
        <>
          <circle cx={x} cy={y} r="16" className="dial-knob" stroke="var(--pen)" strokeWidth="2.5" />
          <path d={`M${x - 6} ${y + 1} l4 4 l8 -9`} stroke="var(--pen)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "riso":
      return (
        <>
          <circle cx={x + 4} cy={y + 3} r="16" fill="var(--apricot-lip)" />
          <circle cx={x} cy={y} r="16" className="dial-knob" stroke="var(--text)" strokeWidth="3" />
          <circle cx={x} cy={y} r="6" fill="var(--apricot)" />
        </>
      );
    case "luna":
      // A little crescent moon.
      return (
        <>
          <circle cx={x} cy={y} r="18" className="dial-knob" />
          <circle cx={x} cy={y} r="10.5" fill={lip} />
          <circle cx={x + 5} cy={y - 3.5} r="9" className="dial-knob" />
        </>
      );
  }
}
