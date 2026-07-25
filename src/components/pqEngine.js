// pqEngine.js — pure calculation functions extracted from PQCalculator.jsx
// (2026-07-25, per debt.md's "no automated test suite for most modules" item —
// this closes out the last of the modules originally flagged as untested).
// Formulas copied exactly from the original inline calc() handlers — no
// numeric changes.

import { batteryBankSizingFromEnergy } from '../lib/batterySizing.js'

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
  const i1 = parseFloat(I1), i3 = parseFloat(I3)
  const i5 = parseFloat(I5), i7 = parseFloat(I7)
  const i11 = parseFloat(I11), i13 = parseFloat(I13)
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
export function upsBatterySizing({ loadKw, pf, runtimeMin, vdc, dodPct, etaPct }) {
  const loadKwNum = parseFloat(loadKw)
  const P = loadKwNum * 1000
  const p = parseFloat(pf), t = parseFloat(runtimeMin) / 60 // hours
  const V = parseFloat(vdc)
  const d = parseFloat(dodPct) / 100, e = parseFloat(etaPct) / 100
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
export const LUX_GUIDE = [
  { area: 'Corridor / walkway', lux: 100 },
  { area: 'Workshop / assembly', lux: 300 },
  { area: 'Office / control room', lux: 500 },
  { area: 'Fine assembly / lab', lux: 750 },
  { area: 'Drawing board / surgery', lux: 1000 },
]

/**
 * @param {Object} p
 * @param {string|number} p.area - m²
 * @param {string|number} p.lux - required illuminance
 * @param {string|number} p.CU - coefficient of utilization
 * @param {string|number} p.MF - maintenance factor
 * @param {string|number} p.lumens - lumens per fitting
 * @param {string|number} p.watts - watts per fitting
 * @returns {null|{N:number, N_ceil:number, W:number, Wm2:number, lux_act:number}}
 */
export function lightingLumenMethod({ area, lux, CU, MF, lumens, watts }) {
  const A = parseFloat(area), E = parseFloat(lux)
  const cu = parseFloat(CU), mf = parseFloat(MF)
  const phi = parseFloat(lumens), W = parseFloat(watts)
  if ([A, E, cu, mf, phi, W].some(isNaN)) return null

  // Lumen method: N = (E × A) / (Φ × CU × MF)
  const N = (E * A) / (phi * cu * mf)
  const N_ceil = Math.ceil(N)
  const totalW = N_ceil * W
  const W_per_m2 = totalW / A
  const actual_lux = (N_ceil * phi * cu * mf) / A

  return { N, N_ceil, W: totalW, Wm2: W_per_m2, lux_act: actual_lux }
}
