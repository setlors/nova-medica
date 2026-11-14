import { AdditiveBlending, BackSide, BoxGeometry, EdgesGeometry } from 'three';
import { Sparkles, Stars } from '@react-three/drei';

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Built once, shared by every frame
const FRAME = new EdgesGeometry(new BoxGeometry(6.4, 4.4, 0.02));

export function MarsTransit() {
  return (
    <>
      <color attach="background" args={['#120807']} />
      <Stars radius={40} depth={20} count={600} factor={2} fade />
      <group position={[6, 1.5, -18]}>
        <mesh>
          <sphereGeometry args={[2, 32, 24]} />
          <meshBasicMaterial color="#b5502d" />
        </mesh>
        <mesh>
          <sphereGeometry args={[2.2, 32, 24]} />
          <meshBasicMaterial color="#ff8a4d" transparent opacity={0.14} blending={AdditiveBlending} side={BackSide} />
        </mesh>
      </group>
      {Array.from({ length: 6 }, (_, i) => (
        <lineSegments key={i} geometry={FRAME} position={[0, 1.1, -2 - i * 1.6]}>
          <lineBasicMaterial color="#ff8a4d" transparent opacity={0.3} />
        </lineSegments>
      ))}
      <Sparkles count={80} scale={[12, 5, 12]} size={2} speed={reduce() ? 0 : 0.3} opacity={0.5} color="#ff9a6b" position={[0, 1.2, 0]} />
    </>
  );
}