import type {
  Environment,
  Range,
  Status,
  Thresholds,
  VitalDef,
  VitalId,
} from "../types";

export const STATUS_RANK: Record<Status, number> = {
  unknown: 0,
  ok: 1,
  warn: 2,
  crit: 3,
};

export function worst(...statuses: Status[]): Status {
  let result: Status = "unknown";
  for (const s of statuses) {
    if (STATUS_RANK[s] > STATUS_RANK[result]) result = s;
  }
  return result;
}

export function inRange(value: number, range: Range): boolean {
  return value >= range.min && value <= range.max;
}

export function classify(value: number, t: Thresholds): Status {
  if (inRange(value, t.ok)) return "ok";
  if (inRange(value, t.warn)) return "warn";
  return "crit";
}

export function isPlausible(value: number, range: Range): boolean {
  return Number.isFinite(value) && inRange(value, range);
}

// Environment thresholds take priority over the default ones.
export function getThresholds(
  def: VitalDef,
  environment?: Environment,
): Thresholds {
  return environment?.thresholdOverrides[def.id] ?? def.thresholds;
}

// Limits for the automatic alarm on sensor data. Outside the limits = alarm
export const ALARM_LIMITS: Partial<Record<VitalId, Range>> = {
  heartRate: { min: 30, max: 180 },
  spo2: { min: 85, max: 100 },
};

export function breachesAlarm(id: VitalId, value: number): boolean {
  const limits = ALARM_LIMITS[id];
  return limits ? !inRange(value, limits) : false;
}

// Numbers for the demo
export const BASELINE_WINDOW = 14;
export const MIN_BASELINE_POINTS = 5;
export const BASELINE_MIN_REL_SD = 0.05; // lower bound for sd: 5% of the mean
export const BASELINE_WARN_Z = 2;
export const BASELINE_WARN_REL = 0.1; // and at least a 10% deviation

export const TREND_POINTS = 3;
export const TREND_MIN_CHANGE = 0.25; // fraction of the ok range width
export const TREND_EDGE_ZONE = 0.3; // "close to the edge": fraction of the width
