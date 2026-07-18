/**
 * Manual sanity checks for batterySizing.js. Same rationale as
 * pvArraySizing.test.mjs — no formal suite exists yet project-wide, but
 * domain-logic correctness (DBT-4) doesn't get to wait for that.
 */
import {
  batteryBankSizingFromEnergy,
  offGridBatteryBankSizing,
  checkDischargeCurrent,
  chargeControllerSizing,
  recommendControllerType,
  BATTERY_CHEMISTRY_PRESETS,
} from './batterySizing.js';

function assert(label, condition) {
  console.log(`${condition ? 'PASS' : 'FAIL'} - ${label}`);
  if (!condition) process.exitCode = 1;
}

console.log('--- Core capacity sizing ---');
const core = batteryBankSizingFromEnergy({
  requiredUsableEnergyWh: 5000,
  dodFraction: 0.5,
  systemVoltageV: 48,
  roundTripEfficiency: 0.85,
});
console.log(core);
// 5000 Wh usable / (0.5 * 0.85) = 11764.7 Wh raw capacity needed
assert('Raw capacity is larger than usable energy (DoD + efficiency losses accounted)', core.requiredCapacityWh > 5000);
assert('Ah figure matches Wh/V', Math.abs(core.requiredCapacityAh - core.requiredCapacityWh / 48) < 0.01);

console.log('\n--- Off-grid wrapper (lead-acid AGM preset) ---');
const preset = BATTERY_CHEMISTRY_PRESETS.leadAcidAGM;
const offGrid = offGridBatteryBankSizing({
  dailyLoadWh: 8000,
  autonomyDays: 2,
  dodFraction: preset.dodFraction,
  systemVoltageV: 48,
  roundTripEfficiency: preset.roundTripEfficiency,
});
console.log(offGrid);
assert('Usable energy = daily load x autonomy days', offGrid.requiredUsableEnergyWh === 16000);
assert('Capacity scales up correctly for 2-day autonomy vs 1-day', offGrid.requiredCapacityWh > core.requiredCapacityWh);

console.log('\n--- LiFePO4 needs less raw capacity than lead-acid for the same usable energy ---');
const lifepo4Preset = BATTERY_CHEMISTRY_PRESETS.lifepo4;
const lifepo4Result = batteryBankSizingFromEnergy({
  requiredUsableEnergyWh: 16000,
  dodFraction: lifepo4Preset.dodFraction,
  systemVoltageV: 48,
  roundTripEfficiency: lifepo4Preset.roundTripEfficiency,
});
console.log(`Lead-acid AGM raw capacity: ${offGrid.requiredCapacityWh} Wh`);
console.log(`LiFePO4 raw capacity: ${lifepo4Result.requiredCapacityWh} Wh`);
assert('LiFePO4 requires less raw capacity than lead-acid for same usable energy (higher DoD/efficiency)', lifepo4Result.requiredCapacityWh < offGrid.requiredCapacityWh);

console.log('\n--- Discharge current check ---');
const dischargeOk = checkDischargeCurrent({
  peakLoadW: 3000,
  systemVoltageV: 48,
  bankCapacityAh: offGrid.requiredCapacityAh,
  maxDischargeCRate: preset.maxDischargeCRate,
});
console.log(dischargeOk);
assert('Discharge current check runs without error', typeof dischargeOk.withinLimit === 'boolean');

const dischargeFail = checkDischargeCurrent({
  peakLoadW: 20000, // unrealistically high peak load for this bank
  systemVoltageV: 48,
  bankCapacityAh: offGrid.requiredCapacityAh,
  maxDischargeCRate: preset.maxDischargeCRate,
});
console.log(dischargeFail);
assert('Excessive peak load correctly flagged as exceeding discharge limit', dischargeFail.withinLimit === false);

console.log('\n--- Charge controller sizing ---');
const controllerOk = chargeControllerSizing({
  arrayMaxCurrentA: 20,
  bankCapacityAh: offGrid.requiredCapacityAh,
  maxChargeCRate: preset.maxChargeCRate,
});
console.log(controllerOk);
assert('Controller rating includes safety margin above raw array current', controllerOk.requiredControllerRatingA > 20);

console.log('\n--- Charge controller sizing: array too large for bank (should warn) ---');
const controllerWarn = chargeControllerSizing({
  arrayMaxCurrentA: 200, // way beyond what this bank can safely absorb
  bankCapacityAh: offGrid.requiredCapacityAh,
  maxChargeCRate: preset.maxChargeCRate,
});
console.log(controllerWarn.warnings);
assert('Oversized array vs. bank charge limit triggers a warning', controllerWarn.warnings.length > 0);

console.log('\n--- MPPT vs PWM recommendation ---');
const highRatio = recommendControllerType(70, 48); // Vmp well above bank voltage
console.log(highRatio);
assert('High Vmp:Vbank ratio recommends MPPT', highRatio.recommendation.startsWith('MPPT recommended'));

const lowRatio = recommendControllerType(50, 48); // Vmp close to bank voltage
console.log(lowRatio);
assert('Low ratio gives a caution, not a silent recommendation', lowRatio.recommendation.includes('close to or below') || lowRatio.recommendation.includes('MPPT still'));
