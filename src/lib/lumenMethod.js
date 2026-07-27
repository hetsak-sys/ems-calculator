// lumenMethod.js — generic photometric lumen-method calculation.
// Extracted from pqEngine.js (2026-07-26) per this project's standing
// convention: "any calculation appearing in more than one place gets
// extracted to src/lib immediately, with both call sites migrated in the
// same pass" (see debt.md / Hetsa_PowerSuite_Project_Knowledge.md §9).
// Needed by both Power Quality's interior Lighting tab (pqEngine.js,
// which imports and re-exports this) and Installation Design's Area
// Lighting tab (installationDesignEngine.js, which imports it directly).
//
// This extraction is bundled with one explicit, flagged bug fix (not a
// silent behavior change): the original pqEngine.js implementation used
// plain parseFloat() with no comma-decimal tolerance, matching the
// "recurring risk class" already documented in debt.md/§9 for other
// modules (GeneratorSizing.jsx's pf() helper, 2026-07-25). Every input
// here now goes through a comma-tolerant pf() that still returns NaN
// (not 0) for missing/garbage input, so the existing null-on-missing-
// input guard behaves identically for every currently-passing test —
// the only change in behavior is that "0,65"-style comma input now
// parses correctly instead of silently truncating.

/** Comma-tolerant numeric parse. Deliberately does NOT fall back to 0 on
 *  invalid input (unlike cableEngine.js's pf()) — this module's null-on-
 *  missing-input guard is isNaN-based, and some legitimate inputs here
 *  are 0 (e.g. CU/MF can't be 0, but callers elsewhere in this pattern
 *  may have valid-zero fields), so preserving NaN-on-invalid is required
 *  to avoid a "missing field silently becomes valid zero" defect. */
function pf(v) { return parseFloat(String(v).replace(',', '.')) }

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
  const A = pf(area), E = pf(lux)
  const cu = pf(CU), mf = pf(MF)
  const phi = pf(lumens), W = pf(watts)
  if ([A, E, cu, mf, phi, W].some(isNaN)) return null

  // Lumen method: N = (E × A) / (Φ × CU × MF)
  const N = (E * A) / (phi * cu * mf)
  const N_ceil = Math.ceil(N)
  const totalW = N_ceil * W
  const W_per_m2 = totalW / A
  const actual_lux = (N_ceil * phi * cu * mf) / A

  return { N, N_ceil, W: totalW, Wm2: W_per_m2, lux_act: actual_lux }
}
