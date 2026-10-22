// Pip, Stint's mascot: a soft blob with a sprout on top.

import { t } from "../i18n";
import { look, type Look } from "../look";
import type { Heat } from "../timer";
import { isProto, ProtoMascot, ProtoGoalMark } from "./ProtoLooks";

export type Mood = "awake" | "asleep" | "break" | "cheer";

const BODY = "M60 24 C92 24 108 48 108 74 C108 100 88 112 60 112 C32 112 12 100 12 74 C12 48 28 24 60 24 Z";
const INK = "#2a2340";

// Leaves added to the sprout, in the order they grow.
const LEAVES = [
  { cx: 50, cy: 12, rx: 8, ry: 4, angle: 25 },
  { cx: 69, cy: 20, rx: 7, ry: 3.5, angle: -15 },
];

function Sprout({ leaves }: { leaves: number }) {
  return (
    <>
      <path d="M60 24 C60 16 60 12 60 8" stroke="#86b374" strokeWidth="5" strokeLinecap="round" fill="none" />
      <ellipse cx="70" cy="11" rx="10" ry="5" fill="#b9d9a9" transform="rotate(-25 70 11)" />
      {LEAVES.slice(0, leaves).map((l) => (
        <ellipse
          key={l.cx}
          cx={l.cx}
          cy={l.cy}
          rx={l.rx}
          ry={l.ry}
          fill="#b9d9a9"
          transform={`rotate(${l.angle} ${l.cx} ${l.cy})`}
        />
      ))}
    </>
  );
}


const isMochi = () => look() === "mochi";

const STEAM_LINE = "#cfc9e4";
const FLUSH = "#f29bb4";
const FLUSH_LINE = "#d9708f";

function Steam({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M-7 4 a4 4 0 0 1 2 -7.5 a5 5 0 0 1 9.5 0 a4 4 0 0 1 2.5 7.5 Z"
      fill="#fff"
      stroke={STEAM_LINE}
      strokeWidth="1.2"
    />
  );
}

/**
 * The overheating face after a long focus: eyes open, rosy cheeks and a puff
 * of steam after one hour; squeezed eyes, wobbly mouth and lots of steam after
 * two. `l`/`r` are the eye centres, `y` their height and `m` the mouth's.
 */
function HotFace({ heat, l, r, y, m, ink }: { heat: Heat; l: number; r: number; y: number; m: number; ink: string }) {
  const cheek = y + 13;
  return (
    <>
      {heat === 1 ? (
        <>
          {[l, r].map((x) => (
            <g key={x}>
              <circle cx={x} cy={y} r="5.5" fill={ink} />
              <circle cx={x + 1.8} cy={y - 2} r="2" fill="#fff" />
            </g>
          ))}
          <path d={`M55 ${m} q5 3 10 0`} stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
          <Steam x={88} y={30} />
        </>
      ) : (
        <>
          <path
            d={`M${l - 6} ${y - 5} l9 5 l-9 5 M${r + 6} ${y - 5} l-9 5 l9 5`}
            stroke={ink}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path d={`M51 ${m + 2} q3 -4 6 0 q3 4 6 0 q3 -4 6 0`} stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />
          <Steam x={30} y={28} s={1.1} />
          <Steam x={90} y={26} s={1.2} />
          <Steam x={102} y={44} s={0.7} />
        </>
      )}
      {[l - 11, r + 11].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={cheek} rx={heat === 1 ? 9 : 12} ry={heat === 1 ? 5 : 6.5} fill={FLUSH} opacity={heat === 1 ? 0.75 : 0.9} />
          {heat === 2 && (
            <path d={`M${x - 5} ${cheek + 2} l3 -4 M${x - 1} ${cheek + 2} l3 -4 M${x + 3} ${cheek + 2} l3 -4`} stroke={FLUSH_LINE} strokeWidth="1.6" strokeLinecap="round" />
          )}
        </g>
      ))}
    </>
  );
}

const FUR = "#edb66b";
const STRIPE = "#c98b3a";
const BLUSH = "#e7a3b5";
const MOSS = "#23362c";

// Mochi, the ginger cat who stands in for Pip in the Mochi look. Hours on the
// dial still show as leaves, tucked between Mochi's ears.
function MochiHead({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <path d="M14 58 L20 14 L50 38 Z" fill={FUR} />
      <path d="M106 58 L100 14 L70 38 Z" fill={FUR} />
      <path d="M22 46 L25 24 L40 37 Z" fill={BLUSH} />
      <path d="M98 46 L95 24 L80 37 Z" fill={BLUSH} />
      <ellipse cx="60" cy="72" rx="50" ry="42" fill={FUR} />
      <path d="M50 32 q4 8 0 14 M60 30 v14 M70 32 q-4 8 0 14" stroke={STRIPE} strokeWidth="4" strokeLinecap="round" fill="none" />
      {children}
    </>
  );
}

function Mochi({ mood, size, a11y, leaves, heat }: { mood: Mood; size: number; a11y: object; leaves: number; heat: Heat }) {
  const hot = heat > 0;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="pip" {...a11y}>
      <MochiHead>
        {LEAVES.slice(0, leaves).map((l, i) => (
          <ellipse key={l.cx} cx={i ? 70 : 50} cy={i ? 24 : 26} rx="8" ry="4" fill="#9fcba4" transform={`rotate(${i ? -30 : 30} ${i ? 70 : 50} ${i ? 24 : 26})`} />
        ))}
        {mood === "awake" && !hot && (
          <>
            <circle cx="44" cy="72" r="6" fill={MOSS} />
            <circle cx="76" cy="72" r="6" fill={MOSS} />
            <circle cx="46" cy="70" r="2" fill="#fff" />
            <circle cx="78" cy="70" r="2" fill="#fff" />
          </>
        )}
        {mood === "asleep" && !hot && <path d="M37 72 Q44 78 51 72 M69 72 Q76 78 83 72" stroke={MOSS} strokeWidth="4" strokeLinecap="round" fill="none" />}
        {(mood === "break" || mood === "cheer") && <path d="M37 72 Q44 65 51 72 M69 72 Q76 65 83 72" stroke={MOSS} strokeWidth="4" strokeLinecap="round" fill="none" />}
        <path d="M56 82 h8 l-4 4 Z" fill={MOSS} />
        {hot ? null : mood === "cheer" ? (
          <path d="M52 88 Q60 98 68 88 Z" fill={MOSS} />
        ) : (
          <path d="M60 86 q-4 5 -8 2 M60 86 q4 5 8 2" stroke={MOSS} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        )}
        <path d="M6 76 h20 M8 86 l18 -4 M114 76 h-20 M112 86 l-18 -4" stroke={STRIPE} strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="30" cy="86" rx="8" ry="4.5" fill={BLUSH} />
        <ellipse cx="90" cy="86" rx="8" ry="4.5" fill={BLUSH} />
        {hot && <HotFace heat={heat} l={44} r={76} y={72} m={92} ink={MOSS} />}
        {mood === "break" && (
          <>
            <path d="M44 96 h30 v10 a10 10 0 0 1 -10 10 h-10 a10 10 0 0 1 -10 -10 Z" fill="#fff" />
            <path d="M74 99 h4 a5 5 0 0 1 0 10 h-4" stroke="#fff" strokeWidth="4" fill="none" />
            <path d="M52 102 h14" stroke="#9fcba4" strokeWidth="4" strokeLinecap="round" />
          </>
        )}
      </MochiHead>
    </svg>
  );
}

type PipProps = {
  mood?: Mood;
  size?: number;
  label?: string;
  /** Draws this look's mascot instead of the current one, for the look picker. */
  as?: Look;
  /** Extra leaves on the sprout, one per full hour on the timer dial. */
  extraLeaves?: number;
  /** Overheats the face after a long focus; see `heat` in timer.ts. */
  heat?: Heat;
};

export function Pip({ mood = "awake", size = 80, label, as, extraLeaves = 0, heat = 0 }: PipProps) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  const which = as ?? look();
  if (isProto(which)) return <ProtoMascot look={which} mood={mood} size={size} a11y={a11y} />;
  if (which === "mochi") return <Mochi mood={mood} size={size} a11y={a11y} leaves={extraLeaves} heat={heat} />;
  const hot = heat > 0;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="pip" {...a11y}>
      <Sprout leaves={Math.max(extraLeaves, mood === "cheer" ? 1 : 0)} />
      <path d={BODY} fill="#a7aeec" />
      {mood === "awake" && !hot && (
        <>
          <circle cx="45" cy="70" r="6" fill={INK} />
          <circle cx="75" cy="70" r="6" fill={INK} />
          <circle cx="47" cy="68" r="2" fill="#fff" />
          <circle cx="77" cy="68" r="2" fill="#fff" />
          <path d="M55 84 Q60 89 65 84" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      )}
      {mood === "asleep" && !hot && (
        <>
          <path d="M39 70 Q45 75 51 70 M69 70 Q75 75 81 70" stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none" />
          <ellipse cx="60" cy="88" rx="3" ry="2" fill={INK} />
        </>
      )}
      {mood === "break" && (
        <>
          <path d="M39 66 Q45 61 51 66 M69 66 Q75 61 81 66" stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M42 84 h30 v12 a10 10 0 0 1 -10 10 h-10 a10 10 0 0 1 -10 -10 Z" fill="#f8f6fc" />
          <path d="M72 88 h4 a5 5 0 0 1 0 10 h-4" stroke="#f8f6fc" strokeWidth="4" fill="none" />
          <path d="M50 92 h14" stroke="#b9d9a9" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {mood === "cheer" && (
        <>
          <path d="M39 70 Q45 63 51 70 M69 70 Q75 63 81 70" stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M51 82 Q60 94 69 82 Z" fill={INK} />
        </>
      )}
      <ellipse cx={mood === "break" ? 32 : 34} cy={mood === "break" ? 76 : 83} rx="7" ry="4" fill="#f1b5c9" />
      <ellipse cx={mood === "break" ? 88 : 86} cy={mood === "break" ? 76 : 83} rx="7" ry="4" fill="#f1b5c9" />
      {hot && <HotFace heat={heat} l={45} r={75} y={70} m={86} ink={INK} />}
    </svg>
  );
}

// One face per rating value: 1 distracted, 2 neutral, 3 focused.
const faces: Record<number, { body: string; eyes: string; eyeWidth: number; mouth: string }> = {
  1: { body: "#c9c4de", eyes: "M41 68 h0.1 M71 72 h0.1", eyeWidth: 12, mouth: "M50 88 q5 -5 10 0 q5 5 10 0" },
  2: { body: "#b8bdee", eyes: "M45 70 h0.1 M75 70 h0.1", eyeWidth: 12, mouth: "M53 86 h14" },
  3: { body: "#a7aeec", eyes: "M39 70 Q45 63 51 70 M69 70 Q75 63 81 70", eyeWidth: 5, mouth: "M52 82 Q60 92 68 82" },
};

export function RatingFace({ value, size = 36 }: { value: number; size?: number }) {
  const f = faces[value] ?? faces[2];
  const l = look();
  if (isProto(l)) return <ProtoMascot look={l} mood={value === 3 ? "cheer" : value === 1 ? "asleep" : "awake"} size={size} a11y={{ "aria-hidden": true }} />;
  if (isMochi()) {
    const fur = value === 1 ? "#d9c3a0" : value === 2 ? "#e8c58f" : FUR;
    return (
      <svg width={size} height={size} viewBox="0 8 120 112" aria-hidden="true">
        <path d="M14 58 L20 14 L50 38 Z" fill={fur} />
        <path d="M106 58 L100 14 L70 38 Z" fill={fur} />
        <ellipse cx="60" cy="72" rx="50" ry="42" fill={fur} />
        <path d={f.eyes} stroke={MOSS} strokeWidth={f.eyeWidth} strokeLinecap="round" fill="none" />
        <path d={f.mouth} stroke={MOSS} strokeWidth="5" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 12 120 108" aria-hidden="true">
      <path d={BODY} fill={f.body} />
      <path d={f.eyes} stroke={INK} strokeWidth={f.eyeWidth} strokeLinecap="round" fill="none" />
      <path d={f.mouth} stroke={INK} strokeWidth="5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** A sprout for each session of the daily goal; done ones have leaves. */
export function GoalSprouts({ done, goal }: { done: number; goal: number }) {
  const total = Math.max(goal, done);
  return (
    <div className="goal" aria-label={t().goalAria(done, goal)}>
      <span className="goal-sprouts" aria-hidden="true">
        {Array.from({ length: total }, (_, i) =>
          isProto(look()) ? (
            <ProtoGoalMark key={i} look={look() as never} done={i < done} />
          ) : isMochi() ? (
            <svg key={i} width="22" height="22" viewBox="0 0 24 24">
              <g fill={i < done ? STRIPE : "var(--seed)"}>
                <ellipse cx="12" cy="15.5" rx="5" ry="4.2" />
                <circle cx="5.5" cy="10" r="2.2" />
                <circle cx="9.5" cy="6.5" r="2.2" />
                <circle cx="14.5" cy="6.5" r="2.2" />
                <circle cx="18.5" cy="10" r="2.2" />
              </g>
            </svg>
          ) : i < done ? (
            <svg key={i} width="22" height="22" viewBox="0 0 24 24">
              <path d="M12 21V11" stroke="#86b374" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M12 12C12 7 8 5 4 5c0 5 3 7 8 7Z" fill="#b9d9a9" />
              <path d="M12 10c0-4 3-6 8-6 0 4-3 6-8 6Z" fill="#86b374" />
            </svg>
          ) : (
            <svg key={i} width="22" height="22" viewBox="0 0 24 24">
              <circle cx="12" cy="19" r="3" className="goal-seed" />
            </svg>
          ),
        )}
      </span>
      <span className="goal-label">
        {t().goalToday(done, goal)}
      </span>
    </div>
  );
}
