# NOVA MEDICA

**An offline holographic health PDA for astronauts on long-duration missions.**

Built for the **NASA Space Apps Challenge 2026**.

---

## The problem

On the way to Mars, a radio signal needs up to ~20 minutes one way. There is no doctor on board, and a crewmate can lose consciousness without warning. Astronauts are not physicians, but the first minutes of any medical event will be theirs to handle.

## The idea

NOVA MEDICA is a holographic PDA that runs **fully in the browser, without internet**, and answers three questions:

1. **What is my condition right now?** A 3D body scanner, vitals, trends and colour-coded statuses.
2. **What should I measure, and how?** Step-by-step guides: how to measure, why it matters in space, what is normal, what to do if it is not.
3. **Something happened. What do I do?** Emergency Mode with a triage tree, a timer, a CPR metronome, voice prompts and a camera that flies to the affected body zone.

## Principles

- **Offline-first.** No backend. Everything runs in the browser (PWA).
- **Data-driven.** Thresholds, instructions, triage and the Databank live in JSON, not in code. A new environment is added without touching the code.
- **Explainable.** Every status says which value, which threshold and what to do next.
- **Personal baseline.** A reading is compared with the _person's own_ norm, not only with a population average, because in space the norm shifts (fluid redistribution, pressure, sleep).
- **Not a doctor.** Plain language, big buttons, every term explained.

## Features

| Module                 | What it does                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Body Scanner (3D)**  | Holographic body with a scan beam. Organs are coloured by status, and the heart pulses at the real BPM. Click a zone for its function, space risks and related vitals. |
| **Guided Measurement** | Wizard for heart rate, blood pressure, temperature, SpO₂, glucose, sleep and mood, with plausibility checks.                                                           |
| **Vitals & Charts**    | Normal-range band, status-coloured points, personal baseline, 24 h / 7 days / mission view. History is stored in IndexedDB.                                            |
| **Rules Engine**       | Pure TypeScript: absolute thresholds, z-score baseline, trends, combined rules, data freshness.                                                                        |
| **Emergency Mode**     | One question per screen, large buttons, voice, timer, CPR metronome, timestamped action log.                                                                           |
| **Reminders**          | Scheduled measurement, exercise, sleep and mood check-ins. A `timeScale` speeds up time for demos.                                                                     |
| **Environments**       | ISS, Orion, Moon base, Mars transit: different thresholds, risks, communication delay, medkit and scene.                                                               |
| **Gamification**       | Crew Health Score, streaks and achievements (disabled during emergencies).                                                                                             |
| **Databank**           | NASA HRP risk encyclopedia with sources and charts from NASA OSDR data.                                                                                                |
| **Ground Link**        | Export a summary for the flight surgeon on Earth (JSON and PDF/print) with a simulated delay.                                                                          |
| **Simulator**          | Deterministic, seeded data source with `normal`, `slowDrift` and `collapse` scenarios.                                                                                 |

**Stretch goals:** rPPG pulse from video, voice commands, Hazard Radar, Mission Map.

## How the app decides a person's state

The app does not "see" anything on its own. It collects signals, checks them against rules and shows the result. **It does not diagnose, it estimates urgency.**

```
sources → ingest (validation) → evaluate (rules) → zone status → alerts → HUD + 3D
```

Statuses: `ok` (green), `warn` (amber), `crit` (red), `unknown` (grey). Status is never shown by colour alone: there is always an icon and a word.

In microgravity there is no "fall", so an automatic alarm is triggered by an out-of-range pulse, critically low SpO₂, or a lack of movement and response.

## Tech stack

| Layer                      | Technology                                   |
| -------------------------- | -------------------------------------------- |
| Runtime / packages / tests | Bun (`bun test`)                             |
| Language                   | TypeScript (strict)                          |
| Build                      | Vite                                         |
| UI                         | React                                        |
| 3D                         | three, @react-three/fiber, @react-three/drei |
| Effects                    | @react-three/postprocessing, GLSL shaders    |
| Animation                  | GSAP, Framer Motion                          |
| State                      | Zustand                                      |
| Validation                 | Zod                                          |
| Charts                     | Recharts                                     |
| Offline storage            | idb-keyval (IndexedDB)                       |
| PWA                        | vite-plugin-pwa (Workbox)                    |
| Export                     | JSON, jsPDF / `window.print()`               |

## Getting started

**Requirements:** [Bun](https://bun.sh)

```bash
git clone https://github.com/setlors/nova-medica.git
bun install
bun dev
```

| Command             | What it does                 |
| ------------------- | ---------------------------- |
| `bun dev`           | Start the dev server         |
| `bun run build`     | Production build             |
| `bun run preview`   | Preview the production build |
| `bun test`          | Run the unit tests (`core/`) |
| `bun run typecheck` | Type-check the project       |

## Sources and acknowledgements

- NASA Human Research Program (Human Research Roadmap, five hazards of spaceflight)
- NASA-STD-3001 and public ISS medical operations materials
- NASA Open Science Data Repository (OSDR)
- Clinical guidelines (AHA for CPR, WHO) for Earth norms and first aid
