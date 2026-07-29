# On-Device Verification — Protection: Arc Flash, PI/DAR, TCC Plot

Written 2026-07-29. These three items are the longest-deferred safety-critical
verification debt in the register (flagged across multiple sessions). Arc Flash
and PI/DAR are marked **safety-critical**: they must be verified on-device before
any version is marketed for safety-decision use.

Expected values below were **independently hand-derived** from the published
IEEE 1584-2002 simplified LV equations and the IEEE 43 ratio definitions in a
standalone script — NOT by running the app code — then cross-checked against the
formulas as implemented. The point of this pass is UI wiring, rounding as
displayed, badge/warning styling, and PDF rendering on the reference device.

Build: standard release sequence, `assembleRelease` only.
Navigation: Protection module → sub-tab bar (scroll right for PI/DAR, Arc Flash,
Coord. Study).

## 1. Arc Flash (sub-tab "Arc Flash") — SAFETY-CRITICAL

The tab header must show the orange "⚠ Arc Flash — Estimate Only" disclaimer
box before anything else — confirm it renders and is readable.

- [ ] **Scenario A (baseline)**: Bolted fault **25 kA**, gap **25 mm**, **Grounded**,
      **Switchgear/Box**, working distance **610 mm**, duration **0.2 s** →
      Estimated Arcing Current **23.89 kA**, Incident Energy **10.60 cal/cm²**,
      PPE **Category 3**.
- [ ] **Scenario B (time scaling)**: same as A but duration **0.5 s** →
      **26.51 cal/cm²**, **Category 4**. (Energy must scale exactly linearly
      with time: 10.60 × 2.5.)
- [ ] **Scenario C (open air, ungrounded)**: **12 kA**, gap **32 mm**,
      **Ungrounded/HRG**, **Open Air**, distance **455 mm**, duration **0.3 s** →
      Arcing Current **11.61 kA**, **8.59 cal/cm²**, **Category 3**.
- [ ] **Scenario D (distance sensitivity)**: same as A but distance **910 mm** →
      **5.88 cal/cm²**, **Category 2**. (Farther = less energy; sanity direction.)
- [ ] **Comma-decimal**: Scenario A with duration entered as "**0,2**" → identical
      10.60 cal/cm² (not a silent 0 → error, not a different number).
- [ ] **Error path**: leave bolted fault current blank → "Enter bolted fault
      current, working distance, and arc duration" error, no crash, no stale
      result left visible from a previous calculation ([COD-14] check).
- [ ] **PDF export (Scenario A)**: all six inputs listed, all three result rows
      render, and the ESTIMATE ONLY note ("...not a substitute for a full
      arc-flash study...IEEE 1584-2018 or NFPA 70E") renders **in full, not
      truncated** — this disclaimer is the single most important line on the
      export for a safety-critical tab.

## 2. Insulation Resistance — PI & DAR (sub-tab "PI/DAR") — SAFETY-CRITICAL

- [ ] **Baseline**: R(30s) **800 MΩ**, R(1min) **1000 MΩ**, R(10min) **4000 MΩ** →
      DAR **1.25 — Fair/Good** (exact boundary: 1.25 must read Fair/Good, NOT
      Poor), PI **4.00 — Good** (exact boundary: 4.00 must read Good, NOT the
      brittleness warning).
- [ ] **DAR upper boundary**: R(30s) **1000**, R(1min) **1600**, R(10min) blank →
      DAR **1.60 — Good** (1.60 is not < 1.6, so it must NOT read Fair/Good),
      and **no PI row at all** (10-min reading omitted).
- [ ] **PI dangerous path**: R(30s) **900**, R(1min) **1000**, R(10min) **900** →
      PI **0.90 — Dangerous — investigate before energising**, rendered with
      the warning styling (this is the run/no-run-relevant path).
- [ ] **PI brittleness path**: R(10min) **4500** with R(1min) 1000 → PI **4.50 —
      Check for over-dried/brittle insulation**.
- [ ] **Error path**: only R(30s) entered → "Enter at least the 30s and 1 minute
      readings", no crash, no stale result ([COD-14]).
- [ ] **IEEE 43 guidance box** renders under the results with all three bullet
      lines, including "check acceptance criteria for the specific machine's
      insulation class".
- [ ] **PDF export (baseline scenario)**: DAR and PI rows both present with their
      ratings; the "General IEEE 43 guidance bands..." note renders in full.

## 3. TCC Plot (sub-tab "Coord. Study") — visual, never screenshotted

Use the chain that the automated tests already assert numerically, so the plot
can be checked against known operating points:

- [ ] Build a two-relay chain: **Downstream** relay, SI curve, pickup **50 A**,
      TMS **0.1**; **Upstream** relay, EI curve, pickup **200 A**, TMS **0.3**.
      Fault current **2000 A**.
- [ ] Expected operating times: downstream **≈0.183 s**, upstream **≈0.242 s**
      (margin ≈0.060 s — expect the margin check to flag this as TIGHT if a
      0.2–0.3 s grading margin rule is applied; that flag appearing is a pass,
      not a failure).
- [ ] **TCC plot renders**: two curves on log-log axes, downstream curve below/
      left of upstream at 2000 A, fault-current marker visible, no clipped axis
      labels at the reference device's screen width.
- [ ] **Screenshot the plot** and file it with the verification record — this
      closes the "TCC plot visual never screenshotted on-device" debt entry.
- [ ] Rotate/scroll: plot does not overflow the safe area; sub-tab bar still
      reachable.

## 4. Reference (single-relay IDMT, quick regression only)

- [ ] Sub-tab "IDMT": SI curve, pickup **100 A**, fault **800 A**, TMS **0.1** →
      PSM **8×**, operating time **0.330 s** (the exact tested engine example).

## Verification record

| Section | Verified by | Date | Result |
|---|---|---|---|
| 1. Arc Flash | | | |
| 2. PI/DAR | | | |
| 3. TCC Plot (+ screenshot filed) | | | |
| 4. IDMT regression | | | |
