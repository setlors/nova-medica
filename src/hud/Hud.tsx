import "./hud.css";
import { useEffect, useState } from "react";
import {
  environments,
  getEnvironment,
  getVitalDef,
  vitalDefs,
  zones,
} from "../core/content";
import { simulatorController } from "../core/simulator/connect";
import { usePda } from "../core/store";
import type { Scenario, VitalId } from "../core/types";
import { SCENARIOS, ZONE_IDS } from "../core/types";
import { Button } from "../ui/Button";
import { Panel, StatusBadge } from "../ui/Panel";
import {
  formatAgo,
  formatClock,
  formatDelay,
  formatReading,
  useHud,
} from "./hudStore";
import { MeasurePanel } from "./measure/MeasurePanel";
import { Reminders } from "./reminders/Reminders";
import {
  clearHistory,
  restoreHistory,
  VitalsCharts,
} from "./vitals/VitalsCharts";
import { Databank } from "./databank/Databank";
import { EmergencyPanel } from "./emergency/EmergencyPanel";
import { HealthScore } from "./gamification/HealthScore";
import { ExportSummary } from "./groundlink/ExportSummary";

// ----- top bar -----

function TopBar() {
  const mode = usePda((s) => s.mode);
  const environment = usePda((s) => s.environment);
  const setEnvironment = usePda((s) => s.setEnvironment);
  const chartsOpen = useHud((s) => s.chartsOpen);
  const toggleCharts = useHud((s) => s.toggleCharts);
  const openMeasure = useHud((s) => s.openMeasure);
  const closeMeasure = useHud((s) => s.closeMeasure);
  const env = getEnvironment(environment);
  const sidePanel = useHud((s) => s.sidePanel);
  const openSide = useHud((s) => s.openSide);
  const closeSide = useHud((s) => s.closeSide);

  return (
    <header className="hud-bar">
      <span className="brand">NOVA MEDICA</span>

      <div className="bar-actions">
        {mode !== "emergency" && (
          <>
            <label className="sr-only" htmlFor="env-select">
              Environment
            </label>
            <select
              id="env-select"
              className="input"
              value={environment}
              onChange={(e) =>
                setEnvironment(e.target.value as typeof environment)
              }
            >
              {environments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant={mode === "measure" ? "primary" : "ghost"}
              onClick={() =>
                mode === "measure" ? closeMeasure() : openMeasure()
              }
            >
              Measure
            </Button>
            <Button
              size="sm"
              variant={chartsOpen ? "primary" : "ghost"}
              onClick={toggleCharts}
            >
              Charts
            </Button>
            <Button
              size="sm"
              variant={sidePanel === "databank" ? "primary" : "ghost"}
              onClick={() =>
                sidePanel === "databank" ? closeSide() : openSide("databank")
              }
            >
              Databank
            </Button>
            <Button
              size="sm"
              variant={sidePanel === "groundlink" ? "primary" : "ghost"}
              onClick={() =>
                sidePanel === "groundlink"
                  ? closeSide()
                  : openSide("groundlink")
              }
            >
              Ground Link
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => usePda.getState().startEmergency("Manual SOS")}
            >
              SOS
            </Button>
          </>
        )}
      </div>
    </header>
  );
}

// ----- vitals widgets -----

function VitalCard({ id, label }: { id: VitalId; label: string }) {
  const latest = usePda((s) => s.vitals[id]?.at(-1));
  const status = usePda((s) => s.evaluations[id]?.status ?? "unknown");
  const simClock = usePda((s) => s.simClock);
  const openMeasure = useHud((s) => s.openMeasure);
  return (
    <li>
      <button
        type="button"
        className="vital-card"
        onClick={() => openMeasure(id)}
        aria-label={`${label}: ${formatReading(latest)}. Open measurement guide.`}
      >
        <span className="vital-name">{label}</span>
        <span className="mono vital-value">{formatReading(latest)}</span>
        <StatusBadge status={status} />
        {latest && (
          <span className="muted vital-ago">
            {formatAgo(latest.takenAt, simClock ?? Date.now())}
          </span>
        )}
      </button>
    </li>
  );
}

function VitalsWidgets() {
  return (
    <Panel title="Vitals">
      <ul className="vital-list">
        {vitalDefs.map((d) => (
          <VitalCard key={d.id} id={d.id} label={d.label} />
        ))}
      </ul>
    </Panel>
  );
}

// ----- alerts -----

function AlertList() {
  const alerts = usePda((s) => s.alerts);
  const dismiss = usePda((s) => s.dismissAlert);
  // automatic alarms stay visible while the sensor is still out of range
  const active = alerts
    .filter((a) => !a.acknowledged || a.id.startsWith("alarm:"))
    .slice(0, 4);
  if (active.length === 0) return null;
  return (
    <Panel title="Alerts" aria-live="assertive">
      <ul className="alert-list">
        {active.map((a) => (
          <li key={a.id} className={`alert alert-${a.severity}`}>
            <div className="alert-head">
              <StatusBadge status={a.severity} />
              <span className="muted mono">{formatClock(a.at)}</span>
            </div>
            <p>{a.message}</p>
            {a.acknowledged && (
              <p className="muted">
                Still out of range. If it persists, Emergency Mode will open
                again.
              </p>
            )}
            <div className="row">
              {a.suggestsEmergency && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => usePda.getState().startEmergency(a.message)}
                >
                  Open Emergency Mode
                </Button>
              )}
              {!a.id.startsWith("alarm:") && (
                <Button size="sm" variant="ghost" onClick={() => dismiss(a.id)}>
                  Dismiss
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ----- zone panel -----

function RelatedVital({ id }: { id: VitalId }) {
  const def = getVitalDef(id);
  const latest = usePda((s) => s.vitals[id]?.at(-1));
  const status = usePda((s) => s.evaluations[id]?.status ?? "unknown");
  const openMeasure = useHud((s) => s.openMeasure);
  return (
    <li className="zone-vital">
      <div>
        <strong>{def?.label ?? id}</strong>
        <div className="mono">{formatReading(latest)}</div>
      </div>
      <StatusBadge status={status} />
      <Button size="sm" variant="ghost" onClick={() => openMeasure(id)}>
        Measure
      </Button>
    </li>
  );
}

function ZonePanel() {
  const zoneId = usePda((s) => s.selectedZone);
  const status = usePda((s) => (zoneId ? s.zoneStatus[zoneId] : "unknown"));
  const selectZone = usePda((s) => s.selectZone);
  const zone = zones.find((z) => z.id === zoneId);
  if (!zone) return null;

  return (
    <Panel
      title={zone.label}
      onClose={() => selectZone(null)}
      actions={<StatusBadge status={status} />}
    >
      <h3 className="section-title">What it does</h3>
      <p>{zone.function}</p>

      <h3 className="section-title">Risks in space</h3>
      <ul className="bullets">
        {zone.spaceRisks.map((risk) => (
          <li key={risk}>{risk}</li>
        ))}
      </ul>

      <h3 className="section-title">Related vitals</h3>
      {zone.relatedVitals.length === 0 ? (
        <p className="muted">
          No vitals are linked to this zone yet, so its status is unknown.
        </p>
      ) : (
        <ul className="zone-vitals">
          {zone.relatedVitals.map((id) => (
            <RelatedVital key={id} id={id} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ----- demo controls -----

const TIME_SCALES = [
  { value: 1, label: "1× (real time)" },
  { value: 60, label: "60× (1 min per tick)" },
  { value: 600, label: "600× (10 min per tick)" },
  { value: 3600, label: "3600× (1 h per tick)" },
];

function DemoControls() {
  const open = useHud((s) => s.demoOpen);
  const toggle = useHud((s) => s.toggleDemo);
  const scenario = usePda((s) => s.scenario);
  const timeScale = usePda((s) => s.timeScale);
  const chestPain = usePda((s) => s.flags.includes("chest-pain"));
  const selectedZone = usePda((s) => s.selectedZone);
  const [running, setRunning] = useState(simulatorController.running);

  return (
    <Panel
      title="Demo controls"
      actions={
        <Button size="sm" variant="ghost" onClick={toggle}>
          {open ? "Hide" : "Show"}
        </Button>
      }
    >
      {open && (
        <div className="demo">
          <div className="row">
            <Button
              size="sm"
              variant={running ? "danger" : "primary"}
              onClick={() => {
                if (running) simulatorController.stop();
                else simulatorController.start();
                setRunning(!running);
              }}
            >
              {running ? "Stop simulator" : "Start simulator"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => simulatorController.loadHistory(14)}
            >
              Load 14-day history
            </Button>
          </div>

          <label className="field" htmlFor="d-scenario">
            Scenario
          </label>
          <select
            id="d-scenario"
            className="input"
            value={scenario}
            onChange={(e) =>
              simulatorController.setScenario(e.target.value as Scenario)
            }
          >
            {SCENARIOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <label className="field" htmlFor="d-scale">
            Time speed
          </label>
          <select
            id="d-scale"
            className="input"
            value={timeScale}
            onChange={(e) =>
              simulatorController.setTimeScale(Number(e.target.value))
            }
          >
            {TIME_SCALES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <label className="check">
            <input
              type="checkbox"
              checked={chestPain}
              onChange={(e) =>
                usePda.getState().setFlag("chest-pain", e.target.checked)
              }
            />
            Flag: chest pain (self-report)
          </label>

          <div className="field">Select zone (instead of a 3D click)</div>
          <div className="chips">
            {ZONE_IDS.map((z) => (
              <button
                key={z}
                type="button"
                className="chip"
                aria-pressed={selectedZone === z}
                onClick={() =>
                  usePda.getState().selectZone(selectedZone === z ? null : z)
                }
              >
                {z}
              </button>
            ))}
          </div>

          <div className="row">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                simulatorController.stop();
                setRunning(false);
                usePda.getState().reset();
              }}
            >
              Reset state
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void clearHistory()}
            >
              Clear saved readings
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

// ----- shell -----

export function Hud() {
  const mode = usePda((s) => s.mode);
  const selectedZone = usePda((s) => s.selectedZone);
  const chartsOpen = useHud((s) => s.chartsOpen);
  const sidePanel = useHud((s) => s.sidePanel);

  useEffect(() => {
    void restoreHistory();
  }, []);

  // Escape closes the open panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const pda = usePda.getState();
      if (pda.mode === "measure") useHud.getState().closeMeasure();
      else if (pda.mode === "idle") pda.selectZone(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="hud-root" data-mode={mode}>
      <TopBar />

      {mode === "emergency" ? (
        <EmergencyPanel />
      ) : (
        <>
          <aside className="hud-left">
            <VitalsWidgets />
            <HealthScore />
            <AlertList />
            <DemoControls />
          </aside>

          <aside className="hud-right">
            {sidePanel === "databank" ? (
              <Databank />
            ) : sidePanel === "groundlink" ? (
              <ExportSummary />
            ) : mode === "measure" ? (
              <MeasurePanel />
            ) : selectedZone ? (
              <ZonePanel />
            ) : null}
          </aside>

          {chartsOpen && (
            <div className="hud-bottom">
              <VitalsCharts />
            </div>
          )}

          <Reminders />
        </>
      )}

      <footer className="hud-disclaimer">
        Demonstration prototype. Not a medical device and does not replace a
        doctor. All data is simulated.
      </footer>
    </div>
  );
}
