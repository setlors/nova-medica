import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { usePda } from "../core/store";
import envJson from '../data/environments.json';
import zonesJson from '../data/zones.json';
import type { EnvironmentId, Scenario, Status, Zone, ZoneId } from '../core/types';
import { CameraRig } from './camera/CameraRig';
import { HoloBody } from './body/HoloBody';
import { STATUS_COLOR } from './body/shaders';
import { MarsTransit } from './environments/MarsTransit';
import { MoonBase } from './environments/MoonBase';
import { Orion } from './environments/Orion';
import { Station } from './environments/Station';
import { Effects } from './fx/Effects';

const zones = zonesJson as unknown as Zone[];
const envs = envJson as unknown as { id: EnvironmentId }[];
const DEBUG = new URLSearchParams(window.location.search).has('debug');
const STATUSES: Status[] = ['ok', 'warn', 'crit', 'unknown'];
const SCENARIOS: Scenario[] = ['normal', 'slowDrift', 'collapse'];
const TARGETS: (ZoneId | 'overview')[] = ['overview', ...zones.map((z) => z.id)];

// Matches by name, so it works whatever the other environment ids are
function Env() {
  const id = String(usePda((s) => s.environment));
  if (id.includes('mars')) return <MarsTransit />;
  if (id.includes('moon') || id.includes('lunar')) return <MoonBase />;
  if (id.includes('orion')) return <Orion />;
  return <Station />;
}

function Chip(p: { on?: boolean; color?: string; onClick: () => void; children: ReactNode }) {
  const c = p.color ?? '#3de0ff';
  return (
    <button
      onClick={p.onClick}
      style={{
        font: 'inherit',
        cursor: 'pointer',
        padding: '2px 6px',
        margin: '0 4px 4px 0',
        color: p.on ? '#04121a' : c,
        background: p.on ? c : 'transparent',
        border: `1px solid ${c}`,
      }}
    >
      {p.children}
    </button>
  );
}

// ?debug only: lets scene work without the HUD
function DebugPanel({ low, setLow }: { low: boolean; setLow: (v: boolean) => void }) {
  const [open, setOpen] = useState(true);
  const [msg, setMsg] = useState('');
  const zoneStatus = usePda((s) => s.zoneStatus);
  const cameraTarget = usePda((s) => s.cameraTarget);
  const environment = usePda((s) => s.environment);
  const scenario = usePda((s) => s.scenario);
  const mode = usePda((s) => s.mode);

  const setStatus = (id: ZoneId, st: Status) =>
    usePda.setState((s) => ({ zoneStatus: { ...s.zoneStatus, [id]: st } }));
  const bpm = (v: number) => {
    const r = usePda.getState().recordMeasurement('heartRate', v);
    setMsg(r.ok ? `heartRate ${v} → ${r.evaluation?.status}` : (r.error ?? 'error'));
  };
  const H = ({ children }: { children: ReactNode }) => (
    <div style={{ margin: '8px 0 4px', opacity: 0.7 }}>{children}</div>
  );

  return (
    <div
      style={{
        position: 'fixed', left: 8, top: 8, zIndex: 1000, width: open ? 250 : 'auto',
        maxHeight: '92vh', overflow: 'auto', padding: 8,
        font: '11px "Share Tech Mono", monospace', color: '#d8f6ff',
        background: 'rgba(8,32,44,0.85)', border: '1px solid #3de0ff',
      }}
    >
      <Chip on={open} onClick={() => setOpen(!open)}>DEBUG {open ? '−' : '+'}</Chip>
      {open && (
        <>
          <H>Zone status (next reading overwrites)</H>
          {zones.map((z) => (
            <div key={z.id}>
              <div>{z.id}</div>
              {STATUSES.map((st) => (
                <Chip key={st} color={STATUS_COLOR[st]} on={zoneStatus[z.id] === st} onClick={() => setStatus(z.id, st)}>
                  {st}
                </Chip>
              ))}
            </div>
          ))}

          <H>Camera</H>
          {TARGETS.map((t) => (
            <Chip key={t} on={cameraTarget === t} onClick={() => usePda.getState().setCameraTarget(t)}>{t}</Chip>
          ))}

          <H>Environment</H>
          {envs.map((e) => (
            <Chip key={e.id} on={environment === e.id} onClick={() => usePda.getState().setEnvironment(e.id)}>{e.id}</Chip>
          ))}

          <H>Heart rate (real evaluate path)</H>
          {[45, 70, 110, 140].map((v) => <Chip key={v} onClick={() => bpm(v)}>{v}</Chip>)}
          <div style={{ opacity: 0.8 }}>{msg}</div>

          <H>Scenario</H>
          {SCENARIOS.map((sc) => (
            <Chip key={sc} on={scenario === sc} onClick={() => usePda.getState().setScenario(sc)}>{sc}</Chip>
          ))}

          <H>Mode: {mode}</H>
          <Chip onClick={() => usePda.getState().startEmergency('debug')}>SOS</Chip>
          <Chip onClick={() => usePda.getState().endEmergency()}>end SOS</Chip>
          <Chip on={low} onClick={() => setLow(!low)}>low graphics</Chip>
        </>
      )}
    </div>
  );
}

export function Scene() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const [low, setLow] = useState(false);

  return (
    <>
      <Canvas
        dpr={low ? 1 : [1, 1.5]}
        camera={{ position: [0, 1.1, 3.6], fov: 40, near: 0.1, far: 60 }}
        onPointerMissed={() => usePda.getState().selectZone(null)}
        style={{ position: 'absolute', inset: 0 }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 4, 3]} intensity={1.2} />

        <Env />
        <HoloBody />
        <gridHelper args={[6, 24, '#3de0ff', '#0b3a4a']} />

        <OrbitControls
          ref={controls}
          target={[0, 0.95, 0]}
          enablePan={false}
          minDistance={0.8}
          maxDistance={6}
          maxPolarAngle={Math.PI * 0.55}
        />
        <CameraRig controls={controls} />
        <Effects low={low} />
      </Canvas>
      {DEBUG && <DebugPanel low={low} setLow={setLow} />}
    </>
  );
}