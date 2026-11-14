import { create } from "zustand";
import { zoneForVital } from "../core/content";
import { usePda } from "../core/store";
import type { VitalId, VitalReading } from "../core/types";

interface HudState {
  measureVital: VitalId | null;
  chartsOpen: boolean;
  chartVital: VitalId;
  demoOpen: boolean;
  openMeasure: (id?: VitalId) => void;
  closeMeasure: () => void;
  toggleCharts: () => void;
  setChartVital: (id: VitalId) => void;
  toggleDemo: () => void;
}

export const useHud = create<HudState>()((set) => ({
  measureVital: null,
  chartsOpen: false,
  chartVital: "heartRate",
  demoOpen: true,

  openMeasure: (id) => {
    set({ measureVital: id ?? null });
    const pda = usePda.getState();
    if (pda.mode === "emergency") return;
    pda.setMode("measure");
    pda.setCameraTarget(id ? (zoneForVital(id) ?? "overview") : "overview");
  },

  closeMeasure: () => {
    set({ measureVital: null });
    const pda = usePda.getState();
    if (pda.mode === "measure") {
      pda.setMode("idle");
      pda.setCameraTarget("overview");
    }
  },

  toggleCharts: () => set((s) => ({ chartsOpen: !s.chartsOpen })),
  setChartVital: (chartVital) => set({ chartVital }),
  toggleDemo: () => set((s) => ({ demoOpen: !s.demoOpen })),
}));

export function formatReading(r?: VitalReading): string {
  if (!r) return "—";
  const v =
    r.secondary !== undefined ? `${r.value}/${r.secondary}` : `${r.value}`;
  return `${v} ${r.unit}`;
}

export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAgo(then: number, now: number): string {
  const min = Math.floor((now - then) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} days ago`;
}

export function formatDelay(sec: number): string {
  return sec < 60 ? `${sec} s` : `${Math.round(sec / 60)} min`;
}
