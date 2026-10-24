import { describe, expect, it } from "vitest";
import * as T from "./timer";
import type { SessionRecord } from "./store";
import {
  closeTask,
  countSessions,
  currentTaskMs,
  currentTaskStart,
  firstParts,
  isNextTask,
  joinParts,
  moveSwitch,
  partsOf,
  taskRecords,
} from "./tasks";

const MIN = 60_000;
const START = new Date(2026, 9, 24, 10, 0).getTime();
const at = (m: number) => START + m * MIN;

function session(over: Partial<SessionRecord> = {}): Omit<SessionRecord, "id"> {
  return {
    kind: "focus",
    intention: "Ponto",
    categoryId: 1,
    startedAt: START,
    endedAt: at(53),
    plannedMs: 60 * MIN,
    focusedMs: 53 * MIN,
    reflection: "",
    rating: 2,
    ...over,
  };
}

describe("closing tasks while the session runs", () => {
  const timer = T.start("focus", 60 * MIN, START);

  it("starts the first task with the session and the next where the last one ended", () => {
    expect(currentTaskStart(timer, [])).toBe(START);
    const done = closeTask(timer, [], "Task AFD", 1, at(22));
    expect(done).toEqual([{ intention: "Task AFD", categoryId: 1, endedAt: at(22), focusedMs: 22 * MIN }]);
    expect(currentTaskStart(timer, done)).toBe(at(22));
    expect(currentTaskMs(timer, done, at(53))).toBe(31 * MIN);
  });

  it("leaves pauses out of a task's time", () => {
    const paused = T.resume(T.pause(timer, at(10)), at(15));
    const done = closeTask(paused, [], "Task AFD", 1, at(22));
    expect(done[0].focusedMs).toBe(17 * MIN);
  });
});

describe("taskRecords", () => {
  it("saves a session with one task as it is", () => {
    expect(taskRecords(session(), [])).toEqual([session()]);
  });

  it("saves one linked record per task, ending with the current one", () => {
    const done = [{ intention: "Task AFD", categoryId: 1, endedAt: at(22), focusedMs: 22 * MIN }];
    const [a, b] = taskRecords(session({ categoryId: 2 }), done);
    expect(a).toMatchObject({ intention: "Task AFD", categoryId: 1, startedAt: START, endedAt: at(22), focusedMs: 22 * MIN, partOf: START });
    expect(b).toMatchObject({ intention: "Ponto", categoryId: 2, startedAt: at(22), endedAt: at(53), focusedMs: 31 * MIN, partOf: START });
  });

  it("never lets a moved start run a task backwards", () => {
    const done = [{ intention: "A", categoryId: 1, endedAt: at(5), focusedMs: 5 * MIN }];
    const [a] = taskRecords(session({ startedAt: at(8) }), done);
    expect(a.startedAt).toBe(at(5));
  });
});

let id = 0;
const rec = (over: Partial<SessionRecord>): SessionRecord => ({ ...session(), id: ++id, partOf: null, ...over });

describe("putting sessions back together", () => {
  const a = rec({ intention: "A", startedAt: START, endedAt: at(22), focusedMs: 22 * MIN, partOf: START });
  const b = rec({ intention: "B", startedAt: at(22), endedAt: at(53), focusedMs: 31 * MIN, partOf: START });
  const solo = rec({ intention: "C", startedAt: at(70), endedAt: at(95), focusedMs: 25 * MIN });
  const pause = rec({ kind: "break", intention: "", startedAt: at(53), endedAt: at(63) });
  const all = [b, solo, a, pause];

  it("counts a session with several tasks once", () => {
    expect(countSessions(all)).toBe(2);
  });

  it("knows which records carry on from an earlier task", () => {
    expect(isNextTask(a, all)).toBe(false);
    expect(isNextTask(b, all)).toBe(true);
    expect(isNextTask(solo, all)).toBe(false);
    expect(firstParts(all).map((s) => s.intention)).toEqual(["C", "A", ""]);
  });

  it("joins the tasks of a session into one", () => {
    const joined = joinParts([a, b, solo]);
    expect(joined).toHaveLength(2);
    expect(joined[0]).toMatchObject({ intention: "A", startedAt: START, endedAt: at(53), focusedMs: 53 * MIN });
  });

  it("lists a session's tasks in order", () => {
    expect(partsOf(b, all).map((s) => s.intention)).toEqual(["A", "B"]);
    expect(partsOf(solo, all)).toEqual([solo]);
  });
});

describe("moveSwitch", () => {
  const parts = [
    { startedAt: START, endedAt: at(22), focusedMs: 22 * MIN },
    { startedAt: at(22), endedAt: at(53), focusedMs: 31 * MIN },
  ];

  it("moves the minute one task ended and the next began", () => {
    const [a, b] = moveSwitch(parts, 1, at(30));
    expect(a).toEqual({ startedAt: START, endedAt: at(30), focusedMs: 30 * MIN });
    expect(b).toEqual({ startedAt: at(30), endedAt: at(53), focusedMs: 23 * MIN });
  });

  it("keeps a minute on each side", () => {
    const [a, b] = moveSwitch(parts, 1, at(60));
    expect(a.endedAt).toBe(at(52));
    expect(b.focusedMs).toBe(MIN);
  });
});
