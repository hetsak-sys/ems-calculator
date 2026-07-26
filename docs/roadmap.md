# Hetsa PowerSuite — Roadmap
## (`/docs/roadmap.md` per HAIOS Appendix B — [LTP-2])

**Split out from `Hetsa_PowerSuite_Project_Knowledge.md` on 2026-07-25** as part of closing the 
"no split architecture.md/debt.md/ADR index" debt item (see `debt.md`). Content is unchanged from
the source doc at split time — this is an extraction, not a rewrite.

---

## 5. Domain Expansion Roadmap [LTP-2]

This is the "why" and horizon for where PowerSuite goes next. Per [LTP-3], every candidate below gets checked against the product's purpose before being checked technically — and per [LTP-4], the instinct is to deepen the existing calculation core before widening into adjacent jobs (installation testing, e.g., is a genuinely different job — a checklist/record tool, not a calculator — and gets flagged as such below).

### 5.1 The standing scoping checklist — run this before starting *any* item below

Per [ARC-1] (technology/scope decisions are architecture decisions, not casual ones) and [DEC-1] (two-question filter), every new domain area gets these three questions answered explicitly before code is written:

1. **Priority** — does this serve the mine/contractor/college institutional pitch soonest, or is it a "later" item?
2. **Depth** — full design tool (derating, shading, string configuration, sag-tension curves...) or field-quick calculator (rule-of-thumb sizing + standard reference)?
3. **New module vs. extension** — does it get its own tab, or fold into an existing module's charter ([DES-1]/[DES-2] — can the module's one-sentence charter still be written honestly if this folds in)?

§5.5 and §5.6 have now been answered against this checklist. The remaining §5.2 candidates (building/installation design and MV/LV reticulation are now scoped as of §5.6 — see below) still need this run fresh before any further candidate starts.

### 5.2 Candidate domains

| Domain | Scope | Standards | Overlap vs. new |
|---|---|---|---|
| **Building/installation design** | Household/office/workshop/warehouse load assessment, DB/distribution board sizing, circuit design, area & floodlighting (lux levels, pole spacing) | SANS 10142-1, SANS 10114-1, SANS 10098, IEC 60364 | New — interior lumen method exists (Power Quality), but load assessment and area lighting layout don't. **Scoped 2026-07-26 — see §5.6** |
| **Renewable energy design** | PV array sizing, inverter/battery sizing, hybrid off-grid/grid-tie design, generator hybridization | IEC 62548, IEC 61727, NRS 097, IEC 62109 | **Shipped** — see §4 |
| **MV/LV reticulation — overhead** | Conductor sizing, sag-tension, pole spacing, clearances, transformer placement | SANS 10280, IEC 61936-1, NRS 048 | New — distinct from single-run cable sizing already in Cable module. **Scoped 2026-07-26 — see §5.6** |
| **MV/LV reticulation — underground** | Cable sizing for direct-buried/duct runs, derating, jointing, route fault levels | IEC 60502, SANS 1339, IEC 60909 | Extension of Cable module logic. **Scoped 2026-07-26 — see §5.6** |
| **Installation testing** | IR, Ze/Zs, RCD trip time/current, polarity, continuity — SANS 10142 test schedule with pass/fail | SANS 10142-1 Annex, IEC 60364-6 | New job type — a commissioning/record tool, not a calculator; likely its own module by charter test ([DES-2]) |
| **Feeder protection, grading & coordination** | IDMT curve selection, discrimination margins, time-current grading | IEC 60255, IEEE 242, MHSA | **Substantially shipped** as Protection Coordination TCC Study — see §4 |
| **Earth fault protection (expanded)** | NER sizing (exists), earth fault relay settings, sensitive earth fault (SEF) for HR and solidly-earthed systems | IEC 60255, MHSA | **Shipped and verified on-device (2026-07-24)** — see §4/§5.5 |
| **Relay selection** | Overcurrent/earth fault/differential relay type by application, CT ratio/class matching | IEC 60255, IEC 61869 | **Shipped and verified on-device (2026-07-24)** — see §4/§5.5 |
| **11 kV generator power generation** | See §5.3 — flagged separately, deliberately not folded into the table above | — | New territory, adjacent to but distinct from existing generator sizing |

### 5.3 Power generation via 11 kV generators — called out separately

Existing Power Systems generator sizing (ISO 8528-1) targets LV gensets — typical field/standby power. **11 kV generation is medium-voltage territory** and pulls in a materially different rule set, not just a bigger number:

- **Machine standards:** IEC 60034 (rotating electrical machines) governs the generator itself, not ISO 8528-1 alone, once you're at MV.
- **Neutral earthing method** at the generator — NER placement/sizing at the generator neutral is a different problem from NER at a downstream transformer (already in Protection); resistance-earthed vs. solidly-earthed generator neutrals have different fault behaviors.
- **Generator protection:** differential protection, restricted earth fault (REF), loss-of-excitation, reverse power, over/under-frequency — a distinct protection philosophy from feeder protection. (Relay Selection's `relaySelectionEngine.js` deliberately treats this as out-of-scope — see §5.5 — rather than guessing a recommendation.)
- **Paralleling/synchronizing:** voltage/frequency/phase matching before closing onto a busbar or grid — a genuinely new calculation domain (synchroscope logic, synchronizing check relays).
- **Step-up/interconnection:** whether the generator feeds an 11 kV distribution network directly or steps up/down, and — if paralleling to the grid — NRS 048/097 embedded-generation compliance.
- **AVR/voltage regulation** behavior under load, relevant to motor-starting-comparison logic that already exists for LV.

This is a "new module vs. extension" question in its own right (§5.1): it could live as an MV-generation sub-tab inside Power Systems (closest existing charter), or as its own module if the scope grows to include paralleling/synchronizing tools, which are a different enough workflow to strain Power Systems' one-sentence charter. **Recommend scoping this as its own conversation** rather than deciding here.

### 5.4 Explicit not-doing (for now) [LTP-2]

Nothing above is being ruled out permanently — but until at least one domain has gone through §5.1's checklist and shipped, no others should be started in parallel. Sprawl into unrelated jobs before deepening any one of them is exactly the failure mode [LTP-4] warns about.

**Note (2026-07-26):** §5.6 below scopes *three* domains at once (Building/Installation Design, MV/LV Reticulation Underground, MV/LV Reticulation Overhead) rather than one. This is a deliberate, bounded exception: all three were checked together in a single scoping pass so a fresh session has a ready queue rather than one item — but §5.4's spirit still binds at the *build* level: **build and ship one at a time, in the stated order, not in parallel.** Scoping ahead of time is not the same as building ahead of time.

### 5.5 Deepening within Protection: Earth Fault Protection + Relay Selection — SHIPPED (2026-07-24)

With Protection's original eight sub-tabs verified (§7), the two nearest "deepen before widening" candidates were **Earth Fault Protection (expanded)** and **Relay Selection**, both extensions of the existing Protection charter rather than new modules. Hertz confirmed this scoping on 2026-07-23 against §5.1:

1. **Priority:** soonest — SEF settings and relay-type selection are core mine-electrical-department daily work, directly relevant to the MHSA-grounded institutional pitch.
2. **Depth:** field-quick calculator — rule-of-thumb sizing plus standard reference tables (CT ratio/class matching, relay-type-by-application), not a full protection-study/configuration package.
3. **New module vs. extension:** extension — both fold into Protection's existing charter without straining it.

**Delivered, engine-first per HAIOS approach conventions:**

- **`earthFaultProtectionEngine.js`** (committed 2026-07-23, part of the 32-test suite alongside `relaySelectionEngine.js`): two structurally distinct flows.
  - **Flow A — HR/resistance-earthed:** pickup as % of the NER-limited maximum fault current (`Vln / R`, reusing the same formula as NER Sizing/NCRT). Default range 10–20% — industry/mining practice (MINING.com NGR guidance, i-gard application notes), explicitly **not** an IEC/MHSA numeric clause, and labeled as such in the UI. Warns if pickup exceeds 100% (relay would never operate) or falls below ~1% of CT rated primary (CT summation/measurement-error risk).
  - **Flow B — solidly-earthed feeder:** pickup as an absolute secondary current (no NER to reference a percentage against) plus a time delay. Default range 5–10A secondary, ~1s delay — utility distribution practice, again explicitly not an IEC numeric clause. Warns if delay is under 1s (nuisance-trip risk) or pickup falls outside the 5–10A convention.
  - The two flows are deliberately kept as separate functions/components (see §3) so a %-based value can never be silently applied where an absolute-amps value belongs, or vice versa.

- **`relaySelectionEngine.js`** (same commit): application + earthing-method → relay function recommendation (feeder/transformer/motor/busbar, each with an HR and solid-earth variant, citing IEEE 242 Figs 196/209 for transformer REF guidance), plus CT protection accuracy class (5P/10P) sizing from required ALF (`max fault current ÷ CT rated primary`, rounded up to the standard 5/10/15/20/30 series per IEC 61869-2). Deliberately flags PX (low-impedance/balanced) class selection as **not covered** — that needs a knee-point EMF calculation this wizard doesn't perform. Generator applications return an explicit out-of-scope result (see §5.3) rather than a guessed recommendation, per [AI-10]/[AI-12].

- **UI (this session, 2026-07-24):** both engines wired into `Protection.jsx` as two new sub-tabs — **Earth Fault** (segmented control between the two flows) and **Relay Select** (application picker → earthing method → fault current/CT inputs → recommendation). Both surface the engine's warnings, compliance notes, and standards references, and export through the existing `ResultCard`/PDF path.

**Verified on-device (2026-07-24), against hand-calculated expected values:**
- HR flow: 11kV system, 30Ω NER, 15% pickup → 211.70A max fault current, 31.75A primary pickup, 0.318A secondary (÷100 CT ratio) — matches formula exactly, no spurious warnings.
- Solid-earth flow: 6A secondary × 200 CT ratio → 1200A primary — matches, no spurious warnings (6A and 1s delay both sit inside the documented conventions).
- Relay Selection: 2500A max fault / 200A CT rated primary → required ALF 12.5 → correctly rounds up to 5P15, for all four applications (Feeder, Transformer, Motor, Busbar), each returning the correct function set and note (Transformer correctly adds 87G/REF with the IEEE 242 citation; Busbar correctly stays earthing-agnostic at the differential-scheme level).
- Generator application: renders the out-of-scope message cleanly — no crash, no blank state, earthing/CT inputs correctly hidden.
- Kill-and-reopen mid-input on both tabs: resets to empty on relaunch, no crash — correct behavior, since neither tab persists draft input (only the result-card recovery banner persists across a kill).

### 5.6 Scoped, ready to build: Building/Installation Design + MV/LV Reticulation (2026-07-26)

Three §5.2 candidates run through the §5.1 checklist together in one scoping pass, so a fresh session can pick straight up on any of them without re-litigating priority/depth/module-boundary questions. **Scoping is not building** — per §5.4, these ship one at a time, in the order below, not in parallel. Nothing has been built yet; this section is the brief a new session executes against.

**Build order (per [LTP-4], deepen before widening):**
1. ~~MV/LV Reticulation — Underground (extends a shipped module, smallest lift)~~ — **shipped and on-device verified, 2026-07-26 — see §5.6.2**
2. Building/Installation Design (new module) — **in progress: Load Assessment built and on-device verified 2026-07-26, 3 sub-tabs remain**
3. MV/LV Reticulation — Overhead (new module, most open-ended depth question)

#### 5.6.1 Building/Installation Design — IN PROGRESS (Load Assessment built, 2026-07-26)

| Question | Answer |
|---|---|
| **Priority** | High — load assessment, DB sizing, and circuit design (SANS 10142) are core daily work for contractors and exactly what training colleges teach. Directly serves the contractor/college leg of the institutional pitch. |
| **Depth** | Field-quick calculator, matching the established PowerSuite pattern (rule-of-thumb sizing + standard reference tables), not a full design suite. |
| **New module vs. extension** | **New module** — "Installation Design." Built as a new dashboard tile/screen (`InstallationDesign.jsx` + `installationDesignEngine.js`), lazy-loaded per the existing per-module code-splitting pattern. |

**Sub-tabs (4 planned, 1 built so far):**
1. **Load Assessment** — **built, tested, on-device verified, and confirmed pushed to `origin/main` (2026-07-26)** — 11 new tests (342 passing repo-wide), all scenarios in `docs/on_device_checklist_installation_design.md` matched exactly (dashboard tile, warning checks, PDF export). Commit `675bd7b`, independently re-verified via fresh clone: 342 tests passing, clean build.
2. **DB Sizing** — **built, tested, on-device verified, and confirmed pushed to `origin/main` (2026-07-26)** — 9 new tests (351 passing repo-wide), all scenarios in `docs/on_device_checklist_installation_design.md` matched exactly, including the Load Assessment → DB Sizing handoff check. Commit `0fa51e6`, independently re-verified via fresh clone: 351 tests passing, clean build. Built as an itemized circuit list (like Cable's Route Fault Level segments) rather than category totals — a real DB schedule is a list of individual circuits, and the one hard numeric SANS 10142-1 rule found for this sub-tab (6.15.2.2, socket-outlet circuits ≤5kW) only makes sense checked per circuit. Consumes Load Assessment's recommended main switch via `WorkspaceContext` (`loadAssessmentSnapshot`, same pattern as Motor→Cable's `flaSnapshot`). DB way-counts and the spare-ways default percentage are labeled as commercial/common-practice reference, not IEC/SANS tables — see the sourcing note at the top of `installationDesignEngine.js`'s DB Sizing section.
3. **Circuit Design** — **built, tested, and on-device verified (2026-07-26), not yet pushed.** Reuses `cableEngine.js`'s `cableSizing()` directly rather than reimplementing it (per [ARC-1]/[DEC-2]). Built around the real IEC 60364-4-43, Clause 433.1 coordination rule (Ib ≤ In ≤ Iz, verified directly against the standard text) — the cable is deliberately sized against the chosen breaker rating (In), not the raw design current (Ib), which is conservative rather than optimistic. 6 new tests (357 passing repo-wide). On-device verification against `docs/on_device_checklist_installation_design.md`'s Circuit Design section completed 2026-07-26 — 100% match, both scenarios (single-phase and three-phase).
4. **Area Lighting** — exterior/floodlighting lux levels and pole spacing (SANS 10114-1), extending the lux-based method already used in Power Quality's interior Lighting sub-tab, but kept here rather than in PQ since outdoor photometric layout (pole spacing, mounting height) is a distinct enough job to strain PQ's charter if folded in there. Not started.

**Significant finding during Load Assessment's build (2026-07-26) — changes the original scope note above:** the original "diversity factors per SANS 10142 Annex" framing assumed a lookup-table shape, matching how Underground Reticulation was built. Verified directly against source text (both SANS 10142-1 edition 1.8 and edition 2.0 PDFs) that this doesn't exist: SANS 10142-1's own load-estimation clause (5.2.1/5.3.1) states its residential-load annex (Annex D/C, renamed between editions) "gives an example... but the method is not to be regarded as an exact method." Traced further to IEC 60364-1 (the standard SANS 10142-1 is harmonized from) — Clause 311 "Maximum demand and diversity" itself says "Guidance on the calculation of diversity is under consideration." Neither the international parent standard nor the national standard mandates a diversity table; both explicitly leave it to "a registered person or an electrical consultant." **Load Assessment was built accordingly as a tally + user-supplied-demand-factor calculator, not a table lookup** — see the sourcing note at the top of `installationDesignEngine.js` for full detail, and `docs/on_device_checklist_installation_design.md` for the verification scenario.

**Charter (one sentence, per [DES-1]/[DES-2]):** *Installation Design is responsible for building/installation-level load and circuit sizing, from connected load through to final-circuit and area-lighting design; it knows nothing of single-run cable engineering beyond calling `cableEngine.js`, and nothing of MV/LV distribution networks.*

#### 5.6.2 MV/LV Reticulation — Underground — SHIPPED, ON-DEVICE VERIFIED (2026-07-26)

| Question | Answer |
|---|---|
| **Priority** | High — mines run extensive underground MV/LV feeder networks; directly relevant to the mining leg of the institutional pitch. |
| **Depth** | Field-quick — direct-buried/duct derating factors (IEC 60364-5-52 Annex B + IEC 60502-2, SANS 1339), route fault levels. A straightforward extension of existing cable-derating logic, not new physics. |
| **New module vs. extension** | **Extension of the Cable module** — same physical job (conductor sizing/derating) as Cable's existing sub-tabs, just different installation-method derating factors. Doesn't strain Cable's charter. |

**Delivered, engine-first per HAIOS approach conventions:**
- **`directBuriedSizing()`, `ductDerating()`, `routeFaultLevel()`** added to `cableEngine.js` (16 new tests, 331 passing repo-wide). Base ampacities and correction factors (ground temperature, soil resistivity, grouping, depth-of-laying) are reproduced from IEC 60364-5-52 Annex B Tables B.52.4/B.52.15/B.52.16/B.52.18, verified against Schneider Electric's Electrical Installation Guide and cross-checked against two independent IEC 60502-2 transcriptions — not fabricated from training memory ([AI-18]).
- **UI**: three new Cable sub-tabs — **Buried**, **Duct**, **Route Fault** — wired into `CableCalculator.jsx`, following the existing tab/`ResultBox` pattern. No PDF export added (consistent with the rest of the Cable module, which has none — see `debt.md`'s Cable PDF-export entry; that remains a separate, not-yet-approved decision).
- **Deliberately out of scope, flagged rather than guessed:** Duct Derating has **no depth-of-laying correction** — IEC 60502-2's duct-depth table (B.13) could only be verified for 3 of ~9 rows, so it was left out entirely rather than filled in with an unverified guess. Duct grouping reuses the direct-buried grouping table (Table B.52.18) as a flagged approximation — see `debt.md` for both as tracked entries.

**Verified on-device (2026-07-26), against hand-calculated expected values** (`docs/on_device_checklist_underground_reticulation.md`): Direct-Buried Sizing (2 scenarios — basic case and qualitative-soil/XLPE/Al/grouped-circuits case), Duct Derating (2 scenarios — basic case and grouped-ducts case), Route Fault Level (3-segment mixed Cu/Al route, fault current confirmed strictly decreasing at each node). All matched expected values exactly; both app-wide UI checks (conditional clearance selector, resistivity-mode input swap) also passed.

**Confirmed (2026-07-26):** committed and pushed to `origin/main` as commit `dae503a` — independently re-verified via a fresh clone (331 tests passing, clean build). This item is fully closed.

#### 5.6.3 MV/LV Reticulation — Overhead

| Question | Answer |
|---|---|
| **Priority** | High for the same mining-pitch reason as underground reticulation — but see the depth caveat below, which bounds what ships first. |
| **Depth** | **Field-quick only, for v1.** Conductor ampacity tables, rule-of-thumb pole spacing, and clearance reference tables (SANS 10280, IEC 61936-1). **Full sag-tension catenary calculation (wind/ice loading, span mechanics) is explicitly deferred** — that is genuine standalone engineering depth, not a v1 scope, and would need its own separate scoping conversation if ever wanted. Do not silently expand into sag-tension physics mid-build; if it looks tempting, stop and flag it rather than scope-creeping. |
| **New module vs. extension** | **New module** — poles, spans, and clearances are genuinely new territory; no existing module's charter fits. |

**Proposed scope (sub-tabs), for confirmation before build starts:**
- **Conductor Sizing (Overhead)** — ampacity tables by conductor type/size, distinct from Cable's insulated-conductor derating logic (bare/ACSR conductors behave differently — no insulation derating factors apply).
- **Pole Spacing (rule-of-thumb)** — reference-table span guidance, not a computed sag-tension curve.
- **Clearances** — ground/crossing clearance reference tables per SANS 10280/IEC 61936-1.

**Charter (one sentence):** *MV/LV Overhead Reticulation is responsible for overhead-line conductor selection and reference-table spacing/clearance guidance; it explicitly does not perform sag-tension mechanical calculations.*

#### What a fresh session should do with this section

1. Underground Reticulation (§5.6.2) is shipped, on-device verified, and confirmed pushed (`dae503a`) — **do not rebuild it.** Still re-clone fresh per [AI-19]/[PRO-11] before touching `cableEngine.js`/`CableCalculator.jsx` again — this doc reflects state as of 2026-07-26, not a live guarantee.
2. Confirm with Hertz that Building/Installation Design (§5.6.1) is next, per the build order above.
3. Re-run [SYS-2] impact analysis for that item specifically before writing code (which existing engines/files does it touch, e.g. `cableEngine.js` for Circuit Design's reuse).
4. Engine-first: extracted calculation engine + tests, then UI, per the established PowerSuite pattern (§3 of the knowledge doc).
5. Do not start MV/LV Reticulation — Overhead (§5.6.3) until Building/Installation Design is shipped and on-device verified, per §5.4.
