# On-Device Verification — Overhead Reticulation (all 7 sub-tabs)

Written 2026-07-28. Expected values below are the same hand-verified figures the automated
tests assert (455/455 passing at write time) — the point of this pass is UI wiring, touch
behaviour, and PDF rendering on the reference device, not re-proving the math.

Build: standard release sequence, `assembleRelease` only (never debug on the licensed device).

## 1. Conductor Sizing (owed from 2026-07-27)
- [ ] **Hare @ 70°C / Rate A** → 376 A (Rate B shown as 496 A). Switch temp to 50°C → 280 A.
- [ ] **Rate class selector**: Hare @ 70°C / Rate B (emergency) → selected rating 496 A.
- [ ] **Rabbit** → amber "DIMENSIONAL DATA ONLY" card renders: 61.7 mm², Ø10.05 mm, no ampacity, warning text visible.
- [ ] **PDF export** (Hare @ 70°C): "Current Rating @ 70°C (Rate A / Rate B): 376 A / 496 A" row present, nothing clipped.

## 2. Pole Spacing (regression only)
- [ ] 22 kV, 150 m span, 0° → spacing renders as before (no change this session; confirm tab still loads).

## 3. Pole Planting (NEW)
- [ ] Wood → **9 m** → depth **1500 mm**, above ground **7.5 m**, tip Ø140 mm.
- [ ] Wood → **18 m** → depth **2400 mm**, above ground **15.6 m**.
- [ ] Wood → **10 m (Transformer pole)** → depth **1700 mm**, tip Ø**180** mm (vs 160 for the standard 10 m).
- [ ] Concrete → **4 m (1 kN)** → depth **800 mm**, above ground **3.2 m**.
- [ ] Switching material Wood↔Concrete resets the pole picker to a valid row (no stale selection crash).
- [ ] **PDF export** (9 m wood): depth accented, DISSCAAO1 note fully rendered (no truncation).

## 4. Clearances (owed from 2026-07-27 + HV/EHV added 2026-07-28)
- [ ] **66 kV** → returns the **72 kV band** (MV badge): ground outside 5.7 m, roads/rail 6.9 m, safety clearance 0.77 m.
- [ ] **33 kV** → 36 kV band: roads **6.5 m** (NOT 6.6 — that was the fixed error; 6.6 belongs to 48 kV).
- [ ] **132 kV** (press preset button) → **partial-scope card** (blue, not amber): safety clearance **1.45 m**, servitude width **15.5 m**, amber ground-clearance-not-verified note visible, ESKASABG3 standard citation in small text. No road/building clearance figures shown.
- [ ] **275 kV** → safety clearance **2.35 m**, servitude **22–23.5 m**.
- [ ] **400 kV** → safety clearance **3.20 m**, servitude **23.5–27.5 m**.
- [ ] **765 kV** → safety clearance **5.50 m**, servitude **40 m**.
- [ ] **220 kV** (type manually) → amber out-of-scope card showing both "132 kV (1.45 m)" and "275 kV (2.35 m)" as bracketing guidance in the message text. No fabricated clearance figure.
- [ ] **PDF export** (132 kV): "Min Safety Clearance: 1.45 m" row accented, servitude width row present, ground-clearance note rendered, ESKASABG3 citation in notes — no road/building clearance rows (those are verified absent, not just missing).
- [ ] Voltage class badge shows correctly: 66kV → **MV**, 88kV → **HV**, 132kV → **HV**, 275kV → **EHV**.

## 5. Fittings & Structures (owed from 2026-07-27)
- [ ] Hare / Dead-End → match diameter **14.16 mm**, colour warning visible.
- [ ] Guy Grip → "sized to stay strand, not phase conductor" amber path.
- [ ] Collapsible **SUPPORT STRUCTURE REFERENCE** opens/closes; 5 structure types + 4 materials listed; scope note visible.

## 6. Construction (NEW)
- [ ] All **11 sequence phases** expand/collapse individually; clause line shows under each.
- [ ] **STRINGING & CONSTRUCTION RULES** toggle: 12 rows, each with clause citation (spot-check: max initial tension 50% UTS, min span 50 m, stay assembly 96 kN).
- [ ] **Checklist**: counter starts 0/35; tick 3 items → 3/35, ticked items strike through; amber "Checklist Incomplete" box appears once ≥1 ticked and <35.
- [ ] Tick **all 35** → counter turns green 35/35, amber box disappears.
- [ ] **Checklist PDF with items UNTICKED**: export at e.g. 20/35 → status line says "INCOMPLETE — may NOT be energized", unticked items show "—" (this is the compliance-record behaviour that matters most).
- [ ] **Checklist PDF at 35/35** → status "ALL ITEMS AFFIRMATIVE — may be energized per §4.10.2"; all 6 group sections render across page breaks with "(cont.)" titles if split.

## 7. Faults & Maintenance (NEW)
- [ ] **Lightning exposure, Ng path**: Ng 7.5, H 10 m, W 2 m, L 50 km → **42.55 strikes/yr**, 85.1 /100km/yr.
- [ ] **Comma-decimal**: enter Ng as "7,5" → identical 42.55 (not 7 → 39.71).
- [ ] **Td path**: Ng blank, Td 60, H 8 m, W 1.5 m, L 12 km → Ng derived **6.68**, Ns **7.94 strikes/yr**, "derived from thunder days" note shown.
- [ ] Empty Ng AND Td → error message, no crash.
- [ ] **Fault reference**: all 9 entries expand; "Look for:" block + clause render (spot-check Power-arc entry: 0,85 probability, 500 mm wood-path gap).
- [ ] **Glossary** toggle: 11 terms; clause citations only on the 3 clause-bearing entries; general-reference note at the bottom.
- [ ] **Lightning PDF export**: inputs + both result rows + the "no default Ng" note render fully.

## App-wide
- [ ] Sub-tab bar with 7 tabs scrolls horizontally without clipping the last tab (safe-area respected).
- [ ] Kill app mid-checklist → reopening does not crash (checklist state is session-local; loss is expected, crash is not).
- [ ] History entries appear for: conductor lookup, pole planting, pre-energization export, lightning estimate.
