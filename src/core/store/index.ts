import { create } from "zustand";
import {
  getEnvironment,
  getVitalDef,
  vitalDefs,
  zoneForVital,
  zones,
} from "../content";
import type { CompositeHit } from "../rules/evaluate";
import {
  computeBaseline,
  computeZoneStatus,
  evaluateComposite,
  evaluateLatest,
  initialZoneStatus,
} from "../rules/evaluate";
import { breachesAlarm, isPlausible } from "../rules/thresholds";
import type {
  Alert,
  Baseline,
  EmergencyLogEntry,
  EnvironmentId,
  Evaluation,
  Mode,
  Scenario,
  Status,
  VitalId,
  VitalReading,
  ZoneId,
} from "../types";

const MAX_ALERTS = 50;
const MAX_READINGS_PER_VITAL = 5000;

export interface MeasurementResult {
  ok: boolean;
  error?: string;
  evaluation?: Evaluation;
}

export interface PdaState {
  mode: Mode;
  environment: EnvironmentId;
  selectedZone: ZoneId | null;
  hoveredZone: ZoneId | null;
  cameraTarget: ZoneId | "overview" | null;
  zoneStatus: Record<ZoneId, Status>;
  vitals: Partial<Record<VitalId, VitalReading[]>>;
  evaluations: Partial<Record<VitalId, Evaluation>>;
  baseline: Partial<Record<VitalId, Baseline>>;
  alerts: Alert[];
  /** Flags from self-reports and questionnaires, e.g. "chest-pain" */
  flags: string[];
  scenario: Scenario;
  timeScale: number;
  /** Virtual clock of the simulator; null = real time */
  simClock: number | null;
  emergencyLog: EmergencyLogEntry[];

  setMode: (mode: Mode) => void;
  setEnvironment: (environment: EnvironmentId) => void;
  selectZone: (zone: ZoneId | null) => void;
  hoverZone: (zone: ZoneId | null) => void;
  setCameraTarget: (target: ZoneId | "overview" | null) => void;
  setScenario: (scenario: Scenario) => void;
  setTimeScale: (timeScale: number) => void;
  setSimClock: (clock: number | null) => void;
  getNow: () => number;

  addReading: (reading: VitalReading) => void;
  /** For the HUD: validates the value, sets the timestamp and adds the reading. */
  recordMeasurement: (
    id: VitalId,
    value: number,
    secondary?: number,
  ) => MeasurementResult;
  loadHistory: (readings: VitalReading[]) => void;
  setFlag: (flag: string, on: boolean) => void;
  dismissAlert: (id: string) => void;

  startEmergency: (reason?: string) => void;
  endEmergency: () => void;
  logEmergency: (text: string) => void;
  reset: () => void;
}

function initialData() {
  return {
    mode: "idle" as Mode,
    environment: "iss" as EnvironmentId,
    selectedZone: null as ZoneId | null,
    hoveredZone: null as ZoneId | null,
    cameraTarget: "overview" as ZoneId | "overview" | null,
    zoneStatus: initialZoneStatus(),
    vitals: {} as PdaState["vitals"],
    evaluations: {} as PdaState["evaluations"],
    baseline: {} as PdaState["baseline"],
    alerts: [] as Alert[],
    flags: [] as string[],
    scenario: "normal" as Scenario,
    timeScale: 1,
    simClock: null as number | null,
    emergencyLog: [] as EmergencyLogEntry[],
  };
}

function recompute(
  vitals: PdaState["vitals"],
  flags: string[],
  environmentId: EnvironmentId,
  now: number,
) {
  const environment = getEnvironment(environmentId);
  const evaluations = evaluateLatest(vitals, vitalDefs, environment, now);
  const hits = evaluateComposite(evaluations, flags);
  const zoneStatus = computeZoneStatus(zones, evaluations, hits);
  return { evaluations, hits, zoneStatus };
}

/** Syncs alerts from composite rules: adds new ones and removes those that are gone. */
function syncRuleAlerts(
  alerts: Alert[],
  hits: CompositeHit[],
  now: number,
): Alert[] {
  const hitIds = new Set(hits.map((h) => `rule:${h.id}`));
  const kept = alerts.filter(
    (a) => !a.id.startsWith("rule:") || hitIds.has(a.id),
  );
  const have = new Set(kept.map((a) => a.id));
  const fresh: Alert[] = hits
    .filter((h) => !have.has(`rule:${h.id}`))
    .map((h) => ({
      id: `rule:${h.id}`,
      at: now,
      severity: h.severity,
      message: h.message,
      suggestsEmergency: h.suggestsEmergency,
    }));
  return [...fresh, ...kept].slice(0, MAX_ALERTS);
}

export const usePda = create<PdaState>()((set, get) => ({
  ...initialData(),

  setMode: (mode) => set({ mode }),
  selectZone: (selectedZone) => set({ selectedZone }),
  hoverZone: (hoveredZone) => set({ hoveredZone }),
  setCameraTarget: (cameraTarget) => set({ cameraTarget }),
  setScenario: (scenario) => set({ scenario }),
  setTimeScale: (timeScale) => set({ timeScale }),
  setSimClock: (simClock) => set({ simClock }),
  getNow: () => get().simClock ?? Date.now(),

  setEnvironment: (environment) =>
    set((state) => {
      const now = state.simClock ?? Date.now();
      const d = recompute(state.vitals, state.flags, environment, now);
      return {
        environment,
        evaluations: d.evaluations,
        zoneStatus: d.zoneStatus,
        alerts: syncRuleAlerts(state.alerts, d.hits, now),
      };
    }),

  addReading: (reading) =>
    set((state) => {
      const now = state.simClock ?? Date.now();
      const nextHistory = [...(state.vitals[reading.id] ?? []), reading].slice(
        -MAX_READINGS_PER_VITAL,
      );
      const vitals = { ...state.vitals };
      vitals[reading.id] = nextHistory;
      const baseline = { ...state.baseline };
      baseline[reading.id] = computeBaseline(nextHistory);

      const d = recompute(vitals, state.flags, state.environment, now);
      const ev = d.evaluations[reading.id];
      const previousStatus = state.evaluations[reading.id]?.status;

      let alerts = syncRuleAlerts(state.alerts, d.hits, now);
      // a per-vital alert is created only when the status changes (so a sensor stream does not flood the list)
      if (
        ev &&
        (ev.status === "warn" || ev.status === "crit") &&
        ev.status !== previousStatus
      ) {
        alerts = [
          {
            id: `${reading.id}-${reading.takenAt}`,
            at: reading.takenAt,
            severity: ev.status,
            vital: reading.id,
            message: ev.reason,
            suggestsEmergency: false,
          },
          ...alerts,
        ].slice(0, MAX_ALERTS);
      }

      // automatic alarm: sensor data only
      let { mode, cameraTarget } = state;
      let emergencyLog = state.emergencyLog;
      const alarmId = `alarm:${reading.id}`;
      const isSensor = reading.source === "sensor";
      const breach = isSensor && breachesAlarm(reading.id, reading.value);
      if (breach && !alerts.some((a) => a.id === alarmId)) {
        const label = getVitalDef(reading.id)?.label ?? reading.id;
        const text = `Automatic alarm: ${label} ${reading.value} ${reading.unit}.`;
        alerts = [
          {
            id: alarmId,
            at: reading.takenAt,
            severity: "crit" as Status,
            vital: reading.id,
            message: text,
            suggestsEmergency: true,
          },
          ...alerts,
        ];
        emergencyLog = [...emergencyLog, { at: reading.takenAt, text }];
        if (mode !== "emergency") {
          mode = "emergency";
          cameraTarget = zoneForVital(reading.id) ?? "heart";
        }
      } else if (isSensor && !breach) {
        alerts = alerts.filter((a) => a.id !== alarmId); // the alarm episode is over
      }

      return {
        vitals,
        baseline,
        evaluations: d.evaluations,
        zoneStatus: d.zoneStatus,
        alerts,
        mode,
        cameraTarget,
        emergencyLog,
      };
    }),

  recordMeasurement: (id, value, secondary) => {
    const def = getVitalDef(id);
    if (!def) return { ok: false, error: `Unknown vital "${id}".` };
    if (!isPlausible(value, def.plausible)) {
      return {
        ok: false,
        error: `${def.primaryLabel ?? def.label} must be between ${def.plausible.min} and ${def.plausible.max} ${def.unit}.`,
      };
    }
    if (def.secondary) {
      if (secondary === undefined)
        return {
          ok: false,
          error: `${def.secondary.label} value is required.`,
        };
      if (!isPlausible(secondary, def.secondary.plausible)) {
        return {
          ok: false,
          error: `${def.secondary.label} must be between ${def.secondary.plausible.min} and ${def.secondary.plausible.max} ${def.secondary.unit}.`,
        };
      }
    }
    const reading: VitalReading = {
      id,
      value,
      secondary: def.secondary ? secondary : undefined,
      unit: def.unit,
      takenAt: get().getNow(),
      source: id === "sleep" || id === "mood" ? "self-report" : "manual",
    };
    get().addReading(reading);
    return { ok: true, evaluation: get().evaluations[id] };
  },

  loadHistory: (readings) =>
    set((state) => {
      const vitals = { ...state.vitals };
      const baseline = { ...state.baseline };
      const byId = new Map<VitalId, VitalReading[]>();
      for (const r of readings) {
        const list = byId.get(r.id);
        if (list) list.push(r);
        else byId.set(r.id, [r]);
      }
      for (const [id, list] of byId) {
        const merged = [...(state.vitals[id] ?? []), ...list]
          .sort((a, b) => a.takenAt - b.takenAt)
          .slice(-MAX_READINGS_PER_VITAL);
        vitals[id] = merged;
        baseline[id] = computeBaseline(merged);
      }
      const now = state.simClock ?? Date.now();
      const d = recompute(vitals, state.flags, state.environment, now);
      return {
        vitals,
        baseline,
        evaluations: d.evaluations,
        zoneStatus: d.zoneStatus,
        alerts: syncRuleAlerts(state.alerts, d.hits, now),
      };
    }),

  setFlag: (flag, on) =>
    set((state) => {
      const has = state.flags.includes(flag);
      if (on === has) return {};
      const flags = on
        ? [...state.flags, flag]
        : state.flags.filter((f) => f !== flag);
      const now = state.simClock ?? Date.now();
      const d = recompute(state.vitals, flags, state.environment, now);
      return {
        flags,
        evaluations: d.evaluations,
        zoneStatus: d.zoneStatus,
        alerts: syncRuleAlerts(state.alerts, d.hits, now),
      };
    }),

  dismissAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a,
      ),
    })),

  startEmergency: (reason) =>
    set((state) => ({
      mode: "emergency",
      emergencyLog: [
        ...state.emergencyLog,
        {
          at: state.simClock ?? Date.now(),
          text: reason
            ? `Emergency mode started: ${reason}`
            : "Emergency mode started.",
        },
      ],
    })),

  endEmergency: () =>
    set((state) => ({
      mode: "idle",
      cameraTarget: "overview",
      alerts: state.alerts.map((a) =>
        a.id.startsWith("alarm:") ? { ...a, acknowledged: true } : a,
      ),
      emergencyLog: [
        ...state.emergencyLog,
        { at: state.simClock ?? Date.now(), text: "Emergency mode ended." },
      ],
    })),

  logEmergency: (text) =>
    set((state) => ({
      emergencyLog: [
        ...state.emergencyLog,
        { at: state.simClock ?? Date.now(), text },
      ],
    })),

  reset: () => set(initialData()),
}));
