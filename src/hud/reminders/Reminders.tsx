import { useCallback, useEffect, useRef, useState } from "react";
import { getEnvironment, getVitalDef, vitalDefs } from "../../core/content";
import { usePda } from "../../core/store";
import type { EnvironmentId, VitalId } from "../../core/types";
import { Button } from "../../ui/Button";
import { useHud } from "../hudStore";

const MIN = 60_000;
const SNOOZE_MIN = 10;

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
    setDue((prev) => (same(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [check, environment]);

  const snooze = useCallback(
    (vital: VitalId) => {
      snoozedUntil.current.set(
        vital,
        usePda.getState().getNow() + SNOOZE_MIN * MIN,
      );
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
      {due.slice(0, 3).map((r) => (
        <div key={r.vital} className="toast" role="status">
          <div>
            <strong>Time to measure: {r.label}</strong>
            <div className="muted">
              {r.overdueMinutes < 1
                ? "Due now"
                : `Overdue by ${r.overdueMinutes} min`}
            </div>
          </div>
          <div className="row">
            <Button size="sm" onClick={() => openMeasure(r.vital)}>
              Measure
            </Button>
            <Button size="sm" variant="ghost" onClick={() => snooze(r.vital)}>
              Later
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
