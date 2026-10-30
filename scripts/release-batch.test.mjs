import { describe, expect, it } from "vitest";
import { highestVersion, pickBump, selectBatch } from "./release-batch.mjs";

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

describe("selectBatch", () => {
  const pr = (number, oid, ...labels) => ({
    number,
    labels: labels.map((name) => ({ name })),
    mergeCommit: oid ? { oid } : null,
  });

  it("picks only the PRs merged in the commits and maps their label names", () => {
    const merged = [pr(3, "c", "minor", "no release"), pr(2, "b"), pr(1, "a", "major")];
    expect(selectBatch(merged, new Set(["b", "c"]), 3)).toEqual([
      { number: 3, labels: ["minor", "no release"] },
      { number: 2, labels: [] },
    ]);
  });

  it("gives an empty batch without an error when an earlier batch shipped the own PR", () => {
    expect(selectBatch([pr(2, "b"), pr(1, "a")], new Set(), 2)).toEqual([]);
  });

  it("throws when the own PR is missing from the merged list", () => {
    expect(() => selectBatch([pr(1, "a")], new Set(["a"]), 2)).toThrow(/#2 was not found/);
  });

  it("throws when the own PR has no merge commit", () => {
    expect(() => selectBatch([pr(2, null), pr(1, "a")], new Set(["a"]), 2)).toThrow(/#2 has no merge commit/);
  });

  it("ignores another PR with no merge commit", () => {
    expect(selectBatch([pr(2, "b"), pr(1, null)], new Set(["b"]), 2)).toEqual([{ number: 2, labels: [] }]);
  });
});

describe("highestVersion", () => {
  it("compares each part as a number", () => {
    expect(highestVersion(["v1.7.9", "v1.7.10"])).toBe("v1.7.10");
    expect(highestVersion(["v1.9.0", "v1.10.0"])).toBe("v1.10.0");
    expect(highestVersion(["v9.0.0", "v10.0.0"])).toBe("v10.0.0");
  });

  it("gives the same answer in any order", () => {
    expect(highestVersion(["v1.7.2", "v1.7.3", "v1.7.1"])).toBe("v1.7.3");
    expect(highestVersion(["v1.7.3", "v1.7.1", "v1.7.2"])).toBe("v1.7.3");
    expect(highestVersion(["v1.7.1", "v1.7.2", "v1.7.3"])).toBe("v1.7.3");
  });

  it("ignores anything that isn't a version tag", () => {
    expect(highestVersion(["v2.0.0-test.1", "latest", "2.0.0", "v2.0", "v1.7.2"])).toBe("v1.7.2");
  });

  it("gives an empty string when there is no version", () => {
    expect(highestVersion([])).toBe("");
    expect(highestVersion(["latest"])).toBe("");
  });
});
