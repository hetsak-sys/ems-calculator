// overheadReticulationEngine.js — pure calculation functions for the new
// MV/LV Reticulation — Overhead module (§5.6.3), scoped 2026-07-26/27 and
// built engine-first per the project's standing pattern.
//
// SOURCING NOTE (per [AI-18]) — read before trusting any number in this file:
// SANS 10280-1 (the standard this module is named for) is a paywalled SABS
// publication. Its actual clause text could not be accessed for this build,
// same situation as Load Assessment's diversity-factor gap and Area
// Lighting's SANS 10389-1 gap. Rather than fabricate a citation, every
// number below comes from two independent, publicly accessible Eskom/NRS
// documents that implement SANS 10280-1 and NRS 033 for MV overhead
// distribution reticulation:
//   - DST_34-1191 (Eskom Distribution Standard, Part 4 Section 0 — General
//     Info & Requirements for Overhead Lines up to 33kV, Rev 1, Jan 2011)
//   - NRS 033:1996 (Guidelines for MV wood-pole overhead lines, 1kV–22kV)
// Both independently reproduce the same OHS Act Electrical Machinery
// Regulations (Reg. 15) clearance table — a genuine cross-check, not a
// single unverified transcription. This is a generic/secondary-sourced
// planning reference, same UI treatment as the fuse-curve and Area
// Lighting precedents — NOT a primary SANS 10280-1 citation. If stricter
// verification is ever needed, SANS 10280-1:2017 is purchasable via SABS/
// Van Schaik.
//
// SCOPE: MV/LV distribution reticulation up to 33 kV, wood-pole
// construction only, per the §5.1 checklist confirmed 2026-07-27.
// Voltages above 33 kV are transmission-class (steel lattice/tower
// structures under SANS 60826, a different design standard entirely,
// administered by a different part of the utility) and are explicitly
// out of scope — see clearanceLookup()'s outOfScope branch.
// Sag-tension catenary mechanics (wind/ice loading, span mechanics) are
// ALSO explicitly deferred — this module is field-quick reference tables
// and the verified electrical-span formula only, not a structural design tool.

function pf(v) { return parseFloat(String(v).replace(',', '.')) }

// ---------------------------------------------------------------------
// Conductor Sizing (Overhead) — Table 7, DST_34-1191
// Bare ACSR/AAAC conductors for MV/LV overhead reticulation. Distinct from
// Cable module's insulated-conductor derating — no insulation, no derating
// factors apply; current ratings below are the standard's own @75°C figures.
// ---------------------------------------------------------------------
export const CONDUCTORS = {
  magpie:  { type: 'ACSR (Extra Strong)', stranding: '3/4/2.118', areaMM2: 24.71,  diaMM: 6.65,  massKgKm: 139.7, breakingLoadKg: 1893, ratingA: 78 },
  squirrel:{ type: 'ACSR',                stranding: '6/1/2.11',  areaMM2: 24.48,  diaMM: 6.33,  massKgKm: 85.2,  breakingLoadKg: 818,  ratingA: 110 },
  fox:     { type: 'ACSR',                stranding: '6/1/2.79',  areaMM2: 42.8,   diaMM: 8.37,  massKgKm: 149,   breakingLoadKg: 1340, ratingA: 155 },
  mink:    { type: 'ACSR',                stranding: '6/1/3.66',  areaMM2: 73.65,  diaMM: 10.98, massKgKm: 257,   breakingLoadKg: 2230, ratingA: 215 },
  hare:    { type: 'ACSR',                stranding: '6/1/4.72',  areaMM2: 122.48, diaMM: 14.16, massKgKm: 427,   breakingLoadKg: 3670, ratingA: 290 },
  acacia:  { type: 'AAAC',                stranding: '7/2.08',    areaMM2: 23.79,  diaMM: 6.24,  massKgKm: 65,    breakingLoadKg: 682,  ratingA: 110 },
  aaac35:  { type: 'AAAC',                stranding: '7/2.77',    areaMM2: 42.18,  diaMM: 8.31,  massKgKm: 115,   breakingLoadKg: 1210, ratingA: 155 },
  pine:    { type: 'AAAC',                stranding: '7/3.61',    areaMM2: 71.65,  diaMM: 10.83, massKgKm: 196,   breakingLoadKg: 2060, ratingA: 215 },
  oak:     { type: 'AAAC',                stranding: '7/4.65',    areaMM2: 118.9,  diaMM: 13.95, massKgKm: 325,   breakingLoadKg: 3400, ratingA: 290 },
}

/**
 * Look up standard conductor properties by code name (e.g. "Hare", "Oak").
 * @param {string} code
 * @returns {Object|null}
 */
export function conductorLookup(code) {
  if (!code) return null
  const key = String(code).trim().toLowerCase()
  const c = CONDUCTORS[key]
  if (!c) return null
  return {
    name: key.charAt(0).toUpperCase() + key.slice(1),
    ...c,
    standard: 'DST_34-1191 Table 7 (Eskom Distribution Standard, implementing SANS 182-1/2/3 conductor specs)',
  }
}

// ---------------------------------------------------------------------
// Clearances — Table 8, DST_34-1191 / NRS 033 Table 4
// Minimum clearances for bare MV overhead lines, sourced from the OHS Act
// Electrical Machinery Regulations (Reg. 15), cross-verified in both docs.
// ---------------------------------------------------------------------
export const CLEARANCE_BANDS = [
  { maxKV: 1.1, groundOutsideM: 4.9, groundTownshipM: 5.5, roadsRailM: 6.1, commsOtherLinesM: 0.6, buildingsM: 3.0 },
  { maxKV: 7.2, groundOutsideM: 5.0, groundTownshipM: 5.5, roadsRailM: 6.2, commsOtherLinesM: 0.7, buildingsM: 3.0 },
  { maxKV: 12,  groundOutsideM: 5.1, groundTownshipM: 5.5, roadsRailM: 6.3, commsOtherLinesM: 0.8, buildingsM: 3.0 },
  { maxKV: 24,  groundOutsideM: 5.2, groundTownshipM: 5.5, roadsRailM: 6.4, commsOtherLinesM: 0.9, buildingsM: 3.0 },
  { maxKV: 33,  groundOutsideM: 5.3, groundTownshipM: 5.5, roadsRailM: 6.6, commsOtherLinesM: 1.0, buildingsM: 3.0 },
]

/**
 * Minimum clearances (ground, roads/rail, comms/other lines, buildings)
 * for a given nominal MV overhead line voltage, up to 33 kV.
 * @param {string|number} voltageKVInput
 * @returns {Object|null}
 */
export function clearanceLookup(voltageKVInput) {
  const voltageKV = pf(voltageKVInput)
  if (isNaN(voltageKV) || voltageKV <= 0) return null

  if (voltageKV > 33) {
    return {
      outOfScope: true,
      message: 'Voltages above 33 kV are transmission-class (steel lattice/tower structures under SANS 60826) — outside the scope of this MV/LV wood-pole distribution module.',
    }
  }

  const band = CLEARANCE_BANDS.find(b => voltageKV <= b.maxKV) || CLEARANCE_BANDS[CLEARANCE_BANDS.length - 1]
  return {
    voltageBandKV: band.maxKV,
    groundOutsideTownshipM: band.groundOutsideM,
    groundInsideTownshipM: band.groundTownshipM,
    aboveRoadsRailM: band.roadsRailM,
    toCommsOtherLinesM: band.commsOtherLinesM,
    toBuildingsM: band.buildingsM,
    standard: 'OHS Act Electrical Machinery Regulations Reg. 15, as reproduced in DST_34-1191 Table 8 and NRS 033:1996 Table 4 (cross-verified — both independently cite the same regulation)',
  }
}

/**
 * Structure-level (at-the-pole) minimum phase clearances. ONLY verified for
 * 33 kV per DST_34-1191 §4.11.4 — 11kV/22kV structure clearances were not
 * found in accessible source text and are deliberately NOT fabricated here.
 * @param {string|number} voltageKVInput
 * @returns {Object|null}
 */
export function structureClearance(voltageKVInput) {
  const voltageKV = pf(voltageKVInput)
  if (isNaN(voltageKV) || voltageKV <= 0) return null

  if (Math.round(voltageKV) === 33) {
    return {
      verified: true,
      phaseToEarthMM: 430,
      phaseToPhaseMM: 500,
      standard: 'DST_34-1191 §4.11.4 (33 kV structure minimum clearances)',
    }
  }
  return {
    verified: false,
    message: 'Structure (at-pole) phase clearances for this voltage were not found in accessible source text — only 33 kV values are verified. Consult a registered SANS 10280-1 copy directly, or use the electrical span/phase-spacing calculation for 22 kV.',
  }
}

// ---------------------------------------------------------------------
// Pole Spacing (rule-of-thumb) — §4.5.11, DST_34-1191
// Electrical span/phase-spacing formula. ONLY the C=0.4m constant for 22kV
// was found in accessible source text — deliberately not extrapolated to
// other voltages. This is NOT a sag-tension/structural span calculation
// (that's explicitly deferred per the §5.1 scope decision) — it only
// relates conductor swing under wind to the phase spacing needed at the
// pole top for a given span.
// ---------------------------------------------------------------------

/**
 * @param {Object} p
 * @param {string|number} p.spanM     - span length, m
 * @param {string|number} p.angleDeg  - conductor swing angle from horizontal, degrees
 * @param {string|number} p.voltageKV - nominal voltage, kV (only 22kV verified)
 * @returns {Object|null}
 */
export function phaseSpacing({ spanM, angleDeg, voltageKV } = {}) {
  const span = pf(spanM)
  const angle = pf(angleDeg)
  const voltage = pf(voltageKV)
  if (isNaN(span) || span <= 0) return null
  if (isNaN(angle)) return null

  if (isNaN(voltage) || Math.round(voltage) !== 22) {
    return {
      verified: false,
      message: 'The span/spacing formula\'s clearance constant (C) is only verified for 22 kV in accessible source text. Enter 22 kV to use this calculation, or consult a registered SANS 10280-1 copy for other voltages.',
    }
  }

  const L = span / 1000 // km
  const thetaRad = (angle * Math.PI) / 180
  const C = 0.4 // m, 22kV verified constant (DST_34-1191 §4.5.11)
  const requiredSpacingM = L * (4 * Math.pow(Math.cos(thetaRad), 4) + 1) + C

  return {
    verified: true,
    requiredSpacingM: Math.round(requiredSpacingM * 1000) / 1000,
    belowMinSpanFloor: span < 50, // DST_34-1191 §4.5.10.2(j) design floor
    standard: 'DST_34-1191 §4.5.11 electrical span/phase-spacing formula, C=0.4m verified for 22 kV',
  }
}
