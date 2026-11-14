# Sources

Every threshold, instruction and triage step in `src/data/*.json` must point to
a key from this table. The test `src/core/content.test.ts` fails if a key used
in the JSON is missing here.

Rules for this file:

- The first column is the key, written in backticks.
- Keys are unique.
- Text in JSON that is not yet checked against its source is marked `unverified: true`.

| Key                  | Title                                                                            | Link                                                                       | Used for                                                                     |
| -------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `nasa-hrp`           | NASA Human Research Program, Human Research Roadmap                              | https://humanresearchroadmap.nasa.gov/                                     | Five hazards of spaceflight, `why` texts in vitals.json, Databank entries    |
| `nasa-std-3001`      | NASA-STD-3001: Space Flight Human-System Standard                                | https://standards.nasa.gov/ (search "NASA-STD-3001")                       | Crew health and performance standards, reference for thresholds              |
| `nasa-iss-medical`   | NASA public materials on medical care on the ISS                                 | TODO: add the exact NASA page                                              | Triage protocols (CPR, chest pain, unresponsive crew member) in a spacecraft |
| `nasa-osdr`          | NASA Open Science Data Repository (OSDR)                                         | https://osdr.nasa.gov/                                                     | Static data snapshot for Databank charts                                     |
| `aha-cpr`            | American Heart Association: Guidelines for CPR and Emergency Cardiovascular Care | https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines      | CPR steps and rate in triage.json                                            |
| `clinical-reference` | Clinical reference for Earth norms (WHO and clinical guidelines)                 | TODO: add the exact guideline pages (blood pressure, SpO2, glucose, fever) | Base thresholds in vitals.json, first-aid steps                              |

## Open items

- Replace every `TODO` and general link with a direct link to the document or page used.
- Check each text marked `unverified: true` against its source, then remove the flag.
- Thresholds in `environments.json` (`thresholdOverrides`) are illustrative demo values. Add the source or label them as demo values.
