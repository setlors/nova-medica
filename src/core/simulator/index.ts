import type { Scenario, VitalId, VitalReading } from "../types";

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export interface SimTick {
  clock: number;
  readings: VitalReading[];
}

export interface SimulatorOptions {
  seed?: number;
  scenario?: Scenario;
  timeScale?: number;
  startTime?: number;
  tickMs?: number;
}

export interface Simulator {
  start: () => void;
  stop: () => void;
  step: () => SimTick;
  setScenario: (scenario: Scenario) => void;
  setTimeScale: (timeScale: number) => void;
  subscribe: (cb: (tick: SimTick) => void) => () => void;
  readonly clock: number;
  readonly scenario: Scenario;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng: () => number, sd: number): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
}

interface Profile {
  base: number;
  circadianAmp: number;
  peakHour: number;
  noise: number;
  decimals: number;
  min: number;
  max: number;
  unit: string;
}

const PROFILES: Record<VitalId, Profile> = {
  heartRate: {
    base: 66,
    circadianAmp: 6,
    peakHour: 15,
    noise: 2,
    decimals: 0,
    min: 20,
    max: 250,
    unit: "bpm",
  },
  spo2: {
    base: 97.5,
    circadianAmp: 0,
    peakHour: 0,
    noise: 0.5,
    decimals: 0,
    min: 50,
    max: 100,
    unit: "%",
  },
  temperature: {
    base: 36.6,
    circadianAmp: 0.25,
    peakHour: 17,
    noise: 0.08,
    decimals: 1,
    min: 30,
    max: 43,
    unit: "°C",
  },
  bloodPressure: {
    base: 118,
    circadianAmp: 4,
    peakHour: 16,
    noise: 3,
    decimals: 0,
    min: 60,
    max: 260,
    unit: "mmHg",
  },
  glucose: {
    base: 88,
    circadianAmp: 0,
    peakHour: 0,
    noise: 5,
    decimals: 0,
    min: 20,
    max: 600,
    unit: "mg/dL",
  },
  sleep: {
    base: 7.2,
    circadianAmp: 0,
    peakHour: 0,
    noise: 0.6,
    decimals: 1,
    min: 0,
    max: 24,
    unit: "h",
  },
  mood: {
    base: 4.1,
    circadianAmp: 0,
    peakHour: 0,
    noise: 0.6,
    decimals: 0,
    min: 1,
    max: 5,
    unit: "/5",
  },
};

const DIASTOLIC: Profile = {
  base: 76,
  circadianAmp: 3,
  peakHour: 16,
  noise: 2,
  decimals: 0,
  min: 30,
  max: 160,
  unit: "mmHg",
};

function rawValue(p: Profile, clock: number, rng: () => number): number {
  const hour = (clock % DAY_MS) / HOUR_MS;
  const circadian =
    p.circadianAmp * Math.cos((2 * Math.PI * (hour - p.peakHour)) / 24);
  return p.base + circadian + gauss(rng, p.noise);
}

function finalize(p: Profile, value: number): number {
  const clamped = Math.min(p.max, Math.max(p.min, value));
  const k = 10 ** p.decimals;
  return Math.round(clamped * k) / k;
}

interface ScenarioState {
  scenario: Scenario;
  clock: number;
  start: number;
  tick: number;
}

function applyScenario(id: VitalId, value: number, s: ScenarioState): number {
  if (s.scenario === "slowDrift") {
    // over 6 simulated hours: SpO2 drops by 6, heart rate rises by 25, temperature by 0.9
    const ramp = Math.min(1, Math.max(0, (s.clock - s.start) / (6 * HOUR_MS)));
    if (id === "heartRate") return value + 25 * ramp;
    if (id === "spo2") return value - 6 * ramp;
    if (id === "temperature") return value + 0.9 * ramp;
  }
  if (s.scenario === "collapse") {
    if (s.tick >= 3) {
      const k = s.tick - 3;
      if (id === "heartRate") return Math.min(195, 100 + k * 12);
      if (id === "spo2") return Math.max(84, 94 - k * 0.8);
    }
  }
  return value;
}

const SENSOR_VITALS: VitalId[] = ["heartRate", "spo2", "temperature"];

export function createSimulator(options: SimulatorOptions = {}): Simulator {
  const rng = mulberry32(options.seed ?? 42);
  const tickMs = options.tickMs ?? 1000;
  let scenario: Scenario = options.scenario ?? "normal";
  let timeScale = options.timeScale ?? 1;
  let clock = options.startTime ?? Date.now();
  let scenarioStart = clock;
  let scenarioTick = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<(tick: SimTick) => void>();

  function step(): SimTick {
    clock += tickMs * timeScale;
    const state: ScenarioState = {
      scenario,
      clock,
      start: scenarioStart,
      tick: scenarioTick,
    };
    const readings: VitalReading[] = SENSOR_VITALS.map((id) => {
      const p = PROFILES[id];
      return {
        id,
        value: finalize(p, applyScenario(id, rawValue(p, clock, rng), state)),
        unit: p.unit,
        takenAt: clock,
        source: "sensor",
      };
    });
    scenarioTick += 1;
    const tick: SimTick = { clock, readings };
    listeners.forEach((cb) => cb(tick));
    return tick;
  }

  return {
    start() {
      if (!timer) timer = setInterval(step, tickMs);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
    },
    step,
    setScenario(next) {
      scenario = next;
      scenarioStart = clock;
      scenarioTick = 0;
    },
    setTimeScale(next) {
      timeScale = Math.max(0.1, next);
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    get clock() {
      return clock;
    },
    get scenario() {
      return scenario;
    },
  };
}

/**
 * Demo history: every day heart rate, SpO2 and temperature at 08:00 and 20:00,
 * blood pressure and glucose in the morning, sleep at 07:00, mood at 21:00.
 * No values are generated in the future.
 */
export function generateHistory(opts: {
  days: number;
  endTime?: number;
  seed?: number;
}): VitalReading[] {
  const rng = mulberry32(opts.seed ?? 7);
  const end = opts.endTime ?? Date.now();
  const todayStart = Math.floor(end / DAY_MS) * DAY_MS;
  const out: VitalReading[] = [];

  const make = (
    id: VitalId,
    takenAt: number,
    source: VitalReading["source"],
  ): VitalReading => {
    const p = PROFILES[id];
    return {
      id,
      value: finalize(p, rawValue(p, takenAt, rng)),
      unit: p.unit,
      takenAt,
      source,
    };
  };

  for (let d = opts.days; d >= 0; d--) {
    const dayStart = todayStart - d * DAY_MS;
    const at = (hour: number) => dayStart + hour * HOUR_MS;
    const add = (r: VitalReading) => {
      if (r.takenAt <= end) out.push(r);
    };

    for (const hour of [8, 20]) {
      add(make("heartRate", at(hour), "sensor"));
      add(make("spo2", at(hour), "sensor"));
      add(make("temperature", at(hour), "sensor"));
    }
    const morning = at(8) + 5 * 60_000;
    add({
      ...make("bloodPressure", morning, "manual"),
      secondary: finalize(DIASTOLIC, rawValue(DIASTOLIC, morning, rng)),
    });
    add(make("glucose", at(8), "manual"));
    add(make("sleep", at(7), "self-report"));
    add(make("mood", at(21), "self-report"));
  }
  return out.sort((a, b) => a.takenAt - b.takenAt);
}
