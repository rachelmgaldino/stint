import { describe, expect, it } from "vitest";
import { pickBump } from "./release-batch.mjs";

describe("pickBump", () => {
  it("releases nothing when no PR is in the batch", () => {
    expect(pickBump([])).toBe("none");
  });

  it("releases nothing when every PR is labelled no release", () => {
    expect(pickBump([{ labels: ["no release"] }, { labels: ["no release"] }])).toBe("none");
  });

  it("defaults to a patch for PRs with no labels", () => {
    expect(pickBump([{ labels: [] }])).toBe("patch");
  });

  it("lets minor beat patch", () => {
    expect(pickBump([{ labels: [] }, { labels: ["minor"] }, { labels: ["documentation"] }])).toBe("minor");
  });

  it("lets major beat minor", () => {
    expect(pickBump([{ labels: ["minor"] }, { labels: ["major"] }, { labels: [] }])).toBe("major");
  });

  it("ignores the other labels of a no release PR", () => {
    expect(pickBump([{ labels: ["no release", "major"] }, { labels: [] }])).toBe("patch");
    expect(pickBump([{ labels: ["no release", "minor"] }])).toBe("none");
  });
});
