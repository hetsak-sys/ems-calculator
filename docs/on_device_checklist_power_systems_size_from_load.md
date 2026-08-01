# On-Device Verification Checklist — Power Systems → Transformer → Size from Load (§5.7)

**Purpose:** the arithmetic below is already verified by `powerSysEngine.test.js`'s
`transformerSizingFromLoad` suite (7 tests) — but only in an isolated local harness, not the real
repo (see `debt.md`'s §5.7 entry). This checklist confirms both the on-device UI (real React
rendering, real rounding, touch input) AND that the real repo's test suite passes with these
files applied.

**Before starting device checks:** run `npm test` after applying all four files
(`generatorSizingEngine.js`, `powerSysEngine.js`, `powerSysEngine_test.js`, `PowerSysCalculator.jsx`).
Confirm the suite passes and note the new total — expect the prior total + 7 assuming nothing else
has drifted. Record the actual number here once run: _____ / _____ passing.

---

## Standalone entry (no Load Assessment run first)

Navigate to Power Systems → Transformer. The "SIZE FROM LOAD" section should appear at the top,
above the existing parameters calculator — confirm no green "Loaded from Load Assessment" banner
appears yet (nothing has been calculated in Load Assessment this session).

**Scenario 1 — hand-calculated, no margin**
Demand kVA: `16.67`, Growth Margin: (leave blank)

- [ ] Expect: Demand kVA = **16.67 kVA**
- [ ] Expect: With Margin = **16.67 kVA** (blank margin defaults to 0%, not a positive assumption)
- [ ] Expect: Recommended Transformer Size = **25 kVA**
- [ ] Tap "Use 25 kVA below ↓" — confirm the Transformer Rating field in the parameters section
      below updates to `25`, and the parameters calculator's own result (if previously calculated)
      clears rather than showing a stale result for the old rating

**Scenario 2 — hand-calculated, with margin**
Demand kVA: `280`, Growth Margin: `20`

- [ ] Expect: With Margin = **336.00 kVA**
- [ ] Expect: Recommended Transformer Size = **400 kVA**

**Error path**
- [ ] Clear Demand kVA entirely, tap Calculate — confirm no crash and no stale result from
      Scenario 2 remains visible ([COD-14] check)

**Comma-decimal check**
- [ ] Re-enter Scenario 1 as `16,67` (comma) — confirm identical result to the period-decimal entry

---

## Handoff from Load Assessment

- [ ] In Installation Design → Load Assessment, run the existing on-device scenario from
      `docs/on_device_checklist_installation_design.md` (three-phase, 400V, PF 0.9, Lighting
      5kW/80%, Sockets 10kW/50%, Water Heating 6kW/100% → demand kVA ≈ 16.67)
- [ ] Switch to Power Systems → Transformer — confirm the green banner appears:
      **"Loaded from Load Assessment: 16.67 kVA demand"**
- [ ] Confirm the Demand kVA field is prefilled with `16.67` (not requiring re-entry)
- [ ] Calculate with no margin — confirm Recommended Transformer Size = **25 kVA** (matches
      Scenario 1 above, confirming the snapshot handoff produces the same result as manual entry)

## App-wide check

- [ ] Kill and reopen the app while on the Transformer tab mid-input on the Size from Load
      section — confirm no crash (this section doesn't persist draft input, matching every other
      calculator; only the parameters section's own pending-result recovery banner is unrelated
      and untouched by this change)

## Verification record

| Section | Verified by | Date | Result |
|---|---|---|---|
| `npm test` real-repo run | | | |
| Standalone Scenario 1 (16.67kVA, no margin → 25kVA) | | | |
| Standalone Scenario 2 (280kVA + 20% → 400kVA) | | | |
| Error path / stale-result check | | | |
| Comma-decimal check | | | |
| Load Assessment handoff banner + prefill | | | |
| App-wide kill/reopen check | | | |
