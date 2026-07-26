# On-Device Verification Checklist — Installation Design (§5.6.1, Load Assessment)

**Purpose:** the arithmetic below is already verified by the automated test suite (11 new tests,
342 passing repo-wide). This checklist confirms the on-device UI (new module tile, navigation,
real React rendering, real rounding, touch input) produces the same numbers the engine does in
isolation.

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
