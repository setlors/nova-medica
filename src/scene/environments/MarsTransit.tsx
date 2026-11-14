import { Stars } from '@react-three/drei';

export function MarsTransit() {
  return (
    <>
      <color attach="background" args={['#0d0709']} />
      <Stars radius={40} depth={25} count={900} factor={2.5} fade />
      {/* Mars ahead */}
      <mesh position={[-7, 2.5, -14]}>
        <sphereGeometry args={[2.4, 32, 24]} />
        <meshBasicMaterial color="#8a3a22" transparent opacity={0.55} />
      </mesh>
      <mesh position={[-7, 2.5, -14]}>
        <sphereGeometry args={[2.45, 20, 14]} />
        <meshBasicMaterial color="#ff8a5c" transparent opacity={0.2} wireframe />
      </mesh>
      {/* Earth behind, small: a reminder of the signal delay */}
      <mesh position={[9, 4, -16]}>
        <sphereGeometry args={[0.35, 20, 14]} />
        <meshBasicMaterial color="#3de0ff" transparent opacity={0.7} />
      </mesh>
    </>
  );
}