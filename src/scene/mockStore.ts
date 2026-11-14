import { create } from 'zustand';
import type { Status, ZoneId } from '../core/types';

const ZONES: ZoneId[] = ['heart', 'brain', 'lungs', 'bones', 'muscles', 'immune', 'metabolism'];

interface MockState {
  selectedZone: ZoneId | null;
  hoveredZone: ZoneId | null;
  cameraTarget: ZoneId | 'overview' | null;
  zoneStatus: Record<ZoneId, Status>;
  selectZone: (z: ZoneId | null) => void;
  hoverZone: (z: ZoneId | null) => void;
  setCameraTarget: (t: ZoneId | 'overview' | null) => void;
}

export const usePda = create<MockState>()((set) => ({
  selectedZone: null,
  hoveredZone: null,
  cameraTarget: 'overview',
  zoneStatus: Object.fromEntries(ZONES.map((z) => [z, 'unknown'])) as Record<ZoneId, Status>,
  selectZone: (selectedZone) => set({ selectedZone }),
  hoverZone: (hoveredZone) => set({ hoveredZone }),
  setCameraTarget: (cameraTarget) => set({ cameraTarget }),
}));