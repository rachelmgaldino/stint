import { describe, expect, it } from "vitest";
import { matching, pastIntentions, recentFor } from "./intentions";
import type { SessionRecord } from "./store";

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 23, 15).getTime();

let id = 0;
function s(intention: string, categoryId: number | null, daysAgo: number, kind: "focus" | "break" = "focus"): SessionRecord {
  const startedAt = NOW - daysAgo * DAY;
  return {
    id: ++id,
    kind,
    intention,
    categoryId,
    startedAt,
    endedAt: startedAt + 25 * 60_000,
    plannedMs: 25 * 60_000,
    focusedMs: 25 * 60_000,
    reflection: "",
    rating: 0,
  };
}

const history = [
  s("Answer emails", 1, 1),
  s("Answer emails", 1, 2),
  s("Answer emails", 1, 3),
  s("Budget review", 1, 0.5),
  s("Plan sprint", 1, 5),
  s("Reunião de equipe", 1, 6),
  s("Spanish lesson", 2, 2),
  s("Statistics", 2, 40),
  s("", 1, 0.2),
  s("Coffee", null, 0.1, "break"),
];

describe("pastIntentions", () => {
  it("merges the same intention ignoring case and counts the last 30 days", () => {
    const all = pastIntentions([...history, s("answer EMAILS", 1, 0.3)], NOW);
    const emails = all.find((i) => i.text.toLowerCase() === "answer emails");
    expect(emails?.uses).toBe(4);
    expect(emails?.text).toBe("answer EMAILS"); // the newest spelling
    expect(all.find((i) => i.text === "Statistics")?.uses).toBe(0);
  });

  it("skips breaks and empty intentions", () => {
    const texts = pastIntentions(history, NOW).map((i) => i.text);
    expect(texts).not.toContain("Coffee");
    expect(texts).not.toContain("");
  });

  it("takes the category it was last used in", () => {
    const all = pastIntentions([s("Read", 1, 3), s("Read", 2, 1)], NOW);
    expect(all[0].categoryId).toBe(2);
  });
});

describe("recentFor", () => {
  const all = pastIntentions(history, NOW);

  it("puts the last one in the category first, then the most used", () => {
    expect(recentFor(all, 1).map((i) => i.text)).toEqual(["Budget review", "Answer emails", "Plan sprint", "Reunião de equipe"]);
  });

  it("only lists the picked category", () => {
    expect(recentFor(all, 2).map((i) => i.text)).toEqual(["Spanish lesson", "Statistics"]);
    expect(recentFor(all, 3)).toEqual([]);
  });
});

describe("matching", () => {
  const all = pastIntentions(history, NOW);
  const texts = (q: string) => matching(all, q).map((i) => i.text);

  it("waits for two letters", () => {
    expect(texts("s")).toEqual([]);
  });

  it("matches the start of any word, from every category", () => {
    expect(texts("sp")).toEqual(["Spanish lesson", "Plan sprint"]);
    expect(texts("rev")).toEqual(["Budget review"]);
    expect(texts("view")).toEqual([]);
  });

  it("ignores accents and case", () => {
    expect(texts("REUNIAO")).toEqual(["Reunião de equipe"]);
  });

  it("leaves out an exact match, since it's already typed", () => {
    expect(texts("Plan sprint")).toEqual([]);
  });
});
