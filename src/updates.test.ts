import { describe, expect, it } from "vitest";
import { goesBack, testOf, testToOffer, type TestBuild } from "./updates";

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

describe("testToOffer", () => {
  const build = (pr: number, version: string): TestBuild => ({ pr, title: "", version, built: "" });
  // Newest first, as update_test_builds lists them: #82 was pushed after #81.
  const tests = [build(82, "1.10.7-pr.82.1"), build(81, "1.10.7-pr.81.4")];

  it("follows the pull request of the test build Stint is on, not the newest one", () => {
    expect(testToOffer("1.10.7-pr.81.3", tests)).toBe(81);
  });

  it("is the release once that pull request has no build listed", () => {
    expect(testToOffer("1.10.7-pr.80.2", tests)).toBeNull();
    expect(testToOffer("1.10.7-pr.81.3", [])).toBeNull();
  });

  it("is the release on a release, whatever is listed", () => {
    expect(testToOffer("1.10.6", tests)).toBeNull();
  });
});
