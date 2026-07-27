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
import { cableSizing } from './cableEngine.js'
import { lightingLumenMethod } from '../lib/lumenMethod.js'

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

// ── DB Sizing ────────────────────────────────────────────────────────────────
// Sourcing note [AI-18], verified 2026-07-26 against the actual standard text and secondary
// summaries citing it directly:
// - SANS 10142-1, 6.15.2.2: "The anticipated load of a circuit that feeds socket-outlets shall
//   not exceed 5 kW" — a real, hard `shall` clause, checked per-circuit below.
// - SANS 10142-1 requires that, where an installation is likely to be extended, a distribution
//   board with spare capacity should be fitted — but (same shape as Load Assessment) sets no
//   specific percentage or way-count. The `sparePctDefault` below is a commonly-cited practice
//   figure, not a standard requirement, and is user-editable for that reason.
// - STANDARD_DB_SIZES is a commercially common range of DB way-counts in the SA market — a
//   product-range convention, not an IEC/SANS table. Confirm against your actual board
//   supplier's range.

export const STANDARD_DB_SIZES = [4, 6, 8, 12, 18, 24, 36, 42]
export const SOCKET_OUTLET_CIRCUIT_MAX_KW = 5 // SANS 10142-1, 6.15.2.2 — hard limit
export const SPARE_WAYS_DEFAULT_PCT = 20 // commonly-cited practice, not a standard figure

/**
 * @param {Object} p
 * @param {Array<{id:string, type:string, connected:string|number, label?:string}>} p.circuits
 * @param {string|number} p.sparePct
 * @param {string|number} p.mainSwitch - assessed demand current or main switch rating (A)
 * @returns {{error:string}|{rows:Array, circuitCount:number, spareCount:number, requiredWays:number,
 *   recommendedDB:number, recommendedMain:number|null, warnings:string[]}}
 */
export function dbSizing({ circuits, sparePct, mainSwitch }) {
  const active = (circuits || []).filter(c => c.type)
  if (!active.length) return { error: 'Add at least one circuit' }

  const warnings = []
  const rows = active.map(c => {
    const connected = pf(c.connected)
    const overLimit = c.type === 'sockets' && connected > SOCKET_OUTLET_CIRCUIT_MAX_KW
    if (overLimit) warnings.push(`${c.label || c.id}: socket-outlet circuit load ${connected} kW exceeds the SANS 10142-1 6.15.2.2 limit of ${SOCKET_OUTLET_CIRCUIT_MAX_KW} kW — split into more circuits`)
    return { ...c, connected, overLimit }
  })

  const circuitCount = rows.length
  const spareCount = Math.ceil(circuitCount * (pf(sparePct) / 100))
  const requiredWays = circuitCount + spareCount
  const recommendedDB = STANDARD_DB_SIZES.find(s => s >= requiredWays) || STANDARD_DB_SIZES[STANDARD_DB_SIZES.length - 1]

  const mainA = pf(mainSwitch)
  const recommendedMain = mainA > 0 ? (MCCB_TRIPS.find(s => s >= mainA) || MCCB_TRIPS[MCCB_TRIPS.length - 1]) : null

  return { rows, circuitCount, spareCount, requiredWays, recommendedDB, recommendedMain, warnings }
}

// ── Circuit Design ────────────────────────────────────────────────────────────
// Sourcing note [AI-18], verified 2026-07-26 directly against the actual standard text (IEC
// 60364-4-43, Clause 433.1 — SANS 10142-1 is harmonized from this same IEC series): the
// coordination rule between a final circuit's protective device and its conductor is
//   Ib ≤ In ≤ Iz   (design current ≤ device rated current ≤ cable's current-carrying capacity)
// with a second condition (I2 ≤ 1.45×Iz) that standard IEC 60898 miniature circuit breakers
// satisfy automatically once In ≤ Iz holds, so it isn't checked separately here.
//
// This function deliberately does NOT reimplement cableEngine.js's sizing loop — it calls
// cableSizing() directly per [ARC-1]/[DEC-2] ("reuse the existing engine, don't fork it").
// The one real design choice: cableSizing() is called with In (the chosen breaker rating), not
// Ib (the raw design current). This means the cable is sized — and its voltage drop checked —
// against In rather than the true operating current, which is mildly conservative (Ib < In
// always) rather than optimistic: the safer assumption if this circuit ever runs closer to its
// breaker's rating than today's connected load suggests ([DEC-4]).

/**
 * @param {Object} p
 * @param {string|number} p.connectedLoad - kW
 * @param {string|number} p.voltage
 * @param {'1ph'|'3ph'} p.phase
 * @param {string|number} p.powerFactor
 * @param {string|number} p.length - one-way circuit length, m
 * @param {string} p.ambient - key into cableEngine's AMBIENT table
 * @param {string} p.groups - key into cableEngine's GROUP table
 * @param {string} p.install - key into cableEngine's INSTALL table
 * @param {'PVC'|'XLPE'} p.insul
 * @param {'Cu'|'Al'} p.material
 * @param {string|number} p.maxVd
 * @returns {{error:string}|{Ib:number, recommendedBreaker:number, recommendedCable:number|null, sizing:Object}}
 */
export function circuitDesign({ connectedLoad, voltage, phase, powerFactor, length, ambient, groups, install, insul, material, maxVd }) {
  const P = pf(connectedLoad), V = pf(voltage), PF = pf(powerFactor) || 1, L = pf(length)
  if (!P || !V || !L) return { error: 'Enter connected load, voltage, and circuit length' }

  const Ib = phase === '1ph' ? (P * 1000) / (V * PF) : (P * 1000) / (SQRT3 * V * PF)
  const recommendedBreaker = MCCB_TRIPS.find(s => s >= Ib) || MCCB_TRIPS[MCCB_TRIPS.length - 1]

  const sizing = cableSizing({ phase, current: String(recommendedBreaker), length: String(L), voltage, insul, material, ambient, groups, install, maxVd })
  if (sizing.error) return sizing

  return { Ib, recommendedBreaker, recommendedCable: sizing.recommended, sizing }
}

// ── Area Lighting ──────────────────────────────────────────────────────────────
// Sourcing note [AI-18] — history preserved because the evidentiary status changed materially
// across two sessions; don't collapse this into a single "final" paragraph that hides the trail.
//
// 2026-07-26 (original scoping): the roadmap described this tab as "extending the lux-based
// method already used in Power Quality's interior Lighting sub-tab" under SANS 10114-1 — but
// SANS 10114-1 is exclusively an interior standard. The correct exterior standard, SANS 10389-1
// ("Exterior lighting, Part 1: Artificial lighting of exterior areas for work and safety"), was
// not accessible to this project at that time, so the tab shipped deliberately scoped down: no
// lux-guide table, user-supplied illuminance only.
//
// 2026-07-27 (standing sourcing hierarchy established): when SANS text isn't accessible, check
// for a harmonized IEC/ISO/CIE parent before falling back to scope-down. SANS 10389-1's likely
// parent, ISO/CIE 8995-3:2018 ("Lighting of work places — Part 3: Lighting requirements for
// safety and security of outdoor work places"), was identified — but its preview content was
// copyright-protected and unlicensed for use here. Status at that point: licensing-blocked.
//
// 2026-07-27 (later session — status upgraded): two further, freely-published sources were
// found and cross-checked line-by-line:
//   1. Genlux Lighting's "Lighting Terminology Guide" (ACTOM group; openly published industry
//      reference, not a paywalled standard) — its "Exterior Lighting" table explicitly attributes
//      its figures to SANS 10389-1.
//   2. The ISO/CIE 8995-3:2018 preview located the prior session.
// For every "safety & security" risk-tier category common to both sources (Industrial Yards,
// Power Plants, Petrochemical, Water & Sewage), the illuminance, uniformity ratios, and glare
// limits match exactly across both sources — including the same footnote exceptions (e.g. the
// building-sites/saw-mills higher glare allowance). This is strong secondary-source
// cross-validation, NOT a direct read of SANS 10389-1's own clause text — still labelled
// accordingly below and in the UI, per [AI-18]/[AI-10]. Building Sites and Parking Lots are
// sourced from Genlux only (not covered by ISO/CIE 8995-3's simpler 4-row table) and carry a
// lighter confidence flag (`crossValidated: false`) for that reason.
//
// Category list deliberately scoped to PowerSuite's actual target market (mines, industrial
// yards, power/utility plants, contractors) — the source tables' harbours, shipyards, railway,
// and saw-mill categories are omitted as out of scope for this project, per [LTP-3].
//
// Fitting-count math still reuses src/lib/lumenMethod.js's lightingLumenMethod() directly — the
// lux/area/lumens/CU/MF formula itself is generic photometrics, not standard-specific, shared
// with Power Quality's interior tab via that extraction (2026-07-26, see lumenMethod.js's file
// header). Mounting height and pole spacing still use widely-published, non-SANS-specific
// industry rules of thumb (mounting height ≈ half the distance across the lit area; spacing ≈ 4×
// mounting height) — unrelated to this guide table, and unchanged from the original scoping.
//
// ── Standing sourcing hierarchy for a national standard that isn't accessible (2026-07-27) ──
// Generalizes beyond this tab. When a cited SANS standard's own text isn't available:
//   1. SANS text directly, if it can be read — most authoritative for this project's actual
//      market (SA/Lesotho inspectors, MHSA, consulting engineers sign off against SANS, not its
//      international parent). Use this whenever available, as done for SANS 10142-1 above.
//   2. The IEC/ISO/CIE standard SANS is harmonized from, if SANS states that harmonization AND
//      the parent's text is accessible — labelled as "the international standard SANS is based
//      on, not confirmed identical to SANS's own clause."
//   3. Cross-validated independent secondary sources (two or more agreeing sources, neither
//      being SANS's own text) — labelled as secondary-sourced and cross-checked, not a standard
//      citation. This is the tier this guide table sits at.
//   4. Honest scope-down (user judgement, no reference table) if nothing above is available.
// This is a fallback chain, not a preference for international over national — SANS remains the
// first choice whenever it's actually readable, and tier 3 is a step down from tier 2, not a
// replacement for eventually getting the actual standard text.

// Reference illuminance/uniformity/glare-rating values by application category, per the sourcing
// note above. NOT a SANS 10389-1 citation — cross-validated secondary-source data (tier 3 of the
// hierarchy above). `crossValidated: true` categories matched exactly against the ISO/CIE 8995-3
// preview; `false` categories are Genlux-only.
export const AREA_LIGHTING_GUIDE = [
  {
    id: 'industrialYards',
    label: 'Industrial Yards & Storage Areas',
    crossValidated: true,
    tiers: [
      { id: 'low', label: 'Low risk — e.g. storage with occasional traffic', lux: 5, uniformityAvg: 0.25, uniformityMax: 0.125, glareMax: 55 },
      { id: 'medium', label: 'Medium risk — e.g. vehicle storage/container terminals, frequent traffic', lux: 20, uniformityAvg: 0.40, uniformityMax: 0.167, glareMax: 50 },
      { id: 'high', label: 'High risk — e.g. fire, poison, radiation risk areas', lux: 50, uniformityAvg: 0.40, uniformityMax: 0.2, glareMax: 45 },
    ],
  },
  {
    id: 'powerPlants',
    label: 'Power, Electricity, Gas & Heat Plants',
    crossValidated: true,
    tiers: [
      { id: 'low', label: 'Low risk — e.g. coal fields', lux: 5, uniformityAvg: 0.25, uniformityMax: 0.1, glareMax: 55 },
      { id: 'medium', label: 'Medium risk — e.g. oil stores', lux: 20, uniformityAvg: 0.40, uniformityMax: 0.167, glareMax: 50 },
      { id: 'high', label: 'High risk — e.g. switch yards', lux: 50, uniformityAvg: 0.40, uniformityMax: 0.2, glareMax: 45 },
    ],
  },
  {
    id: 'petrochemical',
    label: 'Petrochemical & Other Hazardous Industries',
    crossValidated: true,
    tiers: [
      { id: 'low', label: 'Low risk — e.g. risk-free process areas, occasionally used platforms/stairs', lux: 10, uniformityAvg: 0.40, uniformityMax: 0.167, glareMax: 50 },
      { id: 'medium', label: 'Medium risk — e.g. vehicle storage areas, conveyors', lux: 20, uniformityAvg: 0.40, uniformityMax: 0.167, glareMax: 50 },
      { id: 'high', label: 'High risk — e.g. oil stores, cooling towers, boilers, switch-yards', lux: 50, uniformityAvg: 0.40, uniformityMax: 0.2, glareMax: 45 },
      { id: 'fuelLoading', label: 'Fuel loading & unloading sites', lux: 100, uniformityAvg: 0.40, uniformityMax: 0.2, glareMax: 45 },
    ],
  },
  {
    id: 'waterSewage',
    label: 'Water & Sewage Plants',
    crossValidated: true,
    tiers: [
      { id: 'low', label: 'Low risk — e.g. occasionally used stairs, waste water cleaning/aeration tanks', lux: 5, uniformityAvg: 0.25, uniformityMax: 0.1, glareMax: 55 },
      { id: 'medium', label: 'Medium risk — e.g. regularly used stairs, basins/filters', lux: 20, uniformityAvg: 0.40, uniformityMax: 0.167, glareMax: 50 },
    ],
  },
  {
    id: 'buildingSites',
    label: 'Building Sites (work areas/tasks)',
    crossValidated: false, // Genlux-only; ISO/CIE 8995-3 preview only covers a single 50 lux "safety & security" row for this category, not this task-based breakdown
    tiers: [
      { id: 'veryRough', label: 'Very rough work — e.g. clearance, excavation, loading', lux: 20, uniformityAvg: 0.25, uniformityMax: 0.125, glareMax: 55 },
      { id: 'rough', label: 'Rough work — e.g. drainage, transport, auxiliary/storage tasks', lux: 50, uniformityAvg: 0.40, uniformityMax: 0.2, glareMax: 50 },
      { id: 'accurate', label: 'Accurate work — e.g. framework/reinforcement, electrical piping/cabling', lux: 100, uniformityAvg: 0.40, uniformityMax: 0.2, glareMax: 45 },
      { id: 'fine', label: 'Fine work — e.g. element jointing, demanding electrical/machine work', lux: 200, uniformityAvg: 0.50, uniformityMax: 0.2, glareMax: 45 },
    ],
  },
  {
    id: 'parkingLots',
    label: 'Parking Lots & Driveways',
    crossValidated: false,
    tiers: [
      { id: 'light', label: 'Light traffic — e.g. small parking areas', lux: 5, uniformityAvg: 0.25, uniformityMax: 0.1, glareMax: 55 },
      { id: 'medium', label: 'Medium traffic — e.g. office/commercial parking', lux: 10, uniformityAvg: 0.25, uniformityMax: 0.125, glareMax: 50 },
      { id: 'heavy', label: 'Heavy traffic — e.g. major shopping/sports complex parking', lux: 20, uniformityAvg: 0.25, uniformityMax: 0.125, glareMax: 55 },
    ],
  },
]

/**
 * Look up a single guide entry by category and tier id. Returns null (not a throw) for an
 * unknown category or tier, so a UI dropdown can never crash on a stale/invalid selection.
 * @param {string} categoryId
 * @param {string} tierId
 * @returns {null|{category:string, tier:string, lux:number, uniformityAvg:number,
 *   uniformityMax:number, glareMax:number, crossValidated:boolean}}
 */
export function findAreaLightingGuideEntry(categoryId, tierId) {
  const cat = AREA_LIGHTING_GUIDE.find(c => c.id === categoryId)
  if (!cat) return null
  const tier = cat.tiers.find(t => t.id === tierId)
  if (!tier) return null
  return {
    category: cat.label,
    tier: tier.label,
    lux: tier.lux,
    uniformityAvg: tier.uniformityAvg,
    uniformityMax: tier.uniformityMax,
    glareMax: tier.glareMax,
    crossValidated: cat.crossValidated,
  }
}

/**
 * @param {Object} p
 * @param {string|number} p.areaWidth - m, the "distance across" the area to be lighted — used
 *   for the mounting-height/pole-spacing rule of thumb, NOT the same as p.areaLength
 * @param {string|number} p.areaLength - m, used only to compute total area for the lumen method
 * @param {string|number} p.lux - required illuminance. May come from the user's own judgement or
 *   from AREA_LIGHTING_GUIDE (see file header sourcing note — the guide is cross-validated
 *   secondary-source data, not a direct SANS 10389-1 citation)
 * @param {string|number} p.CU - coefficient of (beam) utilization
 * @param {string|number} p.MF - maintenance factor
 * @param {string|number} p.lumens - lumens per fitting
 * @param {string|number} p.watts - watts per fitting
 * @returns {{error:string}|{mountingHeight:number, poleSpacing:number, area:number, N:number,
 *   N_ceil:number, W:number, Wm2:number, lux_act:number, note:string}}
 */
export function areaLighting({ areaWidth, areaLength, lux, CU, MF, lumens, watts }) {
  const W = pf(areaWidth), L = pf(areaLength)
  if (!W || !L) return { error: 'Enter area width and length' }

  // Rule-of-thumb pole geometry — deliberately independent of areaLength (see JSDoc above).
  const mountingHeight = 0.5 * W
  const poleSpacing = 4 * mountingHeight

  const area = W * L
  const lighting = lightingLumenMethod({ area: String(area), lux, CU, MF, lumens, watts })
  if (!lighting) return { error: 'Enter required illuminance, coefficient of utilization, maintenance factor, and fitting output/wattage' }

  return {
    mountingHeight,
    poleSpacing,
    area,
    ...lighting,
    note: 'Mounting height and pole spacing are generic industry rule-of-thumb figures (mounting height ≈ half the distance across the lit area; spacing ≈ 4× mounting height) — not a SANS 10389-1 citation. This project does not have direct access to SANS 10389-1\'s actual exterior-lighting content. Verify against manufacturer photometric data or a qualified lighting designer for anything safety-critical.',
  }
}
