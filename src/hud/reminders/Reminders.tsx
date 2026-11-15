import { useCallback, useEffect, useRef, useState } from "react";
import { getEnvironment, getVitalDef, vitalDefs } from "../../core/content";
import { usePda } from "../../core/store";
import type { EnvironmentId, VitalId } from "../../core/types";
import { Button } from "../../ui/Button";
import { useHud } from "../hudStore";

const MIN = 60_000;
const SNOOZE_MIN = 10;
const SNOOZE_MIN_REAL_MS = 60_000;

export interface DueReminder {
  vital: VitalId;
  label: string;
  overdueMinutes: number;
}

function scheduleFor(id: EnvironmentId) {
  const list = getEnvironment(id)?.reminders ?? [];
  return list.length
    ? list
    : vitalDefs.map((d) => ({ vital: d.id, everyMinutes: d.ttlMinutes }));
}

function same(a: DueReminder[], b: DueReminder[]) {
  return (
    a.length === b.length &&
    a.every(
      (x, i) =>
        x.vital === b[i]?.vital && x.overdueMinutes === b[i]?.overdueMinutes,
    )
  );
}

function snoozeDuration(timeScale: number) {
  return Math.max(
    SNOOZE_MIN * MIN,
    SNOOZE_MIN_REAL_MS * Math.max(1, timeScale),
  );
}

function formatOverdue(min: number) {
  if (min < 1) return "Due now";
  if (min < 120) return `Overdue by ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `Overdue by ${h} h`;
  return `Overdue by ${Math.floor(h / 24)} days`;
}

export function useDueReminders() {
  const environment = usePda((s) => s.environment);
  const [due, setDue] = useState<DueReminder[]>([]);
  const snoozedUntil = useRef(new Map<VitalId, number>());
  const startedAt = useRef<number | null>(null);

  const check = useCallback(() => {
    const s = usePda.getState();
    const now = s.getNow();
    startedAt.current ??= now;
    const next: DueReminder[] = [];
    for (const r of scheduleFor(s.environment)) {
      const snoozed = snoozedUntil.current.get(r.vital);
      if (snoozed !== undefined && now < snoozed) continue;
      const ref = s.vitals[r.vital]?.at(-1)?.takenAt ?? startedAt.current;
      const overdue = now - ref - r.everyMinutes * MIN;
      if (overdue >= 0) {
        next.push({
          vital: r.vital,
          label: getVitalDef(r.vital)?.label ?? r.vital,
          overdueMinutes: Math.floor(overdue / MIN),
        });
      }
    }
    // most overdue first, so the order stays stable between checks
    next.sort(
      (a, b) =>
        b.overdueMinutes - a.overdueMinutes || a.vital.localeCompare(b.vital),
    );
    setDue((prev) => (same(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [check, environment]);

  const snooze = useCallback(
    (vitals: VitalId | VitalId[]) => {
      const s = usePda.getState();
      const until = s.getNow() + snoozeDuration(s.timeScale);
      for (const v of Array.isArray(vitals) ? vitals : [vitals]) {
        snoozedUntil.current.set(v, until);
      }
      check();
    },
    [check],
  );

  return { due, snooze };
}

export function Reminders() {
  const { due, snooze } = useDueReminders();
  const openMeasure = useHud((s) => s.openMeasure);

  return (
    <div className="toasts" aria-live="polite" aria-relevant="additions">
      {due.length === 1 && due[0] && (
        <div className="toast" role="status">
          <div>
            <strong>Time to measure: {due[0].label}</strong>
            <div className="muted">{formatOverdue(due[0].overdueMinutes)}</div>
          </div>
          <div className="row">
            <Button size="sm" onClick={() => openMeasure(due[0]!.vital)}>
              Measure
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => snooze(due[0]!.vital)}
            >
              Later
            </Button>
          </div>
        </div>
      )}

      {due.length > 1 && (
        <div className="toast" role="status">
          <div>
            <strong>{due.length} measurements due</strong>
            <div className="muted">
              {due
                .slice(0, 3)
                .map((r) => r.label)
                .join(", ")}
              {due.length > 3 ? ` +${due.length - 3} more` : ""}
            </div>
          </div>
          <div className="row">
            <Button size="sm" onClick={() => openMeasure()}>
              Measure
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => snooze(due.map((r) => r.vital))}
            >
              Later
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
