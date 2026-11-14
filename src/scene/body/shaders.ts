import * as T from 'three';
import type { Status } from '../../core/types';

// Status colours = the spec tokens --ok, --warn, --crit, --unknown
export const STATUS_COLOR: Record<Status, string> = {
  ok: '#4dffb0',
  warn: '#ffb347',
  crit: '#ff4d5e',
  unknown: '#6b7f8a',
};

const HOLO_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vY;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * wp;
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vY = wp.y;
    gl_Position = projectionMatrix * mv;
  }
`;

const HOLO_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uScanY;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vY;
  void main() {
    float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.5);
    float lines = 0.92 + 0.08 * sin(vY * 90.0 - uTime * 2.0);
    float beam = exp(-pow((vY - uScanY) * 18.0, 2.0));
    float a = (fres * 0.9 + 0.08 + beam * 0.8) * lines * uOpacity * 2.0;
    gl_FragColor = vec4(uColor + beam * 0.6, clamp(a, 0.0, 1.0));
  }
`;

// Fresnel hologram. ScanBeam.tsx animates uTime and uScanY,
// HoloBody.tsx changes uColor (red in Emergency).
export function createHologramMaterial(color = '#3de0ff'): T.ShaderMaterial {
  return new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.FrontSide,
    blending: T.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uScanY: { value: 0 },
      uOpacity: { value: 0.3 },
      uColor: { value: new T.Color(color) },
    },
    vertexShader: HOLO_VERT,
    fragmentShader: HOLO_FRAG,
  });
}