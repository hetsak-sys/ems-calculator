# On-Device Verification Checklist — Underground Reticulation (§5.6.2)

**Purpose:** every value below is already verified by the automated test suite (16 new tests,
331 passing repo-wide) against a hand calculation. This checklist is NOT re-deriving anything —
it's confirming the on-device UI (real React rendering, real rounding/formatting, real touch
input, the new soil/depth/grouping selectors) produces the same number the engine does in
isolation. If a number doesn't match, the bug is in the UI wiring layer, not the formula.

**How to use:** type the inputs into each new Cable sub-tab, tap Calculate, compare against
"Expect." Takes about 5–10 minutes for all three.

---

## Direct-Buried Sizing (Cable → Buried)

**Scenario 1 — basic case**
Current: `40` A, Length: `50` m, Voltage: `400` V, Insulation: PVC, Conductor: Cu,
Ground Temp: `30°C`, Resistivity: Known K·m/W → `1.5`, Depth: `1 m`,
Parallel Circuits: None (single circuit), Max VD: `3`%
- [ ] Expect: Overall derating ≈ **×1.116**, Required ≈ **35.8 A**, Recommended = **6 mm²**
      (derated ≈ 45.8 A, VD ≈ 2.67%)

**Scenario 2 — qualitative soil, XLPE/Al, grouped circuits**
Current: `63` A, Length: `25` m, Voltage: `400` V, Insulation: XLPE, Conductor: Al,
Ground Temp: `25°C`, Resistivity: Describe soil → `Damp`, Depth: `0.6 m`,
Parallel Circuits: `3 circuits`, Clearance: `0.25 m`, Max VD: `4`%
- [ ] Expect: Overall derating ≈ **×0.831**, Required ≈ **75.9 A**, Recommended = **25 mm²**
      (derated ≈ 65.9 A, VD ≈ 3.27 V / 0.82%)
- [ ] Confirm the Clearance selector only appears once "3 circuits" is picked (it should be
      hidden entirely when Parallel Circuits = "None")

**App-wide checks**
- [ ] 1.5mm² does not appear as an option when Conductor = Aluminium (no Al data at that size)
- [ ] Switching Resistivity between "Known K·m/W" and "Describe soil" clears/swaps the visible
      input cleanly, no stale value bleeding from one mode into the other

---

## Duct Derating (Cable → Duct)

**Scenario 1 — basic case**
Current: `40` A, Length: `50` m, Voltage: `400` V, Insulation: PVC, Conductor: Cu,
Ground Temp: `30°C`, Resistivity: Known K·m/W → `1.5`, Circuits: None, Max VD: `3`%
- [ ] Expect: Overall derating ≈ **×0.979**, Required ≈ **40.9 A**, Recommended = **10 mm²**
      (derated ≈ 49.0 A)
- [ ] Confirm this recommends a *bigger* size than Direct-Buried Scenario 1 above at a similar
      current — the D1 (duct) base ampacity table is lower than D2 (direct-buried), so this is
      expected, not a bug

**Scenario 2 — grouped ducts**
Current: `80` A, Length: `40` m, Voltage: `400` V, Insulation: PVC, Conductor: Cu,
Ground Temp: `25°C`, Resistivity: Known K·m/W → `2`, Circuits: `4 circuits`, Clearance: Touching,
Max VD: `3`%
- [ ] Expect: Overall derating ≈ **×0.599**, Required ≈ **133.7 A**, Recommended = **70 mm²**
      (derated ≈ 85.6 A, VD ≈ 1.49 V / 0.37%)
- [ ] Confirm there is **no** Depth-of-Laying selector on this tab at all (intentionally out of
      scope — see the amber info box at the top of the tab for why)

---

## Route Fault Level (Cable → Route Fault)

**Scenario — 3-segment route**
Source: `1600` kVA, Voltage: `400` V
- Segment 1: `150` mm², `40` m, Cu
- Segment 2: `95` mm², `60` m, Cu
- Segment 3: `50` mm², `80` m, Al

- [ ] Expect (Source): Zt ≈ **100.00 mΩ**, 3φ ≈ **2.309 kA**, 1φ ≈ **2.000 kA**
- [ ] Expect (After segment 1): Zt ≈ **111.81 mΩ**, 3φ ≈ **2.066 kA**, 1φ ≈ **1.789 kA**
- [ ] Expect (After segment 2): Zt ≈ **136.75 mΩ**, 3φ ≈ **1.689 kA**, 1φ ≈ **1.463 kA**
- [ ] Expect (After segment 3): Zt ≈ **238.66 mΩ**, 3φ ≈ **0.968 kA**, 1φ ≈ **0.838 kA**
- [ ] Confirm fault current strictly **decreases** at each successive point down the route (a
      route where it doesn't is a sign something's wired backwards)
- [ ] Add a 4th segment, then remove it — confirm the table recalculates correctly and the
      removed segment doesn't leave a stale row in the result

---

## If something doesn't match

Note which tab/field, the exact inputs you used, and what the app showed vs. what's listed
here — that's a real regression from the UI wiring, not the formula (which the automated suite
already covers), and needs fixing before this is trusted on the licensed reference device.
