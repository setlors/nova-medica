import { useEffect, useMemo } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Box3, Color, Mesh, Vector3, type ShaderMaterial } from "three";
import { zones } from "../../core/content";
import { usePda } from "../../core/store";
import type { Status, ZoneId } from "../../core/types";
import { ScanBeam } from "./ScanBeam";
import { createHoloSkin } from "./holoSkin";
import { Pedestal } from "./Pedestal";

const MODEL_URL = "/models/anatomy-female.glb";
const BODY_HEIGHT = 1.75;

const STATUS_COLOR: Record<Status, string> = {
  ok: "#4dffb0",
  warn: "#ffb347",
  crit: "#ff4d5e",
  unknown: "#6b7f8a",
};

// Organs are bright, bones softer, muscles almost transparent so they do not hide the organs.
const ZONE_OPACITY: Record<ZoneId, number> = {
  heart: 0.55,
  brain: 0.5,
  lungs: 0.4,
  immune: 0.5,
  metabolism: 0.45,
  bones: 0.28,
  muscles: 0.06,
};

// When a ray crosses several zones, the first in this list wins (organs before bones before muscles).
const PRIORITY: ZoneId[] = [
  "heart",
  "brain",
  "lungs",
  "immune",
  "metabolism",
  "bones",
  "muscles",
];

// Not part of the 7 zones and too cluttered for the hologram: hidden.
const HIDE =
  /^(veins_|arteries_|coronary_|pulmonary_|aorta|vena_cava|carotid|cranial_|spinal_cord|uterus|ovary_|fallopian|vagina|breast_|teeth|tongue|pharynx|larynx|salivary|eye_|pituitary|ureter_|bladder|appendix)/;

const MESH_TO_ZONE = new Map<string, ZoneId>(
  zones.flatMap((z) => z.meshNames.map((n) => [n, z.id] as const)),
);

const noRaycast = () => null;

function pickZone(e: ThreeEvent<MouseEvent | PointerEvent>): ZoneId | null {
  let best: ZoneId | null = null;
  let rank = Infinity;
  for (const hit of e.intersections) {
    const z = MESH_TO_ZONE.get(hit.object.name);
    if (!z) continue;
    const r = PRIORITY.indexOf(z);
    if (r < rank) {
      rank = r;
      best = z;
    }
  }
  return best;
}

export function HoloBody() {
  const gltf = useGLTF(MODEL_URL);
  const root = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  const skin = useMemo(() => {
    const m = createHoloSkin();
    m.uniforms.uOpacity!.value = 0.12;
    return m;
  }, []);

  const zoneMats = useMemo(() => {
    const map = new Map<ZoneId, ShaderMaterial>();
    for (const z of zones) {
      const m = createHoloSkin();
      m.uniforms.uOpacity!.value = ZONE_OPACITY[z.id];
      map.set(z.id, m);
    }
    return map;
  }, []);

  // Fit the model to the body size and put the feet on the floor.
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(root);
    const size = box.getSize(new Vector3());
    const k = BODY_HEIGHT / size.y;
    return {
      scale: k,
      x: -((box.min.x + box.max.x) / 2) * k,
      y: -box.min.y * k,
      z: -((box.min.z + box.max.z) / 2) * k,
    };
  }, [root]);

  // Heart pulse: keep the node's own scale/position and scale around the heart's centre.
  const heart = useMemo(() => {
    const mesh = root.getObjectByName("heart") as Mesh | undefined;
    if (!mesh?.geometry) return null;
    mesh.geometry.computeBoundingBox();
    const centre = new Vector3();
    mesh.geometry.boundingBox!.getCenter(centre);
    const baseScale = mesh.scale.clone();
    return {
      mesh,
      baseScale,
      basePos: mesh.position.clone(),
      pivot: centre.multiply(baseScale), // centre in parent space
    };
  }, [root]);

  useEffect(() => {
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const zone = MESH_TO_ZONE.get(mesh.name);
      if (zone) {
        mesh.material = zoneMats.get(zone)!;
      } else {
        mesh.material = skin;
        mesh.raycast = noRaycast; // only zone meshes are clickable
        if (HIDE.test(mesh.name)) mesh.visible = false;
      }
    });
    return () => {
      skin.dispose();
      zoneMats.forEach((m) => m.dispose());
    };
  }, [root, skin, zoneMats]);

  useFrame(({ clock }) => {
    const s = usePda.getState();
    const t = clock.elapsedTime;

    skin.uniforms.uColor!.value.set(
      s.mode === "emergency" ? "#ff4d5e" : "#3de0ff",
    );
    for (const [zone, m] of zoneMats) {
      m.uniforms.uTime!.value = t;
      m.uniforms.uScanY!.value = skin.uniforms.uScanY!.value; // follow the scan beam
      (m.uniforms.uColor!.value as Color).set(STATUS_COLOR[s.zoneStatus[zone]]);
    }

    if (heart) {
      const bpm = s.vitals.heartRate?.at(-1)?.value;
      const pulse = bpm ? 1 + 0.05 * Math.sin(2 * Math.PI * (bpm / 60) * t) : 1;
      heart.mesh.scale.copy(heart.baseScale).multiplyScalar(pulse);
      heart.mesh.position
        .copy(heart.basePos)
        .addScaledVector(heart.pivot, 1 - pulse);
    }
  });

  return (
    <>
      <Pedestal />
      <group name="holo-body">
        <ScanBeam material={skin} />
        <primitive
          object={root}
          scale={fit.scale}
          position={[fit.x, fit.y, fit.z]}
          onPointerMove={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            usePda.getState().hoverZone(pickZone(e));
          }}
          onPointerOut={() => usePda.getState().hoverZone(null)}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            const z = pickZone(e);
            if (z) usePda.getState().selectZone(z);
          }}
        />
      </group>
    </>
  );
}

useGLTF.preload(MODEL_URL);
