// Stint's looks. Lavender is Pip's, Mochi is the ginger cat's, Notebook is Memo the
// sticky note's, and Riso is the mushroom's by day and the ghost's by night.

export type Look = "lavender" | "mochi" | "notebook" | "riso";

let current: Look = "lavender";

/** Called by App before rendering, like setLanguage, so every component draws the same look. */
export function setLook(l: Look): void {
  current = l;
}

export function look(): Look {
  return current;
}
