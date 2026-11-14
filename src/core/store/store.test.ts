import { beforeEach, describe, expect, test } from "bun:test";
import type { VitalReading } from "../types";
import { usePda } from "./index";

const sensor = (
  value: number,
  id: VitalReading["id"] = "heartRate",
): VitalReading => ({
  id,
  value,
  unit: "bpm",
  takenAt: Date.now(),
  source: "sensor",
});

beforeEach(() => usePda.getState().reset());

describe("manual measurements", () => {
  test("a critical heart rate colors the heart zone", () => {
    const result = usePda.getState().recordMeasurement("heartRate", 130);
    expect(result.ok).toBe(true);
    expect(result.evaluation?.status).toBe("crit");
    expect(usePda.getState().zoneStatus.heart).toBe("crit");
    expect(usePda.getState().alerts[0]?.severity).toBe("crit");
  });

  test("an implausible value is rejected and the store is unchanged", () => {
    const result = usePda.getState().recordMeasurement("heartRate", 900);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("between");
    expect(usePda.getState().vitals.heartRate).toBeUndefined();
  });

  test("blood pressure needs a second value", () => {
    expect(usePda.getState().recordMeasurement("bloodPressure", 120).ok).toBe(
      false,
    );
    expect(
      usePda.getState().recordMeasurement("bloodPressure", 120, 80).ok,
    ).toBe(true);
  });

  test("a normal value creates no alerts", () => {
    usePda.getState().recordMeasurement("spo2", 98);
    expect(usePda.getState().alerts).toEqual([]);
    expect(usePda.getState().zoneStatus.lungs).toBe("ok");
  });
});

describe("automatic alarm", () => {
  test("a heart rate failure from the sensor starts Emergency and points the camera at the heart", () => {
    usePda.getState().addReading(sensor(24));
    const s = usePda.getState();
    expect(s.mode).toBe("emergency");
    expect(s.cameraTarget).toBe("heart");
    expect(s.alerts[0]).toMatchObject({
      id: "alarm:heartRate",
      suggestsEmergency: true,
    });
    expect(s.emergencyLog.length).toBe(1);
  });

  test("a manual measurement does not start Emergency automatically", () => {
    usePda.getState().addReading({ ...sensor(24), source: "manual" });
    expect(usePda.getState().mode).toBe("idle");
  });

  test("after Emergency ends, the same episode does not start it again", () => {
    usePda.getState().addReading(sensor(24));
    usePda.getState().endEmergency();
    usePda.getState().addReading(sensor(24));
    expect(usePda.getState().mode).toBe("idle");
  });

  test("a new episode after the values return to normal starts Emergency again", () => {
    usePda.getState().addReading(sensor(24));
    usePda.getState().endEmergency();
    usePda.getState().addReading(sensor(70));
    usePda.getState().addReading(sensor(24));
    expect(usePda.getState().mode).toBe("emergency");
  });
});

describe("flags and environment", () => {
  test("chest pain: heart zone is crit and an alert appears, removing the flag clears both", () => {
    usePda.getState().setFlag("chest-pain", true);
    let s = usePda.getState();
    expect(s.zoneStatus.heart).toBe("crit");
    expect(
      s.alerts.some((a) => a.id === "rule:chest-pain" && a.suggestsEmergency),
    ).toBe(true);

    usePda.getState().setFlag("chest-pain", false);
    s = usePda.getState();
    expect(s.zoneStatus.heart).toBe("unknown");
    expect(s.alerts).toEqual([]);
  });

  test("changing the environment recomputes statuses", () => {
    usePda.getState().recordMeasurement("heartRate", 72);
    usePda.getState().setEnvironment("mars-transit");
    expect(usePda.getState().environment).toBe("mars-transit");
    expect(usePda.getState().zoneStatus.heart).toBe("ok");
  });
});
