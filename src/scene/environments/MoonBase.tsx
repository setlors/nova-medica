import { Sparkles, Stars } from '@react-three/drei';

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// [x, z, size]: fixed, so the scene looks the same every time
const ROCKS: [number, number, number][] = [
  [-5, -3, 0.5], [4, -5, 0.7], [6, 2, 0.4], [-6, 4, 0.6], [2, -7, 0.9], [-3, -8, 0.5], [0, 7, 0.4],
];

export function MoonBase() {
  return (
    <>
      <color attach="background" args={['#02060a']} />
      <Stars radius={45} depth={20} count={900} factor={2.2} fade />
      <mesh position={[7, 5, -16]}>
        <sphereGeometry args={[1.4, 28, 20]} />
        <meshBasicMaterial color="#2b7fc2" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <circleGeometry args={[14, 48]} />
        <meshStandardMaterial color="#1a2630" roughness={1} />
      </mesh>
      {ROCKS.map(([x, z, s], i) => (
        <mesh key={i} position={[x, s * 0.3, z]} scale={s}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#243440" roughness={1} flatShading />
        </mesh>
      ))}
      <mesh>
        <sphereGeometry args={[9, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#0b5a70" wireframe transparent opacity={0.18} />
      </mesh>
      <Sparkles count={40} scale={[10, 3, 10]} size={1.5} speed={reduce() ? 0 : 0.1} opacity={0.4} color="#9fb4c0" position={[0, 1.2, 0]} />
    </>
  );
}