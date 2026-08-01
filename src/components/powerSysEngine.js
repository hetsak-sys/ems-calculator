// powerSysEngine.js — pure calculation functions extracted from PowerSysCalculator.jsx
// (2026-07-25, per debt.md's "no automated test suite for most modules" item).
// Formulas copied exactly from the original inline calc() handlers — no
// numeric changes. Same [COD-14] stale-result gap found here as in Earthing/
// Cable (none of these 4 calculators cleared the previous result before
// validating) — fixed in the UI wiring, not here.
//
// Comma-decimal fix (2026-07-27, repo-wide sweep per debt.md): this file, like
// earthingEngine.js, had no comma tolerance — plain parseFloat/parseInt, which
// silently truncates "1,5" to 1 rather than producing NaN, bypassing the
// isNaN() validation below it. Fixed with cnum()/cint() rather than the usual
// pf() name, since `pf` is already used here as a destructured parameter name
// for "power factor" in two function signatures below — reusing it as a
// helper name would shadow that parameter inside those function bodies.

import { TRAFO_SIZES, nextStd } from './generatorSizingEngine.js'

const SQRT3 = Math.sqrt(3)

function cnum(v) { return parseFloat(String(v).replace(',', '.')) }
function cint(v) { return parseInt(String(v).replace(',', '.'), 10) }

// ── 1. Transformer parameters / fault current ────────────────────────────
/**
 * @param {Object} p
 * @param {string|number} p.kva - rating, kVA
 * @param {string|number} p.vpri - primary voltage, V
 * @param {string|number} p.vsec - secondary voltage, V
 * @param {string|number} p.zpc - impedance, %
 * @param {string|number} p.pf - load power factor
 * @param {string|number} p.eff - efficiency, %
 * @returns {{ratio:number, Ipri:number, Isec:number, Isc3:number, Isc1:number, Ploss:number}|null}
 */
export function transformerParameters({ kva, vpri, vsec, zpc, pf, eff }) {
  const S = cnum(kva) * 1000
  const Vp = cnum(vpri), Vs = cnum(vsec)
  const Z = cnum(zpc) / 100
  const p = cnum(pf), e = cnum(eff) / 100
  if ([S, Vp, Vs, Z, p, e].some(isNaN)) return null

  const Ipri = S / (SQRT3 * Vp)
  const Isec = S / (SQRT3 * Vs)
  const ratio = Vp / Vs
  // Fault current at secondary: If = Irated / Z%
  const Isc_sec = Isec / Z
  const Isc_3ph = Isc_sec // bolted 3-phase
  const Isc_1ph = Isc_3ph * 0.866 // approx 1-phase
  const Pinput = (S * p) / e
  const Ploss = Pinput - S * p

  return {
    ratio, Ipri, Isec,
    Isc3: Isc_3ph / 1000, Isc1: Isc_1ph / 1000,
    Ploss: Ploss / 1000,
  }
}

// ── 2. Power Factor Correction ────────────────────────────────────────────
export const PFC_CAPACITOR_STEPS_KVAR = [5, 10, 12.5, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 250, 300]

/**
 * @param {Object} p
 * @param {string|number} p.kw - active power load, kW
 * @param {string|number} p.pf1 - existing power factor
 * @param {string|number} p.pf2 - target power factor
 * @param {string|number} p.vv - system voltage, V
 * @returns {{Qc:number, bank:number|'>300', Ic:number, Ibefore:number, Iafter:number, saving:number}|null}
 */
export function pfCorrection({ kw, pf1, pf2, vv }) {
  const P = cnum(kw), p1 = cnum(pf1), p2 = cnum(pf2)
  const V = cnum(vv)
  if ([P, p1, p2, V].some(isNaN) || p1 >= 1 || p2 > 1) return null

  const Qc = P * (Math.tan(Math.acos(p1)) - Math.tan(Math.acos(p2)))
  const I_before = (P * 1000) / (SQRT3 * V * p1)
  const I_after = (P * 1000) / (SQRT3 * V * p2)
  const Ic = Qc * 1000 / (SQRT3 * V)
  const bank = PFC_CAPACITOR_STEPS_KVAR.find(s => s >= Qc) || '>300'

  return { Qc, bank, Ic, Ibefore: I_before, Iafter: I_after, saving: (I_before - I_after) / I_before * 100 }
}

// ── 3. Busbar Rating ───────────────────────────────────────────────────────
/**
 * @param {Object} p
 * @param {'cu'|'al'} p.mat
 * @param {string|number} p.w - width, mm
 * @param {string|number} p.thick - thickness, mm
 * @param {string|number} p.bars - bars per phase
 * @param {string|number} p.temp - ambient temperature, °C
 * @returns {{area:number, I:number, Isc:number, R:number}|null}
 */
export function busbarRating({ mat, w, thick, bars, temp }) {
  const W = cnum(w), T = cnum(thick)
  const n = cint(bars), ta = cnum(temp)
  if ([W, T, n, ta].some(isNaN)) return null

  // I = J × A (current density method), Copper ~2.0 A/mm², Aluminium ~1.3 A/mm² (conservative)
  const A = W * T // cross-section, mm²
  const J = mat === 'cu' ? 2.0 : 1.3
  // Temperature correction, assumes 90°C max conductor temp
  const tempCorr = Math.sqrt((90 - ta) / (90 - 35))

  const I_single = J * A * tempCorr
  const I_total = I_single * n
  const Isc_1s = mat === 'cu' ? A * n * 143 : A * n * 95 // k=143 Cu-PVC / k=95 Al, adiabatic 1s rating
  const R_per_m = (mat === 'cu' ? 0.01724 : 0.0282) / (A * n) * 1000 // mΩ/m

  return { area: A * n, I: I_total, Isc: Isc_1s / 1000, R: R_per_m }
}

// ── 4. Motor Starting Method Comparison ───────────────────────────────────
export const MOTOR_STARTING_FACTORS = {
  dol:         { start: 6.5, torque: 1.5 },
  star_delta:  { start: 2.2, torque: 0.5 },
  autotrans:   { start: 3.0, torque: 0.64 },
  vfd:         { start: 1.2, torque: 1.0 },
  softstarter: { start: 2.5, torque: 0.8 },
}

/**
 * @param {Object} p
 * @param {string|number} p.kw - motor rating, kW
 * @param {string|number} p.vv - system voltage, V
 * @param {string|number} p.eff - efficiency, %
 * @param {string|number} p.pf - power factor
 * @param {keyof MOTOR_STARTING_FACTORS} p.method
 * @returns {{Ifull:number, Istart:number, kVA:number, dip:number, torque:number}|null}
 */
export function motorStartingComparison({ kw, vv, eff, pf, method }) {
  const P = cnum(kw) * 1000, V = cnum(vv)
  const e = cnum(eff) / 100, p = cnum(pf)
  if ([P, V, e, p].some(isNaN)) return null

  const Ifull = P / (SQRT3 * V * p * e)
  const f = MOTOR_STARTING_FACTORS[method]
  const Istart = Ifull * f.start
  const kVA_start = (SQRT3 * V * Istart) / 1000
  const voltDip_approx = (kVA_start * 0.05) * 100 // rough 5% Zs estimate

  return { Ifull, Istart, kVA: kVA_start, dip: voltDip_approx, torque: f.torque }
}

// ── 5. Transformer Sizing from Load (§5.7, roadmap.md — scoped 2026-08-01) ────────────────────
// Deliberately the "simple arithmetic" version, not the fuller-design-tool scope originally
// flagged in §5.7: connected-load demand kVA (usually handed over from Installation Design's
// Load Assessment via WorkspaceContext.loadAssessmentSnapshot, same handoff pattern as
// Motor->Cable's flaSnapshot and Load Assessment->DB Sizing) + an optional growth margin,
// rounded up to the next standard transformer kVA size. Reuses TRAFO_SIZES/nextStd from
// generatorSizingEngine.js rather than a second copy, per the shared-reference-data convention
// (same list already used by Generator Sizing's Transformer stage for the same rounding step).
//
// No demand-factor table here, same reasoning as Load Assessment's own sourcing note: neither
// IEC 60364-1 Clause 311 nor SANS 10142-1 mandate a diversity/demand-factor table for this kind
// of load, so this function takes demand kVA as already computed (by Load Assessment or the
// user's own judgement) rather than fabricating a lookup step of its own.
/**
 * @param {Object} p
 * @param {string|number} p.demandKVA - demand kVA (from Load Assessment's snapshot, or manually
 *   entered by the user)
 * @param {string|number} p.growthMarginPct - growth margin, % — blank/invalid defaults to 0,
 *   NOT a positive default like Generator Sizing's 25% margin, since this is the plain-arithmetic
 *   version and should not assume growth the user didn't ask for
 * @returns {{demandKVA:number, withMargin:number, stdKVA:number}|null}
 */
export function transformerSizingFromLoad({ demandKVA, growthMarginPct }) {
  const kva = cnum(demandKVA)
  if (isNaN(kva)) return null
  const marginRaw = cnum(growthMarginPct)
  const margin = isNaN(marginRaw) ? 0 : marginRaw

  const withMargin = kva * (1 + margin / 100)
  const stdKVA = nextStd(TRAFO_SIZES, withMargin)

  return { demandKVA: kva, withMargin, stdKVA }
}

export { TRAFO_SIZES }
