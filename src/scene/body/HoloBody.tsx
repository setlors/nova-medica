import { useEffect, useMemo } from "react";
import {
  DoubleSide,
  MeshBasicMaterial,
  type BufferGeometry,
  type Material,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { usePda } from "../../core/store";
import { Organs } from "./Organs";
import { ScanBeam } from "./ScanBeam";
import { createHoloSkin } from "./holoSkin";
import { Pedestal } from "./Pedestal";
import { blob, memo, tube, type V3 } from "./organGeometry";

const noRaycast = () => null;
const SIDES = [-1, 1] as const;

// The whole body (shell + organs + skeleton) is proportioned for natural human posture.
const BODY_X = 0.78;
const HEAD_X = 1.18; // head width: raise = wider

const sst = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type Prof = [number, number][];
function prof(t: number, pts: Prof): number {
  for (let i = 1; i < pts.length; i++) {
    const [t1, v1] = pts[i]!;
    if (t <= t1) {
      const [t0, v0] = pts[i - 1]!;
      return v0 + ((t - t0) / (t1 - t0)) * (v1 - v0);
    }
  }
  return pts[pts.length - 1]![1];
}

function loft(
  hh: number,
  W: Prof,
  ZF: Prof,
  ZB: Prof,
  e: number | ((t: number) => number),
  post?: (
    p: { x: number; y: number; z: number },
    u: { x: number; y: number; z: number },
  ) => void,
  w = 36,
  h = 28,
) {
  return blob(
    1,
    1,
    1,
    (p, u) => {
      const t = (u.y + 1) / 2;
      const rho = Math.hypot(u.x, u.z);
      const dx = rho > 1e-6 ? u.x / rho : 0;
      const dz = rho > 1e-6 ? u.z / rho : 0;
      const ex = typeof e === "number" ? e : e(t);
      const sx = Math.sign(dx) * Math.pow(Math.abs(dx), ex);
      const sz = Math.sign(dz) * Math.pow(Math.abs(dz), ex);
      p.set(sx * prof(t, W), hh * u.y, sz * prof(t, dz >= 0 ? ZF : ZB));
      post?.(p, u);
    },
    w,
    h,
  );
}

// ── Head profiles ──
const HEAD_W: Prof = (
  [
    [0, 0.034],
    [0.025, 0.038],
    [0.1, 0.048],
    [0.2, 0.062],
    [0.275, 0.077],
    [0.4, 0.083],
    [0.5, 0.086],
    [0.6, 0.086],
    [0.75, 0.072],
    [0.875, 0.056],
    [0.95, 0.035],
    [1, 0],
  ] as Prof
).map(([t, v]) => [t, v * HEAD_X] as [number, number]);
const HEAD_ZF: Prof = [
  [0, 0.05],
  [0.025, 0.066],
  [0.075, 0.094],
  [0.2, 0.098],
  [0.35, 0.099],
  [0.5, 0.1],
  [0.6, 0.105],
  [0.65, 0.104],
  [0.75, 0.099],
  [0.875, 0.082],
  [0.95, 0.052],
  [1, 0],
];
const HEAD_ZB: Prof = [
  [0, 0.04],
  [0.1, 0.052],
  [0.2, 0.068],
  [0.275, 0.08],
  [0.4, 0.092],
  [0.5, 0.106],
  [0.65, 0.116],
  [0.75, 0.11],
  [0.875, 0.085],
  [0.95, 0.055],
  [1, 0],
];

// ── Torso profiles ──
const TORSO_Y0 = 0.78;
const TORSO_H = 0.74;
const TORSO_W: Prof = [
  [0, 0.11],
  [0.05, 0.195],
  [0.15, 0.22],
  [0.28, 0.2],
  [0.4, 0.195],
  [0.55, 0.21],
  [0.7, 0.235],
  [0.82, 0.242],
  [0.9, 0.23],
  [0.96, 0.19],
  [1, 0.15],
];
const TORSO_ZF: Prof = [
  [0, 0.075],
  [0.05, 0.105],
  [0.15, 0.12],
  [0.4, 0.115],
  [0.55, 0.118],
  [0.7, 0.135],
  [0.82, 0.13],
  [0.92, 0.11],
  [1, 0.08],
];
const TORSO_ZB: Prof = [
  [0, 0.065],
  [0.05, 0.105],
  [0.15, 0.13],
  [0.4, 0.115],
  [0.55, 0.12],
  [0.7, 0.13],
  [0.82, 0.13],
  [0.92, 0.105],
  [1, 0.075],
];

const ARM_R: Prof = [
  [0, 0.052],
  [0.15, 0.054],
  [0.45, 0.042],
  [0.55, 0.044],
  [0.75, 0.038],
  [0.95, 0.025],
  [1, 0.023],
];
const LEG_R: Prof = [
  [0, 0.09],
  [0.12, 0.092],
  [0.3, 0.074],
  [0.48, 0.054],
  [0.55, 0.054],
  [0.64, 0.058],
  [0.82, 0.042],
  [0.95, 0.031],
  [1, 0.03],
];

const ARM_PTS: V3[] = [
  [0.285, 1.45, 0],
  [0.295, 1.32, -0.004],
  [0.31, 1.17, -0.008],
  [0.325, 1.03, 0.012],
  [0.335, 0.91, 0.03],
];
const LEG_PTS: V3[] = [
  [0.105, 0.9, 0],
  [0.1, 0.7, 0.005],
  [0.095, 0.48, 0.012],
  [0.09, 0.25, 0],
  [0.09, 0.08, 0],
];

// Flowing anatomical shoulder connection points
const TRAP_PTS: V3[] = [
  [0.03, 1.52, -0.014],
  [0.085, 1.48, -0.01],
  [0.17, 1.44, -0.005],
  [0.28, 1.41, 0],
];

const FINGERS = [
  { z: 0.027, len: 0.075 },
  { z: 0.009, len: 0.085 },
  { z: -0.009, len: 0.078 },
  { z: -0.027, len: 0.062 },
];
const THUMB: V3[] = [
  [0, -0.02, 0.028],
  [-0.008, -0.05, 0.05],
  [-0.014, -0.082, 0.062],
  [-0.016, -0.105, 0.07],
];
const tip = (r: number, t: number) =>
  r * Math.sqrt(Math.max(0.0004, 1 - Math.pow(t, 8)));

function handGeo(): BufferGeometry {
  const parts: BufferGeometry[] = [
    blob(
      0.019,
      0.052,
      0.048,
      (p, u) => {
        const k = (1 - u.y) / 2;
        p.z *= 0.7 + 0.3 * k;
        p.x *= 0.85 + 0.15 * k;
      },
      16,
      12,
    ).translate(0, -0.05, 0.004),
  ];
  for (const f of FINGERS) {
    parts.push(
      tube(
        [
          [0, -0.09, f.z],
          [-0.003, -0.09 - f.len * 0.5, f.z + 0.004],
          [-0.011, -0.09 - f.len, f.z + 0.012],
        ],
        (t) => tip(0.0095 - 0.003 * t, t),
        14,
        8,
      ),
    );
  }
  parts.push(tube(THUMB, (t) => tip(0.0115 - 0.004 * t, t), 14, 8));
  return mergeGeometries(parts)!;
}

const TOES = [
  { x: -0.025, z: 0.195, rx: 0.015, rz: 0.022 },
  { x: -0.008, z: 0.19, rx: 0.01, rz: 0.02 },
  { x: 0.007, z: 0.183, rx: 0.009, rz: 0.018 },
  { x: 0.021, z: 0.175, rx: 0.0085, rz: 0.015 },
  { x: 0.034, z: 0.165, rx: 0.008, rz: 0.013 },
];
const FOOT_W: Prof = [
  [0, 0.55],
  [0.2, 0.7],
  [0.5, 0.82],
  [0.78, 1],
  [1, 0.95],
];
const FOOT_H: Prof = [
  [0, 0.75],
  [0.25, 1],
  [0.55, 0.65],
  [0.8, 0.45],
  [1, 0.35],
];

function footGeo(): BufferGeometry {
  const cy = 0.03;
  const parts: BufferGeometry[] = [
    blob(
      0.046,
      0.046,
      0.135,
      (p, u) => {
        const t = (u.z + 1) / 2;
        p.x *= prof(t, FOOT_W);
        if (u.y > 0) p.y *= prof(t, FOOT_H);
        p.y = Math.max(p.y, -cy);
      },
      24,
      18,
    ).translate(0, cy, 0.07),
  ];
  for (const t of TOES)
    parts.push(
      blob(t.rx, 0.011, t.rz, undefined, 10, 8).translate(t.x, 0.013, t.z),
    );
  return mergeGeometries(parts)!;
}

const SHELL = {
  // Smooth round head with subtle face bumps
  head: () =>
    memo("shell:head10", () =>
      loft(
        0.118,
        HEAD_W,
        HEAD_ZF,
        HEAD_ZB,
        (t) => 1 - 0.25 * sst(0.5, 0.25, t),
        (p, u) => {
          const y = u.y;
          const front = Math.max(0, u.z);
          const ax = Math.abs(u.x);
          p.z +=
            0.022 *
            Math.exp(-(u.x * u.x) / 0.04 - Math.pow(y + 0.12, 2) / 0.03) *
            front;
          p.z += 0.005 * Math.exp(-Math.pow(y - 0.3, 2) / 0.01) * front;
          p.z -=
            0.007 *
            Math.exp(
              -Math.pow(ax - 0.4, 2) / 0.02 - Math.pow(y - 0.12, 2) / 0.012,
            ) *
            front;
          p.z +=
            0.004 *
            Math.exp(-(u.x * u.x) / 0.06 - Math.pow(y + 0.52, 2) / 0.004) *
            front;
          p.z +=
            0.006 *
            Math.exp(-(u.x * u.x) / 0.05 - Math.pow(y + 0.85, 2) / 0.01) *
            front;
        },
        48,
        40,
      ),
    ),
  // Small ear, flat against the head
  ear: () =>
    memo("shell:ear3", () =>
      blob(
        0.01,
        0.028,
        0.019,
        (p, u) => {
          if (u.x < 0) p.x *= 0.25; // hugs the head
          p.z *= 1 - 0.15 * u.y; // narrower at the lobe
        },
        16,
        12,
      ),
    ),
  // Neck: wide at the shoulders, narrowing towards the head
  neck: () =>
    memo("shell:neck8", () =>
      tube(
        [
          [0, 1.4, -0.015],
          [0, 1.49, -0.005],
          [0, 1.59, 0.01],
        ],
        (t) => 0.042 + 0.032 * Math.pow(1 - t, 2),
        16,
        16,
      ),
    ),
  trap: () =>
    memo("shell:trap5", () => tube(TRAP_PTS, (t) => 0.06 - 0.015 * t, 24, 14)),
  deltoid: () =>
    memo("shell:delt6", () =>
      blob(
        0.068,
        0.078,
        0.068,
        (p, u) => {
          if (u.y < 0) {
            const k = 1 + 0.32 * u.y;
            p.x *= k;
            p.z *= k;
          }
        },
        22,
        16,
      ),
    ),
  torso: () =>
    memo("shell:torso7", () =>
      loft(TORSO_H / 2, TORSO_W, TORSO_ZF, TORSO_ZB, 0.78, undefined, 40, 32),
    ),
  arm: () =>
    memo("shell:arm3", () => tube(ARM_PTS, (t) => prof(t, ARM_R), 32, 12)),
  hand: () => memo("shell:hand3", handGeo),
  leg: () =>
    memo("shell:leg2", () => tube(LEG_PTS, (t) => prof(t, LEG_R), 40, 14)),
  foot: () => memo("shell:foot3", footGeo),
};

// Draws a part twice: invisibly into the depth buffer, then in colour only where it is the
// nearest surface. Surfaces buried inside other parts (arm inside torso, etc.) disappear.
function Part({
  geometry,
  mat,
  depthMat,
  position,
  rotation,
}: {
  geometry: BufferGeometry;
  mat: Material;
  depthMat: Material;
  position?: V3;
  rotation?: V3;
}) {
  return (
    <>
      <mesh
        raycast={noRaycast}
        material={depthMat}
        geometry={geometry}
        position={position}
        rotation={rotation}
      />
      <mesh
        raycast={noRaycast}
        material={mat}
        geometry={geometry}
        position={position}
        rotation={rotation}
      />
    </>
  );
}

function Shell() {
  const mat = useMemo(() => {
    const m = createHoloSkin();
    m.uniforms.uOpacity!.value = 0.12;
    return m;
  }, []);
  const depthMat = useMemo(
    () =>
      new MeshBasicMaterial({
        colorWrite: false,
        depthWrite: true,
        side: DoubleSide,
        polygonOffset: true, // pushes depth slightly back so the colour pass wins on the nearest surface
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    [],
  );
  const mode = usePda((s) => s.mode);
  useEffect(
    () => () => {
      mat.dispose();
      depthMat.dispose();
    },
    [mat, depthMat],
  );

  useEffect(() => {
    mat.uniforms.uColor!.value.set(
      mode === "emergency" ? "#ff4d5e" : "#3de0ff",
    );
  }, [mode, mat]);

  return (
    <group renderOrder={-1}>
      <ScanBeam material={mat} />
      <Part
        mat={mat}
        depthMat={depthMat}
        geometry={SHELL.head()}
        position={[0, 1.69, 0]}
      />
      <Part mat={mat} depthMat={depthMat} geometry={SHELL.neck()} />
      <Part
        mat={mat}
        depthMat={depthMat}
        geometry={SHELL.torso()}
        position={[0, TORSO_Y0 + TORSO_H / 2, 0]}
      />
      {SIDES.map((s) => (
        <group key={s} scale={[s, 1, 1]}>
          <Part
            mat={mat}
            depthMat={depthMat}
            geometry={SHELL.ear()}
            position={[0.1, 1.68, -0.012]}
            rotation={[-0.1, -0.25, 0]}
          />
          <Part mat={mat} depthMat={depthMat} geometry={SHELL.trap()} />
          <Part
            mat={mat}
            depthMat={depthMat}
            geometry={SHELL.deltoid()}
            position={[0.275, 1.41, 0]}
          />
          <Part mat={mat} depthMat={depthMat} geometry={SHELL.arm()} />
          <Part
            mat={mat}
            depthMat={depthMat}
            geometry={SHELL.hand()}
            position={[0.334, 0.915, 0.03]}
          />
          <Part mat={mat} depthMat={depthMat} geometry={SHELL.leg()} />
          <Part
            mat={mat}
            depthMat={depthMat}
            geometry={SHELL.foot()}
            position={[0.09, 0, 0]}
          />
        </group>
      ))}
    </group>
  );
}

export function HoloBody() {
  return (
    <>
      <Pedestal />
      <group name="holo-body" scale={[BODY_X, 1, 1]}>
        <Shell />
        <Organs />
      </group>
    </>
  );
}
