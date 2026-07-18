/**
 * Manual sanity checks for pvArraySizing.js.
 * Not a formal test suite (none exists yet for this project — see debt
 * register). These are TST-2-priority-1-style checks run once to verify
 * the engine before it's trusted, per DBT-4 (domain-logic correctness is
 * non-negotiable even where the broader test suite is still debt).
 *
 * Panel values below are representative of a common 450W monocrystalline
 * module datasheet (typical figures, not a specific real product — for
 * verifying the ENGINE's arithmetic, not for real design use).
 */
import {
  estimateCellTemperature,
  correctedVoc,
  correctedVmp,
  correctedIsc,
  maxPanelsInSeries,
  minPanelsInSeries,
  maxStringsInParallel,
  requiredArrayPowerWp,
  designStringConfiguration,
} from './pvArraySizing.js';

const panel = {
  wattage: 450,
  vocStc: 49.5,
  vmpStc: 41.5,
  iscStc: 11.5,
  tempCoeffVocPctPerC: -0.27,
  tempCoeffVmpPctPerC: -0.35,
  tempCoeffIscPctPerC: 0.05,
  noctC: 45,
};

// Typical 5kW string inverter with 2 MPPT inputs
const inverter = {
  maxDcVoltage: 600,
  mpptMinVoltage: 120,
  maxInputCurrent: 15, // per MPPT input
};

// Maseru-ish design temps (illustrative, NOT a verified regional dataset —
// exactly the kind of input this engine expects the user/site to supply)
const site = {
  designMinAmbientTempC: -5,
  designMaxAmbientTempC: 35,
};

function assert(label, condition) {
  console.log(`${condition ? 'PASS' : 'FAIL'} - ${label}`);
  if (!condition) process.exitCode = 1;
}

console.log('--- Cell temperature estimate ---');
const cellTempHot = estimateCellTemperature(35, 45, 1000);
console.log(`Cell temp at 35°C ambient, NOCT 45: ${cellTempHot.toFixed(1)}°C`);
assert('Cell temp is hotter than ambient under full sun', cellTempHot > 35);

console.log('\n--- Voc correction (cold extreme) ---');
const vocCold = correctedVoc(panel.vocStc, panel.tempCoeffVocPctPerC, -5);
console.log(`Voc at -5°C: ${vocCold.toFixed(2)} V (STC: ${panel.vocStc} V)`);
assert('Voc rises above STC value when cold', vocCold > panel.vocStc);

console.log('\n--- Vmp correction (hot extreme) ---');
const vmpHot = correctedVmp(panel.vmpStc, panel.tempCoeffVmpPctPerC, cellTempHot);
console.log(`Vmp at ${cellTempHot.toFixed(1)}°C cell temp: ${vmpHot.toFixed(2)} V (STC: ${panel.vmpStc} V)`);
assert('Vmp drops below STC value when hot', vmpHot < panel.vmpStc);

console.log('\n--- Series string bounds ---');
const maxSeries = maxPanelsInSeries(
  inverter.maxDcVoltage,
  panel.vocStc,
  panel.tempCoeffVocPctPerC,
  site.designMinAmbientTempC
);
console.log(`Max panels in series: ${maxSeries.maxPanelsSeries} (worst-case Voc ${maxSeries.worstCaseVoc.toFixed(1)} V)`);
assert('Max series count is plausible for a 600V inverter (roughly 10-13)', maxSeries.maxPanelsSeries >= 8 && maxSeries.maxPanelsSeries <= 14);

const minSeries = minPanelsInSeries(
  inverter.mpptMinVoltage,
  panel.vmpStc,
  panel.tempCoeffVmpPctPerC,
  site.designMaxAmbientTempC,
  panel.noctC
);
console.log(`Min panels in series: ${minSeries.minPanelsSeries} (worst-case Vmp ${minSeries.worstCaseVmp.toFixed(1)} V, cell temp ${minSeries.worstCaseCellTempC.toFixed(1)}°C)`);
assert('Min series count is below max series count (valid design window exists)', minSeries.minPanelsSeries <= maxSeries.maxPanelsSeries);
assert('Min series count is plausible (roughly 3-5 for a 120V MPPT floor)', minSeries.minPanelsSeries >= 2 && minSeries.minPanelsSeries <= 6);

console.log('\n--- Parallel string bound ---');
const parallelResult = maxStringsInParallel(
  inverter.maxInputCurrent,
  panel.iscStc,
  panel.tempCoeffIscPctPerC,
  site.designMaxAmbientTempC,
  panel.noctC
);
console.log(`Max strings in parallel: ${parallelResult.maxStringsParallel} (design current/string: ${parallelResult.designCurrentPerString.toFixed(2)} A)`);
assert('At least one string fits on a 15A MPPT input for an 11.5A Isc panel', parallelResult.maxStringsParallel >= 1);

console.log('\n--- Array sizing from load ---');
const requiredWp = requiredArrayPowerWp(10000, 5.2); // 10kWh/day load, 5.2 PSH
console.log(`Required array power for 10,000 Wh/day @ 5.2 PSH: ${requiredWp.toFixed(0)} Wp`);
const requiredPanelCount = Math.ceil(requiredWp / panel.wattage);
console.log(`  -> approx ${requiredPanelCount} x ${panel.wattage}W panels`);
assert('Required Wp is sensibly larger than the raw daily-load/PSH figure (derate applied)', requiredWp > 10000 / 5.2);

console.log('\n--- Full string configuration summary ---');
const full = designStringConfiguration(panel, inverter, site);
console.log(JSON.stringify(full, null, 2));
assert('No warnings for this compatible panel/inverter pairing', full.warnings.length === 0);

console.log('\n--- Incompatible pairing triggers a warning ---');
const badInverter = { ...inverter, mpptMinVoltage: 450 }; // unreasonably high floor
const badResult = designStringConfiguration(panel, badInverter, site);
console.log(JSON.stringify(badResult.warnings, null, 2));
assert('Incompatible pairing produces a warning, not a silent bad answer', badResult.warnings.length > 0);
