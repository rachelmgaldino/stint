import { describe, expect, it } from "vitest";
import { endFor, lengthOf, stepMinutes } from "./useTimeFields";

describe("time fields", () => {
  const day = new Date(2026, 9, 17).getTime();
  const at = (h: number, m: number, d = 17) => new Date(2026, 9, d, h, m).getTime();

  it("finds the end that keeps a length", () => {
    expect(endFor(at(9, 0), 90)).toBe("10:30");
  });

  it("wraps the end past midnight", () => {
    expect(endFor(at(23, 30), 60)).toBe("00:30");
  });

  it("measures a length within the day", () => {
    expect(lengthOf(day, at(9, 0), "10:30")).toBe(90 * 60_000);
  });

  it("rolls an end before the start to the next day", () => {
    expect(lengthOf(day, at(23, 30), "00:30")).toBe(60 * 60_000);
  });

  it("reads an end equal to the start as a whole day, never as zero", () => {
    expect(lengthOf(day, at(9, 0), "09:00")).toBe(24 * 60 * 60_000);
  });

  it("gives no length for a malformed end", () => {
    expect(lengthOf(day, at(9, 0), "")).toBeNull();
    expect(lengthOf(day, at(9, 0), "25:00")).toBeNull();
  });

  it("steps by 5 minutes from a multiple of 5", () => {
    expect(stepMinutes(25, true)).toBe(30);
    expect(stepMinutes(25, false)).toBe(20);
  });

  it("steps to the nearest multiple of 5 from between two", () => {
    expect(stepMinutes(27, true)).toBe(30);
    expect(stepMinutes(27, false)).toBe(25);
  });

  it("steps below 5 to a value the field refuses", () => {
    expect(stepMinutes(5, false)).toBe(0);
    expect(stepMinutes(0, false)).toBe(-5);
  });
});
