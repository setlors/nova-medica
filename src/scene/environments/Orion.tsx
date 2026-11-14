import { Stars } from '@react-three/drei';

export function Orion() {
  return (
    <>
      <color attach="background" args={['#050f16']} />
      <Stars radius={30} depth={20} count={500} factor={2} fade />
      <group position={[0, 1, 0]}>
        {/* capsule cabin: a big wireframe cone and cylinder around the body */}
        <mesh position={[0, 0.9, 0]}>
          <coneGeometry args={[3.2, 1.8, 24, 3, true]} />
          <meshBasicMaterial color="#3de0ff" transparent opacity={0.16} wireframe />
        </mesh>
        <mesh position={[0, -0.6, 0]}>
          <cylinderGeometry args={[3.2, 3.2, 1.4, 24, 3, true]} />
          <meshBasicMaterial color="#0b5a70" transparent opacity={0.22} wireframe />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 3.18, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[0.35, 24]} />
            <meshBasicMaterial color="#3de0ff" transparent opacity={0.25} />
          </mesh>
        ))}
      </group>
    </>
  );
}