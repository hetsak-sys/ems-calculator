// earthingEngine.js — pure calculation functions extracted from EarthingCalculator.jsx
// (2026-07-25, per debt.md's "no automated test suite for most modules" item).
//
// Formulas copied exactly from the original inline calc() handlers — no
// numeric changes. One behavior correction made during extraction: the
// original UI never cleared the previous result on invalid input (missing
// the [COD-14] "clear result before validating" pattern that Motor,
// Protection, and ContactorOLR already had). That's fixed in the UI wiring,
// not here — this file only returns null on invalid input, same as before.
//
// Comma-decimal fix (2026-07-27, repo-wide sweep per debt.md): this file had
// NO comma tolerance at all — plain parseFloat/parseInt on every field. Unlike
// the GeneratorSizing/pqEngine cases (caught because a bad value produced a
// visible warning or an obviously-wrong result), a value like "1,5" here
// silently parses to 1 rather than NaN, so the existing isNaN() validation
// checks don't catch it — this is genuinely safety-relevant, since these
// functions feed IEEE 80 touch/step voltage and fault-loop-impedance pass/fail
// results. Fixed by routing every input through pf()/pi() below.

function pf(v) { return parseFloat(String(v).replace(',', '.')) }
function pi(v) { return parseInt(String(v).replace(',', '.'), 10) }

// ── 1. Electrode Resistance (Dwight's formula, IEC 62305 / SANS 10199) ──
/**
 * @param {Object} p
 * @param {string|number} p.rho - soil resistivity, Ω·m
 * @param {string|number} p.L   - rod length, m
 * @param {string|number} p.d   - rod diameter, m
 * @param {string|number} p.n   - number of rods
 * @param {string|number} p.s   - rod spacing, m (currently unused in the
 *        parallel approximation — see note below, matches original)
 * @returns {{single:number, parallel:number, ratio:number, pass:boolean}|null}
 */
export function dwightElectrodeResistance({ rho, L, d, n, s }) {
  const r = pf(rho), l = pf(L), dia = pf(d)
  const nr = pi(n), sp = pf(s)
  if ([r, l, dia].some(isNaN) || l <= 0 || dia <= 0) return null

  // Dwight's formula: R = (ρ/2πL)(ln(4L/d) - 1)
  const R_single = (r / (2 * Math.PI * l)) * (Math.log(4 * l / dia) - 1)

  // Multiple rods in parallel — simple 1/n approximation (no spacing
  // correction applied, matching the original's approximation; a full
  // mutual-resistance correction would need the spacing term (sp) and
  // is a known simplification, not a bug introduced by this extraction).
  const R_parallel = nr > 1 ? R_single / nr : R_single

  return {
    single: R_single,
    parallel: R_parallel,
    ratio: R_single / R_parallel,
    pass: R_parallel < 1.0,
  }
}

// ── 2. Touch & Step Voltage (IEEE Std 80, 50 kg body weight) ────────────
/**
 * @param {Object} p
 * @param {string|number} p.rhoS - surface layer resistivity, Ω·m
 * @param {string|number} p.hs   - surface layer thickness, m
 * @param {string|number} p.ts   - fault clearing time, s
 * @returns {{Cs:number, touch:number, step:number}|null}
 */
export function ieee80TouchStepVoltage({ rhoS, hs, ts }) {
  const rs = pf(rhoS), h = pf(hs), t = pf(ts)
  if ([rs, h, t].some(isNaN)) return null

  // Cs = surface layer derating factor (IEEE 80)
  const Cs = 1 - (0.09 * (1 - 100 / rs)) / (2 * h + 0.09)
  // Tolerable touch/step voltage, 50 kg body (IEEE 80 Eq 32/33)
  const touch = (1000 + 1.5 * Cs * rs) * (0.116 / Math.sqrt(t))
  const step = (1000 + 6 * Cs * rs) * (0.116 / Math.sqrt(t))

  return { Cs, touch, step }
}

// ── 3. Earth Conductor Sizing — adiabatic equation (IEC 60364-5-54) ─────
export const EARTHING_MATERIALS = {
  cu:  { k: 143, name: 'Copper (PVC insulated)' },
  cu2: { k: 176, name: 'Copper (bare, welded)' },
  al:  { k: 95,  name: 'Aluminium' },
  st:  { k: 78,  name: 'Steel' },
}

export const STANDARD_CSA_MM2 = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300]

/**
 * @param {Object} p
 * @param {string|number} p.If  - fault current, A
 * @param {string|number} p.tf  - fault duration, s
 * @param {'cu'|'cu2'|'al'|'st'} p.material
 * @returns {{S:number, Smin:number|'>300', name:string}|null}
 */
export function adiabaticConductorSizing({ If, tf, material }) {
  const i = pf(If), t = pf(tf)
  if (isNaN(i) || isNaN(t)) return null
  const { k, name } = EARTHING_MATERIALS[material]
  // IEC 60364-5-54: S = (I × √t) / k
  const S = (i * Math.sqrt(t)) / k
  const Smin = STANDARD_CSA_MM2.find(s => s >= S) || '>300'
  return { S, Smin, name }
}

// ── 4. Fault Loop Impedance (SANS 10142) ─────────────────────────────────
/**
 * @param {Object} p
 * @param {string|number} p.Vs  - supply voltage, V
 * @param {string|number} p.Zs  - source impedance, Ω
 * @param {string|number} p.Rc  - phase cable resistance, Ω
 * @param {string|number} p.Re  - earth conductor resistance, Ω
 * @param {string|number} p.Iop - protection device rating, A
 * @returns {{Zloop:number, Isc:number, If1:number, ratio:number, pass:boolean}|null}
 */
export function faultLoopImpedance({ Vs, Zs, Rc, Re, Iop }) {
  const v = pf(Vs), zs = pf(Zs)
  const rc = pf(Rc), re = pf(Re), io = pf(Iop)
  if ([v, zs, rc, re, io].some(isNaN)) return null

  const Zloop = zs + rc + re                     // total loop impedance
  const Isc = v / (Math.sqrt(3) * Zloop)          // 3-phase fault current (approx)
  const If1 = v / (2 * (rc + re) + zs)            // L-E fault current
  const pass = If1 >= io * 5                      // 5× for magnetic trip (Type B/C)

  return { Zloop, Isc, If1, ratio: If1 / io, pass }
}
