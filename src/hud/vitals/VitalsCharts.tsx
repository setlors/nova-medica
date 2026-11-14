import { get, set, update } from "idb-keyval";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getEnvironment, getVitalDef, vitalDefs } from "../../core/content";
import { usePda } from "../../core/store";
import type { Status, Thresholds, VitalReading } from "../../core/types";
import { Panel, StatusBadge } from "../../ui/Panel";
import { formatReading, useHud } from "../hudStore";

// ----- history (IndexedDB) -----

const KEY = "nova-medica:readings:v1";
const MAX = 5000;

export async function persistReading(reading: VitalReading): Promise<void> {
  try {
    await update<VitalReading[]>(KEY, (old) =>
      [...(old ?? []), reading].slice(-MAX),
    );
  } catch (e) {
    console.warn("IndexedDB write failed", e);
  }
}

let restoring: Promise<void> | null = null;

export function restoreHistory(): Promise<void> {
  restoring ??= (async () => {
    try {
      const saved = await get<VitalReading[]>(KEY);
      if (!saved?.length) return;
      const known = new Set<string>();
      for (const list of Object.values(usePda.getState().vitals)) {
        for (const r of list ?? []) known.add(`${r.id}:${r.takenAt}`);
      }
      const fresh = saved.filter((r) => !known.has(`${r.id}:${r.takenAt}`));
      if (fresh.length) usePda.getState().loadHistory(fresh);
    } catch (e) {
      console.warn("IndexedDB read failed", e);
    }
  })();
  return restoring;
}

export async function clearHistory(): Promise<void> {
  try {
    await set(KEY, []);
  } catch (e) {
    console.warn("IndexedDB clear failed", e);
  }
}

const HOUR = 3_600_000;
const PERIODS = [
  { id: "24h", label: "24 h", ms: 24 * HOUR },
  { id: "7d", label: "7 days", ms: 7 * 24 * HOUR },
  { id: "mission", label: "Mission", ms: Infinity },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

const MAX_POINTS = 400;
const ORDER: Status[] = ["ok", "warn", "crit"];

interface ChartPoint {
  t: number;
  value: number;
  secondary?: number;
  status: Status;
}

function statusOf(value: number, t: Thresholds): Status {
  if (value >= t.ok.min && value <= t.ok.max) return "ok";
  if (value >= t.warn.min && value <= t.warn.max) return "warn";
  return "crit";
}

function worse(a: Status, b: Status): Status {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}

// Shape + colour: circle = normal, triangle = attention, square = critical
function StatusDot({
  cx,
  cy,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: unknown;
}) {
  if (cx === undefined || cy === undefined || !payload) return <g />;
  const status = (payload as ChartPoint).status;
  const style = { fill: `var(--${status})`, stroke: "var(--bg)" };
  if (status === "warn") {
    return (
      <polygon
        points={`${cx},${cy - 5} ${cx + 5},${cy + 4} ${cx - 5},${cy + 4}`}
        style={style}
      />
    );
  }
  if (status === "crit") {
    return <rect x={cx - 4} y={cy - 4} width={8} height={8} style={style} />;
  }
  return <circle cx={cx} cy={cy} r={3.5} style={style} />;
}

export function VitalsCharts() {
  const vitalId = useHud((s) => s.chartVital);
  const setChartVital = useHud((s) => s.setChartVital);
  const readings = usePda((s) => s.vitals[vitalId]);
  const baseline = usePda((s) => s.baseline[vitalId]);
  const status = usePda((s) => s.evaluations[vitalId]?.status ?? "unknown");
  const environmentId = usePda((s) => s.environment);
  const simClock = usePda((s) => s.simClock);
  const [period, setPeriod] = useState<PeriodId>("7d");

  const def = getVitalDef(vitalId);
  const thresholds =
    getEnvironment(environmentId)?.thresholdOverrides[vitalId] ??
    def?.thresholds;

  const { data, start, end } = useMemo(() => {
    const now = simClock ?? Date.now();
    const ms = PERIODS.find((p) => p.id === period)?.ms ?? Infinity;
    const all = readings ?? [];
    const inRange =
      ms === Infinity ? all : all.filter((r) => r.takenAt >= now - ms);
    const stride = Math.max(1, Math.ceil(inRange.length / MAX_POINTS));
    const points: ChartPoint[] = [];
    inRange.forEach((r, i) => {
      if (i % stride !== 0 && i !== inRange.length - 1) return;
      let st: Status = thresholds ? statusOf(r.value, thresholds) : "unknown";
      if (def?.secondary && r.secondary !== undefined) {
        st = worse(st, statusOf(r.secondary, def.secondary.thresholds));
      }
      points.push({
        t: r.takenAt,
        value: r.value,
        secondary: r.secondary,
        status: st,
      });
    });
    const first = points[0]?.t ?? now - 24 * HOUR;
    return {
      data: points,
      start: ms === Infinity ? first : now - ms,
      end: now,
    };
  }, [readings, period, simClock, thresholds, def]);

  if (!def || !thresholds) return null;
  const unit = def.unit;
  const latest = readings?.at(-1);
  const dayScale = period !== "24h";

  return (
    <Panel title="Vitals history">
      <div className="chips" role="group" aria-label="Choose a vital">
        {vitalDefs.map((d) => (
          <button
            key={d.id}
            type="button"
            className="chip"
            aria-pressed={d.id === vitalId}
            onClick={() => setChartVital(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="chart-head">
        <div>
          <span className="mono">{formatReading(latest)}</span>{" "}
          <StatusBadge status={status} />
        </div>
        <div className="chips" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="chip"
              aria-pressed={p.id === period}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <p className="muted">No readings in this period yet.</p>
      ) : (
        <div
          role="img"
          aria-label={`${def.label} chart, ${data.length} readings. Latest: ${formatReading(latest)}.`}
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={data}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke="rgba(61,224,255,0.12)" />
              <XAxis
                dataKey="t"
                type="number"
                domain={[start, end]}
                tickFormatter={(v: number) =>
                  dayScale
                    ? new Date(v).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })
                    : new Date(v).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                }
                stroke="var(--text)"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                domain={[
                  (min: number) => Math.floor(Math.min(min, thresholds.ok.min)),
                  (max: number) => Math.ceil(Math.max(max, thresholds.ok.max)),
                ]}
                stroke="var(--text)"
                tick={{ fontSize: 12 }}
                width={44}
              />
              {/* normal-range band */}
              <ReferenceArea
                y1={thresholds.ok.min}
                y2={thresholds.ok.max}
                fill="var(--ok)"
                fillOpacity={0.12}
                stroke="var(--ok)"
                strokeOpacity={0.4}
                strokeDasharray="2 4"
              />
              {/* personal baseline */}
              {baseline && baseline.n >= 3 && (
                <ReferenceLine
                  y={baseline.mean}
                  stroke="var(--holo)"
                  strokeDasharray="6 4"
                  label={{
                    value: "your baseline",
                    fill: "var(--holo)",
                    fontSize: 11,
                    position: "insideTopRight",
                  }}
                />
              )}
              <Tooltip
                contentStyle={{
                  background: "var(--bg)",
                  border: "1px solid var(--holo)",
                  color: "var(--text)",
                }}
                labelFormatter={(l) =>
                  new Date(Number(l)).toLocaleString("en-GB")
                }
                formatter={(value) => `${value} ${unit}`}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={def.primaryLabel ?? def.label}
                stroke="var(--holo)"
                strokeWidth={2}
                dot={StatusDot}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
              {def.secondary && (
                <Line
                  type="monotone"
                  dataKey="secondary"
                  name={def.secondary.label}
                  stroke="var(--unknown)"
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="muted legend">
        ● normal · ▲ attention · ■ critical · green band = normal range
      </p>
    </Panel>
  );
}
