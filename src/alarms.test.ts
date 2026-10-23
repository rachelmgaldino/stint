import { describe, expect, it } from "vitest";
import { plannedAlarms } from "./alarms";
import { defaultSettings, type Settings } from "./store";
import { idle, pause, start, startFlow } from "./timer";

const MIN = 60_000;
const s = (over: Partial<Settings> = {}): Settings => ({ ...defaultSettings, ...over });
const keys = (a: { key: string }[]) => a.map((x) => x.key).sort();

describe("plannedAlarms", () => {
  it("plans nothing when idle", () => {
    expect(plannedAlarms(idle, s(), "", 0)).toEqual([]);
  });

  it("plans the end, a heads-up and the overflow for a running session", () => {
    const t = start("focus", 25 * MIN, 0);
    const a = plannedAlarms(t, s(), "Write", 0);
    expect(keys(a)).toEqual(["end", "overflow", "soon"]);
    expect(a.find((x) => x.key === "end")).toMatchObject({ at: 25 * MIN, sound: "chime" });
    expect(a.find((x) => x.key === "soon")).toMatchObject({ at: 24 * MIN, sound: "soon" });
    expect(a.find((x) => x.key === "overflow")?.at).toBe(35 * MIN);
    expect(a.find((x) => x.key === "overflow")?.notice?.body).toContain('"Write"');
  });

  it("drops alarms that are switched off or already past", () => {
    const t = start("focus", 25 * MIN, 0);
    expect(keys(plannedAlarms(t, s({ notifySoon: false, overflowFocus: false }), "", 0))).toEqual(["end"]);
    expect(keys(plannedAlarms(t, s(), "", 30 * MIN))).toEqual(["overflow"]);
  });

  it("keeps the end alarm for the sound even without a notification", () => {
    const t = start("break", 5 * MIN, 0);
    const end = plannedAlarms(t, s({ notifyBreakEnd: false }), "", 0).find((x) => x.key === "end");
    expect(end).toMatchObject({ sound: "chime", notice: undefined });
    const silent = plannedAlarms(t, s({ notifyBreakEnd: false, sound: false }), "", 0);
    expect(keys(silent)).not.toContain("end");
  });

  it("skips the heads-up when the session is shorter than the warning", () => {
    const t = start("break", 1 * MIN, 0);
    expect(keys(plannedAlarms(t, s(), "", 0))).not.toContain("soon");
  });

  it("only plans the pause overflow while paused", () => {
    const t = pause(start("focus", 25 * MIN, 0), 5 * MIN);
    const a = plannedAlarms(t, s(), "", 5 * MIN);
    expect(keys(a)).toEqual(["pause"]);
    expect(a[0].at).toBe(15 * MIN);
  });

  it("rings presence every N minutes of focus, not counting pauses, and stops before the end", () => {
    // Started at 0 and paused for 2 minutes, so the end moved to 27.
    const t = { ...start("focus", 25 * MIN, 0), endsAt: 27 * MIN, pausedMs: 2 * MIN };
    const at = (now: number) => plannedAlarms(t, s({ presence: true }), "", now).find((x) => x.key === "presence")?.at;
    expect(at(5 * MIN)).toBe(12 * MIN);
    expect(at(12 * MIN)).toBe(22 * MIN);
    expect(at(22 * MIN)).toBeUndefined();
    const brk = start("break", 25 * MIN, 0);
    expect(keys(plannedAlarms(brk, s({ presence: true }), "", 0))).not.toContain("presence");
  });

  it("plans no end, heads-up or overflow in flow, and keeps the presence sound going", () => {
    const t = startFlow(0);
    expect(plannedAlarms(t, s(), "Write", 0)).toEqual([]);
    const a = plannedAlarms(t, s({ presence: true, presenceMinutes: 10 }), "Write", 300 * MIN + 1);
    expect(a).toEqual([{ key: "presence", at: 310 * MIN, sound: "presence" }]);
  });

  it("still nudges about a long pause in flow", () => {
    expect(keys(plannedAlarms(pause(startFlow(0), 5 * MIN), s(), "", 5 * MIN))).toEqual(["pause"]);
  });
});
