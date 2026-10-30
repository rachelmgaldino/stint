import { describe, expect, it } from "vitest";
import { colorRef, isDark } from "./colors";

describe("colorRef", () => {
  it("swaps red and blue for Windows", () => {
    expect(colorRef("#17142a")).toBe(0x2a1417);
    expect(colorRef("#ff0000")).toBe(0x0000ff);
    expect(colorRef("#0000ff")).toBe(0xff0000);
  });
});

describe("isDark", () => {
  it("tells every look's night ground from its day ground", () => {
    for (const night of ["#17142a", "#1e2e26", "#232429", "#141219"]) expect(isDark(night)).toBe(true);
    for (const day of ["#e8e5f3", "#dde6d6", "#efe8d8", "#f2ede1"]) expect(isDark(day)).toBe(false);
  });
});
