import { describe, expect, it } from "vitest";
import { cleanSize, fitScale } from "./fit";

describe("fitScale", () => {
  it("keeps phones at 1x", () => {
    expect(fitScale(390, 844)).toBe(1);
    expect(fitScale(390, 844, 150)).toBe(1);
  });
  it("shrinks a short laptop window to fit its height", () => {
    expect(fitScale(1280, 699)).toBeCloseTo(699 / 900, 2);
  });
  it("never grows past normal size on a big monitor", () => {
    expect(fitScale(1920, 1050)).toBe(1);
    expect(fitScale(2560, 1400)).toBe(1);
  });
  it("applies the Size setting on top", () => {
    expect(fitScale(1920, 1050, 90)).toBe(0.9);
    expect(fitScale(1920, 1050, 120)).toBe(1.2);
    expect(fitScale(1280, 699, 80)).toBeLessThan(fitScale(1280, 699));
  });
  it("stays within bounds", () => {
    expect(fitScale(700, 300)).toBe(0.7);
    expect(fitScale(700, 300, 70)).toBe(0.6);
  });
});

describe("cleanSize", () => {
  it("snaps to 10% steps between 70 and 150", () => {
    expect(cleanSize(undefined)).toBe(100);
    expect(cleanSize("large")).toBe(100);
    expect(cleanSize(104)).toBe(100);
    expect(cleanSize(40)).toBe(70);
    expect(cleanSize(400)).toBe(150);
  });
});
