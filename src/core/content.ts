import { z } from "zod";
import environmentsRaw from "../data/environments.json";
import vitalsRaw from "../data/vitals.json";
import zonesRaw from "../data/zones.json";
import type {
  Environment,
  EnvironmentId,
  VitalDef,
  VitalId,
  Zone,
  ZoneId,
} from "./types";
import { ENVIRONMENT_IDS, HAZARD_IDS, VITAL_IDS, ZONE_IDS } from "./types";
import databankRaw from "../data/databank.json";
import triageRaw from "../data/triage.json";
import type { DatabankEntry, TriageTree } from "./types";
import { STATUSES } from "./types";

const RangeSchema = z
  .object({ min: z.number(), max: z.number() })
  .refine((r) => r.min <= r.max, "min must be <= max");

const ThresholdsSchema = z
  .object({ ok: RangeSchema, warn: RangeSchema })
  .refine(
    (t) => t.warn.min <= t.ok.min && t.warn.max >= t.ok.max,
    "warn range must contain the ok range",
  );

export const VitalDefSchema = z.object({
  id: z.enum(VITAL_IDS),
  label: z.string().min(1),
  primaryLabel: z.string().optional(),
  unit: z.string(),
  plausible: RangeSchema,
  ttlMinutes: z.number().positive(),
  howTo: z.array(z.object({ step: z.string().min(1) })).min(1),
  why: z.string().min(1),
  thresholds: ThresholdsSchema,
  secondary: z
    .object({
      label: z.string().min(1),
      unit: z.string(),
      plausible: RangeSchema,
      thresholds: ThresholdsSchema,
    })
    .optional(),
  actions: z.object({
    warn: z.array(z.string().min(1)).min(1),
    crit: z.array(z.string().min(1)).min(1),
  }),
  sources: z.array(z.string().min(1)).min(1),
  unverified: z.boolean().optional(),
});

export const EnvironmentSchema = z.object({
  id: z.enum(ENVIRONMENT_IDS),
  label: z.string().min(1),
  gravityG: z.number().min(0),
  commDelaySecOneWay: z.number().min(0),
  risks: z.array(z.enum(HAZARD_IDS)),
  medkit: z.array(z.string()),
  thresholdOverrides: z.record(z.string(), ThresholdsSchema),
  reminders: z.array(
    z.object({ vital: z.enum(VITAL_IDS), everyMinutes: z.number().positive() }),
  ),
});

export const ZoneSchema = z.object({
  id: z.enum(ZONE_IDS),
  label: z.string().min(1),
  meshNames: z.array(z.string()),
  relatedVitals: z.array(z.enum(VITAL_IDS)),
  function: z.string().min(1),
  spaceRisks: z.array(z.string()),
});

const SourceKeys = z.array(z.string().min(1)).min(1);

const TriageNodeSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1).optional(),
  options: z
    .array(z.object({ label: z.string().min(1), next: z.string().min(1) }))
    .optional(),
  action: z
    .object({
      title: z.string().min(1),
      steps: z.array(z.string().min(1)).min(1),
      severity: z.enum(STATUSES),
      cameraTarget: z.enum(ZONE_IDS).optional(),
      metronomeBpm: z.number().min(60).max(200).optional(),
    })
    .optional(),
  voice: z.string().optional(),
  sources: SourceKeys,
  unverified: z.boolean().optional(),
});

export const TriageTreeSchema = z.object({
  start: z.string().min(1),
  nodes: z.record(z.string(), TriageNodeSchema),
});

export const DatabankEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.enum(["hazard", "condition"]),
  summary: z.string().min(1),
  details: z.array(z.string().min(1)).min(1),
  relatedVitals: z.array(z.enum(VITAL_IDS)),
  unlockedBy: z.string().optional(),
  sources: SourceKeys,
  unverified: z.boolean().optional(),
  chart: z
    .object({
      title: z.string().min(1),
      unit: z.string(),
      source: z.string().min(1),
      points: z
        .array(z.object({ label: z.string(), value: z.number() }))
        .min(2),
    })
    .optional(),
});

const typed = <T>(value: unknown): T => value as T;
export const vitalDefs = typed<VitalDef[]>(
  z.array(VitalDefSchema).parse(vitalsRaw),
);
export const environments = typed<Environment[]>(
  z.array(EnvironmentSchema).parse(environmentsRaw),
);
export const zones = typed<Zone[]>(z.array(ZoneSchema).parse(zonesRaw));
export const triageTree = typed<TriageTree>(TriageTreeSchema.parse(triageRaw));
export const databank = typed<DatabankEntry[]>(
  z.array(DatabankEntrySchema).parse(databankRaw),
);
export const getDatabankEntry = (id: string): DatabankEntry | undefined =>
  databank.find((e) => e.id === id);
export const getVitalDef = (id: VitalId): VitalDef | undefined =>
  vitalDefs.find((d) => d.id === id);

export const getEnvironment = (id: EnvironmentId): Environment | undefined =>
  environments.find((e) => e.id === id);

export const zoneForVital = (id: VitalId): ZoneId | undefined =>
  zones.find((z) => z.relatedVitals.includes(id))?.id;
