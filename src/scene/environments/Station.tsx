import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import type { Group } from 'three';

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Station() {
  const ring = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ring.current && !reduce()) ring.current.rotation.z += dt * 0.04;
  });
  return (
    <>
      <color attach="background" args={['#04121a']} />
      <Stars radius={40} depth={20} count={700} factor={2} fade />
      <group ref={ring} position={[0, 1.2, -10]}>
        <mesh>
          <torusGeometry args={[5, 0.05, 8, 96]} />
          <meshBasicMaterial color="#3de0ff" transparent opacity={0.3} />
        </mesh>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 5, Math.sin(a) * 5, 0]} rotation={[0, 0, a]}>
              <boxGeometry args={[0.9, 0.35, 0.35]} />
              <meshBasicMaterial color="#0b5a70" transparent opacity={0.35} wireframe />
            </mesh>
          );
        })}
      </group>
    </>
  );
}