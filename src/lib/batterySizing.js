/**
 * batterySizing.js
 * ------------------------------------------------------------------------
 * Battery bank + charge controller sizing engine — Phase 2 of the
 * Renewable Energy module.
 *
 * DESIGN NOTE [DES-1]: the core function (batteryBankSizingFromEnergy) is
 * deliberately generic — it takes "required usable energy" rather than
 * "daily load", so it can serve BOTH:
 *   - off-grid solar battery sizing (energy = daily load x autonomy days)
 *   - UPS backup sizing, as already exists in the Power Quality module
 *     (energy = average load x backup runtime hours)
 * This file does NOT modify PQCalculator.jsx or its existing UPS sizing —
 * that would be touching shipped code, a separate decision. The hook is
 * here for if/when that migration is decided on deliberately (recorded
 * as a recommendation, not executed unprompted).
 *
 * VERIFICATION STATUS (per AI-18):
 *   - Core capacity arithmetic (Wh -> Ah via DoD, efficiency, voltage):
 *     VERIFIED — standard battery-bank sizing arithmetic, chemistry-independent.
 *   - BATTERY_CHEMISTRY_PRESETS (DoD %, round-trip efficiency, max charge/
 *     discharge C-rate per chemistry): UNVERIFIED-FLAGGED. These are
 *     commonly-cited TYPICAL ranges, not pulled from any single
 *     manufacturer datasheet or standard. They exist as convenient
 *     starting defaults for the UI (e.g. a chemistry dropdown) — every
 *     real design should override them with the actual battery
 *     datasheet's figures. Do not let these silently stand in for a
 *     real spec.
 *   - CHARGE_CONTROLLER_SAFETY_FACTOR_DEFAULT (1.25): UNVERIFIED-FLAGGED,
 *     same caveat as the parallel-string safety factor in pvArraySizing.js
 *     — commonly used, not confirmed against SANS 10142-1/IEC 60364-7-712
 *     specifically. Kept as a SEPARATE named constant from
 *     PARALLEL_STRING_SAFETY_FACTOR_DEFAULT even though both currently
 *     default to 1.25 — they apply at different points in the system
 *     (per-string OCPD vs. total controller input current) and may need
 *     to diverge later; conflating them into one constant would hide that.
 *   - MPPT-vs-PWM recommendation: this is a design GUIDELINE, not a
 *     standard-derived rule. It's advisory text, never a pass/fail.
 * ------------------------------------------------------------------------
 */

/** UNVERIFIED-FLAGGED typical presets — see file header. Always let the
 *  UI override these with real datasheet values. */
export const BATTERY_CHEMISTRY_PRESETS = {
  leadAcidFlooded: { dodFraction: 0.50, roundTripEfficiency: 0.80, maxChargeCRate: 0.10, maxDischargeCRate: 0.20 },
  leadAcidAGM:     { dodFraction: 0.50, roundTripEfficiency: 0.85, maxChargeCRate: 0.20, maxDischargeCRate: 0.30 },
  leadAcidGel:     { dodFraction: 0.50, roundTripEfficiency: 0.80, maxChargeCRate: 0.10, maxDischargeCRate: 0.20 },
  lifepo4:         { dodFraction: 0.85, roundTripEfficiency: 0.95, maxChargeCRate: 0.50, maxDischargeCRate: 1.00 },
};

/** UNVERIFIED-FLAGGED — see file header. */
export const CHARGE_CONTROLLER_SAFETY_FACTOR_DEFAULT = 1.25;

/**
 * Core battery bank sizing from a required usable energy figure.
 * Generic — usable by off-grid solar, UPS backup, or any other
 * "need X Wh of usable energy out of the bank" scenario.
 *
 * requiredCapacityWh = requiredUsableEnergyWh / (dodFraction * roundTripEfficiency)
 *
 * @param {object} params
 * @param {number} params.requiredUsableEnergyWh - energy the bank must deliver, Wh
 * @param {number} params.dodFraction - max usable depth of discharge, 0-1 (e.g. 0.5 = 50%)
 * @param {number} params.systemVoltageV - nominal DC bus voltage (12/24/48V typical)
 * @param {number} [params.roundTripEfficiency=1] - battery round-trip efficiency, 0-1
 * @returns {{requiredCapacityWh: number, requiredCapacityAh: number}}
 */
export function batteryBankSizingFromEnergy({
  requiredUsableEnergyWh,
  dodFraction,
  systemVoltageV,
  roundTripEfficiency = 1,
}) {
  if (dodFraction <= 0 || dodFraction > 1) {
    throw new Error(`dodFraction must be in (0, 1], got ${dodFraction}`);
  }
  const requiredCapacityWh = requiredUsableEnergyWh / (dodFraction * roundTripEfficiency);
  const requiredCapacityAh = requiredCapacityWh / systemVoltageV;
  return { requiredCapacityWh: round2(requiredCapacityWh), requiredCapacityAh: round2(requiredCapacityAh) };
}

/**
 * Off-grid solar battery bank sizing wrapper: converts daily load +
 * autonomy days into a required-usable-energy figure, then calls the
 * shared core.
 *
 * @param {object} params
 * @param {number} params.dailyLoadWh - daily energy demand, Wh/day
 * @param {number} params.autonomyDays - days the bank must cover with zero solar input
 * @param {number} params.dodFraction - 0-1
 * @param {number} params.systemVoltageV
 * @param {number} [params.roundTripEfficiency=1]
 * @returns {{requiredUsableEnergyWh: number, requiredCapacityWh: number, requiredCapacityAh: number}}
 */
export function offGridBatteryBankSizing({
  dailyLoadWh,
  autonomyDays,
  dodFraction,
  systemVoltageV,
  roundTripEfficiency = 1,
}) {
  const requiredUsableEnergyWh = dailyLoadWh * autonomyDays;
  const core = batteryBankSizingFromEnergy({
    requiredUsableEnergyWh,
    dodFraction,
    systemVoltageV,
    roundTripEfficiency,
  });
  return { requiredUsableEnergyWh: round2(requiredUsableEnergyWh), ...core };
}

/**
 * Maximum continuous discharge current the load places on the battery bank,
 * checked against the battery's rated max discharge C-rate.
 *
 * @param {object} params
 * @param {number} params.peakLoadW - peak continuous load, W
 * @param {number} params.systemVoltageV
 * @param {number} params.bankCapacityAh - sized (or actual) bank capacity, Ah
 * @param {number} params.maxDischargeCRate - battery's max discharge C-rate, e.g. 0.2 = C/5
 * @returns {{loadCurrentA: number, batteryMaxDischargeCurrentA: number, withinLimit: boolean}}
 */
export function checkDischargeCurrent({ peakLoadW, systemVoltageV, bankCapacityAh, maxDischargeCRate }) {
  const loadCurrentA = peakLoadW / systemVoltageV;
  const batteryMaxDischargeCurrentA = bankCapacityAh * maxDischargeCRate;
  return {
    loadCurrentA: round2(loadCurrentA),
    batteryMaxDischargeCurrentA: round2(batteryMaxDischargeCurrentA),
    withinLimit: loadCurrentA <= batteryMaxDischargeCurrentA,
  };
}

/**
 * Charge controller sizing: required controller current rating from array
 * output, checked against the battery bank's max safe charge current.
 *
 * @param {object} params
 * @param {number} params.arrayMaxCurrentA - total array design current into the controller, A
 *   (for MPPT: this is DC array-side current; for PWM: same as array Isc-based current)
 * @param {number} params.bankCapacityAh
 * @param {number} params.maxChargeCRate - battery's max charge C-rate, e.g. 0.1 = C/10
 * @param {number} [params.safetyFactor=CHARGE_CONTROLLER_SAFETY_FACTOR_DEFAULT]
 * @returns {{requiredControllerRatingA: number, batteryMaxChargeCurrentA: number, warnings: string[]}}
 */
export function chargeControllerSizing({
  arrayMaxCurrentA,
  bankCapacityAh,
  maxChargeCRate,
  safetyFactor = CHARGE_CONTROLLER_SAFETY_FACTOR_DEFAULT,
}) {
  const requiredControllerRatingA = arrayMaxCurrentA * safetyFactor;
  const batteryMaxChargeCurrentA = bankCapacityAh * maxChargeCRate;

  const warnings = [];
  if (arrayMaxCurrentA > batteryMaxChargeCurrentA) {
    warnings.push(
      `Array can deliver up to ${round2(arrayMaxCurrentA)} A, but the battery bank's safe charge ` +
      `current is ${round2(batteryMaxChargeCurrentA)} A at this C-rate. A current-limiting/derated ` +
      `controller setting, or a larger bank, is needed — otherwise the bank is at risk of overcharge stress.`
    );
  }

  return {
    requiredControllerRatingA: round2(requiredControllerRatingA),
    batteryMaxChargeCurrentA: round2(batteryMaxChargeCurrentA),
    warnings,
  };
}

/**
 * Advisory MPPT-vs-PWM recommendation. GUIDELINE ONLY — not a standard-derived
 * rule, never treat as pass/fail.
 *
 * @param {number} arrayVmpV - array string Vmp (temperature-corrected, worst-case-hot recommended)
 * @param {number} systemVoltageV - battery bank nominal voltage
 * @returns {{recommendation: string, ratio: number}}
 */
export function recommendControllerType(arrayVmpV, systemVoltageV) {
  const ratio = arrayVmpV / systemVoltageV;
  let recommendation;
  if (ratio >= 1.3) {
    recommendation =
      'MPPT recommended — array Vmp is meaningfully above bank voltage; MPPT will harvest the ' +
      'voltage differential that a PWM controller would simply waste.';
  } else if (ratio >= 1.05) {
    recommendation =
      'MPPT still generally preferable, but PWM may be workable for a small/low-budget system ' +
      'given the modest voltage differential. Guideline only — check total system cost either way.';
  } else {
    recommendation =
      'Array Vmp is close to or below bank voltage — verify this pairing works at all; ' +
      'PWM (or MPPT) both need array Vmp comfortably above bank voltage to charge properly.';
  }
  return { recommendation, ratio: round2(ratio) };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
