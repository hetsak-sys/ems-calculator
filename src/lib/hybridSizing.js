/**
 * hybridSizing.js
 * ------------------------------------------------------------------------
 * Hybrid system sizing (battery bridge + generator backup) — Phase 4 of
 * the Renewable Energy module.
 *
 * SCOPE BOUNDARY: this is a SIZING calculation, not a dispatch/energy-
 * management simulator. It answers "how much battery bridge and generator
 * runtime does this design need", not "simulate hour-by-hour what the
 * system does" — the latter is control-system/EMS territory, out of
 * scope for the same reason full shading simulation was excluded from
 * the PV array module.
 *
 * MODULE BOUNDARY [DES-1]: this file does NOT import or call into
 * GeneratorSizing.jsx. It accepts a generator's rated output power and
 * fuel consumption rate as plain inputs — numbers that module already
 * produces (ISO 8528-1, altitude-derated for Maseru/Letseng-class
 * sites). Reading GeneratorSizing.jsx's internals is a separate task,
 * needed only when wiring the actual UI auto-population (analogous to
 * the existing Motor -> Cable FLA cross-module pattern), not for this
 * calculation engine itself.
 *
 * VERIFICATION STATUS (per AI-18):
 *   - Battery-bridge / deficit arithmetic: VERIFIED — direct energy
 *     bookkeeping (Wh in, Wh out), no chemistry- or standard-specific
 *     assumptions beyond what's already flagged in batterySizing.js.
 *   - "Low-sun day" solar output derate: NOT assumed internally. This
 *     engine takes dailySolarOutputWh (during a design low-sun period)
 *     as a REQUIRED input rather than guessing a derate percentage
 *     (e.g. "cloudy days produce 25% of clear-sky output") — that
 *     number varies by region/season and deserves a real source, not
 *     a silent default.
 *   - Generator output/fuel-consumption figures: NOT looked up or
 *     computed here — required inputs, sourced from the existing
 *     GeneratorSizing.jsx (ISO 8528-1) output.
 * ------------------------------------------------------------------------
 */

import { batteryBankSizingFromEnergy } from './batterySizing.js';

/**
 * Size the battery "bridge" — a smaller bank than full worst-case autonomy,
 * intended to cover a short period of underperforming solar before the
 * generator is expected to pick up the slack.
 *
 * @param {object} params
 * @param {number} params.dailyLoadWh - daily energy demand, Wh/day
 * @param {number} params.dailySolarOutputWh - expected array output on a design low-sun day, Wh/day
 *   (NOT computed here — supply a real derated figure, not a guessed percentage)
 * @param {number} params.bridgeDays - number of low-sun days the battery alone should cover
 * @param {number} params.dodFraction - battery max depth of discharge, 0-1
 * @param {number} params.systemVoltageV
 * @param {number} [params.roundTripEfficiency=1]
 * @returns {{dailyDeficitWh: number, requiredUsableEnergyWh: number, requiredCapacityWh: number, requiredCapacityAh: number}}
 */
export function batteryBridgeSizing({
  dailyLoadWh,
  dailySolarOutputWh,
  bridgeDays,
  dodFraction,
  systemVoltageV,
  roundTripEfficiency = 1,
}) {
  const dailyDeficitWh = Math.max(dailyLoadWh - dailySolarOutputWh, 0);
  const requiredUsableEnergyWh = dailyDeficitWh * bridgeDays;

  const core = batteryBankSizingFromEnergy({
    requiredUsableEnergyWh,
    dodFraction,
    systemVoltageV,
    roundTripEfficiency,
  });

  return { dailyDeficitWh: round2(dailyDeficitWh), requiredUsableEnergyWh: round2(requiredUsableEnergyWh), ...core };
}

/**
 * Energy the generator must supply over an extended low-sun period,
 * beyond what the battery bridge absorbs.
 *
 * @param {object} params
 * @param {number} params.dailyLoadWh
 * @param {number} params.dailySolarOutputWh - design low-sun day output
 * @param {number} params.batteryUsableCapacityWh - usable (post-DoD) battery bridge capacity
 * @param {number} params.extendedLowSunDays - total low-sun period to design against (>= bridgeDays used for the battery)
 * @returns {{totalDeficitWh: number, generatorEnergyRequiredWh: number, daysBatteryCanBridgeAlone: number}}
 */
export function generatorEnergyDeficit({
  dailyLoadWh,
  dailySolarOutputWh,
  batteryUsableCapacityWh,
  extendedLowSunDays,
}) {
  const dailyDeficitWh = Math.max(dailyLoadWh - dailySolarOutputWh, 0);
  const totalDeficitWh = dailyDeficitWh * extendedLowSunDays;
  const generatorEnergyRequiredWh = Math.max(totalDeficitWh - batteryUsableCapacityWh, 0);
  const daysBatteryCanBridgeAlone = dailyDeficitWh > 0 ? batteryUsableCapacityWh / dailyDeficitWh : Infinity;

  return {
    totalDeficitWh: round2(totalDeficitWh),
    generatorEnergyRequiredWh: round2(generatorEnergyRequiredWh),
    daysBatteryCanBridgeAlone: round2(daysBatteryCanBridgeAlone),
  };
}

/**
 * Generator runtime (and optionally fuel) needed to supply a given energy
 * deficit. Generator output/fuel-consumption figures are REQUIRED INPUTS —
 * sourced from the existing GeneratorSizing.jsx (ISO 8528-1), not computed
 * or assumed here.
 *
 * @param {object} params
 * @param {number} params.energyWh - energy the generator must supply, Wh
 * @param {number} params.generatorOutputW - generator's usable output power at this load, W
 *   (already altitude/derating-adjusted — see GeneratorSizing.jsx)
 * @param {number} [params.chargeEfficiency=1] - charger/conversion efficiency, 0-1
 * @param {number} [params.fuelConsumptionLPerHour] - optional, from generator's fuel curve at this load
 * @returns {{runHours: number, fuelRequiredL: number|null}}
 */
export function generatorRunHoursForEnergy({
  energyWh,
  generatorOutputW,
  chargeEfficiency = 1,
  fuelConsumptionLPerHour,
}) {
  const runHours = energyWh / (generatorOutputW * chargeEfficiency);
  const fuelRequiredL =
    typeof fuelConsumptionLPerHour === 'number' ? round2(runHours * fuelConsumptionLPerHour) : null;

  return { runHours: round2(runHours), fuelRequiredL };
}

/**
 * Full hybrid design summary tying the pieces above together.
 *
 * @param {object} params - union of batteryBridgeSizing + generatorEnergyDeficit + generator specs
 * @returns {object} combined result with warnings
 */
export function hybridSystemSummary({
  dailyLoadWh,
  dailySolarOutputWh,
  bridgeDays,
  extendedLowSunDays,
  dodFraction,
  systemVoltageV,
  roundTripEfficiency = 1,
  generatorOutputW,
  chargeEfficiency = 1,
  fuelConsumptionLPerHour,
}) {
  const warnings = [];

  if (extendedLowSunDays < bridgeDays) {
    warnings.push(
      `extendedLowSunDays (${extendedLowSunDays}) is less than bridgeDays (${bridgeDays}) — ` +
      `the generator design period should cover at least as many days as the battery bridge, ` +
      `otherwise the generator sizing understates what the battery bridge alone was meant to handle.`
    );
  }

  const battery = batteryBridgeSizing({
    dailyLoadWh,
    dailySolarOutputWh,
    bridgeDays,
    dodFraction,
    systemVoltageV,
    roundTripEfficiency,
  });

  const deficit = generatorEnergyDeficit({
    dailyLoadWh,
    dailySolarOutputWh,
    batteryUsableCapacityWh: battery.requiredUsableEnergyWh,
    extendedLowSunDays,
  });

  const runtime = generatorRunHoursForEnergy({
    energyWh: deficit.generatorEnergyRequiredWh,
    generatorOutputW,
    chargeEfficiency,
    fuelConsumptionLPerHour,
  });

  if (runtime.runHours > 24 * (extendedLowSunDays - bridgeDays + 1)) {
    warnings.push(
      'Required generator runtime is large relative to the design period — the supplied generator ' +
      'output rating may be too small for this deficit, or bridgeDays/extendedLowSunDays need revisiting.'
    );
  }

  return { battery, deficit, runtime, warnings };
}

/**
 * Adapter: converts GeneratorSizing.jsx's calculation result into the
 * `generatorOutputW` input this file's functions expect.
 *
 * IMPORTANT: GeneratorSizing.jsx deliberately selects a nameplate size
 * (`stdSize`) LARGER than the raw requirement, specifically to absorb
 * altitude/temperature derating (`netFactor`) — it divides by netFactor
 * before rounding up to a standard size. That means `stdSize` itself is
 * NOT the usable output at site conditions; the derated output
 * (`stdSize x netFactor`) is. Using `stdSize` directly here would
 * overstate the generator's real output and understate required
 * runtime/fuel — this adapter exists specifically to avoid that mistake.
 *
 * This does NOT import or call GeneratorSizing.jsx — it just accepts
 * the shape of its `genRes` calculation result as a plain object,
 * keeping the module boundary clean [DES-1].
 *
 * @param {object} genRes - GeneratorSizing.jsx's genRes: { stdSize, netFactor, gpf, ... }
 * @returns {{nameplateKVA: number, deratedOutputKVA: number, deratedOutputW: number}}
 */
export function generatorOutputFromSizingResult({ stdSize, netFactor, gpf }) {
  const deratedOutputKVA = stdSize * netFactor;
  const deratedOutputW = deratedOutputKVA * gpf * 1000;
  return {
    nameplateKVA: stdSize,
    deratedOutputKVA: round2(deratedOutputKVA),
    deratedOutputW: round2(deratedOutputW),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
