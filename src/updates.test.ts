import { describe, expect, it } from "vitest";
import { testOf } from "./updates";

describe("testOf", () => {
  it("reads the pull request from a test build's version", () => {
    expect(testOf("1.4.4-pr.49.120")).toBe(49);
  });

  it("is null for a released version", () => {
    expect(testOf("1.4.3")).toBeNull();
  });
});
