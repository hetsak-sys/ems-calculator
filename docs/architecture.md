# Hetsa PowerSuite — Architecture
## (`/docs/architecture.md` per HAIOS Appendix B — [SYS-1], [SCA-2])

**Created 2026-07-25** as part of closing the "no split architecture.md/debt.md/ADR index" debt item
(see `debt.md`). This is a first pass, assembled from facts already documented in
`Hetsa_PowerSuite_Project_Knowledge.md` §1/§3/§4/§6 — not new decisions, just organized under the
HAIOS five-view framework ([SYS-1]) for the first time. Extend this file directly as new architectural
facts are established; don't let it drift back into the knowledge doc.

**Scope ceiling** ([SCA-2]): not yet stated. This is itself a gap — the app has no persisted business
records and no multi-tenant concept, so "scale" here means calculation throughput and bundle size on a
single low-end reference device, not concurrent users or row counts. Worth stating explicitly once a
device performance baseline exists (see `debt.md`'s bundle-size entry).

---

## 1. Data View

- **No local business-record database.** The app is a stateless calculator — inputs and results live
  only in React component state during a session, not persisted between calculations.
- **What *is* persisted**, all via `@capacitor/preferences`:
  - License cache (device ID, activation state) — `LicenseManager.js`
  - Site configuration (altitude, ambient temp, etc.) — `SiteContext.jsx`/`SiteProvider`
  - A single "pending result" slot for crash/kill recovery — `shared.jsx`
  - Calculation history (session-scoped, shown in Formula Reference / History)
- **Cross-module handoff** (Motor FLA → Cable, Generator sizing → Renewable Hybrid) flows through
  `WorkspaceContext.jsx`, published only on explicit user action (Calculate/Save), never silently on
  every recalculation.
- **The only real database** in the system belongs to the license server (Postgres/Neon) — device IDs,
  license keys, activation timestamps. Full [DB-1]–[DB-13] discipline applies there; not applicable to
  the Android app itself, which holds no equivalent entities.

## 2. Flow View

- **Typical calculation flow:** user input (text fields, `inputMode="decimal"`) → client-side validation
  → `calculate()` handler (embedded in the relevant `.jsx` component — see Contract View caveat below) →
  `setResult()` → `ResultCard` render → optional PDF export via `pdfExport.js`.
- **License flow:** app launch → `LicenseManager.js` contacts the license server → fail-closed on any
  first-contact failure (no offline grace period, no bypass — see `Hetsa_PowerSuite_Project_Knowledge.md`
  §2 for the recorded HAIOS override and reasoning).
- **No sync flow exists** — there's nothing to reconcile between devices; each device's license check is
  independent, and no business data crosses devices at all.

## 3. Contract View

- **No external API surface** of PowerSuite's own, other than the license server's endpoints (internal,
  not a public contract in the [API-1]–[API-9] sense — single client type, no third-party consumers).
- **PDF export format** is the closest thing to a user-facing "contract" — exported reports are a
  deliverable users rely on for records/handover. Not currently versioned; worth a DOD-level checklist
  ([DOD-4]) before any structural change to report layout.
- **Known contract-relevant inconsistency (documented, not yet resolved):** the knowledge doc's Tech
  Stack section states calculation engines live in `src/lib/`, but `protectionCoordinationEngine.js`,
  `earthFaultProtectionEngine.js`, and `relaySelectionEngine.js` actually live in `src/components/`.
  Doc-corrected 2026-07-24; no code moved. See `debt.md` if this becomes a Lane-2 refactor candidate.

## 4. State View

- **Where state lives:** almost entirely in-memory (React component state), for the duration of a single
  calculation. The only state that outlives a component unmount is what's explicitly written to
  `@capacitor/preferences` (license cache, site config, pending-result slot, history).
- **No authoritative-copy question exists yet** — there's only ever one copy of anything (on-device), so
  the reconciliation problems [OFF-5]/[OFF-6] exist to solve don't currently apply. This will change the
  moment any cloud-sync or saved-project feature ships (§5 "later" horizon in the roadmap) — full [DB]/
  [OFF] discipline binds from day one of that feature, per the existing HAIOS override table.

## 5. Failure View

- **Power-kill mid-calculation:** no committed write is in flight for most calculators (nothing persists
  until Calculate/Save), so there's nothing to corrupt. The one exception is the pending-result recovery
  slot, which is explicitly designed to survive a kill (verified on-device for Earth Fault/Relay
  Selection this session, per the knowledge doc §5.5 verification notes).
- **License server unreachable:** fails closed by design (§2 override table) — this is the one place
  where "fail loud" was deliberately chosen over "degrade gracefully," recorded as a founder-approved
  exception to the general HAIOS instinct.
- **Malformed input:** per [COD-14] (HAIOS v2.2), every `calculate()` function now clears its previous
  result before validating new input, so a validation failure can't leave a stale result on screen next
  to a live error — this was a real defect, fixed 2026-07-22, tracked as closed in `debt.md`.
- **Untested failure paths:** since most calculation modules have no automated tests yet (`debt.md`'s
  top entry), failure-mode coverage for edge-case/boundary inputs (division by zero, negative values,
  out-of-range standards lookups) is currently unverified beyond manual spot-checks. This is the biggest
  gap in this view and the reason the test-suite debt item is rated **Risky**, not merely Cosmetic.

---

## Module Map (informal — see `Hetsa_PowerSuite_Project_Knowledge.md` §4 for the authoritative feature list)

| Module | File | Lines | Has extracted pure calc engine + tests? |
|---|---|---|---|
| Protection Coordination (TCC Study) | `protectionCoordinationEngine.js` + `ProtectionCoordination.jsx` | — | ✅ 40 tests |
| Earth Fault Protection | `earthFaultProtectionEngine.js` (in `Protection.jsx`) | — | ✅ part of 32-test suite |
| Relay Selection | `relaySelectionEngine.js` (in `Protection.jsx`) | — | ✅ part of 32-test suite |
| Motor | `MotorCalculator.jsx` (UI) + `motorEngine.js` (calc, 2026-07-25) | 576 | ✅ 39 tests |
| Contactor/OLR | `ContactorOLR.jsx` (UI) + `contactorOlrEngine.js` (calc, 2026-07-25) | 450 | ✅ 15 tests |
| Cable | `CableCalculator.jsx` (UI, 726 lines) + `cableEngine.js` (calc, 549 lines; 2026-07-25, extended 2026-07-26 with Direct-Buried/Duct/Route Fault Level per §5.6.2) | 1275 combined | ✅ 53 tests (37 original + 16 for Underground Reticulation) |
| Earthing | `EarthingCalculator.jsx` (UI) + `earthingEngine.js` (calc, 2026-07-25) | 303 | ✅ 17 tests |
| Power Systems (transformer/fault/busbar/motor-starting) | `PowerSysCalculator.jsx` (UI) + `powerSysEngine.js` (calc, 2026-07-25) | 355 | ✅ 16 tests |
| Generator Sizing | `GeneratorSizing.jsx` (UI) + `generatorSizingEngine.js` (calc, 2026-07-25) | 1295 | ✅ 18 tests |
| Power Quality | `PQCalculator.jsx` (UI) + `pqEngine.js` (calc, 2026-07-25) | 412 | ✅ 15 tests |
| Renewable Energy | `RenewableEnergyCalculator.jsx` (already UI-only) + `src/lib/{generatorDerating,gridTieCompliance,hybridSizing}.js` (2026-07-25) | 863 | ✅ 35 tests (dependency libs; component itself was already engine-first) |
| Quick Math | `QuickMath.jsx` (UI) + `src/lib/calcEngine.js` (parser/evaluator, 2026-07-25) | 838 | ✅ 49 tests |
| Installation Design (§5.6.1, shipped 2026-07-27) | `InstallationDesign.jsx` (UI) + `installationDesignEngine.js` (calc, in `src/components/` per the existing engine-location note above) — Area Lighting sub-tab also uses shared `src/lib/lumenMethod.js` | — | ✅ 43 tests (`installationDesignEngine.test.js`, cumulative across all four sub-tabs) |

This table is the concrete map behind `debt.md`'s "no automated test suite for most modules" entry —
kept here rather than duplicated in the debt register, since it's architectural fact, not a debt
description.
