
import {
  AdditiveBlending,
  DoubleSide,
  ShaderMaterial,
} from 'three';

export const STATUS_COLOR: Record<string, string> = {
  normal: '#2ee6a6',
  ok: '#2ee6a6',
  warning: '#ffb020',
  caution: '#ffb020',
  critical: '#ff3b4a',
  alert: '#ff3b4a',
  unknown: '#6b7a8c',
  offline: '#6b7a8c',
};

export function createHologramMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScanY: { value: -10 },
    },
    vertexShader: `
      varying vec3 vPosition;

      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uScanY;

      varying vec3 vPosition;

      void main() {
        float scan = 1.0 - smoothstep(
          0.0,
          0.035,
          abs(vPosition.y - uScanY)
        );

        float pulse = 0.88 + 0.12 * sin(uTime * 2.0);
        float lines = 0.94 + 0.06 * sin(vPosition.y * 180.0);

        vec3 baseColor = vec3(0.10, 0.85, 0.95);
        vec3 scanColor = vec3(0.55, 1.0, 1.0);

        vec3 color = mix(baseColor, scanColor, scan);
        float alpha = (0.32 + scan * 0.45) * pulse * lines;

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthWrite: false,
  });
}
