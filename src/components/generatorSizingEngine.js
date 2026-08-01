// generatorSizingEngine.js — pure calculation functions extracted from
// GeneratorSizing.jsx (2026-07-25, per debt.md's "no automated test suite
// for most modules" item). Formulas copied exactly from the original inline
// calc()/useMemo blocks — no numeric changes. This is the last of the
// eight previously-untested calculator modules to be closed out.

import { calculateGeneratorDerating, GEN_SIZES } from '../lib/generatorDerating.js'

const SQRT3 = Math.sqrt(3)

// Common distribution transformer kVA sizes — market/manufacturer convention,
// NOT an IEC-mandated table. Verified 2026-08-01 by reading IEC 60076-1:2011
// directly: Part 1 defines what "rated power" means and how it's declared,
// but does not publish a standard list of kVA sizes. Previously mislabeled
// "(IEC 60076)" in this comment — corrected per [AI-18] rather than left
// standing now that the inaccuracy is known. Values themselves are unchanged
// and remain the single shared source for both Generator Sizing's
// Transformer stage and Power Systems' load-based sizing tool (§5.7).
export const TRAFO_SIZES = [
  5, 10, 15, 25, 50, 75, 100, 150, 200, 250,
  315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150,
]

/**
 * Starting current multipliers relative to full-load kVA (peak inrush,
 * for generator transient response sizing — not steady-state).
 */
export const START_MULT = {
  DOL: 6.5,
  'Star-Delta': 2.3,
  'Soft-Start': 3.0,
  VFD: 1.0,
  'N/A': 0,
}

/** Round up to next standard size in a sorted array. */
export const nextStd = (arr, val) => arr.find(s => s >= val) || arr[arr.length - 1]

/** Comma-tolerant numeric parse with fallback (matches original pf() helper). */
export function pf(v, fallback = 0) {
  return parseFloat(String(v).replace(',', '.')) || fallback
}

export { GEN_SIZES, calculateGeneratorDerating }

// ── 1. Known Load Sizing (single-shot generator sizing) ─────────────────
/**
 * @param {Object} p
 * @param {string|number} p.kw - total connected load, kW
 * @param {string|number} p.kwPf - overall power factor
 * @param {string|number} p.eff - load efficiency, %
 * @param {string|number} p.altitude - site altitude, m AMSL
 * @param {string|number} p.temp - ambient temperature, °C
 * @param {string|number} p.largestMotorKw
 * @param {'DOL'|'Star-Delta'|'VFD'} p.startMethod
 * @returns {null|{kVA_load:number, kVA_start:number, derate:number, kVA_req:number, gen:number, altitudeM:number, ambientTempC:number}}
 */
export function knownLoadSizing({ kw, kwPf, eff, altitude, temp, largestMotorKw, startMethod }) {
  const P = pf(kw), p = pf(kwPf, 0.8)
  const e = pf(eff, 90) / 100, alt = pf(altitude)
  const T = pf(temp, 25), Pm = pf(largestMotorKw)
  if ([P, p, e, alt, T, Pm].some(v => isNaN(v))) return null

  const { netFactor: derate } = calculateGeneratorDerating({ altitudeM: alt, ambientTempC: T })

  const kVA_load = (P / p) / e
  const kVA_start = Pm * (START_MULT[startMethod] || 0) / p

  const kVA_required = Math.max(kVA_load, kVA_start)
  const kVA_derated = kVA_required / derate
  const recommended = nextStd(GEN_SIZES, kVA_derated)

  return { kVA_load, kVA_start, derate, kVA_req: kVA_derated, gen: recommended, altitudeM: alt, ambientTempC: T }
}

// ── 2. Load Schedule Totals ───────────────────────────────────────────────
/**
 * @param {Array<{kw:string|number, pf:string|number, df:string|number, type:string, start:string}>} loads
 * @returns {{rows:Array, sumKW:number, sumKVAR:number, totKVA:number, sysPF:number, maxStartKVA:number}}
 */
export function loadScheduleTotals(loads) {
  let sumKW = 0, sumKVAR = 0, maxStartKVA = 0

  const rows = loads.map(l => {
    const kw = pf(l.kw)
    const lpf = Math.max(0.01, pf(l.pf, 0.85))
    const df = pf(l.df, 100) / 100

    const dKW = kw * df
    const dKVA = dKW / lpf
    const dKVAR = dKVA * Math.sqrt(Math.max(0, 1 - lpf * lpf))
    const sKVA = l.type === 'Motor' ? dKVA * (START_MULT[l.start] || 0) : 0

    sumKW += dKW
    sumKVAR += dKVAR
    if (sKVA > maxStartKVA) maxStartKVA = sKVA

    return { ...l, dKW, dKVA, dKVAR, sKVA }
  })

  const totKVA = Math.sqrt(sumKW * sumKW + sumKVAR * sumKVAR)
  const sysPF = totKVA > 0 ? sumKW / totKVA : 1

  return { rows, sumKW, sumKVAR, totKVA, sysPF, maxStartKVA }
}

// ── 3. Generator Sizing from Load Schedule (ISO 8528-1) ──────────────────
/**
 * @param {Object} p
 * @param {{totKVA:number, maxStartKVA:number}} p.totals
 * @param {string|number} p.altitude
 * @param {string|number} p.ambTemp
 * @param {string|number} p.margin - %
 * @param {string|number} p.genPF
 * @returns {{altFactor:number, tempFactor:number, netFactor:number, governing:number,
 *   withMargin:number, required:number, stdSize:number, gpf:number, altitudeM:number, ambientTempC:number}}
 */
export function generatorSizingFromTotals({ totals, altitude, ambTemp, margin, genPF }) {
  const alt = pf(altitude)
  const tmp = pf(ambTemp, 25)
  const mar = pf(margin, 25) / 100
  const gpf = pf(genPF, 0.8)

  const { altFactor, tempFactor, netFactor } = calculateGeneratorDerating({ altitudeM: alt, ambientTempC: tmp })

  const governing = Math.max(totals.totKVA, totals.maxStartKVA)
  const withMargin = governing * (1 + mar)
  const required = withMargin / netFactor
  const stdSize = nextStd(GEN_SIZES, required)

  return { altFactor, tempFactor, netFactor, governing, withMargin, required, stdSize, gpf, altitudeM: alt, ambientTempC: tmp }
}

// ── 4. Transformer Sizing ─────────────────────────────────────────────────
/**
 * Sized to match generator output kVA (gen is the source).
 * @param {Object} p
 * @param {string|number} p.vPri
 * @param {string|number} p.vSec
 * @param {number} p.genStdSize - genRes.stdSize (the generator's chosen standard kVA — MUST be
 *   the rounded standard size, not the raw pre-rounding requirement; see the zBase ordering
 *   fix documented in debt.md, closed 2026-07-22)
 * @param {string|number} p.pctZ - transformer impedance, %
 * @returns {{vp:number, vs:number, kva:number, ratio:number, ip:number, is_:number, z:number, zBase:number, zOhm:number, stdKVA:number}}
 */
export function transformerSizing({ vPri, vSec, genStdSize, pctZ }) {
  const vp = pf(vPri, 11000)
  const vs = pf(vSec, 400)
  const kva = genStdSize
  const z = pf(pctZ, 5)

  const ratio = vp / vs
  const ip = (kva * 1000) / (SQRT3 * vp)
  const is_ = (kva * 1000) / (SQRT3 * vs)
  const stdKVA = nextStd(TRAFO_SIZES, kva) // rounding step happens BEFORE zBase references it
  const zBase = (vs * vs) / (stdKVA * 1000)
  const zOhm = (z / 100) * zBase

  return { vp, vs, kva, ratio, ip, is_, z, zBase, zOhm, stdKVA }
}

// ── 5. Impedance & Fault Level (simplified series model, IEC 60909) ──────
/**
 * @param {Object} p
 * @param {string|number} p.vSec
 * @param {number} p.trafoStdKVA - trafoRes.stdKVA (the transformer's rounded standard size)
 * @param {string|number} p.pctZ - transformer impedance, %
 * @param {string|number} p.xdPct - generator subtransient reactance Xd'', %
 * @returns {{baseVA:number, zBase:number, iBase:number, xdPu:number, zTraPu:number, zTot:number, isc3:number, kAsc:number, mvasc:number}}
 */
export function faultLevelFromImpedance({ vSec, trafoStdKVA, pctZ, xdPct }) {
  const vs = pf(vSec, 400)
  const baseVA = trafoStdKVA * 1000
  const zBase = (vs * vs) / baseVA
  const iBase = baseVA / (SQRT3 * vs)

  const xdPu = pf(xdPct, 15) / 100
  const zTraPu = pf(pctZ, 5) / 100
  const zTot = xdPu + zTraPu

  const isc3 = iBase / zTot
  const kAsc = isc3 / 1000
  const mvasc = (SQRT3 * vs * isc3) / 1e6

  return { baseVA, zBase, iBase, xdPu, zTraPu, zTot, isc3, kAsc, mvasc }
}
