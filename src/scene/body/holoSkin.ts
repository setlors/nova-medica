import { Color, CustomBlending, DoubleSide, MaxEquation, OneFactor, ShaderMaterial } from 'three';

const vertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vWorld;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = -mv.xyz;
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uScanY;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vWorld;
  void main() {
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    float ndv = abs(dot(n, normalize(vView)));
    float rim = pow(1.0 - ndv, 2.2);
    float fill = uOpacity * (0.5 + 0.5 * (1.0 - ndv));

    // soft key light from upper left (view space): makes brow, nose, cheeks and chin readable
    vec3 L = normalize(vec3(-0.45, 0.55, 0.7));
    float lam = max(dot(n, L), 0.0);
    // thin contour lines where the surface turns, like facet edges on a clay head
    float steps = floor(lam * 5.0) / 5.0;
    float shade = (lam * 0.65 + steps * 0.35) * 0.30 * (gl_FrontFacing ? 1.0 : 0.0);

    float d = vWorld.y - uScanY;
    float core = exp(-d * d * 2200.0);
    float trail = step(d, 0.0) * exp(d * 7.0);

    float lines = 0.85 + 0.15 * (0.5 + 0.5 * sin(vWorld.y * 260.0 - uTime * 1.5));
    float ground = 0.35 + 0.65 * smoothstep(0.0, 0.3, vWorld.y);

    float a = (fill + shade + rim * 0.7 + core * 0.7 + trail * 0.12) * lines * ground;
    a *= gl_FrontFacing ? 1.0 : 0.45;
    a = clamp(a, 0.0, 1.0);

    vec3 col = uColor * (0.55 + rim * 0.9 + shade * 1.2) + vec3(core * 0.55);
    gl_FragColor = vec4(col * a, a);
  }
`;

export function createHoloSkin() {
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: CustomBlending,
    blendEquation: MaxEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    uniforms: {
      uColor: { value: new Color('#3de0ff') },
      uTime: { value: 0 },
      uScanY: { value: -10 },
      uOpacity: { value: 0.12 },
    },
  });
}