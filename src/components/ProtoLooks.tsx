// Prototype mascots, goal marks and dial dressings for the new-look mockups.

import type { Look } from "../look";

export const PROTO_LOOKS = ["tide", "pixel", "notebook", "orbit", "riso"] as const;
export type ProtoLook = (typeof PROTO_LOOKS)[number];
export const isProto = (l: Look): l is ProtoLook => (PROTO_LOOKS as readonly string[]).includes(l);

type Mood = "awake" | "asleep" | "break" | "cheer";

function Face({ mood, l, r, y, m, ink, eye = 6 }: { mood: Mood; l: number; r: number; y: number; m: number; ink: string; eye?: number }) {
  return (
    <>
      {mood === "awake" && (
        <>
          <circle cx={l} cy={y} r={eye} fill={ink} />
          <circle cx={r} cy={y} r={eye} fill={ink} />
          <circle cx={l + 2} cy={y - 2} r={eye / 3} fill="#fff" />
          <circle cx={r + 2} cy={y - 2} r={eye / 3} fill="#fff" />
          <path d={`M${60 - 5} ${m} q5 5 10 0`} stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      )}
      {mood === "asleep" && (
        <>
          <path d={`M${l - 6} ${y} q6 6 12 0 M${r - 6} ${y} q6 6 12 0`} stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none" />
          <ellipse cx="60" cy={m + 2} rx="3" ry="2.2" fill={ink} />
        </>
      )}
      {(mood === "break" || mood === "cheer") && (
        <path d={`M${l - 6} ${y + 2} q6 -7 12 0 M${r - 6} ${y + 2} q6 -7 12 0`} stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none" />
      )}
      {mood === "cheer" && <path d={`M52 ${m - 2} Q60 ${m + 10} 68 ${m - 2} Z`} fill={ink} />}
    </>
  );
}

function Cup({ y = 96, rim = "#fff", tea = "#9fcba4" }: { y?: number; rim?: string; tea?: string }) {
  return (
    <>
      <path d={`M44 ${y} h30 v9 a10 10 0 0 1 -10 10 h-10 a10 10 0 0 1 -10 -10 Z`} fill={rim} />
      <path d={`M74 ${y + 3} h4 a5 5 0 0 1 0 10 h-4`} stroke={rim} strokeWidth="4" fill="none" />
      <path d={`M52 ${y + 5} h14`} stroke={tea} strokeWidth="4" strokeLinecap="round" />
    </>
  );
}

// Tide: Pebble the sea otter.
function Otter({ mood }: { mood: Mood }) {
  const ink = "#3b2a20";
  return (
    <>
      <circle cx="26" cy="44" r="12" fill="#a4785a" />
      <circle cx="94" cy="44" r="12" fill="#a4785a" />
      <circle cx="26" cy="44" r="6" fill="#7d573f" />
      <circle cx="94" cy="44" r="6" fill="#7d573f" />
      <ellipse cx="60" cy="70" rx="48" ry="42" fill="#b98a66" />
      <ellipse cx="60" cy="86" rx="32" ry="22" fill="#f1dcc4" />
      <ellipse cx="60" cy="52" rx="20" ry="9" fill="#c99c78" />
      <Face mood={mood} l={42} r={78} y={68} m={90} ink={ink} />
      <ellipse cx="60" cy="80" rx="7" ry="5" fill={ink} />
      {[44, 76].map((x) => (
        <g key={x} fill="#a4785a">
          <circle cx={x + (x < 60 ? -4 : 4)} cy="86" r="1.4" />
          <circle cx={x + (x < 60 ? -8 : 8)} cy="90" r="1.4" />
          <circle cx={x + (x < 60 ? 0 : 0)} cy="91" r="1.4" />
        </g>
      ))}
      <ellipse cx="30" cy="84" rx="7" ry="4" fill="#f3a5a0" opacity="0.8" />
      <ellipse cx="90" cy="84" rx="7" ry="4" fill="#f3a5a0" opacity="0.8" />
      {mood === "break" ? (
        <Cup y={98} rim="#fffaf1" tea="#8fc9d9" />
      ) : (
        // Otters hold a favourite pebble.
        <>
          <ellipse cx="60" cy="108" rx="14" ry="8" fill="#8fc9d9" />
          <ellipse cx="56" cy="105" rx="5" ry="2" fill="#fff" opacity="0.6" />
          <ellipse cx="44" cy="106" rx="8" ry="6" fill="#a4785a" />
          <ellipse cx="76" cy="106" rx="8" ry="6" fill="#a4785a" />
        </>
      )}
    </>
  );
}

// Pixel: Bit the frog, drawn on a 14 x 12 grid.
const FROG: Record<Mood, string[]> = {
  awake: [
    "..ooo....ooo..",
    ".owwwo..owwwo.",
    ".owkwo..owkwo.",
    ".owwwoooowwwo.",
    "oggggggggggggo",
    "ogppggggggppgo",
    "ogggoggggogggo",
    "oggggooooggggo",
    "ogllllllllllgo",
    "oggllllllllggo",
    ".oggggggggggo.",
    "..oooooooooo..",
  ],
  asleep: [
    "..............",
    "..ooo....ooo..",
    ".ogggo..ogggo.",
    ".ooooooooooooo".slice(0, 14),
    "oggggggggggggo",
    "ogppggggggppgo",
    "oggggggggggggo",
    "ogggggoogggggo",
    "ogllllllllllgo",
    "oggllllllllggo",
    ".oggggggggggo.",
    "..oooooooooo..",
  ],
  break: [
    "..ooo....ooo..",
    ".ogggo..ogggo.",
    ".owgwo..owgwo.",
    ".ogggoooogggo.",
    "oggggggggggggo",
    "ogppggggggppgo",
    "ogggoggggogggo",
    "oggggooooggggo",
    "ogllllllllllgo",
    "oggllllllllggo",
    ".oggggggggggo.",
    "..oooooooooo..",
  ],
  cheer: [],
};
FROG.cheer = FROG.break;
const FROG_INK: Record<string, string> = { o: "#233016", g: "#7cc25a", w: "#ffffff", k: "#233016", p: "#f29ac0", l: "#c9ec9a" };

function Frog({ mood }: { mood: Mood }) {
  const cell = 8;
  const rects: React.ReactNode[] = [];
  FROG[mood].forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (FROG_INK[ch]) rects.push(<rect key={`${x}-${y}`} x={4 + x * cell} y={14 + y * cell} width={cell + 0.3} height={cell + 0.3} fill={FROG_INK[ch]} />);
    }),
  );
  return (
    <g shapeRendering="crispEdges">
      {rects}
      {mood === "asleep" && (
        <g fill="var(--text)">
          <rect x="100" y="2" width="12" height="3" />
          <rect x="106" y="5" width="3" height="3" />
          <rect x="103" y="8" width="3" height="3" />
          <rect x="100" y="11" width="12" height="3" />
        </g>
      )}
      {mood === "break" && (
        <g>
          <rect x="44" y="100" width="28" height="18" fill="#f4f7e6" stroke="#233016" strokeWidth="3" />
          <rect x="72" y="104" width="7" height="9" fill="none" stroke="#233016" strokeWidth="3" />
          <rect x="49" y="104" width="18" height="4" fill="#9ad67a" />
        </g>
      )}
    </g>
  );
}

// Notebook: Pom the doodled hedgehog, in pen by day and chalk by night.
function spikes() {
  const pts: string[] = [];
  const n = 15;
  for (let i = 0; i <= n * 2; i++) {
    const a = Math.PI * (1.05 + (i / (n * 2)) * 0.9) - 0.05 * Math.PI;
    const rr = i % 2 ? 54 : 40;
    pts.push(`${(60 + rr * Math.cos(a)).toFixed(1)} ${(80 + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}
const SPIKES = spikes();

function Hedgehog({ mood }: { mood: Mood }) {
  const pen = "var(--pen, #263a6e)";
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d={`${SPIKES} Z`} fill="#c99a6e" stroke={pen} strokeWidth="3" />
      <path d="M18 86 C18 58 40 50 60 50 C80 50 102 58 102 86 C102 104 84 112 60 112 C36 112 18 104 18 86 Z" fill="#fbe6cc" stroke={pen} strokeWidth="3" />
      <path d="M30 60 q6 -6 12 -2 M78 58 q6 -4 12 2" stroke={pen} strokeWidth="2" fill="none" />
      <Face mood={mood} l={46} r={74} y={80} m={98} ink={pen} eye={5.5} />
      <circle cx="60" cy="90" r="4.5" fill={pen} />
      <path d="M28 94 q6 -3 10 0 M82 94 q6 -3 10 0" stroke="#f28da6" strokeWidth="4" fill="none" />
      {mood === "break" && <path d="M98 30 l4 -10 M106 36 l10 -4 M104 26 l7 -7" stroke={pen} strokeWidth="2.5" />}
      {mood === "asleep" && <path d="M96 22 h10 l-10 10 h10" stroke={pen} strokeWidth="2.5" fill="none" />}
    </g>
  );
}

// Orbit: Luna the little moon, who wears a nightcap while you focus.
function Moon({ mood }: { mood: Mood }) {
  const ink = "#1d2150";
  return (
    <>
      <circle cx="60" cy="70" r="44" fill="#fff0c4" />
      <circle cx="38" cy="50" r="8" fill="#f6dd9c" />
      <circle cx="84" cy="92" r="6" fill="#f6dd9c" />
      <circle cx="88" cy="56" r="4" fill="#f6dd9c" />
      <Face mood={mood} l={46} r={74} y={72} m={88} ink={ink} />
      <ellipse cx="34" cy="84" rx="7" ry="4" fill="#ffa6cb" opacity="0.8" />
      <ellipse cx="86" cy="84" rx="7" ry="4" fill="#ffa6cb" opacity="0.8" />
      {mood === "asleep" && (
        <>
          <path d="M22 44 Q52 14 92 36 Q98 26 104 20 Q72 2 34 22 Z" fill="#a3acff" />
          <path d="M20 46 Q56 22 94 40" stroke="#fff" strokeWidth="7" strokeLinecap="round" fill="none" />
          <circle cx="106" cy="18" r="7" fill="#fff" />
        </>
      )}
      {mood === "break" && <Cup y={100} rim="#fff" tea="#93e2cc" />}
      {mood !== "asleep" && (
        <path d="M100 18 l2.5 6.5 6.5 2.5 -6.5 2.5 -2.5 6.5 -2.5 -6.5 -6.5 -2.5 6.5 -2.5 Z" fill="#ffd873" />
      )}
    </>
  );
}

// Riso: Bop the bird, printed in two inks that never quite line up.
function Bird({ mood }: { mood: Mood }) {
  const blue = "#4a63ff";
  const pink = "#ff6fa8";
  const ink = "#1d2a78";
  return (
    <>
      <g>
        <circle cx="65" cy="74" r="42" fill={pink} />
        <circle cx="60" cy="70" r="42" fill={blue} opacity="0.92" />
        <path d="M60 28 q-6 -14 4 -22 M60 28 q8 -12 20 -10" stroke={blue} strokeWidth="5" strokeLinecap="round" fill="none" />
        <circle cx="64" cy="90" r="22" fill="#ffd23f" opacity="0.95" />
      </g>
      <circle cx="44" cy="64" r="10" fill="#fbf8f0" />
      <circle cx="76" cy="64" r="10" fill="#fbf8f0" />
      {mood === "awake" && (
        <>
          <circle cx="46" cy="65" r="5" fill={ink} />
          <circle cx="78" cy="65" r="5" fill={ink} />
        </>
      )}
      {mood !== "awake" && (
        <path d={mood === "asleep" ? "M38 64 q6 6 12 0 M70 64 q6 6 12 0" : "M38 66 q6 -7 12 0 M70 66 q6 -7 12 0"} stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none" />
      )}
      <path d="M54 76 L66 76 L60 86 Z" fill={pink} />
      <path d="M52 74 L64 74 L58 84 Z" fill="#ff9a3d" opacity="0.9" />
      {mood === "break" && <Cup y={98} rim="#fbf8f0" tea="#4fd1a1" />}
    </>
  );
}

export function ProtoMascot({ look, mood, size, a11y }: { look: ProtoLook; mood: Mood; size: number; a11y: object }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="pip" {...a11y}>
      {look === "tide" && <Otter mood={mood} />}
      {look === "pixel" && <Frog mood={mood} />}
      {look === "notebook" && <Hedgehog mood={mood} />}
      {look === "orbit" && <Moon mood={mood} />}
      {look === "riso" && <Bird mood={mood} />}
    </svg>
  );
}

/** One mark per session of the daily goal. */
export function ProtoGoalMark({ look, done }: { look: ProtoLook; done: boolean }) {
  const off = "var(--seed)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24">
      {look === "tide" && (
        <g fill={done ? "var(--apricot)" : off}>
          <path d="M12 21 L3 9 Q12 0 21 9 Z" />
          <path d="M12 21 L8 7 M12 21 V5 M12 21 L16 7" stroke={done ? "var(--apricot-lip)" : "var(--surface)"} strokeWidth="1.3" />
          <rect x="9" y="19" width="6" height="3" rx="1" />
        </g>
      )}
      {look === "pixel" && (
        <path
          shapeRendering="crispEdges"
          d="M3 6h6v3h6V6h6v8h-3v3h-3v3h-3v-3H9v-3H6v-3H3Z"
          fill={done ? "#f0807a" : "none"}
          stroke={done ? "var(--hard)" : off}
          strokeWidth="2"
        />
      )}
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
      {look === "orbit" && (
        <path d="M12 1.5 l2.6 7.9 7.9 2.6 -7.9 2.6 -2.6 7.9 -2.6 -7.9 -7.9 -2.6 7.9 -2.6 Z" fill={done ? "#ffd873" : off} />
      )}
      {look === "riso" && (
        <>
          <circle cx="13.5" cy="13.5" r="8" fill={done ? "#ff6fa8" : "none"} opacity="0.8" />
          <circle cx="11" cy="11" r="8" fill={done ? "#4a63ff" : "none"} stroke={done ? "none" : off} strokeWidth="2" />
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
const WAVE = ring((a) => 170 + 6 * Math.sin(a * 22));
const WOBBLE = ring((a) => 169 + 4 * Math.sin(a * 3 + 0.4) + 2.5 * Math.sin(a * 7 + 1));
const WOBBLE2 = ring((a) => 171 + 3 * Math.sin(a * 4 + 2) + 2.5 * Math.sin(a * 6));

function pixelCircle(r: number, step: number) {
  // A staircase circle: each row of the grid is as wide as the circle there.
  const rows: [number, number][] = [];
  for (let y = -r; y < r; y += step) {
    const mid = y + step / 2;
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - mid * mid)) / step) * step;
    rows.push([y, half]);
  }
  let right = "";
  let left = "";
  rows.forEach(([y, h]) => {
    right += `L${C + h} ${C + y} L${C + h} ${C + y + step} `;
    left = `L${C - h} ${C + y + step} L${C - h} ${C + y} ` + left;
  });
  return `M${C} ${C - r} ${right}${left}Z`;
}
const PIXEL = pixelCircle(176, 12);

export function ProtoDialBack({ look }: { look: ProtoLook }) {
  switch (look) {
    case "tide":
      return (
        <>
          <path d={WAVE} className="dial-petals" />
          <circle cx={C} cy={C} r="160" fill="none" stroke="var(--sticker)" strokeWidth="3" strokeDasharray="0.1 14" strokeLinecap="round" opacity="0.9" />
        </>
      );
    case "pixel":
      return <path d={PIXEL} className="dial-petals" stroke="var(--hard)" strokeWidth="3" shapeRendering="crispEdges" />;
    case "notebook":
      return (
        <>
          <path d={WOBBLE} className="dial-petals" />
          <path d={WOBBLE} fill="none" stroke="var(--pen)" strokeWidth="2.6" />
          <path d={WOBBLE2} fill="none" stroke="var(--pen)" strokeWidth="1.4" opacity="0.6" />
        </>
      );
    case "orbit":
      return (
        <>
          <defs>
            <radialGradient id="orbit-glow">
              <stop offset="0.7" stopColor="var(--petal)" />
              <stop offset="1" stopColor="var(--petal)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx={C} cy={C} r="180" fill="url(#orbit-glow)" />
          <circle cx={C} cy={C} r="166" fill="none" stroke="var(--muted)" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="2 9" />
          <circle cx={C + 166 * Math.sin(4.1)} cy={C - 166 * Math.cos(4.1)} r="9" fill="var(--peri)" />
          <circle cx={C + 166 * Math.sin(5.3)} cy={C - 166 * Math.cos(5.3)} r="5" fill="var(--bubblegum)" />
          <circle cx={C + 166 * Math.sin(2.3)} cy={C - 166 * Math.cos(2.3)} r="6" fill="var(--matcha)" />
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
  }
}

/** Drawn over the ring: Pixel cuts it into blocks. */
export function ProtoDialOver({ look }: { look: ProtoLook }) {
  if (look !== "pixel") return null;
  const circ = 2 * Math.PI * 140;
  const seg = circ / 48;
  return <circle cx={C} cy={C} r="140" fill="none" stroke="var(--petal)" strokeWidth="26" strokeDasharray={`3.5 ${(seg - 3.5).toFixed(2)}`} transform={`rotate(-90 ${C} ${C})`} />;
}

export function ProtoKnob({ look, x, y, lip }: { look: ProtoLook; x: number; y: number; lip: string }) {
  switch (look) {
    case "tide":
      return (
        <>
          <circle cx={x} cy={y} r="17" className="dial-knob" />
          <circle cx={x} cy={y} r="10" fill={lip} />
          <circle cx={x - 3} cy={y - 3} r="3" fill="#fff" opacity="0.8" />
        </>
      );
    case "pixel":
      return (
        <g shapeRendering="crispEdges">
          <rect x={x - 16} y={y - 16} width="32" height="32" fill="var(--surface)" stroke="var(--hard)" strokeWidth="3" />
          <rect x={x - 7} y={y - 7} width="14" height="14" fill={lip} />
        </g>
      );
    case "notebook":
      return (
        <>
          <circle cx={x} cy={y} r="16" className="dial-knob" stroke="var(--pen)" strokeWidth="2.5" />
          <path d={`M${x - 6} ${y + 1} l4 4 l8 -9`} stroke="var(--pen)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "orbit":
      return (
        <>
          <circle cx={x} cy={y} r="19" className="dial-knob" />
          <circle cx={x} cy={y} r="9" fill={lip} />
          <ellipse cx={x} cy={y} rx="17" ry="5" fill="none" stroke={lip} strokeWidth="2.5" transform={`rotate(-22 ${x} ${y})`} />
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
  }
}
