import { Scene } from '../scene/Scene';
import { usePda } from "../core/store";
// import { Hud } from '../hud/Hud'; // enable when B's HUD is ready

const CAM_TARGETS = [
  'overview',
  'heart',
  'brain',
  'lungs',
  'immune',
  'metabolism',
  'bones',
  'muscles',
] as const;

function TempReadout() {
  const zone = usePda((s) => s.selectedZone);
  const hovered = usePda((s) => s.hoveredZone);
  const setCam = usePda((s) => s.setCameraTarget);
  return (
    <div className="panel mono" style={{ position: 'absolute', top: 16, left: 16, zIndex: 1 }}>
      <h3 className="panel-title">M0 test</h3>
      <div>selectedZone: {zone ?? 'null'}</div>
      <div>hoveredZone: {hovered ?? 'null'}</div>
      {CAM_TARGETS.map((z) => (
        <button key={z} onClick={() => setCam(z)}>
          {z}
        </button>
      ))}
    </div>
  );
}

// Console access: pda.getState(), pda.setState({...})
(window as any).pda = usePda;

export default function App() {
  return (
    <>
      <Scene />
      <TempReadout />
      {/* <Hud /> */}
    </>
  );
}