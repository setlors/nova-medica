import { create } from "zustand";
import { databank, zoneForVital } from "../core/content";
import { usePda } from "../core/store";
import type { DatabankEntry, VitalId, VitalReading } from "../core/types";

export type SidePanel = "databank" | "groundlink" | null;

const PROGRESS_KEY = "nova-medica:progress:v1";

interface Progress {
  read: string[];
  unlocked: string[];
}

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>;
      return {
        read: Array.isArray(p.read) ? p.read : [],
        unlocked: Array.isArray(p.unlocked) ? p.unlocked : [],
      };
    }
  } catch {}
  return { read: [], unlocked: [] };
}

function saveProgress(p: Progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {}
}

export const isEntryUnlocked = (e: DatabankEntry, unlocked: string[]) =>
  !e.unlockedBy || unlocked.includes(e.id);

interface HudState {
  measureVital: VitalId | null;
  chartsOpen: boolean;
  chartVital: VitalId;
  demoOpen: boolean;
  sidePanel: SidePanel;
  read: string[];
  unlocked: string[];
  openMeasure: (id?: VitalId) => void;
  closeMeasure: () => void;
  toggleCharts: () => void;
  setChartVital: (id: VitalId) => void;
  toggleDemo: () => void;
  openSide: (panel: Exclude<SidePanel, null>) => void;
  closeSide: () => void;
  markRead: (id: string) => void;
  unlockEntry: (id: string) => void;
}

const initialProgress = loadProgress();

export const useHud = create<HudState>()((set, get) => ({
  measureVital: null,
  chartsOpen: false,
  chartVital: "heartRate",
  demoOpen: true,
  sidePanel: null,
  read: initialProgress.read,
  unlocked: initialProgress.unlocked,

  openMeasure: (id) => {
    set({ measureVital: id ?? null, sidePanel: null });
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

  openSide: (panel) => {
    if (usePda.getState().mode === "emergency") return;
    if (usePda.getState().mode === "measure") get().closeMeasure();
    set({ sidePanel: panel });
  },
  closeSide: () => set({ sidePanel: null }),

  markRead: (id) => {
    const { read, unlocked } = get();
    const nextRead = read.includes(id) ? read : [...read, id];
    const nextUnlocked = new Set(unlocked);
    for (const e of databank) if (e.unlockedBy === id) nextUnlocked.add(e.id);
    const u = [...nextUnlocked];
    saveProgress({ read: nextRead, unlocked: u });
    set({ read: nextRead, unlocked: u });
  },

  unlockEntry: (id) => {
    const { read, unlocked } = get();
    if (unlocked.includes(id)) return;
    const u = [...unlocked, id];
    saveProgress({ read, unlocked: u });
    set({ unlocked: u });
  },
}));

// Unlock condition entries when a related vital turns warn or crit.
usePda.subscribe((s) => {
  const { unlocked, unlockEntry } = useHud.getState();
  for (const e of databank) {
    if (!e.unlockedBy || unlocked.includes(e.id)) continue;
    const changed = e.relatedVitals.some((v) => {
      const st = s.evaluations[v]?.status;
      return st === "warn" || st === "crit";
    });
    if (changed) unlockEntry(e.id);
  }
});

// ----- formatting helpers -----

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
