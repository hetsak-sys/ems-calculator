// motorEngine.js — pure calculation functions extracted from MotorCalculator.jsx
// (2026-07-25, per debt.md's "no automated test suite for most modules" item).
//
// Each function here mirrors the exact formula previously embedded in the
// matching sub-tab's calculate() handler in MotorCalculator.jsx. No formulas
// were changed during extraction — this is a structural refactor only
// ([REF-1]/[REF-3]: behavior-neutral, tests written before any UI rewiring).
//
// Note: ContactorCalc/OverloadCalc sub-components in MotorCalculator.jsx are
// dead code (defined, never rendered — MOTOR_TABS 'qf' uses the imported
// ContactorOLR.jsx instead). Not extracted here; flagged in debt.md instead.

const SQRT3 = Math.sqrt(3)

/** Comma-tolerant numeric parse, matching the original inline `pf()` helper. */
export function pf(v) {
  return parseFloat(String(v).replace(',', '.')) || 0
}

// ── FLA (Full Load Current) ─────────────────────────────────────────────
/**
 * @param {Object} p
 * @param {'1ph'|'3ph'} p.phase
 * @param {'kw'|'hp'} p.inputType
 * @param {string|number} p.kw   - motor power in kW (used if inputType==='kw')
 * @param {string|number} p.hp   - motor power in HP (used if inputType==='hp')
 * @param {string|number} p.voltage
 * @param {string|number} p.pfVal - power factor
 * @param {string|number} p.eff   - efficiency, percent (e.g. 90)
 * @returns {{fla:number, kva:number, kvar:number, inputkW:number, startCurrent:number, ctRatio:number}|null}
 *          null if required inputs are missing/zero (matches original "Fill in all fields" guard)
 */
export function motorFla({ phase, inputType, kw, hp, voltage, pfVal, eff }) {
  const V = pf(voltage), PF = pf(pfVal), EFF = pf(eff) / 100
  const powerW = inputType === 'kw' ? pf(kw) * 1000 : pf(hp) * 745.7
  if (!powerW || !V || !PF || !EFF) return null
  const inputPower = powerW / EFF
  const fla = phase === '3ph' ? inputPower / (SQRT3 * V * PF) : inputPower / (V * PF)
  const kva = (phase === '3ph' ? SQRT3 * V * fla : V * fla) / 1000
  const kvar = kva * Math.sqrt(1 - PF * PF)
  const ctRatio = Math.ceil(fla * 1.25 / 5) * 5
  return { fla, kva, kvar, inputkW: inputPower / 1000, startCurrent: fla * 6, ctRatio }
}

// ── NewElec 327M motor protection relay settings ────────────────────────
/**
 * @param {Object} p
 * @param {string|number} p.fla
 * @param {string|number} p.ctP - CT primary rating
 * @param {string|number} p.starts - desired max starts/hour
 * @param {string|number} p.startTime - DOL start time, seconds
 * @returns {{loadRatio:number, maxLoadSetting:number, maxStarts:number, dial:number, mult:string, ct:string}|{error:string}}
 */
export function newElec327MSettings({ fla, ctP, starts, startTime }) {
  const FLA = pf(fla), CT = pf(ctP)
  if (!FLA || !CT) return { error: 'Enter FLA and CT primary' }
  if (FLA > CT) return { error: 'FLA cannot exceed CT primary rating' }
  const loadRatio = (FLA / CT) * 100
  const maxLoadSetting = Math.min(loadRatio * 1.10, 100)
  const ST = pf(startTime)
  let mult, dial
  if (ST <= 20) { mult = '×1'; dial = ST }
  else { mult = '×4'; dial = Number((ST / 4).toFixed(1)) }
  return {
    loadRatio, maxLoadSetting,
    maxStarts: Math.min(Math.max(pf(starts), 1), 20),
    dial, mult, ct: `${CT}/5`,
  }
}

// ── EPC MS1 sensitive core balance (earth leakage) relay ────────────────
export const MS1_SETTINGS = [30, 50, 100, 150, 200, 250, 300, 400, 500]

/**
 * @param {Object} p
 * @param {string|number} p.voltage - system L-L voltage
 * @param {string|number} [p.earthRes] - earth fault path resistance, Ω (optional)
 * @param {string|number} [p.cableLen] - protected cable length, m (optional)
 * @param {string|number} p.sensitivity - desired sensitivity, mA
 * @returns {{Vln:number, minFault:number|null, capLeakage:number|null, settingMa:number, instantaneous:number}|{error:string}}
 */
export function epcMs1Settings({ voltage, earthRes, cableLen, sensitivity }) {
  const V = pf(voltage)
  if (!V) return { error: 'Enter system voltage' }
  const Vln = V / SQRT3
  const RE = pf(earthRes)
  const L = pf(cableLen)
  const minFault = RE > 0 ? (Vln / RE * 1000) : null
  const C = L > 0 ? 0.4e-6 * (L / 1000) : 0
  const capLeakage = L > 0 ? (V * 2 * Math.PI * 50 * C * 1000) : null
  const settingMa = pf(sensitivity)
  const recommended = MS1_SETTINGS.find(s => s >= settingMa) || 500
  return { Vln, minFault, capLeakage, settingMa: recommended, instantaneous: Math.min(recommended * 4, 500) }
}

// ── MCCB/MCB motor branch circuit breaker sizing ─────────────────────────
export const MCCB_TRIPS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600]

/**
 * @param {Object} p
 * @param {string|number} p.fla
 * @param {string|number} p.startFactor - DOL=6, Star-Delta=2, Softstarter=3
 * @returns {{tripRating:number, minRating:number, magMin:number, magMax:number}|{error:string}}
 */
export function mccbBreakerSizing({ fla, startFactor }) {
  const FLA = pf(fla)
  if (!FLA) return { error: 'Enter FLA' }
  const minRating = FLA * 1.25
  const tripRating = MCCB_TRIPS.find(t => t >= minRating) || 1600
  const SF = pf(startFactor) || 6
  return { tripRating, minRating, magMin: FLA * SF * 1.2, magMax: FLA * SF * 1.5 }
}

// ── Motor starting voltage dip / reacceleration ──────────────────────────
/**
 * @param {Object} p
 * @param {string|number} p.motorKW
 * @param {string|number} p.voltage
 * @param {string|number} p.xfmrKVA
 * @param {string|number} p.pfVal
 * @param {string|number} p.eff - percent
 * @returns {{fla:number, startI:number, startKVA:number, voltageDip:number, voltageAtStart:number, torqueReduction:number, willStart:boolean}|{error:string}}
 */
export function motorReaccelerationVoltageDip({ motorKW, voltage, xfmrKVA, pfVal, eff }) {
  const KW = pf(motorKW), V = pf(voltage), KVA = pf(xfmrKVA), PF = pf(pfVal), EFF = pf(eff) / 100
  if (!KW || !V || !KVA) return { error: 'Enter motor kW, voltage, and transformer kVA' }
  const inputPower = KW / EFF
  const fla = inputPower * 1000 / (SQRT3 * V * PF)
  const startI = fla * 6 // DOL starting current
  const startKVA = (SQRT3 * V * startI) / 1000
  const Zt = 0.055 // typical 5.5% distribution transformer impedance
  // Voltage dip = (starting kVA) / (transformer kVA) × Zt × 100%
  const voltageDip = (startKVA / KVA) * Zt * 100
  const voltageAtStart = V * (1 - voltageDip / 100)
  // Available torque reduces as V²
  const torqueReduction = (voltageAtStart / V) ** 2 * 100
  const willStart = torqueReduction >= 60 // needs >60% torque for typical loads
  return { fla, startI, startKVA, voltageDip, voltageAtStart, torqueReduction, willStart }
}

// ── IE efficiency class comparison (IEC 60034-30-1) ──────────────────────
// Approximate efficiency (%) at rated load, 3ph 50Hz, by nominal kW.
export const IE_EFF = {
  IE1: { 0.75: 72.1, 1.1: 75.0, 1.5: 77.2, 2.2: 79.7, 3: 81.5, 4: 83.1, 5.5: 84.7, 7.5: 86.0, 11: 87.6, 15: 88.7, 18.5: 89.3, 22: 89.9, 30: 90.7, 37: 91.2, 45: 91.7, 55: 92.1, 75: 92.8, 90: 93.1, 110: 93.5, 132: 93.8, 160: 94.0, 200: 94.2 },
  IE2: { 0.75: 77.4, 1.1: 79.6, 1.5: 81.3, 2.2: 83.2, 3: 84.6, 4: 85.8, 5.5: 87.0, 7.5: 88.1, 11: 89.4, 15: 90.3, 18.5: 90.9, 22: 91.3, 30: 92.0, 37: 92.5, 45: 92.9, 55: 93.2, 75: 93.8, 90: 94.1, 110: 94.4, 132: 94.7, 160: 94.9, 200: 95.1 },
  IE3: { 0.75: 80.7, 1.1: 82.7, 1.5: 84.2, 2.2: 85.9, 3: 87.1, 4: 88.1, 5.5: 89.2, 7.5: 90.1, 11: 91.2, 15: 91.9, 18.5: 92.4, 22: 92.7, 30: 93.3, 37: 93.7, 45: 94.0, 55: 94.3, 75: 94.7, 90: 95.0, 110: 95.2, 132: 95.4, 160: 95.6, 200: 95.8 },
  IE4: { 0.75: 82.5, 1.1: 84.5, 1.5: 85.9, 2.2: 87.4, 3: 88.5, 4: 89.4, 5.5: 90.3, 7.5: 91.0, 11: 92.0, 15: 92.7, 18.5: 93.1, 22: 93.4, 30: 94.0, 37: 94.4, 45: 94.7, 55: 95.0, 75: 95.4, 90: 95.6, 110: 95.8, 132: 96.0, 160: 96.2, 200: 96.4 },
}

/** Nearest-kW-match lookup, matching the original findEff(). */
export function findEff(level, kw) {
  const sizes = Object.keys(IE_EFF[level]).map(Number).sort((a, b) => a - b)
  const closest = sizes.reduce((prev, curr) => Math.abs(curr - kw) < Math.abs(prev - kw) ? curr : prev)
  return IE_EFF[level][closest]
}

/**
 * @param {Object} p
 * @param {string|number} p.kw
 * @param {string|number} p.hoursPerYear
 * @param {string|number} p.tariff
 * @returns {Array<{level:string, eff:number, inputKW:number, annualKWh:number, annualCost:number, saving:number}>|{error:string}}
 */
export function ieEfficiencyComparison({ kw, hoursPerYear, tariff }) {
  const KW = pf(kw), H = pf(hoursPerYear), T = pf(tariff)
  if (!KW || !H || !T) return { error: 'Enter motor kW, operating hours, and tariff' }
  const levels = ['IE1', 'IE2', 'IE3', 'IE4']
  const results = levels.map(level => {
    const eff = findEff(level, KW) / 100
    const inputKW = KW / eff
    const annualKWh = inputKW * H
    const annualCost = annualKWh * T
    return { level, eff: eff * 100, inputKW, annualKWh, annualCost }
  })
  const ie1Cost = results[0].annualCost
  return results.map(r => ({ ...r, saving: ie1Cost - r.annualCost }))
}
