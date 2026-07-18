/**
 * generatorDerating.js
 * ------------------------------------------------------------------------
 * Generator altitude/temperature derating (ISO 8528-1) — shared core.
 *
 * EXTRACTED from GeneratorSizing.jsx, where this formula previously lived
 * inline, after it was also duplicated in RenewableEnergyCalculator.jsx's
 * Hybrid tab. Two copies of the same domain formula is exactly the
 * situation this project's standing practice says to fix immediately,
 * not defer — see the recorded decision in project conventions.
 *
 * Also now hosts GEN_SIZES (standard generator nameplate kVA list) for
 * the same reason: RenewableEnergyCalculator.jsx had its own local copy
 * that had already drifted out of sync (missing the 600-2000 kVA range)
 * before this extraction. One list, not two.
 *
 * Both GeneratorSizing.jsx and RenewableEnergyCalculator.jsx now import
 * this single function. If they ever need to diverge (e.g. a different
 * derating curve for a different generator class), that's a deliberate
 * decision to make explicitly, not something that happens by accident
 * because one copy got edited and the other didn't.
 *
 * VERIFICATION STATUS (per AI-18):
 *   - Formula itself (altitude -3%/500m above 1000m; temperature -1%/°C
 *     above 40°C): VERIFIED as behavior-identical to the original
 *     GeneratorSizing.jsx logic — see generatorDeratingMigration.verify.mjs.
 *     The derating percentages themselves are ISO 8528-1-derived
 *     conventions already in use in the shipped app; this extraction
 *     does not change or re-derive them, only relocates them.
 * ------------------------------------------------------------------------
 */

/** Standard generator nameplate kVA (IEC/ISO commercial sizes).
 *  Single source of truth — was duplicated (and had drifted) between
 *  GeneratorSizing.jsx and RenewableEnergyCalculator.jsx. */
export const GEN_SIZES = [
  10, 15, 20, 25, 30, 40, 50, 62.5, 75, 100,
  125, 150, 175, 200, 250, 300, 350, 400, 500,
  600, 750, 1000, 1250, 1500, 2000,
]

/**
 * Combined altitude + ambient temperature derating factor for a diesel
 * generator set, per ISO 8528-1 convention.
 *
 * @param {object} params
 * @param {number} params.altitudeM - site altitude, metres AMSL
 * @param {number} params.ambientTempC - site ambient temperature, °C
 * @returns {{altFactor: number, tempFactor: number, netFactor: number}}
 */
export function calculateGeneratorDerating({ altitudeM, ambientTempC }) {
  const altFactor = altitudeM > 1000 ? 1 - ((altitudeM - 1000) / 500) * 0.03 : 1
  const tempFactor = ambientTempC > 40 ? 1 - (ambientTempC - 40) * 0.01 : 1
  const netFactor = altFactor * tempFactor

  return { altFactor, tempFactor, netFactor }
}
