import { usePda } from "../store";
import type { Scenario } from "../types";
import type { Simulator } from "./index";
import { createSimulator, generateHistory } from "./index";

let sim: Simulator | null = null;
let unsubscribe: (() => void) | null = null;

export const simulatorController = {
  get running() {
    return sim !== null;
  },

  start(
    options: { seed?: number; scenario?: Scenario; timeScale?: number } = {},
  ) {
    if (sim) return;
    const state = usePda.getState();
    sim = createSimulator({
      seed: options.seed,
      scenario: options.scenario ?? state.scenario,
      timeScale: options.timeScale ?? state.timeScale,
    });
    unsubscribe = sim.subscribe((tick) => {
      const s = usePda.getState();
      s.setSimClock(tick.clock);
      for (const reading of tick.readings) s.addReading(reading);
    });
    sim.start();
  },

  stop() {
    sim?.stop();
    unsubscribe?.();
    sim = null;
    unsubscribe = null;
    usePda.getState().setSimClock(null);
  },

  setScenario(scenario: Scenario) {
    usePda.getState().setScenario(scenario);
    sim?.setScenario(scenario);
  },

  setTimeScale(timeScale: number) {
    usePda.getState().setTimeScale(timeScale);
    sim?.setTimeScale(timeScale);
  },

  loadHistory(days = 14) {
    usePda.getState().loadHistory(generateHistory({ days }));
  },
};
