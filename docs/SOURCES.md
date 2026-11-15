# Sources

Every threshold, instruction and triage step in `src/data/*.json` must point to
a key from this table. The test `src/core/content.test.ts` fails if a key used
in the JSON is missing here.

| Key                  | Title                                                                            | Link                                                                                                                                                    | Used for                                                                  |
| -------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `nasa-hrp`           | NASA Human Research Program, Human Research Roadmap                              | https://humanresearchroadmap.nasa.gov/                                                                                                                  | Five hazards of spaceflight, `why` texts in vitals.json, Databank entries |
| `nasa-iss-medical`   | NASA NTRS: ISS Medical Checklist                                                 | https://ntrs.nasa.gov/citations/20110003477                                                                                                             | How the emergency checklist is organized                                  |
| `aha-cpr`            | American Heart Association: Guidelines for CPR and Emergency Cardiovascular Care | https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines                                                                                   | CPR steps and rate in triage.json                                         |
| `clinical-reference` | Clinical reference for Earth norms (AHA, MedlinePlus)                            | https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings <br> https://medlineplus.gov/lab-tests/pulse-oximetry/ | Base thresholds in vitals.json, first-aid steps                           |
