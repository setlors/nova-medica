import { Stars } from '@react-three/drei';

const CRATERS: [number, number, number][] = [
  [-3, -2.5, 0.7], [2.8, -3.2, 0.5], [4, 1.5, 0.9], [-4.5, 2.5, 0.6], [0.5, -5, 0.8], [-1.5, 4.8, 0.5],
];

export function MoonBase() {
  return (
    <>
      <color attach="background" args={['#05080c']} />
      <Stars radius={40} depth={20} count={900} factor={2.5} fade />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[12, 48]} />
        <meshBasicMaterial color="#1b2a33" transparent opacity={0.8} />
      </mesh>
      {CRATERS.map(([x, z, r], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, z]}>
          <ringGeometry args={[r * 0.8, r, 32]} />
          <meshBasicMaterial color="#3de0ff" transparent opacity={0.3} />
        </mesh>
      ))}
      {/* habitat dome */}
      <mesh position={[0, 0, -6]}>
        <sphereGeometry args={[2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#3de0ff" transparent opacity={0.18} wireframe />
      </mesh>
    </>
  );
}