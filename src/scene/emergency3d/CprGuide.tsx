import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Mesh, type MeshBasicMaterial } from "three";

const reduce = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const noRaycast = () => null;

// Compression point: lower half of the sternum, just in front of the chest shell
const POS: [number, number, number] = [0, 1.25, 0.17];
// White, so it stays visible on the red Emergency hologram
const COLOR = "#ffffff";

// Pulsing target on the chest. bpm = metronome rate from the triage action
// (the usual CPR range is 100-120). No bpm = nothing is drawn.
export function CprGuide({ bpm }: { bpm?: number | null }) {
  const ring = useRef<Mesh>(null);
  const disc = useRef<Mesh>(null);
  const arrow = useRef<Mesh>(null);
  const phase = useRef(0);

  useFrame((_, dt) => {
    if (!bpm || !ring.current || !disc.current || !arrow.current) return;

    // 0 = released, 1 = fully pressed; the phase accumulates so a BPM change doesn't jump
    let press = 0;
    if (!reduce()) {
      phase.current += dt * (bpm / 60) * Math.PI * 2;
      press = 0.5 - 0.5 * Math.cos(phase.current);
    }

    ring.current.scale.setScalar(1 + 0.3 * (1 - press));
    (ring.current.material as MeshBasicMaterial).opacity = 0.45 + 0.4 * press;
    (disc.current.material as MeshBasicMaterial).opacity = 0.1 + 0.3 * press;
    arrow.current.position.z = 0.13 - 0.08 * press; // the arrow pushes toward the chest
  });

  if (!bpm) return null;

  return (
    <group position={POS} renderOrder={3}>
      <mesh ref={ring} raycast={noRaycast}>
        <torusGeometry args={[0.055, 0.005, 8, 40]} />
        <meshBasicMaterial
          color={COLOR}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={disc} raycast={noRaycast}>
        <circleGeometry args={[0.05, 32]} />
        <meshBasicMaterial
          color={COLOR}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      {/* the cone tip points into the chest (-z) */}
      <mesh
        ref={arrow}
        raycast={noRaycast}
        position={[0, 0, 0.13]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <coneGeometry args={[0.022, 0.06, 12]} />
        <meshBasicMaterial
          color={COLOR}
          transparent
          opacity={0.9}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
