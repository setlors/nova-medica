import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import type { Group } from 'three';

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Station() {
  const ring = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ring.current && !reduce()) ring.current.rotation.y += dt * 0.05;
  });
  return (
    <>
      <color attach="background" args={['#04121a']} />
      <Stars radius={30} depth={20} count={600} factor={2} fade />
      <group ref={ring} position={[0, 1, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[5, 0.06, 8, 96]} />
          <meshBasicMaterial color="#3de0ff" transparent opacity={0.35} />
        </mesh>
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 5, 0, Math.sin(a) * 5]} rotation={[0, -a, 0]}>
              <boxGeometry args={[0.5, 0.5, 1.2]} />
              <meshBasicMaterial color="#0b5a70" transparent opacity={0.4} wireframe />
            </mesh>
          );
        })}
      </group>
    </>
  );
}