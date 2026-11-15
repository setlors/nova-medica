import { useState } from "react";
import { getEnvironment, vitalDefs } from "../../core/content";
import { usePda } from "../../core/store";
import { CONTRACT_VERSION } from "../../core/types";
import { Button } from "../../ui/Button";
import { Panel, StatusBadge } from "../../ui/Panel";
import { formatDelay, formatReading, useHud } from "../hudStore";

type Period = "24h" | "7d" | "mission";

const DISCLAIMER =
  "Demonstration prototype. Not a medical device and does not replace a doctor. All data is simulated.";
const DAY = 86_400_000;

function buildSummary(period: Period) {
  const s = usePda.getState();
  const now = s.getNow();
  const since =
    period === "24h" ? now - DAY : period === "7d" ? now - 7 * DAY : 0;
  const env = getEnvironment(s.environment);

  return {
    disclaimer: DISCLAIMER,
    contractVersion: CONTRACT_VERSION,
    generatedAt: new Date(now).toISOString(),
    period,
    environment: {
      id: s.environment,
      label: env?.label ?? s.environment,
      commDelaySecOneWay: env?.commDelaySecOneWay ?? 0,
    },
    zoneStatus: s.zoneStatus,
    vitals: vitalDefs.map((d) => {
      const readings = (s.vitals[d.id] ?? []).filter((r) => r.takenAt >= since);
      const ev = s.evaluations[d.id];
      return {
        id: d.id,
        label: d.label,
        status: ev?.status ?? "unknown",
        reason: ev?.reason ?? "No data.",
        latest: readings.at(-1) ?? null,
        readings: readings.map((r) => ({
          ...r,
          takenAtIso: new Date(r.takenAt).toISOString(),
        })),
      };
    }),
    alerts: s.alerts
      .filter((a) => a.at >= since)
      .map((a) => ({ ...a, atIso: new Date(a.at).toISOString() })),
    emergencyLog: s.emergencyLog
      .filter((l) => l.at >= since)
      .map((l) => ({ ...l, atIso: new Date(l.at).toISOString() })),
  };
}

type Summary = ReturnType<typeof buildSummary>;

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp(summary: Summary) {
  return summary.generatedAt.replace(/[:.]/g, "-");
}

function exportJson(summary: Summary) {
  download(
    new Blob([JSON.stringify(summary, null, 2)], { type: "application/json" }),
    `nova-medica-${stamp(summary)}.json`,
  );
}

async function exportPdf(summary: Summary) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 16;
  const line = (text: string, size = 10) => {
    doc.setFontSize(size);
    for (const l of doc.splitTextToSize(text, 180) as string[]) {
      if (y > 280) {
        doc.addPage();
        y = 16;
      }
      doc.text(l, 15, y);
      y += size * 0.45 + 2;
    }
  };

  line("NOVA MEDICA - Crew health summary", 16);
  line(DISCLAIMER, 8);
  line(
    `Generated: ${summary.generatedAt} | Period: ${summary.period} | Environment: ${summary.environment.label} | One-way delay: ${formatDelay(summary.environment.commDelaySecOneWay)}`,
  );
  y += 3;

  line("Vitals", 13);
  for (const v of summary.vitals) {
    const latest = v.latest
      ? `${v.latest.value}${v.latest.secondary !== undefined ? `/${v.latest.secondary}` : ""} ${v.latest.unit} at ${new Date(v.latest.takenAt).toISOString()}`
      : "no data in period";
    line(`${v.label}: ${v.status.toUpperCase()} - ${latest}`);
    line(`   ${v.reason}`, 9);
  }
  y += 3;

  line("Alerts", 13);
  if (summary.alerts.length === 0) line("None in this period.");
  for (const a of summary.alerts) {
    line(`${a.atIso} [${a.severity.toUpperCase()}] ${a.message}`);
  }
  y += 3;

  line("Emergency log", 13);
  if (summary.emergencyLog.length === 0) line("None in this period.");
  for (const l of summary.emergencyLog) line(`${l.atIso} ${l.text}`);

  doc.save(`nova-medica-${stamp(summary)}.pdf`);
}

export function ExportSummary() {
  const [period, setPeriod] = useState<Period>("24h");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentEta, setSentEta] = useState<string | null>(null);
  const closeSide = useHud((s) => s.closeSide);
  const environment = usePda((s) => s.environment);
  const vitals = usePda((s) => s.vitals);
  const evaluations = usePda((s) => s.evaluations);
  const alerts = usePda((s) => s.alerts);

  const env = getEnvironment(environment);
  const delay = env?.commDelaySecOneWay ?? 0;

  const onPdf = async () => {
    setBusy(true);
    setError(null);
    try {
      await exportPdf(buildSummary(period));
    } catch {
      setError("PDF export failed. Use the JSON export instead.");
    } finally {
      setBusy(false);
    }
  };

  const onSend = () => {
    const arrival = new Date(usePda.getState().getNow() + delay * 1000);
    setSentEta(arrival.toLocaleTimeString("en-GB"));
    usePda
      .getState()
      .logEmergency(
        `Summary sent to Earth (one-way delay ${formatDelay(delay)}).`,
      );
  };

  return (
    <Panel title="Ground Link" onClose={closeSide}>
      <p>
        Summary for the flight surgeon on Earth: latest readings, alerts and the
        emergency action log.
      </p>

      <label className="field" htmlFor="gl-period">
        Period
      </label>
      <select
        id="gl-period"
        className="input"
        value={period}
        onChange={(e) => setPeriod(e.target.value as Period)}
      >
        <option value="24h">Last 24 hours</option>
        <option value="7d">Last 7 days</option>
        <option value="mission">Whole mission</option>
      </select>

      <h3 className="section-title">Preview</h3>
      <ul className="zone-vitals">
        {vitalDefs.map((d) => {
          const latest = vitals[d.id]?.at(-1);
          return (
            <li key={d.id} className="zone-vital">
              <span>{d.label}</span>
              <span className="mono">{formatReading(latest)}</span>
              <StatusBadge status={evaluations[d.id]?.status ?? "unknown"} />
            </li>
          );
        })}
      </ul>
      <p className="legend muted">Alerts on record: {alerts.length}</p>

      <div className="row">
        <Button size="sm" onClick={() => exportJson(buildSummary(period))}>
          Download JSON
        </Button>
        <Button size="sm" onClick={onPdf} disabled={busy}>
          {busy ? "Preparing PDF…" : "Download PDF"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onSend}>
          Send to Earth
        </Button>
      </div>

      {error && <p className="error">{error}</p>}
      {sentEta && (
        <p className="note" role="status">
          Transmitted. Simulated one-way delay: {formatDelay(delay)}. Expected
          on Earth at {sentEta}.
        </p>
      )}
    </Panel>
  );
}
