import { useState } from "react";
import type { SubmitEvent } from "react";
import { getEnvironment, getVitalDef, vitalDefs } from "../../core/content";
import { usePda } from "../../core/store";
import type { Evaluation, VitalId } from "../../core/types";
import { Button } from "../../ui/Button";
import { Panel, StatusBadge } from "../../ui/Panel";
import { useHud } from "../hudStore";
import { persistReading } from "../vitals/VitalsCharts";

type Stage = "guide" | "input" | "result";

const MOOD_LABELS = ["Very low", "Low", "Okay", "Good", "Very good"];
const CHECK_LABELS: Record<string, string> = {
  range: "Against the normal range",
  secondary: "Second value (diastolic)",
  baseline: "Against your own baseline",
  trend: "Recent trend",
};

function parseNumber(text: string): number | null {
  const n = Number(text.trim().replace(",", "."));
  return text.trim() !== "" && Number.isFinite(n) ? n : null;
}

export function MeasureWizard({
  vitalId,
  onDone,
}: {
  vitalId: VitalId;
  onDone?: () => void;
}) {
  const def = getVitalDef(vitalId);
  const environmentId = usePda((s) => s.environment);
  const [stage, setStage] = useState<Stage>("guide");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Evaluation | null>(null);

  if (!def) return <p>Unknown vital "{vitalId}".</p>;

  const environment = getEnvironment(environmentId);
  const t = environment?.thresholdOverrides[vitalId] ?? def.thresholds;
  const stepNumber = stage === "guide" ? 1 : stage === "input" ? 2 : 3;

  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!def) return;
    const p = parseNumber(primary);
    if (p === null) {
      setError("Enter a number.");
      return;
    }
    const s = def.secondary ? parseNumber(secondary) : null;
    if (def.secondary && s === null) {
      setError(`Enter the ${def.secondary.label.toLowerCase()}.`);
      return;
    }
    const res = usePda.getState().recordMeasurement(vitalId, p, s ?? undefined);
    if (!res.ok) {
      setError(res.error ?? "Invalid value.");
      return;
    }
    const last = usePda.getState().vitals[vitalId]?.at(-1);
    if (last) void persistReading(last);
    setError(null);
    setResult(res.evaluation ?? null);
    setStage("result");
  }

  function measureAgain() {
    setPrimary("");
    setSecondary("");
    setResult(null);
    setError(null);
    setStage("input");
  }

  return (
    <div className="wizard">
      <p className="muted mono" aria-live="polite">
        Step {stepNumber} of 3
      </p>

      {stage === "guide" && (
        <>
          <h3 className="section-title">Why it matters in space</h3>
          <p>{def.why}</p>

          <h3 className="section-title">How to measure</h3>
          <ol className="steps">
            {def.howTo.map((h) => (
              <li key={h.step}>{h.step}</li>
            ))}
          </ol>

          <h3 className="section-title">
            Normal range{environment ? ` · ${environment.label}` : ""}
          </h3>
          <p className="mono">
            {def.primaryLabel ? `${def.primaryLabel}: ` : ""}
            {t.ok.min}–{t.ok.max} {def.unit}
          </p>
          {def.secondary && (
            <p className="mono">
              {def.secondary.label}: {def.secondary.thresholds.ok.min}–
              {def.secondary.thresholds.ok.max} {def.secondary.unit}
            </p>
          )}
          <p className="muted">
            Attention: up to {t.warn.min}–{t.warn.max} {def.unit}. Outside that
            range the status is critical.
          </p>

          <Button block size="lg" onClick={() => setStage("input")}>
            I'm ready, enter the value
          </Button>
        </>
      )}

      {stage === "input" && (
        <form onSubmit={submit} noValidate>
          {vitalId === "mood" ? (
            <fieldset className="mood-pick">
              <legend className="section-title">How do you feel today?</legend>
              <div className="mood-row">
                {MOOD_LABELS.map((label, i) => {
                  const value = String(i + 1);
                  return (
                    <Button
                      key={value}
                      variant={primary === value ? "primary" : "ghost"}
                      aria-pressed={primary === value}
                      onClick={() => setPrimary(value)}
                    >
                      {value}
                      <small>{label}</small>
                    </Button>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <>
              <label className="field" htmlFor="m-primary">
                {def.primaryLabel ?? def.label} ({def.unit})
              </label>
              <input
                id="m-primary"
                className="input mono"
                inputMode="decimal"
                autoFocus
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                aria-invalid={error !== null}
              />
            </>
          )}

          {def.secondary && (
            <>
              <label className="field" htmlFor="m-secondary">
                {def.secondary.label} ({def.secondary.unit})
              </label>
              <input
                id="m-secondary"
                className="input mono"
                inputMode="decimal"
                value={secondary}
                onChange={(e) => setSecondary(e.target.value)}
                aria-invalid={error !== null}
              />
            </>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <div className="row">
            <Button variant="ghost" onClick={() => setStage("guide")}>
              Back
            </Button>
            <Button type="submit" size="lg">
              Check result
            </Button>
          </div>
        </form>
      )}

      {stage === "result" && result && (
        <div aria-live="polite">
          <div className="result-head">
            <StatusBadge status={result.status} />
            <span className="mono">
              {primary}
              {def.secondary ? `/${secondary}` : ""} {def.unit}
            </span>
          </div>
          <p>{result.reason}</p>

          {result.status === "ok" ? (
            <p className="muted">Nothing to do. Keep your routine.</p>
          ) : (
            <>
              <h3 className="section-title">What to do</h3>
              <ol className="steps">
                {result.actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ol>
            </>
          )}

          <h3 className="section-title">How this status was set</h3>
          <ul className="bullets">
            {Object.entries(result.checks).map(([key, status]) => (
              <li key={key}>
                {CHECK_LABELS[key] ?? key}: <StatusBadge status={status} />
              </li>
            ))}
          </ul>

          <div className="row">
            <Button variant="ghost" onClick={measureAgain}>
              Measure again
            </Button>
            {result.status === "crit" && (
              <Button
                variant="danger"
                onClick={() =>
                  usePda.getState().startEmergency(`Critical ${def.label}`)
                }
              >
                Open Emergency Mode
              </Button>
            )}
            <Button onClick={onDone}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MeasurePanel() {
  const vitalId = useHud((s) => s.measureVital);
  const openMeasure = useHud((s) => s.openMeasure);
  const closeMeasure = useHud((s) => s.closeMeasure);
  const def = vitalId ? getVitalDef(vitalId) : undefined;

  return (
    <Panel
      title={def ? `Measure · ${def.label}` : "Measure"}
      onClose={closeMeasure}
    >
      <div className="chips" role="group" aria-label="Choose a vital">
        {vitalDefs.map((d) => (
          <button
            key={d.id}
            type="button"
            className="chip"
            aria-pressed={d.id === vitalId}
            onClick={() => openMeasure(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>

      {vitalId ? (
        // key resets the wizard when another vital is selected
        <MeasureWizard key={vitalId} vitalId={vitalId} onDone={closeMeasure} />
      ) : (
        <p className="muted">Choose what you want to measure.</p>
      )}
    </Panel>
  );
}
