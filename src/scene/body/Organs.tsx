import { Fragment, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshBasicMaterial, MeshStandardMaterial, type Group, type Object3D } from 'three';
import zonesJson from '../../data/zones.json';
import type { Zone, ZoneId } from '../../core/types';
import { usePda } from "../../core/store";
import { STATUS_COLOR } from './shaders';
import { G, memo, tube, type V3 } from './organGeometry';

const zones = zonesJson as unknown as Zone[];
const noRaycast = () => null; // decorative parts must not swallow clicks
const SIDES = [-1, 1] as const; // +x = the body's left (the model faces +z)
const PULSE_AMP = 0.15;

const OPACITY: Partial<Record<ZoneId, number>> = { bones: 0.85, muscles: 0.3 };

type Builder = (m: MeshStandardMaterial, w: MeshBasicMaterial) => ReactNode;

// ── helpers ──────────────────────────────────────────────────────────

// Straight or curved bone with a knob at each end
function Bone({ m, pts, r, knob = 1.7 }: { m: MeshStandardMaterial; pts: V3[]; r: number; knob?: number }) {
  const geo = memo(`bone:${pts.join('|')}:${r}`, () => tube(pts, r, 12, 8));
  return (
    <>
      <mesh geometry={geo} material={m} />
      <mesh material={m} position={pts[0]}>
        <sphereGeometry args={[r * knob, 12, 8]} />
      </mesh>
      <mesh material={m} position={pts[pts.length - 1]}>
        <sphereGeometry args={[r * knob, 12, 8]} />
      </mesh>
    </>
  );
}

// Muscle belly: thick in the middle, pointed at both ends. peak < 1 moves the belly towards the start.
function Spindle({ m, a, b, r, peak = 1 }: { m: MeshStandardMaterial; a: V3; b: V3; r: number; peak?: number }) {
  const geo = memo(`sp:${a}|${b}|${r}|${peak}`, () =>
    tube([a, b], (t) => r * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, peak))), 0.6), 16, 12),
  );
  return <mesh geometry={geo} material={m} />;
}

// ── brain ────────────────────────────────────────────────────────────
function Brain({ m }: { m: MeshStandardMaterial }) {
  return (
    <group name="brain" position={[0, 1.7, 0.01]}>
      <mesh material={m} geometry={G.hemisphere()} position={[0.038, 0, 0]} />
      <mesh material={m} geometry={G.hemisphere()} position={[-0.038, 0, 0]} scale={[-1, 1, 1]} />
      <mesh material={m} geometry={G.cerebellum()} position={[0, -0.048, -0.062]} />
      <mesh material={m} geometry={G.brainStem()} />
    </group>
  );
}

// ── heart (group is named "heart": the pulse scales the whole group) ──
function Heart({ m }: { m: MeshStandardMaterial }) {
  return (
    <group name="heart" position={[0.04, 1.3, 0.04]}>
      <mesh material={m} geometry={G.heartBody()} />
      <mesh material={m} geometry={G.atrium()} position={[-0.03, 0.035, -0.01]} />
      <mesh material={m} geometry={G.atrium()} position={[0.03, 0.04, 0.005]} scale={[0.6, 0.6, 0.6]} />
      <mesh material={m} geometry={G.aorta()} />
      <mesh material={m} geometry={G.pulmTrunk()} />
      <mesh material={m} geometry={G.svc()} />
    </group>
  );
}

// ── skeleton ─────────────────────────────────────────────────────────
const SPINE_Z: [number, number][] = [
  [1.53, -0.04], [1.42, -0.06], [1.3, -0.085], [1.18, -0.082], [1.06, -0.06], [0.95, -0.068], [0.88, -0.075],
];
function spineZ(y: number) {
  for (let i = 0; i < SPINE_Z.length - 1; i++) {
    const [y0, z0] = SPINE_Z[i]!;
    const [y1, z1] = SPINE_Z[i + 1]!;
    if (y <= y0 && y >= y1) return z0 + ((y0 - y) / (y0 - y1)) * (z1 - z0);
  }
  return SPINE_Z[SPINE_Z.length - 1]![1];
}
const VERT = (() => {
  const out: { y: number; z: number; r: number }[] = [];
  const add = (n: number, y0: number, step: number, r0: number, r1: number) => {
    for (let i = 0; i < n; i++) {
      const y = y0 - i * step;
      out.push({ y, z: spineZ(y), r: r0 + ((r1 - r0) * i) / (n - 1) });
    }
  };
  add(7, 1.52, 0.02, 0.009, 0.012); // cervical
  add(12, 1.38, 0.018, 0.013, 0.019); // thoracic
  add(5, 1.155, 0.026, 0.021, 0.024); // lumbar
  return out;
})();

function Skeleton({ m, w }: { m: MeshStandardMaterial; w: MeshBasicMaterial }) {
  return (
    <group name="skeleton">
      {/* skull: wireframe cranium so the brain stays visible */}
      <mesh raycast={noRaycast} material={w} position={[0, 1.7, -0.005]}>
        <sphereGeometry args={[0.105, 18, 12]} />
      </mesh>
      <mesh material={m} geometry={G.jaw()} />
      <mesh material={m} geometry={G.maxilla()} />
      {SIDES.map((s) => (
        <mesh key={s} material={m} position={[s * 0.035, 1.69, 0.097]}>
          <torusGeometry args={[0.016, 0.0035, 8, 20]} />
        </mesh>
      ))}

      {/* spine */}
      {VERT.map((v, i) => (
        <group key={i} position={[0, v.y, v.z]}>
          <mesh material={m} scale={[v.r, 1, v.r]}>
            <cylinderGeometry args={[1, 1, 0.014, 10]} />
          </mesh>
          <mesh material={m} position={[0, -0.003, -(v.r + 0.01)]}>
            <boxGeometry args={[0.005, 0.005, 0.022]} />
          </mesh>
        </group>
      ))}

      {/* rib cage: visual only, no raycast, otherwise it blocks organ clicks */}
      {Array.from({ length: G.ribCount }, (_, i) => (
        <Fragment key={i}>
          {SIDES.map((s) => (
            <mesh key={s} material={m} raycast={noRaycast} geometry={G.rib(i, s)} />
          ))}
        </Fragment>
      ))}
      <mesh material={m} position={[0, 1.41, 0.103]}>
        <boxGeometry args={[0.04, 0.05, 0.01]} />
      </mesh>
      <mesh material={m} position={[0, 1.3, 0.103]}>
        <boxGeometry args={[0.028, 0.17, 0.009]} />
      </mesh>
      <mesh material={m} position={[0, 1.2, 0.103]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.008, 0.025, 4]} />
      </mesh>

      {/* shoulder girdle and arms */}
      {SIDES.map((s) => (
        <group key={s}>
          <mesh material={m} geometry={G.clavicle(s)} />
          <mesh material={m} geometry={G.scapula()} position={[s * 0.12, 1.37, -0.095]} rotation={[0.15, -s * 0.3, s * 0.4]} />
          <Bone m={m} pts={[[s * 0.3, 1.45, 0], [s * 0.3, 1.22, 0]]} r={0.0095} knob={1.6} />
          <Bone m={m} pts={[[s * 0.3, 1.2, 0.008], [s * 0.3, 0.975, 0.01]]} r={0.0055} knob={1.5} />
          <Bone m={m} pts={[[s * 0.3, 1.2, -0.008], [s * 0.3, 0.97, -0.01]]} r={0.0058} knob={1.5} />
          {[0, 1, 2, 3, 4].map((f) => (
            <Bone
              key={f}
              m={m}
              pts={[[s * 0.3, 0.975, 0], [s * 0.3 + (f - 2) * 0.006, 0.93, 0], [s * 0.3 + (f - 2) * 0.012, 0.875, 0]]}
              r={0.0035}
              knob={1.3}
            />
          ))}
        </group>
      ))}

      {/* pelvis */}
      <mesh material={m} geometry={G.sacrum()} position={[0, 0.985, -0.07]} />
      <mesh material={m} position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.75, 1]}>
        <torusGeometry args={[0.1, 0.007, 8, 32]} />
      </mesh>
      {SIDES.map((s) => (
        <mesh key={s} material={m} geometry={G.iliac()} position={[s * 0.095, 0.97, -0.02]} rotation={[0, -s * 0.6, s * 0.25]} />
      ))}

      {/* legs */}
      {SIDES.map((s) => (
        <group key={s}>
          <Bone m={m} pts={[[s * 0.1, 0.885, 0], [s * 0.122, 0.85, 0], [s * 0.115, 0.67, 0.005], [s * 0.1, 0.485, 0.01]]} r={0.011} knob={1.5} />
          <mesh material={m} position={[s * 0.1, 0.47, 0.032]} scale={[1, 1.1, 0.5]}>
            <sphereGeometry args={[0.014, 12, 8]} />
          </mesh>
          <Bone m={m} pts={[[s * 0.1, 0.455, 0.005], [s * 0.1, 0.08, 0]]} r={0.0095} knob={1.4} />
          <Bone m={m} pts={[[s * 0.112, 0.44, -0.012], [s * 0.112, 0.085, -0.012]]} r={0.0045} knob={1.4} />
          <Bone m={m} pts={[[s * 0.1, 0.06, -0.035], [s * 0.1, 0.035, 0.03], [s * 0.1, 0.022, 0.1]]} r={0.012} knob={1} />
        </group>
      ))}
    </group>
  );
}

// ── muscles ──────────────────────────────────────────────────────────
function Muscles({ m }: { m: MeshStandardMaterial }) {
  return (
    <group name="muscles">
      {/* back */}
      <mesh material={m} geometry={memo('back', () => G.scapula().clone().scale(2.8, 2.5, 3))} position={[0, 1.3, -0.104]} />
      {/* abs */}
      {[1.18, 1.12, 1.06, 1.0].map((y) =>
        [-0.028, 0.028].map((x) => (
          <mesh key={`${y}${x}`} material={m} position={[x, y, 0.115]}>
            <sphereGeometry args={[0.024, 14, 10]} />
          </mesh>
        )),
      )}
      {SIDES.map((s) => (
        <group key={s}>
          <mesh material={m} position={[s * 0.08, 1.36, 0.098]} rotation={[0, 0, -s * 0.35]} scale={[0.075, 0.05, 0.022]}>
            <sphereGeometry args={[1, 20, 14]} />
          </mesh>
          <mesh material={m} position={[s * 0.3, 1.42, 0]} scale={[0.04, 0.05, 0.04]}>
            <sphereGeometry args={[1, 18, 14]} />
          </mesh>
          <Spindle m={m} a={[s * 0.3, 1.4, 0.012]} b={[s * 0.3, 1.22, 0.01]} r={0.036} />
          <Spindle m={m} a={[s * 0.3, 1.19, 0]} b={[s * 0.3, 0.93, 0]} r={0.034} peak={0.6} />
          <mesh material={m} position={[s * 0.09, 0.9, -0.08]} scale={[0.06, 0.06, 0.04]}>
            <sphereGeometry args={[1, 18, 14]} />
          </mesh>
          <Spindle m={m} a={[s * 0.1, 0.88, 0.015]} b={[s * 0.1, 0.5, 0.015]} r={0.075} peak={0.9} />
          <Spindle m={m} a={[s * 0.1, 0.45, -0.015]} b={[s * 0.1, 0.1, -0.01]} r={0.06} peak={0.65} />
        </group>
      ))}
    </group>
  );
}

// ── one builder per mesh name from zones.json ────────────────────────
const BUILDERS: Record<string, Builder> = {
  brain: (m) => <Brain m={m} />,
  heart: (m) => <Heart m={m} />,
  lung_left: (m) => (
    <group name="lung_left">
      <mesh material={m} geometry={G.lungLeft()} position={[0.105, 1.34, -0.005]} />
      {G.bronchi().map((g, i) => (
        <mesh key={i} material={m} geometry={g} raycast={noRaycast} />
      ))}
    </group>
  ),
  lung_right: (m) => (
    <group name="lung_right">
      <mesh material={m} geometry={G.lungRight()} position={[-0.105, 1.34, -0.005]} scale={[-1, 1, 1]} />
      {/* trachea lives here so it needs no extra entry in zones.json */}
      <mesh material={m} geometry={G.trachea()} />
      <group scale={[-1, 1, 1]}>
        {G.bronchi().map((g, i) => (
          <mesh key={i} material={m} geometry={g} raycast={noRaycast} />
        ))}
      </group>
    </group>
  ),
  spleen: (m) => (
    <mesh name="spleen" material={m} geometry={G.spleen()} position={[0.14, 1.18, -0.04]} rotation={[0, 0, 0.35]} />
  ),
  thymus: (m) => (
    <group name="thymus" position={[0, 1.44, 0.05]}>
      <mesh material={m} geometry={G.thymusLobe()} position={[0.018, 0, 0]} rotation={[0, 0, -0.18]} />
      <mesh material={m} geometry={G.thymusLobe()} position={[-0.018, 0, 0]} rotation={[0, 0, 0.18]} />
    </group>
  ),
  liver: (m) => (
    <group name="liver">
      <mesh material={m} geometry={G.liver()} position={[-0.1, 1.12, 0.04]} />
      <mesh material={m} geometry={G.gallbladder()} position={[-0.07, 1.075, 0.07]} rotation={[0, 0, 0.3]} />
    </group>
  ),
  stomach: (m) => (
    <group name="stomach" position={[0.07, 1.1, 0.05]}>
      <mesh material={m} geometry={G.stomach()} />
      <mesh material={m} geometry={G.esophagus()} />
      <mesh material={m} geometry={G.duodenum()} />
    </group>
  ),
  pancreas: (m) => <mesh name="pancreas" material={m} geometry={G.pancreas()} position={[0, 1.03, 0]} />,
  skeleton: (m, w) => <Skeleton m={m} w={w} />,
  muscles: (m) => <Muscles m={m} />,
};

export function Organs() {
  // One material per zone (plus a wireframe one); colours are updated in a single useFrame
  const mats = useMemo(
    () =>
      Object.fromEntries(
        zones.map((z) => [
          z.id,
          new MeshStandardMaterial({
            transparent: true,
            opacity: OPACITY[z.id] ?? 0.6,
            depthWrite: false,
            roughness: 0.4,
          }),
        ]),
      ) as Record<ZoneId, MeshStandardMaterial>,
    [],
  );
  const wires = useMemo(
    () =>
      Object.fromEntries(
        zones.map((z) => [
          z.id,
          new MeshBasicMaterial({ transparent: true, opacity: 0.35, wireframe: true, depthWrite: false }),
        ]),
      ) as Record<ZoneId, MeshBasicMaterial>,
    [],
  );
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      Object.values(wires).forEach((m) => m.dispose());
    },
    [mats, wires],
  );

  const root = useRef<Group>(null);
  const heart = useRef<{ obj: Object3D; base: [number, number, number] } | null>(null);
  const phase = useRef(0);

  useFrame((_, dt) => {
    const s = usePda.getState(); // no hook, so no re-render per frame
    for (const z of zones) {
      const m = mats[z.id];
      const c = STATUS_COLOR[s.zoneStatus[z.id]] ?? '#6b7a8c';
      m.color.set(c);
      m.emissive.set(c);
      m.emissiveIntensity =
        s.selectedZone === z.id ? 0.9 : s.hoveredZone === z.id ? 0.6 : 0.25;
      wires[z.id].color.set(c);
    }

    // heart pulse: scale = 1 + a * sin(2π · bpm/60 · t)
    if (!heart.current) {
      const obj = root.current?.getObjectByName('heart');
      if (obj) heart.current = { obj, base: [obj.scale.x, obj.scale.y, obj.scale.z] };
    }
    if (heart.current) {
      const list = s.vitals?.heartRate;
      const bpm = list?.[list.length - 1]?.value ?? 70;
      phase.current += dt * (bpm / 60) * Math.PI * 2; // phase accumulates, so changing BPM doesn't jump
      const k = 1 + PULSE_AMP * Math.sin(phase.current);
      const { obj, base } = heart.current;
      obj.scale.set(base[0] * k, base[1] * k, base[2] * k);
    }
  });

  return (
    <group ref={root}>
      {zones.map((z) => (
        <group
          key={z.id}
          name={`zone-${z.id}`}
          onClick={(e) => {
            e.stopPropagation();
            usePda.getState().selectZone(z.id);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            usePda.getState().hoverZone(z.id);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            usePda.getState().hoverZone(null);
            document.body.style.cursor = 'auto';
          }}
        >
          {z.meshNames.map((n) => {
            const build = BUILDERS[n];
            if (!build) {
              console.warn(`[scene] no builder for mesh "${n}" (zone ${z.id})`);
              return null;
            }
            return <Fragment key={n}>{build(mats[z.id], wires[z.id])}</Fragment>;
          })}
        </group>
      ))}
    </group>
  );
}