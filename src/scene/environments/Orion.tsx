import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { AdditiveBlending, BackSide, type Group } from 'three';

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Orion() {
  const earth = useRef<Group>(null);
  useFrame((_, dt) => {
    if (earth.current && !reduce()) earth.current.rotation.y += dt * 0.03;
  });
  return (
    <>
      <color attach="background" args={['#050d16']} />
      <Stars radius={40} depth={20} count={800} factor={2} fade />
      <group ref={earth} position={[-4, 2.5, -14]}>
        <mesh>
          <sphereGeometry args={[3, 32, 24]} />
          <meshBasicMaterial color="#1b5f96" />
        </mesh>
        <mesh>
          <sphereGeometry args={[3.2, 32, 24]} />
          <meshBasicMaterial color="#3de0ff" transparent opacity={0.14} blending={AdditiveBlending} side={BackSide} />
        </mesh>
      </group>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[0, 1.1, -2 - i * 1.4]}>
          <torusGeometry args={[3.2 - i * 0.15, 0.04, 6, 48]} />
          <meshBasicMaterial color="#3de0ff" transparent opacity={0.22} />
        </mesh>
      ))}
    </>
  );
}