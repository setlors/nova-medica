import { vitalDefs } from "../../core/content";
import type { PdaState } from "../../core/store";
import { usePda } from "../../core/store";
import { Panel } from "../../ui/Panel";
import { useHud } from "../hudStore";
import { useDueReminders } from "../reminders/Reminders";

const DAY = 86_400_000;
const W_FRESH = 40;
const W_STATUS = 40;
const W_SLEEP = 20;
const MISSED_PENALTY = 5;
const MISSED_PENALTY_MAX = 15;

export interface ScoreParts {
  fresh: number;
  status: number;
  sleep: number;
  missedPenalty: number;
  score: number;
}

const STATUS_VALUE = { ok: 1, warn: 0.5, crit: 0, unknown: 0 } as const;

export function computeHealthScore(
  evaluations: PdaState["evaluations"],
  missedReminders: number,
): ScoreParts {
  const total = vitalDefs.length;
  const fresh = vitalDefs.filter((d) => {
    const ev = evaluations[d.id];
    return ev !== undefined && !ev.stale;
  });

  const freshPart = (fresh.length / total) * W_FRESH;
  const statusAvg =
    fresh.length === 0
      ? 0
      : fresh.reduce(
          (sum, d) =>
            sum + STATUS_VALUE[evaluations[d.id]?.status ?? "unknown"],
          0,
        ) / fresh.length;
  const statusPart = statusAvg * W_STATUS;

  const sleepEv = evaluations.sleep;
  const sleepPart =
    sleepEv && !sleepEv.stale ? STATUS_VALUE[sleepEv.status] * W_SLEEP : 0;

  const missedPenalty = Math.min(
    MISSED_PENALTY_MAX,
    missedReminders * MISSED_PENALTY,
  );
  const raw = freshPart + statusPart + sleepPart - missedPenalty;
  return {
    fresh: Math.round(freshPart),
    status: Math.round(statusPart),
    sleep: Math.round(sleepPart),
    missedPenalty,
    score: Math.max(0, Math.min(100, Math.round(raw))),
  };
}

export function computeStreak(vitals: PdaState["vitals"], now: number): number {
  const days = new Set<number>();
  for (const list of Object.values(vitals)) {
    for (const r of list ?? []) days.add(Math.floor(r.takenAt / DAY));
  }
  let d = Math.floor(now / DAY);
  if (!days.has(d)) d -= 1;
  let n = 0;
  while (days.has(d)) {
    n += 1;
    d -= 1;
  }
  return n;
}

export function HealthScore() {
  const vitals = usePda((s) => s.vitals);
  const evaluations = usePda((s) => s.evaluations);
  const simClock = usePda((s) => s.simClock);
  const read = useHud((s) => s.read);
  const { due } = useDueReminders();

  const now = simClock ?? Date.now();
  const parts = computeHealthScore(evaluations, due.length);
  const streak = computeStreak(vitals, now);
  const hasReading = Object.values(vitals).some((l) => (l?.length ?? 0) > 0);

  const achievements = [
    { id: "first-scan", label: "First scan", done: hasReading },
    { id: "streak-7", label: "7 days in a row", done: streak >= 7 },
    {
      id: "read-radiation",
      label: "Read about radiation",
      done: read.includes("radiation"),
    },
  ];

  return (
    <Panel title="Crew Health Score">
      <div className="score-head">
        <span className="mono score-value">{parts.score}</span>
        <span className="muted">/ 100</span>
        <span className="muted score-streak">Streak: {streak} d</span>
      </div>
      <div
        className="score-bar"
        role="progressbar"
        aria-label="Crew Health Score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={parts.score}
      >
        <div style={{ width: `${parts.score}%` }} />
      </div>
      <p className="legend muted">
        Fresh measurements {parts.fresh}/{W_FRESH} · Statuses {parts.status}/
        {W_STATUS} · Sleep {parts.sleep}/{W_SLEEP}
        {parts.missedPenalty > 0 &&
          ` · Missed reminders −${parts.missedPenalty}`}
      </p>
      <ul className="bullets achievements">
        {achievements.map((a) => (
          <li key={a.id} className={a.done ? "" : "muted"}>
            <span aria-hidden="true">{a.done ? "✓" : "○"}</span> {a.label}
            <span className="sr-only">
              {a.done ? " (unlocked)" : " (locked)"}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
