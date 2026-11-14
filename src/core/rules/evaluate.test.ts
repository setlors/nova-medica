import { describe, expect, test } from "bun:test";
import { getEnvironment, getVitalDef, zones } from "../content";
import type { VitalDef, VitalId, VitalReading } from "../types";
import {
  byBaseline,
  byTrend,
  computeBaseline,
  computeZoneStatus,
  evaluateComposite,
  evaluateReading,
} from "./evaluate";
import { breachesAlarm, classify, worst } from "./thresholds";

const NOW = Date.UTC(2026, 10, 10, 12, 0, 0);
const iss = getEnvironment("iss");
const def = (id: VitalId) => getVitalDef(id) as VitalDef;

function reading(
  id: VitalId,
  value: number,
  minutesAgo = 0,
  secondary?: number,
): VitalReading {
  return {
    id,
    value,
    secondary,
    unit: "",
    takenAt: NOW - minutesAgo * 60_000,
    source: "manual",
  };
}

const ctx = (id: VitalId, history: VitalReading[] = []) => ({
  def: def(id),
  environment: iss,
  history,
  now: NOW,
});

describe("classify and worst", () => {
  const t = def("heartRate").thresholds;

  test("values exactly on the range boundaries", () => {
    expect(classify(50, t)).toBe("ok");
    expect(classify(100, t)).toBe("ok");
    expect(classify(101, t)).toBe("warn");
    expect(classify(40, t)).toBe("warn");
    expect(classify(120, t)).toBe("warn");
    expect(classify(39, t)).toBe("crit");
    expect(classify(121, t)).toBe("crit");
  });

  test("worst: unknown loses to known statuses", () => {
    expect(worst("ok", "unknown")).toBe("ok");
    expect(worst("ok", "crit", "warn")).toBe("crit");
    expect(worst()).toBe("unknown");
  });

  test("automatic alarm limits", () => {
    expect(breachesAlarm("heartRate", 24)).toBe(true);
    expect(breachesAlarm("heartRate", 70)).toBe(false);
    expect(breachesAlarm("spo2", 80)).toBe(true);
    expect(breachesAlarm("glucose", 500)).toBe(false);
  });
});

describe("evaluateReading: absolute thresholds", () => {
  test("heart rate: ok, warn, crit", () => {
    expect(
      evaluateReading(reading("heartRate", 72), ctx("heartRate")).status,
    ).toBe("ok");
    expect(
      evaluateReading(reading("heartRate", 110), ctx("heartRate")).status,
    ).toBe("warn");
    expect(
      evaluateReading(reading("heartRate", 130), ctx("heartRate")).status,
    ).toBe("crit");
  });

  test("blood pressure: the diastolic value counts too", () => {
    expect(
      evaluateReading(
        reading("bloodPressure", 120, 0, 80),
        ctx("bloodPressure"),
      ).status,
    ).toBe("ok");
    expect(
      evaluateReading(
        reading("bloodPressure", 120, 0, 92),
        ctx("bloodPressure"),
      ).status,
    ).toBe("warn");
    expect(
      evaluateReading(
        reading("bloodPressure", 135, 0, 80),
        ctx("bloodPressure"),
      ).status,
    ).toBe("warn");
    expect(
      evaluateReading(
        reading("bloodPressure", 165, 0, 80),
        ctx("bloodPressure"),
      ).status,
    ).toBe("crit");
  });

  test("warn and crit return actions and a reason", () => {
    const ev = evaluateReading(reading("spo2", 92), ctx("spo2"));
    expect(ev.status).toBe("warn");
    expect(ev.actions.length).toBeGreaterThan(0);
    expect(ev.reason).toContain("outside the normal range");
  });

  test("ok has no actions", () => {
    expect(evaluateReading(reading("spo2", 98), ctx("spo2")).actions).toEqual(
      [],
    );
  });

  test("a stale reading gives unknown", () => {
    const ev = evaluateReading(
      reading("heartRate", 72, 13 * 60),
      ctx("heartRate"),
    );
    expect(ev.stale).toBe(true);
    expect(ev.status).toBe("unknown");
  });

  test("environment thresholds take priority", () => {
    const env = {
      ...iss!,
      thresholdOverrides: {
        heartRate: { ok: { min: 50, max: 110 }, warn: { min: 40, max: 130 } },
      },
    };
    const ev = evaluateReading(reading("heartRate", 105), {
      ...ctx("heartRate"),
      environment: env,
    });
    expect(ev.status).toBe("ok");
  });
});

describe("baseline", () => {
  const history = [64, 66, 65, 65, 66, 64].map((v, i) =>
    reading("heartRate", v, (7 - i) * 60),
  );

  test("needs at least 5 points", () => {
    expect(computeBaseline(history.slice(0, 4))).toBeUndefined();
    expect(computeBaseline(history)?.n).toBe(6);
  });

  test("a deviation from the person's own normal gives warn even though the absolute value is normal", () => {
    const check = byBaseline(78, computeBaseline(history));
    expect(check?.status).toBe("warn");
    const ev = evaluateReading(
      reading("heartRate", 78),
      ctx("heartRate", history),
    );
    expect(ev.checks.range).toBe("ok");
    expect(ev.checks.baseline).toBe("warn");
    expect(ev.status).toBe("warn");
  });

  test("a small change does not trigger it", () => {
    expect(byBaseline(67, computeBaseline(history))?.status).toBe("ok");
  });
});

describe("trend", () => {
  const t = def("spo2").thresholds;

  test("SpO2 steadily falling toward the lower limit: warn", () => {
    const history = [reading("spo2", 99, 20), reading("spo2", 97, 10)];
    const trend = byTrend(t, history, reading("spo2", 96));
    expect(trend.status).toBe("warn");
    expect(trend.direction).toBe("falling");
    const ev = evaluateReading(reading("spo2", 96), ctx("spo2", history));
    expect(ev.checks.range).toBe("ok");
    expect(ev.status).toBe("warn");
  });

  test("non-monotonic values give no trend", () => {
    const history = [reading("spo2", 99, 20), reading("spo2", 98, 10)];
    expect(byTrend(t, history, reading("spo2", 99)).status).toBe("ok");
  });
});

describe("composite rules and zones", () => {
  const hr = evaluateReading(reading("heartRate", 130), ctx("heartRate"));
  const spo2 = evaluateReading(reading("spo2", 88), ctx("spo2"));

  test("chest pain is always crit and suggests Emergency", () => {
    const hits = evaluateComposite({}, ["chest-pain"]);
    expect(hits[0]).toMatchObject({
      id: "chest-pain",
      severity: "crit",
      suggestsEmergency: true,
    });
  });

  test("low SpO2 together with an abnormal heart rate", () => {
    const hits = evaluateComposite({ heartRate: hr, spo2 }, []);
    expect(hits.map((h) => h.id)).toContain("hypoxia-tachycardia");
  });

  test("the heart zone takes the worst status of its vitals", () => {
    const status = computeZoneStatus(zones, { heartRate: hr }, []);
    expect(status.heart).toBe("crit");
    expect(status.brain).toBe("unknown");
  });

  test("a composite rule raises its zones", () => {
    const status = computeZoneStatus(
      zones,
      {},
      evaluateComposite({}, ["chest-pain"]),
    );
    expect(status.heart).toBe("crit");
  });
});
