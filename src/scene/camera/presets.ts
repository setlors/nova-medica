import type { ZoneId } from "../../core/types";

type V3 = [number, number, number];

export const CAMERA_PRESETS: Record<
  ZoneId | "overview",
  { target: V3; distance: number }
> = {
  overview: { target: [0, 0.95, 0], distance: 3.6 },
  brain: { target: [0, 1.7, 0], distance: 0.9 },
  heart: { target: [0.04, 1.3, 0.04], distance: 0.9 },
  lungs: { target: [0, 1.36, 0], distance: 1.1 },
  immune: { target: [0, 1.25, 0], distance: 1.2 },
  metabolism: { target: [0, 1.08, 0], distance: 1.0 },
  bones: { target: [0, 0.95, 0], distance: 3.0 },
  muscles: { target: [0, 0.95, 0], distance: 3.0 },
};
