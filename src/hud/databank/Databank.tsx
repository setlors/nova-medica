import { useMemo, useState } from "react";
import { databank, getDatabankEntry } from "../../core/content";
import type { DatabankEntry } from "../../core/types";
import { Panel } from "../../ui/Panel";
import { Button } from "../../ui/Button";
import { isEntryUnlocked, useHud } from "../hudStore";

function Chart({ entry }: { entry: DatabankEntry }) {
  const chart = entry.chart;
  if (!chart) return null;
  const max = Math.max(...chart.points.map((p) => p.value), 1);
  return (
    <figure className="db-chart">
      <figcaption>
        {chart.title} ({chart.unit})
      </figcaption>
      {chart.points.map((p) => (
        <div key={p.label} className="db-bar-row">
          <span className="db-bar-label">{p.label}</span>
          <span
            className="db-bar"
            style={{ width: `${(p.value / max) * 100}%` }}
          />
          <span className="mono">{p.value}</span>
        </div>
      ))}
      <p className="legend muted">Data snapshot: {chart.source}</p>
    </figure>
  );
}

function Detail({
  entry,
  onBack,
}: {
  entry: DatabankEntry;
  onBack: () => void;
}) {
  return (
    <Panel title={entry.title} onClose={onBack}>
      <p>{entry.summary}</p>
      <ul className="bullets">
        {entry.details.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
      <Chart entry={entry} />
      {entry.unverified && (
        <p className="note">
          Text not yet verified against its source. Do not treat as fact.
        </p>
      )}
      <p className="legend muted">Sources: {entry.sources.join(", ")}</p>
      <div className="row">
        <Button size="sm" variant="ghost" onClick={onBack}>
          ← All entries
        </Button>
      </div>
    </Panel>
  );
}

export function Databank() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const unlocked = useHud((s) => s.unlocked);
  const read = useHud((s) => s.read);
  const markRead = useHud((s) => s.markRead);
  const closeSide = useHud((s) => s.closeSide);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return databank;
    return databank.filter((e) =>
      [e.title, e.summary, ...e.details].join(" ").toLowerCase().includes(q),
    );
  }, [query]);

  const open = openId ? getDatabankEntry(openId) : undefined;
  if (open) return <Detail entry={open} onBack={() => setOpenId(null)} />;

  const openEntry = (e: DatabankEntry) => {
    markRead(e.id);
    setOpenId(e.id);
  };

  return (
    <Panel title="Databank" onClose={closeSide}>
      <label className="sr-only" htmlFor="db-search">
        Search the Databank
      </label>
      <input
        id="db-search"
        className="input"
        type="search"
        placeholder="Search risks and conditions"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {filtered.length === 0 && <p className="muted">Nothing found.</p>}
      <ul className="db-list">
        {filtered.map((e) => {
          const ok = isEntryUnlocked(e, unlocked);
          if (!ok) {
            const parent = e.unlockedBy ? getDatabankEntry(e.unlockedBy) : null;
            return (
              <li key={e.id} className="db-item db-locked">
                <strong>🔒 Locked</strong>
                <span className="muted">
                  Read “{parent?.title ?? e.unlockedBy}” to unlock, or wait for
                  a change in a related vital.
                </span>
              </li>
            );
          }
          return (
            <li key={e.id}>
              <button
                type="button"
                className="vital-card db-item"
                onClick={() => openEntry(e)}
              >
                <span className="vital-name">{e.title}</span>
                <span className="muted">
                  {e.category === "hazard" ? "Hazard" : "Condition"}
                  {!read.includes(e.id) && " · NEW"}
                </span>
                <span className="db-summary">{e.summary}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
