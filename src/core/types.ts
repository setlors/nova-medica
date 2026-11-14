
export const CONTRACT_VERSION = 2;

export const STATUSES = ["ok", "warn", "crit", "unknown"] as const;
export const MODES = ["idle", "measure", "emergency"] as const;

export const ENVIRONMENT_IDS = [
  "iss",
  "orion",
  "moon-base",
  "mars-transit",
] as const;

export const ZONE_IDS = [
  "heart",
  "brain",
  "lungs",
  "bones",
  "muscles",
  "immune",
  "metabolism",
] as const;

export const VITAL_IDS = [
  "heartRate",
  "bloodPressure",
  "temperature",
  "spo2",
  "glucose",
  "sleep",
  "mood",
] as const;

export const HAZARD_IDS = [
  "radiation",
  "isolation",
  "distance",
  "gravity",
  "closedEnvironment",
] as const;

export const SCENARIOS = ["normal", "slowDrift", "collapse"] as const;
export const READING_SOURCES = ["manual", "sensor", "self-report"] as const;

export type Status = (typeof STATUSES)[number];
export type Mode = (typeof MODES)[number];
export type EnvironmentId = (typeof ENVIRONMENT_IDS)[number];
export type ZoneId = (typeof ZONE_IDS)[number];
export type VitalId = (typeof VITAL_IDS)[number];
export type HazardId = (typeof HAZARD_IDS)[number];
export type Scenario = (typeof SCENARIOS)[number];
export type ReadingSource = (typeof READING_SOURCES)[number];

export interface Range {
  min: number;
  max: number;
}

export interface Thresholds {
  ok: Range;
  warn: Range;
}

export interface VitalReading {
  id: VitalId;
  value: number;
  secondary?: number;
  unit: string;
  takenAt: number;
  source: ReadingSource;
}

export interface VitalDef {
  id: VitalId;
  label: string;
  primaryLabel?: string;
  unit: string;
  plausible: Range;
  ttlMinutes: number;
  howTo: { step: string }[];
  why: string;
  thresholds: Thresholds;
  secondary?: {
    label: string;
    unit: string;
    plausible: Range;
    thresholds: Thresholds;
  };
  actions: {
    warn: string[];
    crit: string[];
  };
  sources: string[];
  unverified?: boolean;
}

export interface Environment {
  id: EnvironmentId;
  label: string;
  gravityG: number;
  commDelaySecOneWay: number;
  risks: HazardId[];
  medkit: string[];
  thresholdOverrides: Partial<Record<VitalId, Thresholds>>;
  reminders: {
    vital: VitalId;
    everyMinutes: number;
  }[];
}

export interface Zone {
  id: ZoneId;
  label: string;
  meshNames: string[];
  relatedVitals: VitalId[];
  function: string;
  spaceRisks: string[];
}

export interface Baseline {
  mean: number;
  sd: number;
  n: number;
}

export interface Evaluation {
  vital: VitalId;
  status: Status;
  reason: string;
  actions: string[];
  checks: {
    range: Status;
    secondary?: Status;
    baseline?: Status;
    trend: Status;
  };
  stale: boolean;
  takenAt: number;
}

export interface Alert {
  id: string;
  at: number;
  severity: Status;
  vital?: VitalId;
  message: string;
  suggestsEmergency: boolean;
  acknowledged?: boolean;
}

export interface EmergencyLogEntry {
  at: number;
  text: string;
}

export interface TriageOption {
  label: string;
  next: string;
}

export interface TriageAction {
  title: string;
  steps: string[];
  severity: Status;
  cameraTarget?: ZoneId;
  metronomeBpm?: number;
}

export interface TriageNode {
  id: string;
  question?: string;
  options?: TriageOption[];
  action?: TriageAction;
  voice?: string;
  sources?: string[];
  unverified?: boolean;
}

export interface TriageTree {
  start: string;
  nodes: Record<string, TriageNode>;
}

export interface DatabankChart {
  title: string;
  unit: string;
  source: string;
  points: {
    label: string;
    value: number;
  }[];
}

export interface DatabankEntry {
  id: string;
  title: string;
  category: "hazard" | "condition";
  summary: string;
  details: string[];
  relatedVitals: VitalId[];
  unlockedBy?: string;
  sources: string[];
  unverified?: boolean;
  chart?: DatabankChart;
}

export const STATUS_COLOR: Record<string, string> = {
  normal: "#2ee6a6",
  ok: "#2ee6a6",
  warning: "#ffb020",
  caution: "#ffb020",
  critical: "#ff3b4a",
  alert: "#ff3b4a",
  unknown: "#6b7a8c",
  offline: "#6b7a8c",
};
