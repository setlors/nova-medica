import { usePda } from '../core/store';

type SoundId = 'click' | 'hover' | 'select' | 'boot' | 'warn' | 'crit' | 'alarm';

const RANK = { unknown: 0, ok: 0, warn: 1, crit: 2 } as const;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let metroTimer: number | null = null;
let unsubscribe: (() => void) | null = null;

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC() as AudioContext;
    master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// Browsers block audio until a user gesture
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => ensure(), { once: true });
  window.addEventListener('keydown', () => ensure(), { once: true });
}

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
  delay?: number;
}

function tone(freq: number, dur: number, o: ToneOpts = {}) {
  const c = ensure();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.5, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function playSound(id: SoundId) {
  switch (id) {
    case 'click':
      tone(880, 0.06, { type: 'triangle', gain: 0.4 });
      break;
    case 'hover':
      tone(1320, 0.03, { gain: 0.12 });
      break;
    case 'select':
      tone(520, 0.08, { type: 'triangle' });
      tone(780, 0.1, { type: 'triangle', delay: 0.07 });
      break;
    case 'boot':
      tone(200, 0.9, { type: 'sawtooth', slideTo: 1200, gain: 0.25 });
      tone(1200, 0.25, { delay: 0.9 });
      break;
    case 'warn':
      tone(660, 0.14, { type: 'square', gain: 0.25 });
      tone(660, 0.14, { type: 'square', gain: 0.25, delay: 0.22 });
      break;
    case 'crit':
      for (let i = 0; i < 3; i++) tone(920, 0.12, { type: 'square', gain: 0.35, delay: i * 0.18 });
      break;
    case 'alarm':
      for (let i = 0; i < 4; i++) {
        tone(740, 0.16, { type: 'sawtooth', gain: 0.35, delay: i * 0.34 });
        tone(520, 0.16, { type: 'sawtooth', gain: 0.35, delay: i * 0.34 + 0.17 });
      }
      break;
  }
}

export function setMuted(v: boolean) {
  muted = v;
  if (v) stopMetronome();
}
export const isMuted = () => muted;

// CPR metronome (audible part); the HUD/CprGuide shows the visual part
export function startMetronome(bpm: number) {
  stopMetronome();
  if (muted || bpm <= 0) return;
  const tick = () => tone(1000, 0.05, { type: 'square', gain: 0.3 });
  tick();
  metroTimer = window.setInterval(tick, 60000 / bpm);
}
export function stopMetronome() {
  if (metroTimer !== null) {
    clearInterval(metroTimer);
    metroTimer = null;
  }
}

// Call once from Scene. Safe against double calls (StrictMode). Returns an unsubscribe function.
export function initSoundEvents() {
  unsubscribe?.();
  unsubscribe = usePda.subscribe((s, prev) => {
    if (s.mode === 'emergency' && prev.mode !== 'emergency') {
      playSound('alarm');
      return;
    }
    if (s.mode === 'emergency') return; // quiet during the protocol

    if (s.selectedZone && s.selectedZone !== prev.selectedZone) playSound('select');

    let worst = 0;
    for (const z of Object.keys(s.zoneStatus) as (keyof typeof s.zoneStatus)[]) {
      const now = RANK[s.zoneStatus[z]];
      if (now > RANK[prev.zoneStatus[z]]) worst = Math.max(worst, now);
    }
    if (worst === 2) playSound('crit');
    else if (worst === 1) playSound('warn');
  });
  return () => {
    unsubscribe?.();
    unsubscribe = null;
  };
}