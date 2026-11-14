import { useEffect, useMemo, useState } from 'react';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Scanline,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';

// The spec asks to drop scanlines and motion-heavy effects for prefers-reduced-motion
function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

type Props = {
  /** "Low graphics" switch: turns everything off */
  low?: boolean;
};

export function Effects({ low = false }: Props) {
  const reduced = useReducedMotion();
  const aberration = useMemo(() => new Vector2(0.0008, 0.0012), []);

  if (low) return null;

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        intensity={0.9}
        luminanceThreshold={0.18}
        luminanceSmoothing={0.35}
        mipmapBlur
        radius={0.7}
      />
      <ChromaticAberration
        offset={aberration}
        radialModulation
        modulationOffset={0.35}
        blendFunction={BlendFunction.NORMAL}
      />
      {reduced ? (
        <Vignette eskil={false} offset={0.25} darkness={0.55} />
      ) : (
        <Scanline blendFunction={BlendFunction.OVERLAY} density={1.4} opacity={0.18} />
      )}
      <Vignette eskil={false} offset={0.25} darkness={0.55} />
    </EffectComposer>
  );
}

export default Effects;