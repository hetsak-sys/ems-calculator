/**
 * pvArraySizing.js
 * ------------------------------------------------------------------------
 * PV array & string sizing engine — Phase 1 of the Renewable Energy module.
 *
 * Scope: electrical/standards design only (string voltage/current sizing,
 * array-to-load sizing). No shading/irradiance simulation — that is a
 * different software category (PVSyst/Helioscope class) and deliberately
 * out of scope per project decision.
 *
 * Standards context:
 *   - IEC 62548  : PV array design requirements (string sizing safety,
 *                  the temperature-correction methodology below).
 *   - IEC 60364-7-712 / SANS 10142-1 : PV installation electrical
 *                  requirements (overcurrent protection, cabling) —
 *                  NOT implemented here; this file only covers array
 *                  design, not the downstream cabling/OCPD sizing.
 *
 * [DES-5] Pure calculation functions only. No DB/DOM/network access.
 * [COR-3] All units explicit in parameter names and JSDoc.
 *
 * VERIFICATION STATUS (per AI-18 — read before trusting a number):
 *   - Temperature-correction math (Voc/Vmp vs temp coefficient, NOCT cell
 *     temp estimate): VERIFIED — standard photovoltaic engineering
 *     physics, independent of any specific paywalled standard text.
 *   - PARALLEL_STRING_SAFETY_FACTOR_DEFAULT (1.25): UNVERIFIED-FLAGGED.
 *     Commonly cited in PV design practice, but the widely-used "125%"
 *     figure traces to NEC 690.8 (a US code). It has NOT been confirmed
 *     against IEC 60364-7-712 / SANS 10142-1, which are the standards
 *     that actually govern overcurrent/cable sizing in this market.
 *     Exposed as an editable parameter, not hardcoded, for exactly this
 *     reason — confirm against SANS 10142-1 before this number is relied
 *     on for a real installation's overcurrent protection sizing.
 *   - SYSTEM_DERATE_FACTOR_DEFAULT (0.80): UNVERIFIED-FLAGGED. Industry
 *     rule-of-thumb (typical published ranges: 0.75-0.86), not sourced
 *     from IEC 62548 itself. Exposed as an editable input for the same
 *     reason.
 *   - Design ambient min/max temperatures: NOT looked up internally.
 *     This engine takes them as required inputs — it does not guess
 *     regional temperatures for Lesotho/SA sites. A future phase could
 *     add a regional design-temperature reference table (ASHRAE-style
 *     99.6%/0.4% design temps), but that is its own sourcing exercise,
 *     not silently baked in here.
 * ------------------------------------------------------------------------
 */

/** Default safety factor applied to Isc for parallel-string current sizing.
 *  UNVERIFIED-FLAGGED — see file header. Override with a confirmed
 *  SANS 10142-1 / IEC 60364-7-712 derived value once checked. */
export const PARALLEL_STRING_SAFETY_FACTOR_DEFAULT = 1.25;

/** Default combined system derate (soiling, wiring, mismatch, inverter
 *  efficiency). UNVERIFIED-FLAGGED — see file header. */
export const SYSTEM_DERATE_FACTOR_DEFAULT = 0.80;

/**
 * Estimate PV cell temperature from ambient temperature using the
 * NOCT (Nominal Operating Cell Temperature) method.
 *
 * Tcell = Tambient + (NOCT - 20) / 800 * irradianceWm2
 *
 * @param {number} ambientTempC - ambient air temperature, °C
 * @param {number} noctC - module's NOCT rating from datasheet, °C (typ. ~42-48°C)
 * @param {number} [irradianceWm2=1000] - irradiance, W/m² (1000 = STC-equivalent full sun)
 * @returns {number} estimated cell temperature, °C
 */
export function estimateCellTemperature(ambientTempC, noctC, irradianceWm2 = 1000) {
  return ambientTempC + ((noctC - 20) / 800) * irradianceWm2;
}

/**
 * Temperature-corrected open-circuit voltage (Voc) at a given cell temperature.
 * Used for the COLD extreme (sets max panels in series).
 *
 * Voc(T) = VocSTC * (1 + tempCoeffVocPctPerC / 100 * (T - 25))
 * tempCoeffVocPctPerC is negative for silicon PV (Voc rises as temp drops).
 *
 * @param {number} vocStc - Voc at STC (25°C), volts, from datasheet
 * @param {number} tempCoeffVocPctPerC - datasheet temp coefficient of Voc, %/°C (negative)
 * @param {number} cellTempC - cell temperature to correct to, °C
 * @returns {number} corrected Voc, volts
 */
export function correctedVoc(vocStc, tempCoeffVocPctPerC, cellTempC) {
  return vocStc * (1 + (tempCoeffVocPctPerC / 100) * (cellTempC - 25));
}

/**
 * Temperature-corrected voltage at max power (Vmp) at a given cell temperature.
 * Used for the HOT extreme (sets min panels in series, MPPT window floor).
 *
 * @param {number} vmpStc - Vmp at STC (25°C), volts, from datasheet
 * @param {number} tempCoeffVmpPctPerC - datasheet temp coefficient of Vmp (or Pmax), %/°C (negative)
 * @param {number} cellTempC - cell temperature to correct to, °C
 * @returns {number} corrected Vmp, volts
 */
export function correctedVmp(vmpStc, tempCoeffVmpPctPerC, cellTempC) {
  return vmpStc * (1 + (tempCoeffVmpPctPerC / 100) * (cellTempC - 25));
}

/**
 * Temperature-corrected short-circuit current (Isc) at a given cell temperature.
 * Isc rises slightly with temperature (positive coefficient).
 *
 * @param {number} iscStc - Isc at STC, amps, from datasheet
 * @param {number} tempCoeffIscPctPerC - datasheet temp coefficient of Isc, %/°C (positive, small)
 * @param {number} cellTempC - cell temperature to correct to, °C
 * @returns {number} corrected Isc, amps
 */
export function correctedIsc(iscStc, tempCoeffIscPctPerC, cellTempC) {
  return iscStc * (1 + (tempCoeffIscPctPerC / 100) * (cellTempC - 25));
}

/**
 * Maximum panels allowed in series (cold-temperature Voc constraint).
 * Cell temp at cold extreme is approximated as ambient (low-irradiance,
 * dawn/cold-clear conditions — negligible self-heating above ambient).
 *
 * @param {number} inverterMaxDcVoltage - inverter/charge-controller max DC input voltage, V
 * @param {number} vocStc - panel Voc at STC, V
 * @param {number} tempCoeffVocPctPerC - panel temp coefficient of Voc, %/°C
 * @param {number} designMinAmbientTempC - site design minimum ambient temperature, °C
 * @returns {{maxPanelsSeries: number, wortsCaseVoc: number}}
 */
export function maxPanelsInSeries(
  inverterMaxDcVoltage,
  vocStc,
  tempCoeffVocPctPerC,
  designMinAmbientTempC
) {
  const worstCaseVoc = correctedVoc(vocStc, tempCoeffVocPctPerC, designMinAmbientTempC);
  const maxPanelsSeries = Math.floor(inverterMaxDcVoltage / worstCaseVoc);
  return { maxPanelsSeries, worstCaseVoc };
}

/**
 * Minimum panels required in series (hot-temperature Vmp / MPPT floor constraint).
 *
 * @param {number} mpptMinVoltage - inverter/charge-controller MPPT tracking min voltage, V
 * @param {number} vmpStc - panel Vmp at STC, V
 * @param {number} tempCoeffVmpPctPerC - panel temp coefficient of Vmp (or Pmax), %/°C
 * @param {number} designMaxAmbientTempC - site design maximum ambient temperature, °C
 * @param {number} noctC - panel NOCT rating, °C
 * @returns {{minPanelsSeries: number, worstCaseCellTempC: number, worstCaseVmp: number}}
 */
export function minPanelsInSeries(
  mpptMinVoltage,
  vmpStc,
  tempCoeffVmpPctPerC,
  designMaxAmbientTempC,
  noctC
) {
  const worstCaseCellTempC = estimateCellTemperature(designMaxAmbientTempC, noctC, 1000);
  const worstCaseVmp = correctedVmp(vmpStc, tempCoeffVmpPctPerC, worstCaseCellTempC);
  const minPanelsSeries = Math.ceil(mpptMinVoltage / worstCaseVmp);
  return { minPanelsSeries, worstCaseCellTempC, worstCaseVmp };
}

/**
 * Maximum parallel strings allowed on one inverter/charge-controller MPPT input,
 * bounded by max input current.
 *
 * @param {number} inverterMaxInputCurrent - max DC input current for the MPPT/CC input, A
 * @param {number} iscStc - panel Isc at STC, A
 * @param {number} tempCoeffIscPctPerC - panel temp coefficient of Isc, %/°C
 * @param {number} designMaxAmbientTempC - site design max ambient temp, °C
 * @param {number} noctC - panel NOCT rating, °C
 * @param {number} [safetyFactor=PARALLEL_STRING_SAFETY_FACTOR_DEFAULT] - UNVERIFIED-FLAGGED, see header
 * @returns {{maxStringsParallel: number, designCurrentPerString: number}}
 */
export function maxStringsInParallel(
  inverterMaxInputCurrent,
  iscStc,
  tempCoeffIscPctPerC,
  designMaxAmbientTempC,
  noctC,
  safetyFactor = PARALLEL_STRING_SAFETY_FACTOR_DEFAULT
) {
  const cellTempC = estimateCellTemperature(designMaxAmbientTempC, noctC, 1000);
  const hotIsc = correctedIsc(iscStc, tempCoeffIscPctPerC, cellTempC);
  const designCurrentPerString = hotIsc * safetyFactor;
  const maxStringsParallel = Math.floor(inverterMaxInputCurrent / designCurrentPerString);
  return { maxStringsParallel, designCurrentPerString };
}

/**
 * Required array power (Wp) from daily energy demand.
 *
 * requiredArrayWp = dailyLoadWh / (peakSunHours * systemDerateFactor)
 *
 * @param {number} dailyLoadWh - daily energy demand, Wh/day
 * @param {number} peakSunHours - site peak sun hours, h/day (user/site-supplied, not looked up internally)
 * @param {number} [systemDerateFactor=SYSTEM_DERATE_FACTOR_DEFAULT] - UNVERIFIED-FLAGGED, see header
 * @returns {number} required array power, Wp
 */
export function requiredArrayPowerWp(
  dailyLoadWh,
  peakSunHours,
  systemDerateFactor = SYSTEM_DERATE_FACTOR_DEFAULT
) {
  return dailyLoadWh / (peakSunHours * systemDerateFactor);
}

/**
 * Full string design summary for a given panel + inverter/CC datasheet pair.
 * Combines all constraints above into one recommendation.
 *
 * @param {object} panel - { vocStc, vmpStc, iscStc, tempCoeffVocPctPerC, tempCoeffVmpPctPerC, tempCoeffIscPctPerC, noctC, wattage }
 * @param {object} inverter - { maxDcVoltage, mpptMinVoltage, maxInputCurrent }
 * @param {object} site - { designMinAmbientTempC, designMaxAmbientTempC }
 * @param {object} [options] - { safetyFactor }
 * @returns {object} full sizing result with warnings
 */
export function designStringConfiguration(panel, inverter, site, options = {}) {
  const { maxPanelsSeries, worstCaseVoc } = maxPanelsInSeries(
    inverter.maxDcVoltage,
    panel.vocStc,
    panel.tempCoeffVocPctPerC,
    site.designMinAmbientTempC
  );

  const { minPanelsSeries, worstCaseCellTempC, worstCaseVmp } = minPanelsInSeries(
    inverter.mpptMinVoltage,
    panel.vmpStc,
    panel.tempCoeffVmpPctPerC,
    site.designMaxAmbientTempC,
    panel.noctC
  );

  const { maxStringsParallel, designCurrentPerString } = maxStringsInParallel(
    inverter.maxInputCurrent,
    panel.iscStc,
    panel.tempCoeffIscPctPerC,
    site.designMaxAmbientTempC,
    panel.noctC,
    options.safetyFactor
  );

  const warnings = [];
  if (minPanelsSeries > maxPanelsSeries) {
    warnings.push(
      `No valid series count exists: minimum required (${minPanelsSeries}, hot-Vmp/MPPT floor) ` +
      `exceeds maximum allowed (${maxPanelsSeries}, cold-Voc ceiling). Panel/inverter pairing is incompatible.`
    );
  }
  if (maxStringsParallel < 1) {
    warnings.push('Inverter/MPPT max input current is too low for even one string of this panel.');
  }

  return {
    maxPanelsSeries,
    minPanelsSeries,
    maxStringsParallel,
    worstCaseVoc: round2(worstCaseVoc),
    worstCaseVmp: round2(worstCaseVmp),
    worstCaseCellTempC: round2(worstCaseCellTempC),
    designCurrentPerString: round2(designCurrentPerString),
    warnings,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
