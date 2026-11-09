import { describe, expect, it } from "vitest";
import { setLanguage } from "./i18n";
import {
  goesBack,
  offerText,
  outcome,
  pillText,
  testOf,
  whatToAsk,
  type Offer,
  type PullState,
  type TestBuild,
  type TestBuilds,
} from "./updates";

// setLanguage sets the page's lang, so tests give it a stand-in document.
(globalThis as { document?: unknown }).document ??= { documentElement: {} };

describe("testOf", () => {
  it("reads the pull request from a test build's version", () => {
    expect(testOf("1.4.4-pr.49.120")).toBe(49);
  });

  it("is null for a released version", () => {
    expect(testOf("1.4.3")).toBeNull();
  });
});

describe("goesBack", () => {
  it("is true for the release a test build was made on", () => {
    expect(goesBack("1.10.3", "1.10.4-pr.75.3")).toBe(true);
  });

  it("is false for the release that ships the test build, or a later one", () => {
    expect(goesBack("1.10.4", "1.10.4-pr.75.3")).toBe(false);
    expect(goesBack("1.11.0", "1.10.4-pr.75.3")).toBe(false);
  });

  it("compares the numbers, not the text", () => {
    expect(goesBack("1.9.0", "1.10.1-pr.80.2")).toBe(true);
    expect(goesBack("1.10.0", "1.9.1-pr.80.2")).toBe(false);
  });

  it("is false for a newer release from a release", () => {
    expect(goesBack("1.10.4", "1.10.3")).toBe(false);
  });
});

const build = (pr: number, version: string, before: string | null = null): TestBuild => ({
  pr,
  title: "",
  version,
  built: "",
  before,
});
const listOf = (builds: TestBuild[], released = false): TestBuilds => ({ release: "1.10.7", builds, released });

describe("whatToAsk", () => {
  // Newest first, as update_test_builds lists them: #88 was pushed after #87.
  const fresh = [build(88, "1.10.8-pr.88.1"), build(87, "1.10.8-pr.87.4")];

  it("looks at the build of the pull request Stint is on, not the newest one", () => {
    expect(whatToAsk("1.10.8-pr.87.3", listOf(fresh), true)).toEqual({ test: 87, pull: null });
  });

  it("asks GitHub about the pull request once its build is gone", () => {
    expect(whatToAsk("1.10.8-pr.86.2", listOf(fresh), true)).toEqual({ test: null, pull: 86 });
  });

  it("asks GitHub about it too when its build was made before the newest release", () => {
    const list = listOf([build(87, "1.10.7-pr.87.2", "1.10.7"), ...fresh.slice(0, 1)]);
    expect(whatToAsk("1.10.7-pr.87.2", list, true)).toEqual({ test: null, pull: 87 });
  });

  it("asks nothing more once a release lists the pull request", () => {
    expect(whatToAsk("1.10.7-pr.86.2", listOf(fresh, true), true)).toEqual({ test: null, pull: null });
  });

  it("looks only at the release on a release", () => {
    expect(whatToAsk("1.10.7", listOf(fresh), true)).toEqual({ test: null, pull: null });
  });

  it("looks only at the release with Test builds off, and asks nothing about the pull request", () => {
    expect(whatToAsk("1.10.8-pr.87.3", listOf(fresh), false)).toEqual({ test: null, pull: null });
    expect(whatToAsk("1.10.8-pr.86.2", listOf(fresh), false)).toEqual({ test: null, pull: null });
  });
});

// One case per row of the spec ("PR 22 additions" in fix-plan.md).
describe("outcome", () => {
  const found = (version: string, test: number | null = null) => ({ version, notes: "", test });
  const on87 = "1.10.8-pr.87.3"; // made on 1.10.7

  it("offers a newer build of the pull request Stint is on", () => {
    expect(outcome(on87, found("1.10.8-pr.87.4", 87), listOf([build(87, "1.10.8-pr.87.4")]))).toEqual({
      phase: "available",
      version: "1.10.8-pr.87.4",
      test: 87,
      back: false,
    });
  });

  it("has nothing to do on the newest build of it", () => {
    expect(outcome(on87, null, listOf([build(87, on87)]))).toEqual({ phase: "latest" });
  });

  it("waits for a new build while the pull request is open", () => {
    expect(outcome(on87, null, listOf([]), "open")).toEqual({ phase: "waiting", pr: 87, release: "1.10.7" });
  });

  it("offers the release that ships the pull request, Test builds on or off", () => {
    expect(outcome(on87, found("1.10.8"), listOf([], true))).toEqual({
      phase: "available",
      version: "1.10.8",
      test: null,
      back: false,
      why: "released",
    });
  });

  it("never calls the release that ships the pull request a step back", () => {
    expect(outcome(on87, found("1.10.7"), listOf([], true))).toMatchObject({ back: false, why: "released" });
  });

  it("waits for the release once the pull request is merged", () => {
    expect(outcome(on87, null, listOf([]), "merged")).toEqual({ phase: "merged", pr: 87 });
  });

  it("offers the release after a pull request closed without merging, newer or back", () => {
    expect(outcome(on87, found("1.10.9"), listOf([]), "closed")).toEqual({
      phase: "available",
      version: "1.10.9",
      test: null,
      back: false,
      why: "closed",
    });
    expect(outcome(on87, found("1.10.7"), listOf([]), "closed")).toEqual({
      phase: "available",
      version: "1.10.7",
      test: null,
      back: true,
      why: "closed",
    });
  });

  it("with Test builds off and the pull request in no release, offers the release, newer or back", () => {
    const list = listOf([]);
    expect(outcome(on87, found("1.10.8"), list)).toEqual({ phase: "available", version: "1.10.8", test: null, back: false });
    expect(outcome(on87, found("1.10.7"), list)).toEqual({ phase: "available", version: "1.10.7", test: null, back: true });
  });

  it("offers a newer release on a release, or nothing", () => {
    expect(outcome("1.10.7", found("1.10.8"), listOf([]))).toEqual({
      phase: "available",
      version: "1.10.8",
      test: null,
      back: false,
    });
    expect(outcome("1.10.7", null, listOf([]))).toEqual({ phase: "latest" });
  });
});

// The words are the point of the change: what the card and the pill say for each offer.
describe("offerText and pillText", () => {
  const on87 = "1.10.8-pr.87.3";
  const offer = (current: string, version: string, test: number | null, list?: TestBuilds, pull?: PullState) =>
    outcome(current, { version, notes: "", test }, list, pull) as Offer;
  const words = (current: string, o: Offer) => [offerText(o, current), pillText(o)];

  it("a newer build of the pull request Stint is on", () => {
    expect(words(on87, offer(on87, "1.10.8-pr.87.4", 87, listOf([])))).toEqual([
      "A newer PR #87 test build is ready.",
      "Update PR #87",
    ]);
  });

  it("the release that ships it, even an older version", () => {
    expect(words(on87, offer(on87, "1.10.8", null, listOf([], true)))).toEqual([
      "PR #87 is in Stint 1.10.8.",
      "Update to 1.10.8",
    ]);
    expect(words(on87, offer(on87, "1.10.7", null, listOf([], true)))).toEqual([
      "PR #87 is in Stint 1.10.7.",
      "Update to 1.10.7",
    ]);
  });

  it("closed without merging, then a newer release or back", () => {
    expect(words(on87, offer(on87, "1.10.9", null, listOf([]), "closed"))).toEqual([
      "PR #87 was closed without merging. Stint 1.10.9 is out, the released version. Updating leaves the PR #87 test build.",
      "Update to 1.10.9",
    ]);
    expect(words(on87, offer(on87, "1.10.7", null, listOf([]), "closed"))).toEqual([
      "PR #87 was closed without merging. Stint 1.10.7 is the released version, the one this test build was made on.",
      "Back to 1.10.7",
    ]);
  });

  it("Test builds off, a newer release or back", () => {
    expect(words(on87, offer(on87, "1.10.8", null, listOf([])))).toEqual([
      "Stint 1.10.8 is out, the released version. Updating leaves the PR #87 test build.",
      "Update to 1.10.8",
    ]);
    expect(words(on87, offer(on87, "1.10.7", null, listOf([])))).toEqual([
      "Stint 1.10.7 is the released version, the one this test build was made on.",
      "Back to 1.10.7",
    ]);
  });

  it("a newer release on a release", () => {
    expect(words("1.10.7", offer("1.10.7", "1.10.8", null))).toEqual(["Stint 1.10.8 is out.", "Update to 1.10.8"]);
  });

  it("in Portuguese too", () => {
    setLanguage("pt-BR");
    expect(words(on87, offer(on87, "1.10.7", null, listOf([]), "closed"))).toEqual([
      "O PR #87 foi fechado sem ser mesclado. O Stint 1.10.7 é a versão lançada, a que serviu de base para este teste.",
      "Voltar para 1.10.7",
    ]);
    expect(words(on87, offer(on87, "1.10.8", null, listOf([], true)))).toEqual([
      "O PR #87 está no Stint 1.10.8.",
      "Atualizar para 1.10.8",
    ]);
    setLanguage("en");
  });
});
