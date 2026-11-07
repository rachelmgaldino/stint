import { describe, expect, it } from "vitest";
import { goesBack, testOf } from "./updates";

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
