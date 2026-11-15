import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import type { OrbitControls } from '@react-three/drei';
import gsap from 'gsap';
import { Vector3 } from 'three';
import { usePda } from "../../core/store";
import { CAMERA_PRESETS } from './presets';

type Controls = ComponentRef<typeof OrbitControls>;

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function CameraRig({ controls }: { controls: RefObject<Controls | null> }) {
  const camera = useThree((s) => s.camera);
  const target = usePda((s) => s.cameraTarget);
  const tween = useRef<gsap.core.Tween | null>(null);
  const [controlsReady, setControlsReady] = useState(0);

  // Ensure event listener attaches once controls.current is populated
  useEffect(() => {
    const ctl = controls.current;
    if (!ctl) {
      const id = requestAnimationFrame(() => setControlsReady((n) => n + 1));
      return () => cancelAnimationFrame(id);
    }

    const stop = () => tween.current?.kill();
    ctl.addEventListener('start', stop);
    return () => {
      ctl.removeEventListener('start', stop);
    };
  }, [controls, controlsReady]);

  useEffect(() => {
    const ctl = controls.current;
    if (!target || !ctl) return;

    const p = CAMERA_PRESETS[target];
    const toTarget = new Vector3(...p.target);
    const toPos = new Vector3(p.target[0], p.target[1] + 0.1, p.target[2] + p.distance);

    // prefers-reduced-motion: jump, no flight
    if (reduceMotion()) {
      camera.position.copy(toPos);
      ctl.target.copy(toTarget);
      ctl.update();
      return;
    }

    const fromPos = camera.position.clone();
    const fromTarget = ctl.target.clone();
    const k = { t: 0 };

    tween.current?.kill();
    // One tween drives both position and target, so they never drift apart
    tween.current = gsap.to(k, {
      t: 1,
      duration: 1.1,
      ease: 'power2.inOut',
      onUpdate: () => {
        camera.position.lerpVectors(fromPos, toPos, k.t);
        ctl.target.lerpVectors(fromTarget, toTarget, k.t);
        ctl.update();
      },
    });

    return () => {
      tween.current?.kill();
    };
  }, [target, camera, controls, controlsReady]);

  return null;
}