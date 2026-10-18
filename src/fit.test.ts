import { describe, expect, it } from "vitest";
import { fitScale } from "./fit";

describe("fitScale", () => {
  it("keeps phones at 1x", () => {
    expect(fitScale(390, 844)).toBe(1);
  });
  it("shrinks a short laptop window to fit its height", () => {
    expect(fitScale(1280, 620)).toBeCloseTo(620 / 760, 2);
  });
  it("grows on a big monitor", () => {
    expect(fitScale(1920, 1000)).toBeGreaterThan(1.3);
  });
  it("stays within bounds", () => {
    expect(fitScale(700, 300)).toBe(0.7);
    expect(fitScale(5000, 3000)).toBe(1.8);
  });
});
