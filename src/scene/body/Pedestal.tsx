import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, DoubleSide, ShaderMaterial } from 'three';
import { usePda } from '../../core/store';

const noRaycast = () => null;
const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const vertex = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uMotion;
  varying vec2 vP;
  void main() {
    float r = length(vP);
    float disc = (1.0 - smoothstep(0.0, 0.7, r)) * 0.10;
    float ring1 = exp(-pow((r - 0.50) * 60.0, 2.0)) * 0.55;
    float ring2 = exp(-pow((r - 0.62) * 90.0, 2.0)) * 0.35;
    float pr = mod(uTime * 0.25, 1.0) * 0.6;
    float pulse = exp(-pow((r - pr) * 45.0, 2.0)) * 0.35 * (1.0 - pr / 0.6) * uMotion;
    float ang = atan(vP.y, vP.x);
    float ticks = step(0.85, fract(ang * 24.0 / 6.2831853)) * exp(-pow((r - 0.56) * 120.0, 2.0)) * 0.5;
    float a = disc + ring1 + ring2 + pulse + ticks;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export function Pedestal() {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
        uniforms: {
          uColor: { value: new Color('#3de0ff') },
          uTime: { value: 0 },
          uMotion: { value: reduceMotion ? 0 : 1 },
        },
      }),
    [],
  );
  const mode = usePda((s) => s.mode);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => {
    mat.uniforms.uColor!.value.set(mode === 'emergency' ? '#ff4d5e' : '#3de0ff');
  }, [mode, mat]);
  useFrame(({ clock }) => {
    mat.uniforms.uTime!.value = clock.elapsedTime;
  });

  return (
    <mesh raycast={noRaycast} material={mat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
      <circleGeometry args={[0.7, 96]} />
    </mesh>
  );
}