# Hetsa PowerSuite — Project Conventions & Knowledge
## (HAIOS v2.0-aligned — functions as this project's `conventions.md`)

**Status:** Normative for this project. Extends the HETSA AI Operating System (HAIOS) v2.0 per [PRO-1]. Any deviation from a HAIOS MUST/MUST NOT is recorded explicitly in §2, never silent, per [PRO-2].

---

## 0. Bootstrap note [PRO-9]

At the start of a session on this project, the working context is: (1) HAIOS Appendix A kernel, (2) this document, (3) whatever module/feature is the actual task. There is no separate `architecture.md` / `debt.md` / ADR index yet — this document currently absorbs those roles in condensed form (see §8 for the debt register in miniature). Splitting them out properly is itself a listed debt item (§8).

**Update (2026-07-22):** this document itself was, until this session, only attached to the Claude Project — not tracked in the `hetsak-sys/ems-calculator` repository at all, in direct tension with [PRO-11] ("chat history is never the system of record"). It now lives at `docs/Hetsa_PowerSuite_Project_Knowledge.md` in the repo. Future sessions should bootstrap from the repo copy, not assume a Project-attached file is authoritative.

---

## 1. Mission & Product Overview

**Hetsa PowerSuite** is a commercial Android engineering app for electrical engineers and field technicians in South Africa and Lesotho, built solo by Hertz — an electrical technician with hands-on field experience.

Per [MIS-1]: this is software a small team (currently a team of one, plus an AI engineering partner) can maintain for a decade, that keeps working when the network and grid do not, and earns trust through correctness rather than novelty. Every module decision is checked against that, not against what's technically interesting to build.

- **Goal:** Replace engineering reference books, manual calculations, and error-prone spreadsheets for field practitioners.
- **Target users:** Electrical engineers, field technicians, mine electrical staff, contractors, training colleges.
- **Field context:** High-altitude sites (Maseru ~1600 m, Letseng ~3100 m), rugged use, offline-first operation, dust/gloves/sunlight-on-screen conditions ([UX-6] applies).
- **Standards base:** IEC 60364, 60947, 60076, 60909, 60034, 61936-1, 60255, 61869, 62548, 61727, 62109, 60502; SANS 10142, 10114, 10098, 1339; IEEE 80, 519, 242, C37; IEC 61000; ISO 8528-1; NRS 048, 097; MHSA regulations.
- **Repo:** `hetsak-sys/ems-calculator` (legacy name retained internally — see override in §2). License server: `hetsak-sys/hetsa-license-server`.

---

## 2. Profile Declaration & Recorded Overrides [PRO-5], [PRO-1]

**Declared profile: P-FIELD.** The Android app is the product's center of gravity — offline-first binds in full ([OFF-1]–[OFF-9]). The license server is a small, separate P-WEB-class service (server-authoritative, connectivity-dependent by design, since trial integrity requires it).

Every deviation from a HAIOS default below is deliberate and recorded, not accidental:

| Rule(s) | HAIOS default | PowerSuite override | Reason |
|---|---|---|---|
| [OFF-2]–[OFF-5] sync/conflict | Local store of record with outbox/inbox sync | Not implemented — app is stateless per-calculation, no business records persisted or synced across devices | There is currently no multi-device business data to reconcile; only license state talks to a server, and that's verify-only, not sync |
| License fail-behavior (analogous to [OFF-9]/[ERR-2]) | Graceful degradation preferred | **Fail-closed** on first-contact license check, no offline grace period, owner-bypass mode removed entirely | A fail-open or bypass path reintroduces the device-clear exploit (uninstall/reinstall to reset trial) that's endemic to sideloaded APK distribution in this market ([MOB-5]). This is a deliberate, founder-approved exception to the general "degrade gracefully" instinct — logged here per [PRO-2], not silently decided |
| [VCS-4] CI gates on `main` | Build/lint/tests must pass to merge | No CI pipeline exists; builds are local via Android Studio on Windows | Solo-developer reality; no team-coordination problem CI is solving for yet. **Flagged as debt**, not a permanent exception — revisit if a second developer or automated release pipeline is ever justified |
| [TST-1]–[TST-10] test suite | Automated suite, domain logic near-complete coverage | No automated test suite currently exists for any module (except `protectionCoordinationEngine.js`, which has 40 unit tests) | **This is the highest-priority forbidden-debt-adjacent gap** ([DBT-4] treats domain-logic correctness as non-negotiable). Calculation modules are safety-relevant and currently verified only by manual spot-check. See §8 |
| [DB-1]–[DB-13] database rules | Full schema/migration discipline | Only the license server has a real database (Postgres/Neon); the app itself holds no local business-record database, only license cache via Capacitor Preferences | The app is a calculator, not a record-keeping system — no persisted business entities yet. If cloud sync or saved-project features are added later (§5 "later" horizon), full [DB] discipline binds from day one of that feature |
| [SEC-4] at-rest encryption | Local DBs encrypted | Not applied — no sensitive personal data is stored locally, only calculation inputs and a license cache | Per [PRV-1] classification: data handled is business-operational, not personal/sensitive. Revisit if any future feature stores site GPS coordinates, client names, or similar |

**Standing instruction:** any new override to a HAIOS MUST/MUST NOT gets added to this table with a reason — that's the mechanism, not a suggestion ([PRO-2]).

---

## 3. Tech Stack & Architecture

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Capacitor 6 + Tailwind CSS |
| Packaging | Android APK (Capacitor + Android Studio, local build) |
| Backend (license server only) | Node.js/Express + PostgreSQL (Neon), hosted on Render.com |
| Client storage | `@capacitor/preferences` (license cache, site config), `@capacitor/device` (device ID) |
| PDF export | `jsPDF`, `@capacitor/filesystem@6.0.4`, `@capacitor/share@6.0.4` |

**Architecture conventions (per [DES-1]–[DES-7], [ARC-6]):**
- Shared site config lives in `SiteContext.jsx` / `SiteProvider`, wired through `App.jsx`. Site parameters persist across relaunch via `@capacitor/preferences`.
- Bottom navigation uses `env(safe-area-inset-bottom)`.
- **All numeric inputs:** `type="text" inputMode="decimal"` — never `type="number"` — with comma-to-period normalization. This is a [DES-4]-style "make invalid states unrepresentable" concern specific to Android decimal entry.
- Dark/light theming centralized in `theme.js`.
- Naming collisions on import: rename on import (e.g. `import GeneratorSizing as GeneratorSizingPro`) rather than refactor existing code — a deliberate [DEC-2] "smallest reversible change" bias, not a permanent pattern; if the same collision recurs, that's the [DEC-3] signal to resolve it properly instead of renaming around it again.
- Few, heavy dependencies over many light ones ([ARC-6]): the jsPDF bundle-size tradeoff (~350 KB dead code) was accepted deliberately for the offline-APK context, not overlooked.
- **No location ever assumed as a default.** The app never seeds any calculator's altitude/ambient/site fields from a named place (Maseru, Letseng, or otherwise) — only from the user's own configured `SiteContext` value, free-text/free-number entry, or an explicit worked example clearly marked as illustrative.
- Cross-module data handoff (e.g. Motor FLA → Cable Calculator, Generator sizing → Renewable Hybrid) flows through `WorkspaceContext.jsx`, published only on an explicit user action (e.g. tapping Calculate/Save), never silently on every recalculation.
- PDF export and result-card display share one core (`shared.jsx`'s `ResultCard`/`useResultCard`). Every generated result is also persisted as a single "pending result" slot via `@capacitor/preferences`, so a result left unexported before the app closes/gets killed can be recovered via a banner on next launch rather than silently lost.
- **Generator tab structure (decided 2026-07-22):** `PowerSysCalculator.jsx`'s former standalone basic Generator tab and `GeneratorSizing.jsx`'s four-stage chain are merged into a single top-level **Generator** tab. Two entry modes via a segmented control:
  - **Known Load Sizing** — single total kW/kVA input, one-shot calculation
  - **Load Schedule Sizing** — build-up chain, navigated via a persistent flow-strip: **Loads → Gen → Transformer → Fault Level**

  "Impedance" was renamed to "Fault Level" throughout — states the output the user cares about, not the calculation method. Both modes share the same motor-starting multipliers and standard-transformer-size list (previously silently diverged between the two legacy tabs: 6.5×/2.3×/1.0× vs. 6×/2×/1.1× — now unified on the Load Schedule chain's values). This was a visible, moderately hard-to-reverse UI decision per [AI-15]; recorded here rather than left implicit.
- **Every `calculate()` function clears its previous result before validating new input** — `setResult(null)` immediately after `setError('')`, before any early-return check ([COD-14], see §9 and the amendment note below). This is now a standing pattern for any new calculator module, not just the three files patched in this session.
- **PDF export text sanitization:** all rendered PDF text (titles, site info, standard references, table rows, notes) passes through `sanitizeForPdf()` in `pdfExport.js` before being written, because jsPDF's built-in Helvetica font is WinAnsi/Latin-1 only and cannot render Ω/φ/Φ/→/← correctly. Any new calculator adding PDF export must route its strings through the same shared rendering path (`ResultCard`/`useResultCard` → `pdfExport.js`) rather than calling jsPDF directly, or it will silently reintroduce the glyph-corruption defect closed in §8.

---

## 4. Current Module State (Complete)

| Module | Key Features |
|---|---|
| **Motor** | FLA, contactor/OLR selector (IEC 60947, Schneider/Eaton/Siemens/AB cross-refs), MCCB sizing, starting methods (DOL/Y-Δ/Auto-T/VFD/Soft Start), voltage dip, IE class comparison |
| **Cable** | IEC 60364 sizing + derating, voltage drop, fault current, mining trailing cable, conduit fill, VFD cable, cable schedule w/ CSV export, gland selection |
| **Earthing** | Dwight formula, IEEE 80 touch/step voltage, Schwarz formula, adiabatic equation |
| **Protection** | NER/NCRT, IDMT relay coordination (IEC 60255-151), CT burden (IEC 61869-2), insulation resistance/PI/DAR (IEEE 43), simplified LV arc flash estimate (IEEE 1584), transformer differential protection, protection grading reference table, Protection Coordination TCC Study (arbitrary-length relay/fuse/transformer chain with discrimination margin checking) — **all sub-tabs now verified on-device (§7)** |
| **Power Systems** | Transformer parameters/fault currents, PFC + detuned reactor sizing, generator sizing (ISO 8528-1 de-rating) with combined Gen→Transformer→Fault Level PDF report (single export reachable from any of the three stages, replacing the three separate per-stage exports — **verified on-device, §7**), busbar rating, motor-starting comparison |
| **Power Quality** | THD/K-factor, battery/UPS sizing, lighting lumen method (SANS 10114) |
| **Renewable Energy** | PV array sizing, off-grid/hybrid battery sizing (shared core with Power Quality's UPS sizing), grid-tie compliance reference (IEC 62548/61727/NRS 097) |
| **Unit Converter** | 12 categories incl. AWG-to-mm² table |
| **Quick Math** | Recursive-descent parser/AST evaluator (`calcEngine.js`), parameterized Programs tab, multi-step worksheets with Pass/Fail thresholds |
| **Formula Reference** | Session history, absorbed former Constants tab |

**Cross-cutting features:** PDF export (all modules, via ResultCard data shape, with sitewide Ω/φ/Φ/arrow-safe rendering and page-break continuation headers — §7/§8) with pending-result recovery, cross-module data handoff via `WorkspaceContext.jsx` (Motor → Cable's four relevant sub-tabs, Generator sizing → Renewable Hybrid), full licensing system (trial + activation, server-side clock).

**Note per [ARC-1]:** Generator sizing is foundational, not standalone — it feeds motor starting, cable sizing, protection settings, and fuel estimation. Treat as a dependency when modifying.

**Note (resolved 2026-07-22):** the knowledge doc previously referenced a "multi-load fault level calculator (IEC 60909)" under Power Systems. Confirmed by direct file inspection — no such calculator exists or ever existed in `PowerSysCalculator.jsx`. The file's Transformer/Generator logic contains only a single-transformer, secondary-side fault estimate (generator + transformer series impedance, simplified model per IEC 60909 Clause 8 caveats). The earlier doc wording describing a "multi-load fault level calculator" was either aspirational or referred to a feature that never shipped. No multi-load fault-level feature is currently planned; if one is wanted later, it's a new scoping conversation per §5.1.

---

## 5. Domain Expansion Roadmap [LTP-2]

This is the "why" and horizon for where PowerSuite goes next. Per [LTP-3], every candidate below gets checked against the product's purpose before being checked technically — and per [LTP-4], the instinct is to deepen the existing calculation core before widening into adjacent jobs (installation testing, e.g., is a genuinely different job — a checklist/record tool, not a calculator — and gets flagged as such below).

### 5.1 The standing scoping checklist — run this before starting *any* item below

Per [ARC-1] (technology/scope decisions are architecture decisions, not casual ones) and [DEC-1] (two-question filter), every new domain area gets these three questions answered explicitly before code is written:

1. **Priority** — does this serve the mine/contractor/college institutional pitch soonest, or is it a "later" item?
2. **Depth** — full design tool (derating, shading, string configuration, sag-tension curves...) or field-quick calculator (rule-of-thumb sizing + standard reference)?
3. **New module vs. extension** — does it get its own tab, or fold into an existing module's charter ([DES-1]/[DES-2] — can the module's one-sentence charter still be written honestly if this folds in)?

None of the items below have been answered against this checklist yet — that's the next conversation, one domain at a time, not a batch decision.

### 5.2 Candidate domains

| Domain | Scope | Standards | Overlap vs. new |
|---|---|---|---|
| **Building/installation design** | Household/office/workshop/warehouse load assessment, DB/distribution board sizing, circuit design, area & floodlighting (lux levels, pole spacing) | SANS 10142-1, SANS 10114-1, SANS 10098, IEC 60364 | New — interior lumen method exists (Power Quality), but load assessment and area lighting layout don't |
| **Renewable energy design** | PV array sizing, inverter/battery sizing, hybrid off-grid/grid-tie design, generator hybridization | IEC 62548, IEC 61727, NRS 097, IEC 62109 | **Shipped** — see §4 |
| **MV/LV reticulation — overhead** | Conductor sizing, sag-tension, pole spacing, clearances, transformer placement | SANS 10280, IEC 61936-1, NRS 048 | New — distinct from single-run cable sizing already in Cable module |
| **MV/LV reticulation — underground** | Cable sizing for direct-buried/duct runs, derating, jointing, route fault levels | IEC 60502, SANS 1339, IEC 60909 | Extension of Cable module logic |
| **Installation testing** | IR, Ze/Zs, RCD trip time/current, polarity, continuity — SANS 10142 test schedule with pass/fail | SANS 10142-1 Annex, IEC 60364-6 | New job type — a commissioning/record tool, not a calculator; likely its own module by charter test ([DES-2]) |
| **Feeder protection, grading & coordination** | IDMT curve selection, discrimination margins, time-current grading | IEC 60255, IEEE 242, MHSA | **Substantially shipped** as Protection Coordination TCC Study — see §4 |
| **Earth fault protection (expanded)** | NER sizing (exists), earth fault relay settings, sensitive earth fault (SEF) for HR systems | IEC 60255, MHSA | Extension of Protection |
| **Relay selection** | Overcurrent/earth fault/differential relay type by application, CT ratio/class matching | IEC 60255, IEC 61869 | Extension of Protection |
| **11 kV generator power generation** | See §5.3 — flagged separately, deliberately not folded into the table above | — | New territory, adjacent to but distinct from existing generator sizing |

### 5.3 Power generation via 11 kV generators — called out separately

Existing Power Systems generator sizing (ISO 8528-1) targets LV gensets — typical field/standby power. **11 kV generation is medium-voltage territory** and pulls in a materially different rule set, not just a bigger number:

- **Machine standards:** IEC 60034 (rotating electrical machines) governs the generator itself, not ISO 8528-1 alone, once you're at MV.
- **Neutral earthing method** at the generator — NER placement/sizing at the generator neutral is a different problem from NER at a downstream transformer (already in Protection); resistance-earthed vs. solidly-earthed generator neutrals have different fault behaviors.
- **Generator protection:** differential protection, restricted earth fault (REF), loss-of-excitation, reverse power, over/under-frequency — a distinct protection philosophy from feeder protection.
- **Paralleling/synchronizing:** voltage/frequency/phase matching before closing onto a busbar or grid — a genuinely new calculation domain (synchroscope logic, synchronizing check relays).
- **Step-up/interconnection:** whether the generator feeds an 11 kV distribution network directly or steps up/down, and — if paralleling to the grid — NRS 048/097 embedded-generation compliance.
- **AVR/voltage regulation** behavior under load, relevant to motor-starting-comparison logic that already exists for LV.

This is a "new module vs. extension" question in its own right (§5.1): it could live as an MV-generation sub-tab inside Power Systems (closest existing charter), or as its own module if the scope grows to include paralleling/synchronizing tools, which are a different enough workflow to strain Power Systems' one-sentence charter. **Recommend scoping this as its own conversation** rather than deciding here.

### 5.4 Explicit not-doing (for now) [LTP-2]

Nothing above is being ruled out permanently — but until at least one domain has gone through §5.1's checklist and shipped, no others should be started in parallel. Sprawl into unrelated jobs before deepening any one of them is exactly the failure mode [LTP-4] warns about.

### 5.5 Deepening candidates within Protection (proposed, not yet scoped — 2026-07-23)

With Protection's six sub-tabs and the TCC Study now verified (§7), the two nearest "deepen before widening" candidates are **Earth Fault Protection (expanded)** and **Relay Selection**, both extensions of the existing Protection charter rather than new modules. Provisional read against §5.1, pending Hertz's confirmation:

1. **Priority:** soonest — SEF settings and relay-type selection are core mine-electrical-department daily work, directly relevant to the MHSA-grounded institutional pitch.
2. **Depth:** field-quick calculator — rule-of-thumb sizing plus standard reference tables (CT ratio/class matching, relay-type-by-application), not a full protection-study/configuration package.
3. **New module vs. extension:** extension — both fold into Protection's existing charter without straining it.

**Not yet actioned** — this is a recommendation surfaced in conversation, not a confirmed decision. Treat as unscoped until Hertz runs §5.1 explicitly in its own session.

---

## 6. Licensing System — Current State

- Backend live at `https://hetsa-license-server.onrender.com`, Postgres on Neon (free tier).
- `LicenseManager.js`, `LicenseGate.jsx`, `deviceId.js` committed and verified on a real device.
- Hertz's personal key `HETSA-TMSF-RRWQ-38BY` generated and confirmed active.
- Owner bypass mode removed entirely — see §2 override table for the reasoning; this is deliberate, not an oversight to "fix" later.
- Fail-closed on first-contact failure; no local grace period (§2).
- **License migration to a new device** — explicitly deferred/parked, not solved. Needs the actual `hetsa-license-server` code/schema reviewed before recommending anything concrete.

---

## 7. Pending/Unresolved

| Item | Status | Blocking? |
|---|---|---|
| **applicationId mismatch** — `capacitor.config.json` had `com.hetsa.powersuite`, `android/app/build.gradle` had `com.ems.calculator` | **Resolved** — confirmed running on the reference device under `com.hetsa.powersuite`, committed and pushed | No longer blocking |
| **Copper resistivity discrepancy** — FormulaReference used 0.0175 Ω·mm²/m; other modules used 1.724e-8 Ω·m (~0.01724) | **Resolved** — standardized to 0.01724 Ω·mm²/m (IEC 60228 measured value at 20°C) across FormulaReference, PowerSysCalculator (Busbar R_per_m), and Protection.jsx (CT Burden RHO_CU); verified on-device via CT Burden calc matching hand-calculation | No longer blocking |
| **Keystore** — PowerSuite needs its own dedicated signing keystore | **Resolved** — release signing certificate (`CN=Khoalite Hetsa, OU=PowerSuite, O=Hetsa Systems, L=Maseru, ST=Lesotho, C=Ls`, valid through 2053) confirmed stored outside the project folder, in a safe location, as of 2026-07-17 | No longer blocking |
| **`PowerSysCalculator.jsx` multi-load fault calculator discrepancy** — knowledge doc previously referenced a "multi-load fault level calculator (IEC 60909)" that doesn't appear in the actual file | **Resolved (2026-07-22)** — confirmed by direct file inspection that no such calculator exists; doc wording corrected in §4. No multi-load fault-level feature is currently planned | No longer blocking |
| **Six Protection sub-tabs unverified on-device** — IDMT, CT Burden, Insulation PI/DAR, Arc Flash, Transformer Differential, and Grading | **Resolved (2026-07-22)** — all six exercised on the reference device with hand-calculated test values; every result matched formula within rounding. Grading (static reference table) confirmed rendering cleanly, all 5 rows. See §8 for the defect found and fixed during this pass | No longer blocking |
| **Transformer stage base-impedance discrepancy** — `GeneratorSizing.jsx`'s Transformer stage computed `zBase`/`%Z ohmic equivalent` off the generator's pre-rounding input kVA (1500), while the Fault Level stage correctly used the selected standard transformer size (1600 kVA) for the same base-impedance figure — causing the two stages to disagree (0.2017 Ω vs. 0.1891 Ω) despite describing the same transformer | **Resolved (2026-07-22)** — reordered so `stdKVA` is computed before `zBase`/`zOhm` reference it. Verified on-device: both stages now agree (0.1891 Ω / 0.0095 Ω) | No longer blocking |
| **Combined Gen/Transformer/Fault-Level PDF report** — replaces the three separate per-stage export buttons with one, reachable from all three stage tabs | **Shipped and verified (2026-07-22)** — exercised on-device across all three entry stages; all figures matched on-screen values exactly. Surfaced two rendering-layer defects in `pdfExport.js` (see §8), now fixed | No longer blocking |
| **Stale calculation result on validation failure** — Protection.jsx, MotorCalculator.jsx, ContactorOLR.jsx | **Resolved (2026-07-22)** — `setResult(null)` added to all 14 affected `calculate()` functions; verified on-device | No longer blocking |
| **PDF export Ω/φ/Φ/arrow glyph corruption + page-break table headers** | **Resolved (2026-07-22)** — `sanitizeForPdf()` added and applied sitewide; `drawTable()` repeats section titles across page breaks; verified via rendered-and-extracted test PDFs | No longer blocking |
| **This session's five code files committed & pushed to `main`** | **Resolved (2026-07-23)** — `237ffe9` (stale-result fix), `03e2d50` (combined report), `a1d418d` (PDF sanitization), all pushed to `origin/main` | No longer blocking |
| **This knowledge doc's repo copy was stale relative to session decisions** | **Resolved (2026-07-23)** — this file is the corrected version, meant to be committed as the file body at `docs/Hetsa_PowerSuite_Project_Knowledge.md`, replacing the version from commit `772322a` | Not blocking once committed — **confirm the commit actually landed before next session trusts this note** |

---

## 8. Debt Register (condensed) [DBT-2]

A full `/docs/debt.md` doesn't exist yet as a separate file — logged here until it's worth splitting out.

| Debt | Why taken | Repayment trigger | Severity |
|---|---|---|---|
| No automated test suite | Solo-dev velocity; manual verification so far | Before any second developer joins, or before any calculation module is materially reworked | **Risky** — calculation logic is safety-relevant ([TST-2] priority 1 territory); this is the debt item closest to crossing into [DBT-4] forbidden-debt if left too long |
| No CI pipeline | No team-coordination problem yet | Before public distribution, or before a second developer joins | Cosmetic-to-risky |
| No split `architecture.md`/`debt.md`/ADR index | This document currently absorbs those roles | Before the domain expansion (§5) begins in earnest — new architecture decisions (11 kV generation, reticulation) deserve real ADRs, not a table row | Risky, rising |
| ~~Six Protection sub-tabs shipped but never run on-device~~ | — | **Repaid (2026-07-22)** — all six verified on-device against hand-calculated expected values | Closed |
| ~~Stale calculation result not cleared on validation failure~~ | Pre-existing since each module was first built; found via on-device Insulation PI/DAR testing | **Repaid (2026-07-22)** — `setResult(null)` added immediately after `setError('')` at the top of all 14 affected `calculate()` functions, before any validation runs. Re-verified on-device | Closed |
| **Round-to-standard-then-reference ordering pattern unchecked elsewhere** | The zBase bug (fixed 2026-07-22) was a specific instance of a general pattern risk: any calc that rounds to a standard size and then references that standard size needs the rounding step first. Cable, Protection, and other Transformer-adjacent logic weren't audited for the same mistake this session — only the one instance found via user report was fixed | Before next release build, grep each module for `nextStd(` or equivalent standard-size lookups and confirm nothing downstream references the pre-rounded value | Cosmetic-to-risky — no evidence yet of a second instance, but unverified |
| ~~PDF export: Ω/φ/Φ/arrow characters render as garbage glyphs sitewide~~ | jsPDF's built-in Helvetica font is WinAnsi/Latin-1 only | **Repaid (2026-07-22)** — `sanitizeForPdf()` added to shared rendering path; header title wrapped via `splitTextToSize`; verified via rendered-and-extracted test PDFs | Closed |
| ~~PDF export: section title doesn't repeat across a page break~~ | Same root-cause investigation as the glyph fix | **Repaid (2026-07-22)** — `drawTable()` repeats the section title marked "(cont.)" on page breaks; verified with a forced 70-row test table | Closed |
| **[COD-14] HAIOS amendment drafted but not yet written into the handbook** — a proposed general rule generalizing the stale-result fix ("derived/displayed state must be invalidated before new validation begins") was discussed in chat but never pasted into wherever `HETSA_AI_Operating_System_v2.md` actually lives as a tracked file | Amendment was scoped verbally in-session; committing it needs a deliberate v2.2 changelog entry per [PRO-7]/[PRO-8], not a casual edit | Before the pattern recurs in a new module — ideally before starting any §5 domain work | Cosmetic-to-risky — the underlying fix is done; only the handbook generalization is outstanding |
| **`npm audit` flagged 6 vulnerabilities (1 critical) during a build this session** | Surfaced in build output per [MOB-7] post-build check, never actually reviewed — noted in passing only | Review before next release build; a critical vulnerability sitting unexamined is a [SEC-7] gap | **Risky** — unreviewed critical-severity flag, dependency attack surface |
| **Repo-copy of this knowledge doc was stale relative to in-session decisions** — the doc committed in `772322a` didn't reflect the six-sub-tab verification, stale-result fix, combined report, or PDF-encoding closures; those existed only in chat until this update | Doc updates were drafted in conversation but the corresponding `git add`/`commit` for the doc file itself was never executed alongside the code commits | **Repaid (2026-07-23), pending confirmation** — this file replaces the stale repo copy; confirm via `git log`/`git diff` that the commit actually landed | Closed once committed — re-verify next session per [PRO-11] |

---

## 9. Key Learnings & Principles

- **Always re-clone fresh from `main` before any work** — prior sessions revealed dangerous divergence between session notes and actual repo state. Never trust session summaries about what's committed; verify with git.
- **Fail closed on first-contact license failure** — no local grace period, as any offline fallback reintroduces the device-clear exploit the architecture was designed to prevent. Render's cold-start latency (~30–60s) is handled by retry logic and honest waiting copy.
- **Never use `localStorage.clear()` for license cache resets** — remove only the specific Capacitor Preferences key.
- **`Out-File -Encoding ascii -NoNewline`** for all `.env` writes on Hertz's Windows machine (PowerShell's default UTF-16 silently breaks Vite's `.env` parsing).
- **Build complete but not over-built features** — scope creep is actively pushed back on.
- **Commit messages must reflect the actual diff**, not copy-pasted from a previous session's message.
- **jsPDF bundle tradeoff** is acceptable for an offline APK (not a network-fetched web app).
- **`type="text" inputMode="decimal"`**, never `type="number"`, for all Android decimal inputs; include comma-to-period normalization.
- **`env(safe-area-inset-bottom)`** for bottom nav padding.
- **No location is ever a silent default** — altitude/ambient/site fields always seed from `SiteContext`, never from a hardcoded place name or its coordinates; place names may only appear as clearly-illustrative examples in explanatory text.
- **Every `calculate()` must clear the previous result before running new validation** — `setResult(null)` immediately after `setError('')`, before any early-return check. Otherwise an invalid/incomplete input state can leave a stale result on screen (and exportable) next to a current error. `CableCalculator.jsx` had this right from the start; Protection.jsx, MotorCalculator.jsx, and ContactorOLR.jsx didn't, until found via on-device testing and fixed 2026-07-22. Apply this pattern to any new calculator module from day one. **A general HAIOS rule for this ([COD-14]) has been proposed but not yet written into the handbook — see §8.**
- **Never switch between debug and release signing on the reference device once it's licensed** — Android's `ANDROID_ID` is scoped to device + signing certificate since Android 8, so a cert change looks like a new device to the license server (fail-closed correctly rejects it, no bypass exists). Always build `assembleRelease` for anything installed on the licensed reference device; use a separate device for debug-build iteration if faster turnaround is needed.
- **The comma-decimal bug is a recurring risk class, not a one-off (found 2026-07-22).** Any input field using `type="number"` instead of the project's mandated `type="text" inputMode="decimal"` + comma-to-period normalization will silently accept a comma-decimal entry (e.g. `0,8`) without normalizing it — the field displays what looks like a valid number but the underlying value is `NaN` or truncated, and downstream calculations silently produce wrong results with no error shown. Found in 18 fields across `GeneratorSizing.jsx` (6 newly written, 12 pre-existing) via a user screenshot showing an unnormalized comma in a live field. **Whenever a new numeric input is added anywhere in the app, explicitly verify it uses the mandated pattern before shipping — this is not a one-time fix, it's a standing check.**
- **Derived reference values must be computed after their own dependency, not before (found 2026-07-22).** The zBase bug was a variable-ordering mistake: `zBase` (impedance reference base) was computed using the generator's raw input kVA in the same code block where `stdKVA` (the rounded, standard-size kVA that should have been the actual reference) was calculated one line later. Any calculation that "rounds up to a standard size" and then uses that standard size elsewhere needs the rounding step to happen *first* — a pattern worth checking for in the Cable, Protection, and Transformer sizing logic wherever a similar round-to-standard-then-reference-it structure exists.
- **PDF text must be sanitized for jsPDF's font encoding, not just numerically correct (found 2026-07-22).** Verifying a PDF export by checking that the numbers match isn't sufficient — non-Latin-1 characters (Ω, φ, Φ, →, ←) silently render as wrong glyphs even when every calculated value is correct. Any PDF verification pass should visually inspect rendered symbol characters, not just spot-check figures.
- **Doc updates and code commits can silently drift apart within the same session (found 2026-07-23).** This session's knowledge-doc edits were drafted in chat and described as "committed" in a handoff summary, but the actual `git add`/`commit` for the doc file was never run — only the code files were committed. The lesson: treat doc changes as their own commit step, verified via `git status`/`git diff` like any other file, not assumed-done because a chat response described it as done.

---

## 10. Session Protocol & Communication Style

**Bootstrap** ([PRO-9]): this document + the immediate task is sufficient context for isolated module work; re-clone from `main` before anything touching committed state.

**Handoff** ([PRO-10]): substantial sessions end with a handoff block — state, decisions taken, open questions, next actions — so a fresh session can resume without re-litigating.

**Communication style (Hertz's stated preference, unchanged):**
- Lead with a concise, direct answer, then the deeper explanation.
- Headings/bullets/tables over long paragraphs, especially for comparisons or calculation steps.
- For genuinely new topics, build up from first principles and flag common pitfalls.
- Standards-first: ground calculations explicitly in IEC/SANS/IEEE/MHSA references, and name the clause where possible.
- Flag uncertainty explicitly rather than guessing on safety-relevant figures ([AI-18]).
- For local/regulatory-dependent decisions, note where to double-check with local codes or a professional.
- Ask whether a "deep dive" or "quick checklist" is wanted when it's unclear.
- Prefers collaborative reasoning on architectural decisions before implementation — no unilateral calls on anything in the [AI-15] "hard to reverse" or "destructive" tiers.
