// Dev-only page for the mockups: every mascot candidate of a look in each mood.
// /?mascots&look=notebook|riso|luna&theme=light|dark

import { MASCOTS, ProtoMascot, type ProtoLook } from "./ProtoLooks";

const q = new URLSearchParams(location.search);
const look = (q.get("look") ?? "notebook") as ProtoLook;
const only = q.get("m");

export const NAMES: Record<string, string> = {
  crane: "Fold, a paper crane",
  blot: "Inky, an ink blot",
  worm: "Bookworm",
  memo: "Memo, a sticky note",
  snail: "Doodle, a snail",
  fish: "Koi, a goldfish",
  shroom: "Cap, a mushroom",
  ghost: "Boo, a ghost",
  cactus: "Prickle, a cactus",
  whale: "Big Blue, a whale",
  rabbit: "Moon rabbit",
  moth: "Luna moth",
  owl: "Night owl",
};

const MOODS = [
  ["awake", "Ready"],
  ["asleep", "Focusing"],
  ["break", "On a break"],
  ["cheer", "Goal met"],
] as const;

export function MascotSheet() {
  document.documentElement.dataset.look = look;
  document.documentElement.setAttribute("data-theme", q.get("theme") ?? "light");
  document.documentElement.style.cssText = "height:auto;overflow:visible";
  document.body.style.cssText = "height:auto;overflow:visible";
  document.getElementById("root")!.style.cssText = "height:auto";
  const list = only ? [only] : MASCOTS[look];
  return (
    <div className="shell" style={{ height: "auto", width: 1000, padding: 24, gap: 14 }}>
      {list.map((m) => (
        <div key={m} className="card" style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 24px" }}>
          <h2 style={{ width: 220, flex: "0 0 auto", fontSize: 22 }}>{NAMES[m]}</h2>
          {MOODS.map(([mood, label]) => (
            <figure key={mood} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 130 }}>
              <ProtoMascot look={look} as={m} mood={mood} size={96} a11y={{ "aria-hidden": true }} />
              <figcaption style={{ fontSize: 13, color: "var(--muted)" }}>{label}</figcaption>
            </figure>
          ))}
        </div>
      ))}
    </div>
  );
}
