// Stint's two looks. Lavender is Pip's; Mochi is the ginger cat's.

export type Look = "lavender" | "mochi";

let current: Look = "lavender";

/** Called by App before rendering, like setLanguage, so every component draws the same look. */
export function setLook(l: Look): void {
  current = l;
}

export function look(): Look {
  return current;
}
