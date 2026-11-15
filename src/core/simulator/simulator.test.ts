import { describe, expect, test } from "bun:test";
import { getVitalDef } from "../content";
import { VITAL_IDS } from "../types";
import { createSimulator, generateHistory } from "./index";

const T = Date.UTC(2026, 10, 10, 12, 0, 0);
const value = (
  tick: ReturnType<ReturnType<typeof createSimulator>["step"]>,
  id: string,
) => tick.readings.find((r) => r.id === id)!.value;

describe("simulator", () => {
  test("the same seed gives the same data", () => {
    const a = createSimulator({ seed: 5, startTime: T });
    const b = createSimulator({ seed: 5, startTime: T });
    for (let i = 0; i < 20; i++) expect(a.step()).toEqual(b.step());
  });

  test("normal: vitals stay in the normal range", () => {
    const sim = createSimulator({ seed: 1, startTime: T });
    for (let i = 0; i < 50; i++) {
      const tick = sim.step();
      expect(value(tick, "heartRate")).toBeGreaterThan(45);
      expect(value(tick, "heartRate")).toBeLessThan(100);
      expect(value(tick, "spo2")).toBeGreaterThanOrEqual(94);
    }
  });

  test("collapse: from the 11th tick heart rate is 24 and SpO2 is 78 (below the alarm limits)", () => {
    const sim = createSimulator({
      seed: 1,
      startTime: T,
      scenario: "collapse",
    });
    const ticks = Array.from({ length: 14 }, () => sim.step());
    expect(value(ticks[2]!, "heartRate")).toBeLessThan(90);
    expect(value(ticks[10]!, "heartRate")).toBe(24);
    expect(value(ticks[10]!, "spo2")).toBe(78);
  });

  test("slowDrift: over 8 simulated hours SpO2 falls and heart rate rises", () => {
    const sim = createSimulator({
      seed: 1,
      startTime: T,
      scenario: "slowDrift",
      timeScale: 3600,
    });
    const ticks = Array.from({ length: 8 }, () => sim.step());
    expect(value(ticks[7]!, "spo2")).toBeLessThan(94);
    expect(value(ticks[7]!, "heartRate")).toBeGreaterThan(70);
  });

  test("setScenario resets the scenario counter", () => {
    const sim = createSimulator({
      seed: 1,
      startTime: T,
      scenario: "collapse",
    });
    for (let i = 0; i < 12; i++) sim.step();
    sim.setScenario("normal");
    expect(value(sim.step(), "heartRate")).toBeGreaterThan(45);
  });

  test("a subscriber receives ticks, unsubscribing stops them", () => {
    const sim = createSimulator({ seed: 1, startTime: T });
    let count = 0;
    const off = sim.subscribe(() => count++);
    sim.step();
    off();
    sim.step();
    expect(count).toBe(1);
  });
});

describe("generateHistory", () => {
  const history = generateHistory({ days: 10, endTime: T, seed: 3 });

  test("sorted by time, no future values", () => {
    for (let i = 1; i < history.length; i++) {
      expect(history[i]!.takenAt).toBeGreaterThanOrEqual(
        history[i - 1]!.takenAt,
      );
    }
    expect(history.every((r) => r.takenAt <= T)).toBe(true);
  });

  test("contains all 7 vitals within plausible ranges", () => {
    for (const id of VITAL_IDS) {
      const def = getVitalDef(id)!;
      const readings = history.filter((r) => r.id === id);
      expect(readings.length).toBeGreaterThan(5);
      for (const r of readings) {
        expect(r.value).toBeGreaterThanOrEqual(def.plausible.min);
        expect(r.value).toBeLessThanOrEqual(def.plausible.max);
        if (def.secondary) {
          expect(r.secondary).toBeDefined();
          expect(r.secondary!).toBeGreaterThanOrEqual(
            def.secondary.plausible.min,
          );
          expect(r.secondary!).toBeLessThanOrEqual(def.secondary.plausible.max);
        }
      }
    }
  });
});
