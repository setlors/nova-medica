import { useEffect, useMemo } from 'react';
import { Organs } from './Organs';
import { ScanBeam } from './ScanBeam';
import { createHologramMaterial } from './shaders';

const noRaycast = () => null;

function Shell() {
  const mat = useMemo(() => createHologramMaterial(), []);
  useEffect(() => () => mat.dispose(), [mat]);

  return (
    <group>
      <ScanBeam material={mat} />
      <mesh raycast={noRaycast} material={mat} position={[0, 1.68, 0]}>
        <sphereGeometry args={[0.12, 24, 16]} />
      </mesh>
      <mesh raycast={noRaycast} material={mat} position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.1, 12]} />
      </mesh>
      <mesh raycast={noRaycast} material={mat} position={[0, 1.17, 0]} scale={[1.15, 1, 0.7]}>
        <capsuleGeometry args={[0.19, 0.3, 8, 20]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh raycast={noRaycast} material={mat} position={[s * 0.3, 1.18, 0]}>
            <capsuleGeometry args={[0.055, 0.55, 8, 12]} />
          </mesh>
          <mesh raycast={noRaycast} material={mat} position={[s * 0.1, 0.45, 0]}>
            <capsuleGeometry args={[0.085, 0.7, 8, 14]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function HoloBody() {
  return (
    <group name="holo-body">
      <Shell />
      <Organs />
    </group>
  );
}