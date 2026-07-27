# On-Device Verification Checklist — Installation Design (§5.6.1, all four sub-tabs)

**Purpose:** the arithmetic below is already verified by the automated test suite. This checklist
confirms the on-device UI (new module tile, navigation, real React rendering, real rounding, touch
input) produces the same numbers the engine does in isolation. Test counts below are as-of each
sub-tab's own build session, not a running total — see `debt.md`/`architecture.md` for the current
repo-wide total.

**Status: §5.6.1 fully closed as of Area Lighting (2026-07-27), commit `210ed02` — on-device verification confirmed by Hertz (2026-07-27).**

**Note on this sub-tab's nature:** unlike other PowerSuite calculators, Load Assessment has no
single "correct" answer to check against a standard — see the in-app info box and
`installationDesignEngine.js`'s sourcing note for why (neither IEC 60364-1 nor SANS 10142-1
publish a mandatory diversity table). What's being verified here is that the app faithfully
computes what you tell it to, not that a particular demand factor is "right."

---

## Dashboard

- [ ] A new tile, **"Installation Design"** (blue/sky accent, 🏗 icon), appears on the dashboard
      alongside the existing modules
- [ ] Tapping it navigates in and the header shows "Installation Design" as the screen title

## Load Assessment

**Scenario — hand-calculated**
Phase: Three-phase, Voltage: `400` V, Assumed PF: `0.9`
- Lighting: Connected `5` kW, Demand Factor `80` %
- Socket Outlets: Connected `10` kW, Demand Factor `50` %
- Water Heating: Connected `6` kW, Demand Factor `100` %
- (leave Cooking / Space Heating-Cooling / Motors / Other blank)

- [ ] Expect: Total Connected Load = **21.00 kW**
- [ ] Expect: Total Maximum Demand = **15.00 kW**
- [ ] Expect: Demand (kVA) ≈ **16.67 kVA**
- [ ] Expect: Estimated Demand Current ≈ **24.1 A**
- [ ] Expect: Diversity Achieved ≈ **28.6 %**
- [ ] Expect: Recommended Main Switch/Breaker = **25 A**

**Warning check**
- [ ] Set Motors' Demand Factor to `120` and re-calculate — confirm an amber warning appears
      ("demand factor above 100%...")
- [ ] Clear a row's Demand Factor field entirely (leave blank) while its Connected Load is filled
      in — confirm a warning appears ("zero or blank") and that row contributes nothing to the
      total

**PDF export**
- [ ] Tap Export PDF after a successful calculation — confirm the load tally (each category's
      connected/DF/demand) and the results section both appear correctly in the exported card,
      with no glyph corruption (this app renders φ/Ω-style symbols elsewhere; confirm the ×/%
      characters in the tally lines render cleanly)

## App-wide check

- [ ] Kill and reopen the app while on the Installation Design screen mid-input — confirm no
      crash (this module doesn't persist draft input, matching every other calculator; the
      pending-result recovery banner is unrelated and untouched by this change)

---

## DB Sizing

**Handoff check**
- [ ] Run the Load Assessment scenario above first, then switch to the DB Sizing sub-tab —
      confirm the green "Main switch loaded from Load Assessment" banner appears showing **25 A**
      (matching Load Assessment's recommended main from the scenario above)

**Scenario — hand-calculated**
Spare Ways Allowance: `20` %, Main Switch: leave as prefilled (or enter `63` manually to test override)
- Circuit 1: Type Lighting, Connected `2` kW
- Circuit 2: Type Socket Outlets, Connected `3` kW
- Circuit 3: Type Socket Outlets, Connected `6` kW, Label "Kitchen sockets"

- [ ] Expect: Circuit Count = **3**
- [ ] Expect: Spare Ways = **1**
- [ ] Expect: Required Ways = **4**
- [ ] Expect: Recommended DB Size = **4-way**
- [ ] Expect an amber warning naming "Kitchen sockets" and citing the 5 kW SANS 10142-1 6.15.2.2
      limit (Circuit 3 is 6 kW, over the limit)
- [ ] If Main Switch was entered as `63`: Expect Recommended Main Switch = **63 A**

**App-wide checks**
- [ ] Remove Circuit 3, confirm the warning disappears and Circuit Count drops to 2
- [ ] Add a 4th circuit, confirm it appears with default values (Lighting, blank load) and the
      circuit numbering updates correctly
- [ ] Export PDF — confirm the circuit list (with labels where given) and results both render
      cleanly, and the over-limit row shows its warning in the exported card too

---

## If something doesn't match

Note the exact inputs and what the app showed vs. what's listed here — since the underlying
arithmetic is simple and already covered by 9 automated tests for `dbSizing()`, a mismatch here
almost certainly means a UI wiring bug, not a formula error.

---

## Circuit Design

**Scenario 1 — single-phase, hand-calculated**
Phase: Single-phase, Connected Load: `3` kW, Voltage: `230` V, Power Factor: `1`,
Circuit Length: `15` m, Max VD: `5`%, Insulation: PVC, Conductor: Cu,
Ambient: `30°C`, Grouped Circuits: `1`, Installation Method: Conduit in wall

- [ ] Expect: Design Current (Ib) ≈ **13.04 A**
- [ ] Expect: Recommended Breaker (In) = **16 A**
- [ ] Expect: Recommended Cable = **2.5 mm²**

**Scenario 2 — three-phase, hand-calculated**
Phase: Three-phase, Connected Load: `15` kW, Voltage: `400` V, Power Factor: `0.85`,
Circuit Length: `40` m, Max VD: `3`%, Insulation: PVC, Conductor: Cu,
Ambient: `30°C`, Grouped Circuits: `1`, Installation Method: Clipped direct

- [ ] Expect: Design Current (Ib) ≈ **25.47 A**
- [ ] Expect: Recommended Breaker (In) = **32 A**
- [ ] Expect: Recommended Cable = **6 mm²**

**App-wide checks**
- [ ] Set Max VD to an unreasonably tight value (e.g. `0.01`%) with a long length — confirm a
      clear error appears rather than a blank or crashing result
- [ ] Export PDF on Scenario 1 — confirm Ib, In, recommended cable, Iz, and voltage drop all
      appear correctly, with the note about sizing against In (not Ib) present
- [ ] Confirm the Ambient/Grouped Circuits/Installation Method dropdowns show the same options
      and multiplier hints as the Cable module's own Sizing tab (they're pulling from the same
      `cableEngine.js` tables — a mismatch here would mean the import is stale)

---

## If something doesn't match (Circuit Design)

Since Circuit Design calls `cableEngine.js`'s own `cableSizing()` directly rather than
reimplementing it, a wrong cable recommendation here would most likely also show up on the
Cable module's Sizing tab with the same inputs — worth checking both if something looks off.

---

## Area Lighting

**Verified 2026-07-27** against commit `210ed02` (feat: Installation Design - Area Lighting
sub-tab complete with cross-validated lux guide (§5.6.1 closed); same commit also fixed
comma-decimal parsing in `pqEngine.js` and extracted the shared lumen-method core to
`src/lib/lumenMethod.js` — see `debt.md` for both). Engine-side: 43/43 tests passing in
`installationDesignEngine.test.js` (includes the `AREA_LIGHTING_GUIDE`/`findAreaLightingGuideEntry`
suite).

**Note on this sub-tab's nature:** like Load Assessment, there's no SANS 10389-1 lux-guide table
built in — the standard's actual exterior-lighting content wasn't accessible to this project, so
the app takes user-entered illuminance directly, or (optionally) a reference category whose
illuminance/uniformity/glare figures come from cross-checked secondary sources (an ISO/CIE
8995-3:2018 preview + an industry lighting guide attributing SANS 10389-1), explicitly labeled as
such — not a direct standard citation. Fitting-count math reuses the same generic lumen-method
formula as Power Quality's interior Lighting tab (now factored out to `src/lib/lumenMethod.js`,
shared rather than duplicated). Mounting height/pole spacing are generic industry rules of thumb
(height ≈ half the area's width; spacing ≈ 4× mounting height), explicitly not SANS-specific.

**Scenario — hand-calculated, matches actual device output**
Reference Category: Water & Sewage Plants — Medium risk (or "None, enter your own lux" with the
same numeric values below — both paths should agree)
- Area Width (distance across): `40` m
- Area Length: `80` m
- Required Illuminance: `20` lux
- Coefficient of Utilization (CU): `0.4`
- Maintenance Factor (MF): `0.8`
- Fitting Output: `20000` lm / `200` W

- [ ] Expect: Fittings Required = **10.0 → 10**
- [ ] Expect: Actual Illuminance = **20 lux**
- [ ] Expect: Mounting Height = **20.0 m** (= half of Area Width)
- [ ] Expect: Pole Spacing = **80.0 m** (= 4 × Mounting Height)
- [ ] Expect: Total Load = **2000 W**
- [ ] Expect: Power Density ≈ **0.63 W/m²**
- [ ] Expect (if a reference category was selected): Reference Uniformity (min/avg) = **0.4**,
      Reference Max Glare Rating = **50**

**Guide-table / manual-entry toggle**
- [ ] Selecting "— None, enter your own lux —" leaves Required Illuminance, CU, and MF as
      plain editable fields with no reference values shown
- [ ] Selecting a reference category (e.g. Water & Sewage Plants — Medium risk) auto-fills
      Required Illuminance and surfaces the category's Reference Uniformity/Glare figures in the
      result, without needing CU/MF to be looked up manually
- [ ] Switching back to "None" after selecting a category doesn't leave stale reference figures
      showing in the result

**PDF export**
- [ ] Export PDF — confirm the sourcing note text (SANS 10389-1 not directly accessible,
      cross-validated secondary sources, "not a substitute for professional sign-off") renders in
      full, with no glyph corruption on any special characters
- [ ] Confirm the exported card shows the same Reference Category/Uniformity/Glare figures as the
      on-screen result when a guide category was selected

---

## If something doesn't match (Area Lighting)

Since `areaLighting()`'s fitting-count math now calls the same shared `lumenMethod.js` used by
Power Quality's interior Lighting tab, a wrong fitting count here would likely also show up there
with equivalent inputs — worth checking both. A wrong mounting height/pole spacing, by contrast, is
isolated to `areaLighting()` itself (simple width-based ratios, no shared dependency).
