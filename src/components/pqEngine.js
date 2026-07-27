// pqEngine.js — pure calculation functions extracted from PQCalculator.jsx
// (2026-07-25, per debt.md's "no automated test suite for most modules" item —
// this closes out the last of the modules originally flagged as untested).
// Formulas copied exactly from the original inline calc() handlers — no
// numeric changes at that time.
//
// Updated 2026-07-26: two changes, both explicitly flagged, not bundled
// silently (per [REF-3]):
//   1. lightingLumenMethod() extracted to src/lib/lumenMethod.js — needed by
//      both this module's interior Lighting tab and Installation Design's
//      new Area Lighting tab. Re-exported here unchanged so
//      PQCalculator.jsx needs zero changes ([COR-9] compatibility).
//   2. Comma-decimal parsing bug fixed in harmonicsAnalysis/upsBatterySizing
//      — both previously used plain parseFloat() with no comma tolerance,
//      the same "recurring risk class" already documented in debt.md/§9
//      (found originally in GeneratorSizing.jsx, 2026-07-25; found here
//      2026-07-26 while extracting the Lighting function for reuse). The
//      isNaN-based null-on-missing-input guard is preserved exactly — see
//      the pf() comment below — so every previously-passing test is
//      unaffected; only comma-decimal input behavior changes (from silent
//      truncation to correct parsing).

import { batteryBankSizingFromEnergy } from '../lib/batterySizing.js'
import { lightingLumenMethod } from '../lib/lumenMethod.js'

/** Comma-tolerant numeric parse. Deliberately does NOT fall back to 0 on
 *  invalid input — this module's functions guard on isNaN (not falsy),
 *  because legitimate inputs here can be 0 (e.g. a harmonic amplitude of
 *  0 in "pure fundamental" cases). Falling back to 0 would make a missing
 *  field indistinguishable from a valid zero and silently defeat the
 *  guard — see lumenMethod.js's identical pf() for the same reasoning. */
function pf(v) { return parseFloat(String(v).replace(',', '.')) }

// ── 1. Harmonics / THD / K-Factor ─────────────────────────────────────────
/**
 * @param {Object} p - harmonic current magnitudes, A
 * @param {string|number} p.I1 - fundamental
 * @param {string|number} p.I3
 * @param {string|number} p.I5
 * @param {string|number} p.I7
 * @param {string|number} p.I11
 * @param {string|number} p.I13
 * @returns {null|{THD:number, Irms:number, K:number, derate:number, passIEC:boolean}}
 *          null if any input is missing/non-numeric (matches original guard)
 */
export function harmonicsAnalysis({ I1, I3, I5, I7, I11, I13 }) {
  const i1 = pf(I1), i3 = pf(I3)
  const i5 = pf(I5), i7 = pf(I7)
  const i11 = pf(I11), i13 = pf(I13)
  if ([i1, i3, i5, i7, i11, i13].some(isNaN)) return null

  // THD = √(I3²+I5²+I7²+...) / I1 × 100
  const harmonicSum = Math.sqrt(i3 ** 2 + i5 ** 2 + i7 ** 2 + i11 ** 2 + i13 ** 2)
  const THD = (harmonicSum / i1) * 100
  const Irms = Math.sqrt(i1 ** 2 + harmonicSum ** 2)

  // K-factor (for transformer derating): K = Σ(Ih²×h²) / Σ(Ih²)
  const num = i1 ** 2 * 1 + i3 ** 2 * 9 + i5 ** 2 * 25 + i7 ** 2 * 49 + i11 ** 2 * 121 + i13 ** 2 * 169
  const den = i1 ** 2 + i3 ** 2 + i5 ** 2 + i7 ** 2 + i11 ** 2 + i13 ** 2
  const K = num / den

  // Transformer derating (simplified): Prated_derated = Prated / √K
  const derate = (1 / Math.sqrt(K)) * 100

  return { THD, Irms, K, derate, passIEC: THD < 8 } // IEC 61000-3-2 Class A limit ~8%
}

// ── 2. Battery / UPS Sizing ────────────────────────────────────────────────
/**
 * @param {Object} p
 * @param {string|number} p.loadKw
 * @param {string|number} p.pf - load power factor
 * @param {string|number} p.runtimeMin - required backup runtime, minutes
 * @param {string|number} p.vdc - battery bank voltage
 * @param {string|number} p.dodPct - max depth of discharge, %
 * @param {string|number} p.etaPct - inverter efficiency, %
 * @returns {null|{kVA:number, Wh:number, Ah:number, cells:string, inv_A:number}}
 */
export function upsBatterySizing({ loadKw, pf: pfIn, runtimeMin, vdc, dodPct, etaPct }) {
  const loadKwNum = pf(loadKw)
  const P = loadKwNum * 1000
  const p = pf(pfIn), t = pf(runtimeMin) / 60 // hours
  const V = pf(vdc)
  const d = pf(dodPct) / 100, e = pf(etaPct) / 100
  if ([loadKwNum, P, p, t, V, d, e].some(isNaN)) return null

  // kVA computed from loadKw (kW), not P (W) — see PQCalculator.jsx's own
  // "BUG FIX" comment on this exact line for the historical division-by-1000
  // defect this formula already fixes.
  const kVA = loadKwNum / p

  // Energy drawn at the DC/battery side, accounting for inverter efficiency.
  const Wh_load = (P / e) * t

  const { requiredCapacityAh } = batteryBankSizingFromEnergy({
    requiredUsableEnergyWh: Wh_load,
    dodFraction: d,
    systemVoltageV: V,
    roundTripEfficiency: 1, // Wh_load already has inverter efficiency baked in above
  })

  const cells = Math.ceil(V / 2) // 2V cells
  const strings_hint = V === 48 ? '4 × 12V or 24 × 2V cells'
    : V === 24 ? '2 × 12V or 12 × 2V cells'
    : `${cells} × 2V cells`

  return { kVA, Wh: Wh_load / 1000, Ah: requiredCapacityAh, cells: strings_hint, inv_A: kVA * 1000 / V }
}

// ── 3. Lighting Design (Lumen Method, SANS 10114-1) ───────────────────────
// lightingLumenMethod() itself now lives in src/lib/lumenMethod.js (2026-07-26
// extraction — see file header). Re-exported here unchanged so
// PQCalculator.jsx's existing `import { lightingLumenMethod } from './pqEngine'`
// continues to work with zero changes to that file.
export { lightingLumenMethod }

// LUX_GUIDE stays here, not in the shared lib — these are interior-specific
// SANS 10114-1 reference values and don't apply to Installation Design's
// exterior Area Lighting tab (which deliberately has no lux-guide table at
// all — SANS 10389-1's actual exterior figures aren't available to this
// project; see roadmap.md §5.6.1/§9 for the sourcing decision).
export const LUX_GUIDE = [
  { area: 'Corridor / walkway', lux: 100 },
  { area: 'Workshop / assembly', lux: 300 },
  { area: 'Office / control room', lux: 500 },
  { area: 'Fine assembly / lab', lux: 750 },
  { area: 'Drawing board / surgery', lux: 1000 },
]
