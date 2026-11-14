import { useFrame } from '@react-three/fiber';
import type { ShaderMaterial } from 'three';

const SCAN_MIN = 0;
const SCAN_MAX = 1.85;
const SCAN_PERIOD = 4; // seconds per sweep

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Drives the hologram material's time and beam height. Renders nothing itself.
export function ScanBeam({ material }: { material: ShaderMaterial }) {
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    material.uniforms.uTime!.value = t;
    // reduced motion: no beam
    material.uniforms.uScanY!.value = reduceMotion
      ? -10
      : SCAN_MIN + ((t % SCAN_PERIOD) / SCAN_PERIOD) * (SCAN_MAX - SCAN_MIN);
  });
  return null;
}