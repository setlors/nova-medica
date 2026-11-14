import { BufferGeometry, CatmullRomCurve3, SphereGeometry, TubeGeometry, Vector3 } from 'three';

export type V3 = [number, number, number];
type Shape = (p: Vector3, u: Vector3) => void;

// Geometries are built once and shared
const cache = new Map<string, BufferGeometry>();
export function memo(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const groove = (d: number) => Math.exp(-(d * d) / 0.012);

// Average normals of vertices at the same position, so seams are not visible
function weld(g: BufferGeometry) {
  g.computeVertexNormals();
  const pos = g.attributes.position!;
  const nor = g.attributes.normal!;
  const key = (i: number) =>
    `${Math.round(pos.getX(i) * 1e5)}|${Math.round(pos.getY(i) * 1e5)}|${Math.round(pos.getZ(i) * 1e5)}`;
  const acc = new Map<string, Vector3>();
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const a = acc.get(k) ?? new Vector3();
    a.x += nor.getX(i);
    a.y += nor.getY(i);
    a.z += nor.getZ(i);
    acc.set(k, a);
  }
  for (let i = 0; i < pos.count; i++) {
    const a = acc.get(key(i)) as Vector3;
    const l = a.length() || 1;
    nor.setXYZ(i, a.x / l, a.y / l, a.z / l);
  }
  nor.needsUpdate = true;
}

// Ellipsoid that can be deformed vertex by vertex. u = unit-sphere direction, p = scaled position.
export function blob(
  rx: number,
  ry: number,
  rz: number,
  shape?: Shape,
  w = 32,
  h = 24,
): BufferGeometry {
  const g = new SphereGeometry(1, w, h);
  const pos = g.attributes.position!;
  const u = new Vector3();
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    u.fromBufferAttribute(pos, i);
    p.set(u.x * rx, u.y * ry, u.z * rz);
    shape?.(p, u);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  weld(g);
  return g;
}

// Tube along a curve with a radius that can change along its length (t = 0..1)
export function tube(
  points: V3[],
  radius: number | ((t: number) => number),
  tubular = 32,
  radial = 8,
): BufferGeometry {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
  const rf = typeof radius === 'number' ? () => radius : radius;
  const g = new TubeGeometry(curve, tubular, 1, radial, false);
  const pos = g.attributes.position!;
  const c = new Vector3();
  const v = new Vector3();
  for (let i = 0; i <= tubular; i++) {
    curve.getPointAt(i / tubular, c);
    const r = rf(i / tubular);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  pos.needsUpdate = true;
  weld(g);
  return g;
}

// Brain folds: layered sines give a wrinkly surface
const fold = (x: number, y: number, z: number) => {
  const f = 190;
  const a = Math.sin(x * f + 1.6 * Math.sin(y * f * 0.8));
  const b = Math.sin(y * f * 1.1 + 1.6 * Math.sin(z * f * 0.9));
  const c = Math.sin(z * f + 1.6 * Math.sin(x * f * 0.7));
  return (a * b + b * c + c * a) / 3;
};

// +x = the body's left, the model faces +z. Right-side parts reuse the left geometry mirrored with scale-x = -1.
const lung = (left: boolean) =>
  blob(
    left ? 0.056 : 0.064,
    0.125,
    0.07,
    (p, u) => {
      const t = (u.y + 1) / 2; // 0 = base, 1 = apex
      p.x *= 0.62 + 0.38 * (1 - t);
      p.z *= 0.75 + 0.25 * (1 - t);
      p.y += 0.02 * sstep(-0.6, -1, u.y) * (1 - (u.x * u.x + u.z * u.z)); // concave base
      if (left) {
        // cardiac notch
        p.x += 0.045 * Math.max(0, -u.x) * Math.max(0, u.z) * (1 - sstep(0.3, 0.75, t));
        p.multiplyScalar(1 - 0.05 * groove(u.y - 0.9 * u.z + 0.15));
      } else {
        p.multiplyScalar(
          1 - 0.06 * (groove(u.y - 0.9 * u.z + 0.15) + groove(u.y - 0.2) * Math.max(0, u.z)),
        );
      }
      p.x = Math.max(p.x, -0.044); // flat inner face
    },
    40,
    32,
  );

const RIB_Y = [1.44, 1.4, 1.36, 1.32, 1.28, 1.24, 1.2];
const RIB_A = [0.15, 0.17, 0.185, 0.2, 0.2, 0.195, 0.18];

const BRONCHI: (() => BufferGeometry)[] = [
  () => tube([[0, 1.405, -0.015], [0.03, 1.385, -0.015], [0.06, 1.355, -0.012], [0.085, 1.31, -0.01]], (t) => 0.008 - 0.003 * t, 20, 8),
  () => tube([[0.05, 1.37, -0.014], [0.085, 1.4, -0.01], [0.105, 1.43, -0.008]], (t) => 0.0055 - 0.002 * t, 14, 6),
  () => tube([[0.07, 1.34, -0.012], [0.105, 1.32, -0.005], [0.125, 1.29, 0]], (t) => 0.0045 - 0.0015 * t, 14, 6),
  () => tube([[0.085, 1.31, -0.01], [0.1, 1.26, -0.015], [0.105, 1.22, -0.02]], (t) => 0.0055 - 0.002 * t, 14, 6),
];

export const G = {
  // ── brain ──
  hemisphere: () =>
    memo('hemi', () =>
      blob(
        0.04,
        0.062,
        0.085,
        (p, u) => {
          p.x *= 1 - 0.12 * Math.max(0, u.z);
          p.addScaledVector(u, 0.0035 * fold(p.x, p.y, p.z));
          p.x = Math.max(p.x, -0.034);
        },
        80,
        56,
      ),
    ),
  cerebellum: () =>
    memo('cerebellum', () =>
      blob(0.05, 0.028, 0.038, (p, u) => p.addScaledVector(u, 0.0022 * Math.sin(u.y * 18)), 48, 32),
    ),
  brainStem: () =>
    memo('stem', () => tube([[0, -0.05, -0.03], [0, -0.075, -0.035], [0, -0.1, -0.04]], (t) => 0.011 - 0.004 * t, 12, 10)),

  // ── heart ──
  heartBody: () =>
    memo('heartBody', () =>
      blob(
        0.05,
        0.075,
        0.042,
        (p, u) => {
          const t = (u.y + 1) / 2; // 0 = apex, 1 = base
          const taper = 0.3 + 0.7 * Math.pow(t, 0.6);
          const gr = 1 - 0.07 * Math.exp(-Math.pow((t - 0.66) / 0.06, 2)); // coronary groove
          p.x *= taper * gr;
          p.z *= taper * gr;
          p.x += (1 - t) * 0.028; // apex points to the body's left
        },
        36,
        28,
      ),
    ),
  atrium: () => memo('atrium', () => blob(0.026, 0.026, 0.024, undefined, 20, 14)),
  aorta: () =>
    memo('aorta', () =>
      tube([[-0.005, 0.05, 0], [0, 0.095, -0.005], [0.025, 0.12, -0.015], [0.055, 0.1, -0.03], [0.06, 0.06, -0.04], [0.058, 0.0, -0.045]], 0.0125, 28, 10),
    ),
  pulmTrunk: () => memo('pulm', () => tube([[0.012, 0.04, 0.025], [0.025, 0.07, 0.02], [0.045, 0.09, 0]], 0.011, 14, 8)),
  svc: () => memo('svc', () => tube([[-0.032, 0.025, -0.005], [-0.032, 0.07, -0.008], [-0.03, 0.11, -0.01]], 0.0085, 14, 8)),

  // ── lungs ──
  lungLeft: () => memo('lungL', () => lung(true)),
  lungRight: () => memo('lungR', () => lung(false)),
  trachea: () =>
    memo('trachea', () =>
      tube([[0, 1.53, -0.02], [0, 1.46, -0.02], [0, 1.405, -0.015]], (t) => 0.0115 * (1 + 0.08 * Math.sin(t * 80)), 90, 10),
    ),
  bronchi: () => BRONCHI.map((make, i) => memo(`bronch${i}`, make)), // built for the left side, mirror for the right

  // ── metabolism ──
  liver: () =>
    memo('liver', () =>
      blob(
        0.105,
        0.058,
        0.07,
        (p, u) => {
          const L = Math.max(0, u.x); // left lobe side tapers
          p.y *= 1 - 0.65 * L;
          p.z *= 1 - 0.45 * L;
          if (u.x < 0) p.y *= 1 + 0.15 * -u.x; // bulky right lobe
          if (u.y < 0) p.y += 0.014 * -u.y * (1 - u.x * u.x); // concave underside
        },
        40,
        28,
      ),
    ),
  gallbladder: () => memo('gall', () => blob(0.011, 0.022, 0.011, undefined, 14, 10)),
  stomach: () =>
    memo('stomach', () =>
      tube(
        [[0.03, 0.05, -0.005], [0.052, 0.02, 0], [0.05, -0.02, 0.01], [0.025, -0.042, 0.018], [-0.01, -0.04, 0.02], [-0.04, -0.028, 0.018]],
        (t) => Math.max(0.002, (0.03 - 0.018 * t) * Math.sqrt(Math.min(1, t / 0.12))),
        40,
        14,
      ),
    ),
  esophagus: () => memo('eso', () => tube([[-0.005, 0.095, -0.01], [0.003, 0.07, -0.005], [0.02, 0.048, 0]], 0.0065, 14, 8)),
  duodenum: () =>
    memo('duo', () =>
      tube([[-0.04, -0.028, 0.018], [-0.065, -0.03, 0.01], [-0.07, -0.05, 0.005]], (t) => Math.max(0.002, 0.009 * (1 - 0.7 * t * t * t)), 12, 8),
    ),
  pancreas: () =>
    memo('pancreas', () =>
      tube(
        [[-0.075, -0.01, 0.005], [-0.04, -0.005, 0.01], [0, 0.005, 0.01], [0.04, 0.012, 0.005], [0.08, 0.02, -0.01]],
        (t) =>
          Math.max(
            0.002,
            (0.018 - 0.011 * t) * (1 + 0.14 * Math.sin(t * 70)) * Math.sqrt(Math.min(1, t / 0.08)) * Math.sqrt(Math.min(1, (1 - t) / 0.1)),
          ),
        40,
        10,
      ),
    ),

  // ── immune ──
  spleen: () =>
    memo('spleen', () =>
      blob(
        0.014,
        0.042,
        0.026,
        (p, u) => {
          p.x += -0.012 * u.y * u.y; // crescent
          if (u.x < 0) p.x += 0.004 * (1 - u.y * u.y); // dent on the inner face
        },
        24,
        18,
      ),
    ),
  thymusLobe: () =>
    memo('thymus', () =>
      blob(0.02, 0.032, 0.009, (p, u) => p.addScaledVector(u, 0.0015 * Math.sin(u.y * 9 + u.x * 7)), 20, 14),
    ),

  // ── skeleton ──
  jaw: () =>
    memo('jaw', () =>
      tube([[-0.062, 1.67, 0], [-0.058, 1.625, 0.035], [-0.035, 1.605, 0.075], [0, 1.598, 0.088], [0.035, 1.605, 0.075], [0.058, 1.625, 0.035], [0.062, 1.67, 0]], 0.0065, 28, 8),
    ),
  maxilla: () =>
    memo('maxilla', () => tube([[-0.05, 1.655, 0.07], [-0.025, 1.645, 0.098], [0.025, 1.645, 0.098], [0.05, 1.655, 0.07]], 0.006, 16, 8)),
  ribCount: RIB_Y.length,
  rib: (i: number, s: -1 | 1) =>
    memo(`rib:${i}:${s}`, () => {
      const y0 = RIB_Y[i]!;
      const a = RIB_A[i]!;
      const pts: V3[] = [];
      const N = 9;
      for (let k = 0; k <= N; k++) {
        const t = k / N;
        pts.push([
          s * (0.02 + (a - 0.02) * Math.pow(Math.sin(Math.PI * t), 0.7)),
          y0 - 0.05 * t * t,
          -0.08 + 0.18 * t,
        ]);
      }
      return tube(pts, 0.0048, 28, 6);
    }),
  clavicle: (s: -1 | 1) =>
    memo(`clav:${s}`, () =>
      tube([[s * 0.015, 1.46, 0.075], [s * 0.07, 1.475, 0.075], [s * 0.14, 1.48, 0.04], [s * 0.22, 1.475, 0], [s * 0.285, 1.465, -0.02]], 0.0065, 24, 8),
    ),
  scapula: () => memo('scap', () => blob(0.045, 0.055, 0.005, undefined, 20, 14)),
  sacrum: () =>
    memo('sacrum', () =>
      blob(0.03, 0.045, 0.018, (p, u) => {
        const t = (u.y + 1) / 2;
        p.x *= 0.45 + 0.55 * t;
      }, 20, 14),
    ),
  iliac: () => memo('iliac', () => blob(0.075, 0.05, 0.01, undefined, 24, 16)),
};