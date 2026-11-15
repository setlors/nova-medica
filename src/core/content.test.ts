import { readFileSync } from "node:fs";
import { validateTriageTree } from "./rules/triage";
import { databank, environments, triageTree, vitalDefs } from "./content";
import { describe, expect, test } from "bun:test";

const sourcesDoc = readFileSync("docs/SOURCES.md", "utf8");

describe("part 3 content", () => {
  test("triage tree is valid", () => {
    expect(validateTriageTree(triageTree)).toEqual([]);
  });

  test("every source key exists in docs/SOURCES.md", () => {
    const keys = new Set<string>([
      ...vitalDefs.flatMap((d) => d.sources),
      ...databank.flatMap((e) => e.sources),
      ...Object.values(triageTree.nodes).flatMap((n) => n.sources ?? []),
    ]);
    for (const key of keys) expect(sourcesDoc).toContain(key);
  });

  test("databank unlockedBy points to a real entry", () => {
    const ids = new Set(databank.map((e) => e.id));
    for (const e of databank) {
      if (e.unlockedBy) expect(ids.has(e.unlockedBy)).toBe(true);
    }
  });

  test("environment overrides and reminders reference real vitals", () => {
    const vitals = new Set<string>(vitalDefs.map((d) => d.id));
    for (const env of environments) {
      for (const id of Object.keys(env.thresholdOverrides))
        expect(vitals.has(id)).toBe(true);
      for (const r of env.reminders) expect(vitals.has(r.vital)).toBe(true);
    }
  });
});
