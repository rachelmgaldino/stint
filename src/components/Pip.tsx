// Pip, Stint's mascot: a soft blob with a sprout on top.

import { t } from "../i18n";

export type Mood = "awake" | "asleep" | "break" | "cheer";

const BODY = "M60 24 C92 24 108 48 108 74 C108 100 88 112 60 112 C32 112 12 100 12 74 C12 48 28 24 60 24 Z";
const INK = "#2a2340";

function Sprout({ double }: { double?: boolean }) {
  return (
    <>
      <path d="M60 24 C60 16 60 12 60 8" stroke="#86b374" strokeWidth="5" strokeLinecap="round" fill="none" />
      <ellipse cx="70" cy="11" rx="10" ry="5" fill="#b9d9a9" transform="rotate(-25 70 11)" />
      {double && <ellipse cx="50" cy="12" rx="8" ry="4" fill="#b9d9a9" transform="rotate(25 50 12)" />}
    </>
  );
}

export function Pip({ mood = "awake", size = 80, label }: { mood?: Mood; size?: number; label?: string }) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="pip" {...a11y}>
      <Sprout double={mood === "cheer"} />
      <path d={BODY} fill="#a7aeec" />
      {mood === "awake" && (
        <>
          <circle cx="45" cy="70" r="6" fill={INK} />
          <circle cx="75" cy="70" r="6" fill={INK} />
          <circle cx="47" cy="68" r="2" fill="#fff" />
          <circle cx="77" cy="68" r="2" fill="#fff" />
          <path d="M55 84 Q60 89 65 84" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      )}
      {mood === "asleep" && (
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
          i < done ? (
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
