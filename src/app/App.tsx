import { Scene } from '../scene/Scene';
import { usePda } from "../core/store";
import { simulatorController } from '../core/simulator/connect';
// import { Hud } from '../hud/Hud'; // enable when B's HUD is ready

// Console access: pda.getState(), pda.setState({...})
(window as any).pda = usePda;
// Simulator from the console: sim.loadHistory(14), sim.start({ scenario: 'collapse' }), sim.stop()
(window as any).sim = simulatorController;

export default function App() {
  return (
    <>
      <Scene />
      {/* <Hud /> */}
    </>
  );
}