// installationDesignEngine.js — Building/Installation Design module (§5.6.1, roadmap.md)
// New module per the §5.6.1 scoping decision: "building/installation-level load and circuit
// sizing, from connected load through to final-circuit and area-lighting design; knows nothing
// of single-run cable engineering beyond calling cableEngine.js, and nothing of MV/LV
// distribution networks."
//
// ── Load Assessment — sourcing note [AI-18] ─────────────────────────────────────────────────
// Verified 2026-07-26 by reading the actual standard text (not from training memory):
//
// - SANS 10142-1's load-estimation clause (5.2.1 in edition 1.8 / 5.3.1 in edition 2.0) states:
//   "[The load] shall be estimated..." with "NOTE 1 Annex D [ed.1.8] / Annex C [ed.2.0] gives an
//   example of estimating the load for residential installations but the method is not to be
//   regarded as an exact method." Both editions checked directly against source PDFs.
// - SANS 10142-1 is harmonized from IEC 60364. IEC 60364-1 Clause 311 ("Maximum demand and
//   diversity") — the clause SANS 10142-1's own load-estimation clause maps to — itself carries
//   the note: "Guidance on the calculation of diversity is under consideration." IEC has not
//   published a mandatory diversity-factor table either; this is a known, acknowledged open
//   item, not an oversight on SANS's part.
// - Conclusion: there is no IEC/SANS-mandated diversity/demand-factor table to reproduce here.
//   Both standards deliberately leave this to "a registered person or an electrical consultant"
//   (SANS 10142-1, 5.2.1/5.3.1) using their own judgement. Building this as a fixed lookup table
//   presented as "the standard number" would misrepresent what the standards actually say.
//
// Design consequence: loadAssessment() is a tally + user-supplied-demand-factor calculator, not
// a table lookup. LOAD_CATEGORIES' `hint` text cites commonly-published BS 7671 On-Site Guide /
// AS/NZS 3000-style reference ranges for comparison only — explicitly labelled as industry
// practice, not an IEC/SANS figure — same honest-labelling convention already used elsewhere in
// PowerSuite (generic ANSI fuse curves, SEF percentage ranges).

import { MCCB_TRIPS } from './motorEngine.js'

const SQRT3 = Math.sqrt(3)

export const pf = (v) => {
  const n = parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? 0 : n
}

// Default demand factor is 100% (no diversity assumed) — the safest assumption if the user
// doesn't change it ([DEC-4]: choose the assumption safest if wrong).
export const LOAD_CATEGORIES = [
  { id: 'lighting',     label: 'Lighting',                      defaultDF: 100, hint: 'Industry practice commonly cites 66–100%, varying with zoning/control — not an IEC/SANS figure' },
  { id: 'sockets',      label: 'Socket Outlets (general power)', defaultDF: 100, hint: 'Industry practice commonly cites 40–100% depending on point count — not an IEC/SANS figure' },
  { id: 'waterHeating', label: 'Water Heating',                  defaultDF: 100, hint: 'Often no diversity applied unless multiple units are load-managed' },
  { id: 'cooking',      label: 'Cooking Appliances',             defaultDF: 100, hint: 'Industry practice commonly applies 100% of the largest appliance + a reduced % of the rest' },
  { id: 'hvac',         label: 'Space Heating / Cooling',        defaultDF: 100, hint: 'Industry practice commonly cites 50–100% depending on thermostatic control' },
  { id: 'motors',       label: 'Motors',                         defaultDF: 100, hint: 'For starting current and largest-motor allowances, see the Motor and Generator Sizing modules' },
  { id: 'other',        label: 'Other Fixed Appliances',         defaultDF: 100, hint: 'Assess per the specific load — no general reference figure applies' },
]

/**
 * @param {Object} p
 * @param {Array<{id:string, connected:string|number, demandFactor:string|number}>} p.rows
 * @param {string|number} p.voltage - line voltage (V)
 * @param {'1ph'|'3ph'} p.phase
 * @param {string|number} p.powerFactor - overall assumed PF for kW→kVA conversion
 * @returns {{error:string}|{rowResults:Array, totalConnected:number, totalDemand:number,
 *   demandKVA:number, current:number, recommendedMain:number, diversityAchieved:number,
 *   warnings:string[]}}
 */
export function loadAssessment({ rows, voltage, phase, powerFactor }) {
  const V = pf(voltage)
  const PF = pf(powerFactor) || 0.9
  const activeRows = (rows || []).filter(r => pf(r.connected) > 0)
  if (!V) return { error: 'Enter the system voltage' }
  if (!activeRows.length) return { error: 'Enter at least one connected load' }

  const warnings = []
  let totalConnected = 0
  let totalDemand = 0
  const rowResults = activeRows.map(r => {
    const connected = pf(r.connected)
    const dfPct = pf(r.demandFactor)
    if (dfPct > 100) warnings.push(`${r.id}: demand factor above 100% — this increases demand above the connected load, confirm this is intended`)
    if (dfPct <= 0) warnings.push(`${r.id}: demand factor is zero or blank — this load will not be counted`)
    const demand = connected * (dfPct / 100)
    totalConnected += connected
    totalDemand += demand
    return { id: r.id, connected, demandFactorPct: dfPct, demand }
  })

  const demandKVA = PF > 0 ? totalDemand / PF : totalDemand
  const current = phase === '1ph'
    ? (demandKVA * 1000) / V
    : (demandKVA * 1000) / (SQRT3 * V)

  const recommendedMain = MCCB_TRIPS.find(s => s >= current) || MCCB_TRIPS[MCCB_TRIPS.length - 1]
  const diversityAchieved = totalConnected > 0 ? (1 - totalDemand / totalConnected) * 100 : 0

  return { rowResults, totalConnected, totalDemand, demandKVA, current, recommendedMain, diversityAchieved, warnings }
}
