export {};
import type {
  Baseline,
  Environment,
  Evaluation,
  Status,
  Thresholds,
  VitalDef,
  VitalId,
  VitalReading,
  Zone,
  ZoneId,
} from "../types";
import { ZONE_IDS } from "../types";
import {
  BASELINE_MIN_REL_SD,
  BASELINE_WARN_REL,
  BASELINE_WARN_Z,
  BASELINE_WINDOW,
  MIN_BASELINE_POINTS,
  TREND_EDGE_ZONE,
  TREND_MIN_CHANGE,
  TREND_POINTS,
  classify,
  getThresholds,
  worst,
} from "./thresholds";

// ----- baseline -----

export function computeBaseline(history: VitalReading[]): Baseline | undefined {
  const recent = history.slice(-BASELINE_WINDOW);
  if (recent.length < MIN_BASELINE_POINTS) return undefined;
  const values = recent.map((r) => r.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return { mean, sd: Math.sqrt(variance), n: values.length };
}

export interface BaselineCheck {
  status: Status;
  z: number;
  rel: number;
}

export function byBaseline(
  value: number,
  baseline?: Baseline,
): BaselineCheck | undefined {
  if (!baseline) return undefined;
  const sd = Math.max(
    baseline.sd,
    Math.abs(baseline.mean) * BASELINE_MIN_REL_SD,
    1e-9,
  );
  const z = (value - baseline.mean) / sd;
  const rel =
    baseline.mean !== 0
      ? Math.abs(value - baseline.mean) / Math.abs(baseline.mean)
      : 0;
  const status: Status =
    Math.abs(z) >= BASELINE_WARN_Z && rel >= BASELINE_WARN_REL ? "warn" : "ok";
  return { status, z, rel };
}

// ----- trend -----

export interface TrendCheck {
  status: Status;
  direction?: "rising" | "falling";
}
export function byTrend(
  t: Thresholds,
  history: VitalReading[],
  current: VitalReading,
): TrendCheck {
  const points = [...history.slice(-(TREND_POINTS - 1)), current].map(
    (r) => r.value,
  );
  if (points.length < TREND_POINTS) return { status: "ok" };

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const width = t.ok.max - t.ok.min;
  if (width <= 0 || last < t.ok.min || last > t.ok.max) return { status: "ok" };

  const rising = points.every((v, i) => i === 0 || v > points[i - 1]!);
  const falling = points.every((v, i) => i === 0 || v < points[i - 1]!);
  if (!rising && !falling) return { status: "ok" };

  const change = Math.abs(last - first);
  const distanceToEdge = rising ? t.ok.max - last : last - t.ok.min;
  if (
    change >= width * TREND_MIN_CHANGE &&
    distanceToEdge <= width * TREND_EDGE_ZONE
  ) {
    return { status: "warn", direction: rising ? "rising" : "falling" };
  }
  return { status: "ok" };
}

// ----- evaluating a single reading -----

export interface EvalContext {
  def: VitalDef;
  environment?: Environment;
  history: VitalReading[];
  now: number;
}

function describeRange(
  label: string,
  value: number,
  unit: string,
  t: Thresholds,
  status: Status,
): string {
  const text = `${label} ${value}${unit ? ` ${unit}` : ""}`;
  const normal = `${t.ok.min}-${t.ok.max}`;
  if (status === "ok") return `${text} is within the normal range (${normal}).`;
  if (status === "warn")
    return `${text} is outside the normal range (${normal}).`;
  return `${text} is far outside the normal range (${normal}).`;
}

export function evaluateReading(
  reading: VitalReading,
  ctx: EvalContext,
): Evaluation {
  const { def } = ctx;
  const t = getThresholds(def, ctx.environment);

  const range = classify(reading.value, t);
  const secondary =
    def.secondary && reading.secondary !== undefined
      ? classify(reading.secondary, def.secondary.thresholds)
      : undefined;
  const baselineCheck = byBaseline(reading.value, computeBaseline(ctx.history));
  const trend = byTrend(t, ctx.history, reading);
  const stale = ctx.now - reading.takenAt > def.ttlMinutes * 60_000;

  const status: Status = stale
    ? "unknown"
    : worst(
        range,
        secondary ?? "unknown",
        baselineCheck?.status ?? "unknown",
        trend.status,
      );

  const reasons: string[] = [];
  if (stale) {
    reasons.push(
      `${def.label} was last measured more than ${Math.round(def.ttlMinutes / 60)} h ago. Measure it again.`,
    );
  } else {
    reasons.push(
      describeRange(
        def.primaryLabel ?? def.label,
        reading.value,
        def.unit,
        t,
        range,
      ),
    );
    if (def.secondary && reading.secondary !== undefined && secondary) {
      reasons.push(
        describeRange(
          def.secondary.label,
          reading.secondary,
          def.secondary.unit,
          def.secondary.thresholds,
          secondary,
        ),
      );
    }
    if (baselineCheck?.status === "warn") {
      reasons.push(
        `This is ${Math.round(baselineCheck.rel * 100)}% away from your own usual value.`,
      );
    }
    if (trend.status === "warn") {
      const edge = trend.direction === "rising" ? "upper" : "lower";
      reasons.push(
        `${def.label} has been ${trend.direction} over the last ${TREND_POINTS} readings and is approaching the ${edge} limit.`,
      );
    }
  }

  const actions = stale
    ? ["Take a new measurement."]
    : status === "warn" || status === "crit"
      ? def.actions[status]
      : [];

  return {
    vital: def.id,
    status,
    reason: reasons.join(" "),
    actions,
    checks: {
      range,
      secondary,
      baseline: baselineCheck?.status,
      trend: trend.status,
    },
    stale,
    takenAt: reading.takenAt,
  };
}

export function evaluateLatest(
  vitals: Partial<Record<VitalId, VitalReading[]>>,
  defs: VitalDef[],
  environment: Environment | undefined,
  now: number,
): Partial<Record<VitalId, Evaluation>> {
  const out: Partial<Record<VitalId, Evaluation>> = {};
  for (const def of defs) {
    const readings = vitals[def.id];
    const last = readings?.at(-1);
    if (!readings || !last) continue;
    out[def.id] = evaluateReading(last, {
      def,
      environment,
      history: readings.slice(0, -1),
      now,
    });
  }
  return out;
}

// ----- composite rules -----

export interface CompositeHit {
  id: string;
  severity: Status;
  message: string;
  suggestsEmergency: boolean;
  zones: ZoneId[];
}

interface CompositeInput {
  status: (id: VitalId) => Status;
  flags: string[];
}

interface CompositeRule {
  id: string;
  message: string;
  suggestsEmergency: (c: CompositeInput) => boolean;
  severity: (c: CompositeInput) => Status;
  zones: ZoneId[];
  when: (c: CompositeInput) => boolean;
}
const abnormal = (s: Status) => s === "warn" || s === "crit";

export const COMPOSITE_RULES: CompositeRule[] = [
  {
    id: "chest-pain",
    message: "Chest pain reported. Treat it as a possible cardiac event.",
    zones: ["heart"],
    when: (c) => c.flags.includes("chest-pain"),
    severity: () => "crit",
    suggestsEmergency: () => true,
  },
  {
    id: "hypoxia-tachycardia",
    message: "Low oxygen saturation together with an abnormal heart rate.",
    zones: ["heart", "lungs"],
    when: (c) => abnormal(c.status("spo2")) && abnormal(c.status("heartRate")),
    severity: (c) =>
      c.status("spo2") === "crit" || c.status("heartRate") === "crit"
        ? "crit"
        : "warn",
    suggestsEmergency: (c) =>
      c.status("spo2") === "crit" || c.status("heartRate") === "crit",
  },
  {
    id: "fever-tachycardia",
    message:
      "Abnormal temperature together with an abnormal heart rate: possible infection. Contact the flight surgeon.",
    zones: ["immune", "heart"],
    when: (c) =>
      abnormal(c.status("temperature")) && abnormal(c.status("heartRate")),
    severity: () => "warn",
    suggestsEmergency: () => false,
  },
  {
    id: "poor-sleep-low-mood",
    message:
      "Poor sleep together with low mood. Review workload and rest, and talk to a crewmate or the flight surgeon.",
    zones: ["brain"],
    when: (c) => abnormal(c.status("sleep")) && abnormal(c.status("mood")),
    severity: () => "warn",
    suggestsEmergency: () => false,
  },
];

export function evaluateComposite(
  evaluations: Partial<Record<VitalId, Evaluation>>,
  flags: string[],
): CompositeHit[] {
  const input: CompositeInput = {
    status: (id) => evaluations[id]?.status ?? "unknown",
    flags,
  };
  return COMPOSITE_RULES.filter((r) => r.when(input)).map((r) => ({
    id: r.id,
    severity: r.severity(input),
    message: r.message,
    suggestsEmergency: r.suggestsEmergency(input),
    zones: r.zones,
  }));
}

// ----- zone statuses -----

export function initialZoneStatus(): Record<ZoneId, Status> {
  return Object.fromEntries(ZONE_IDS.map((z) => [z, "unknown"])) as Record<
    ZoneId,
    Status
  >;
}
export function computeZoneStatus(
  zones: Zone[],
  evaluations: Partial<Record<VitalId, Evaluation>>,
  hits: CompositeHit[],
): Record<ZoneId, Status> {
  const out = initialZoneStatus();
  for (const zone of zones) {
    out[zone.id] = worst(
      ...zone.relatedVitals.map((v) => evaluations[v]?.status ?? "unknown"),
    );
  }
  for (const hit of hits) {
    for (const zoneId of hit.zones)
      out[zoneId] = worst(out[zoneId], hit.severity);
  }
  return out;
}
