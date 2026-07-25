# On-Device Verification Checklist — Session 2026-07-25 Refactor

**Purpose:** every value below is already verified by the automated test suite against a hand
calculation. This checklist is NOT re-deriving anything — it's confirming the on-device UI (real
React rendering, real rounding/formatting, real touch input) produces the same number the engine
does in isolation. If a number doesn't match, the bug is in the UI wiring layer, not the formula.

**How to use:** type the inputs into each tab, tap Calculate, compare against "Expect." A ✓ box to
tick as you go. Takes about 15–20 minutes for all of it.

---

## Motor (6 sub-tabs)

**FLA** — Phase: 3ph, Input: kW, kW: `15`, Voltage: `400`, PF: `0.85`, Eff: `90`
- [ ] Expect: FLA ≈ **28.30 A**, kVA ≈ **19.61**, CT Ratio = **40**

**NewElec 327M** — FLA: `80`, CT Primary: `100`, Max Starts: `4`, Start Time: `10`
- [ ] Expect: Load Ratio = **80.0%**, Max Load Setting = **88.0%**, Dial = **10**, Mult = **×1**

**EPC MS1** — Voltage: `400`, Earth Res: `10`, Cable Length: `500`, Sensitivity: `250`
- [ ] Expect: Vln ≈ **230.9 V**, Min Fault ≈ **23094 A**, recommended setting = **300 mA**

**Breaker** — FLA: `80`, Start Factor: `6` (DOL)
- [ ] Expect: Trip Rating = **100 A** (sits exactly on a standard frame)

**Reacceleration / V-Dip** — Motor: `75` kW, Voltage: `400`, Xfmr: `500` kVA, PF: `0.85`, Eff: `90`
- [ ] Expect: Voltage Dip ≈ **6.47%**, Will Start = **Yes**

**IE Comparison** — kW: `15`, Hours/yr: `4000`, Tariff: `2.50`
- [ ] Expect: IE1 saving = **0** (baseline), IE3 saving > IE1, monotonic increase toward IE4

---

## Earthing (4 sub-tabs)

**Electrode Resistance** — ρ: `100`, Length: `2.4`, Diameter: `0.016`, Rods: `1`
- [ ] Expect: R ≈ **35.79 Ω**

**Touch/Step Voltage** — ρs: `3000`, hs: `0.15`, Clearing Time: `0.5`
- [ ] Expect: Touch ≈ **737.6 V**, Step ≈ **2458.2 V** (step always > touch)

**Conductor Sizing** — Fault Current: `10000` A, Time: `1` s, Material: Copper (PVC)
- [ ] Expect: S ≈ **69.93 mm²**, rounds up to **70 mm²**

**Fault Loop Impedance** — Vs: `400`, Zs: `0.8`, Rc: `0.5`, Re: `0.3`, Device: `100` A
- [ ] Expect: Zloop = **1.6 Ω**, If (L-E) ≈ **166.7 A**

---

## Cable (8 sub-tabs)

**Cable Sizing** — 3ph, `50` A, `50` m, `400` V, PVC, Cu, 30°C, 1 group, Clipped Direct, maxVd `3`
- [ ] Expect: recommended size = **10 mm²**

**Voltage Drop (detailed)** — 3ph, `50` A, PF `0.85`, `50` m, `400` V, `16` mm², Cu
- [ ] Expect: IEC detailed VD ≈ **4.44 V** (≈1.11%), lower than simple-method VD (≈4.98 V)

**Short Circuit** — `500` kVA, `400` V, `16` mm² cable, `50` m, Cu
- [ ] Expect: 3ph fault ≈ **530 A**

**Trailing Cable** — `100` A, `100` m, `525` V, maxVd `5`
- [ ] Expect: recommended = **25 mm²**

**Conduit Fill** — Conduit ID `25` mm, Cable `2.5` mm², Count `5`
- [ ] Expect: Fill ≈ **53.8%**, exceeds 33% limit (fail)

**Gland Selection** — By conductor: `16` mm², 3-core, Unarmoured, PVC
- [ ] Expect: Gland size **2**, OD ≈ **16.5 mm**

**Cable Schedule** — Auto-size a row: `50` A, 3ph, Cu, PVC
- [ ] Expect: auto-sizes to **10 mm²**

**VFD Cable** — `50` A, `30` m, `400` V
- [ ] Expect: recommended = **16 mm²**, Length OK = **Yes**

---

## Power Systems (4 sub-tabs)

**Transformer** — `1000` kVA, `11000` V pri, `400` V sec, `6`% Z, PF `0.85`, Eff `98`
- [ ] Expect: Ratio = **27.5**, 3ph fault ≈ **24.06 kA**

**PF Correction** — `500` kW, PF `0.75` → `0.95`, `400` V
- [ ] Expect: Qc ≈ **276.6 kVAr**, recommended bank = **300 kVAr**

**Busbar Rating** — Copper, `50`×`5` mm, `2` bars/phase, `30`°C
- [ ] Expect: Total current ≈ **1044 A**

**Motor Starting Comparison** — `75` kW, `400` V, Eff `92`, PF `0.88`, method DOL
- [ ] Expect: Starting current ≈ **869 A** (6.5× FLC); switch to VFD and confirm it's noticeably lower

---

## ContactorOLR

`15` kW, `400` V, PF `0.85`, Eff `90`, 3ph, IE Class IE3
- [ ] Expect: FLA ≈ **28.30 A**, recommended contactor = **32 A** frame, OLR setting ≈ **29.72 A**

---

## Generator Sizing

**Known Load Sizing** — `200` kW, PF `0.8`, Eff `90`, Altitude `1600` m, Temp `35`°C, Largest Motor `37` kW, DOL
- [ ] Expect: recommended generator = **350 kVA**

**Load Schedule chain** — add two loads: (1) `50` kW Motor, PF `0.85`, DF `100`, DOL start; (2) `20` kW Resistive, PF `0.9`, DF `80`
- [ ] Expect on Gen stage (1600m/35°C, 25% margin, PF 0.8): recommended = **500 kVA**
- [ ] Expect on Transformer stage (11000/400V, 5% Z): std size = **500 kVA**, Z ≈ **0.016 Ω**
- [ ] Expect on Fault Level stage (15% Xd): 3ph fault ≈ **3.61 kA**, ≈ **2.5 MVA**

---

## Power Quality (3 sub-tabs)

**Harmonics/THD** — I1 `100`, I3 `5`, I5 `20`, I7 `14`, I11 `9`, I13 `7`
- [ ] Expect: THD ≈ **27.4%** (fails 8% IEC limit), K-Factor ≈ **4.46**

**Battery/UPS** — `10` kW, PF `0.9`, Runtime `30` min, `48` Vdc, DoD `80`, Eff `85`
- [ ] Expect: UPS rating ≈ **11.1 kVA**, Battery bank ≈ **153 Ah**

**Lighting** — Area `100` m², Lux `300`, CU `0.65`, MF `0.80`, Fitting `4000` lm / `36` W
- [ ] Expect: **15** fittings, actual illuminance ≈ **312 lux**

---

## App-wide behavior check

- [ ] Open Motor, Protection, and Renewable Energy tabs in sequence — confirm a brief "Loading…"
      flash appears (not a blank screen or crash) before each renders. This confirms the
      lazy-loading change from earlier this session works correctly on-device.
- [ ] Kill and reopen the app mid-calculation on any one tab — confirm no crash, and that the
      pending-result recovery banner behaves as before (unrelated to this session's changes, but
      worth a spot-check since load timing changed).

---

## If something doesn't match

Note which module/field, the exact inputs you used, and what the app showed vs. what's listed
here. That's a real regression from the extraction and needs to be fixed before this is trusted —
send it over and it'll get top priority.
