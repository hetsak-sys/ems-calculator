// contactorOlrEngine.js — pure calculation functions extracted from ContactorOLR.jsx
// (2026-07-25, per debt.md's "no automated test suite for most modules" item).
// Formulas and reference tables copied exactly from the original inline
// calculate() handler — no numeric changes.

const SQRT3 = Math.sqrt(3)

// AC-3 standard contactor ratings with manufacturer cross-reference
// [AC3_rating_A, Schneider_TeSys_D, Eaton_XT, Siemens_SIRIUS, AB_100C, frame_note]
export const CONTACTOR_SIZES = [
  [9,   'LC1D09',  'XTCE009B', '3RT2015', '100-C09',  'Frame B (45mm)'],
  [12,  'LC1D12',  'XTCE009B', '3RT2016', '100-C12',  'Frame B (45mm)'],
  [16,  'LC1D18',  'XTCE012B', '3RT2023', '100-C16',  'Frame B (45mm)'],
  [18,  'LC1D18',  'XTCE018B', '3RT2023', '100-C16',  'Frame B (45mm)'],
  [25,  'LC1D25',  'XTCE025C', '3RT2025', '100-C23',  'Frame C (45mm)'],
  [32,  'LC1D32',  'XTCE032C', '3RT2027', '100-C30',  'Frame C (45mm)'],
  [40,  'LC1D40',  'XTCE038C', '3RT2035', '100-C37',  'Frame C (45mm)'],
  [50,  'LC1D50',  'XTCE050C', '3RT2036', '100-C43',  'Frame C (45mm)'],
  [65,  'LC1D65',  'XTCE065D', '3RT2037', '100-C55',  'Frame D (55mm)'],
  [80,  'LC1D80',  'XTCE080D', '3RT2038', '100-C60',  'Frame D (55mm)'],
  [95,  'LC1D95',  'XTCE096D', '3RT2045', '100-C72',  'Frame D (55mm)'],
  [115, 'LC1D115', 'XTCE120D', '3RT2046', '100-C85',  'Frame D (55mm)'],
  [150, 'LC1D150', 'XTCE150G', '3RT2047', '100-C110', 'Frame G'],
  [185, 'LC1D185', 'XTCE175G', '3RT2148', '100-C140', 'Frame G'],
  [225, 'LC1D225', 'XTCE210G', '3RT2354', '100-C172', 'Frame G'],
  [265, 'LC1D265', 'XTCE250G', '3RT2354', '100-C210', 'Frame G'],
  [300, 'LC1D300', 'XTCE300G', '3RT2355', '100-C250', 'Frame G'],
  [400, 'LC1D400', 'XTCE350G', '3RT2356', '100-C310', 'Frame G'],
]

// Thermal OLR ranges with manufacturer references
// [range_min_A, range_max_A, Schneider_LRD, Eaton_XTOB, Siemens_3RU, fits_frame]
export const OLR_RANGES = [
  [0.63, 1.0,  'LRD01',  'XTOB001B', '3RU2116', 'B'],
  [1.0,  1.6,  'LRD02',  'XTOB002B', '3RU2116', 'B'],
  [1.6,  2.5,  'LRD03',  'XTOB002B', '3RU2116', 'B'],
  [2.5,  4.0,  'LRD04',  'XTOB004B', '3RU2116', 'B'],
  [4.0,  6.0,  'LRD10',  'XTOB004B', '3RU2116', 'B'],
  [5.5,  8.0,  'LRD12',  'XTOB006B', '3RU2116', 'B'],
  [7.0,  10.0, 'LRD14',  'XTOB009B', '3RU2116', 'B'],
  [9.0,  13.0, 'LRD16',  'XTOB012B', '3RU2116', 'B'],
  [12.0, 18.0, 'LRD21',  'XTOB016B', '3RU2126', 'B'],
  [16.0, 24.0, 'LRD22',  'XTOB025C', '3RU2126', 'C'],
  [23.0, 32.0, 'LRD332', 'XTOB032C', '3RU2136', 'C'],
  [30.0, 40.0, 'LRD340', 'XTOB040C', '3RU2136', 'C'],
  [37.0, 50.0, 'LRD350', 'XTOB050C', '3RU2136', 'C'],
  [48.0, 65.0, 'LRD365', 'XTOB065D', '3RU2136', 'D'],
  [55.0, 80.0, 'LRD380', 'XTOB080D', '3RU2136', 'D'],
  [70.0, 104.0,'LRD390', 'XTOB096D', '3RU2146', 'D'],
  [80.0, 120.0,'LRD3353','XTOB096D', '3RU2146', 'D'],
  [100.0,150.0,'LRD3363','XTOB150G', '3RU2146', 'G'],
  [130.0,195.0,'LRD3369','XTOB150G', '3RU2146', 'G'],
]

export const COIL_CODES = {
  'Schneider TeSys D': { '110VAC': 'F7', '230VAC': 'P7', '400VAC': 'V7', '24VDC': 'BL', '48VDC': 'DL', '110VDC': 'FL' },
  'Eaton XTCE':         { '110VAC': 'C',  '230VAC': 'F',  '400VAC': 'J',  '24VDC': 'A',  '48VDC': 'B',  '110VDC': 'C' },
  'Siemens SIRIUS':     { '110VAC': '0AF0', '230VAC': '0AN0', '400VAC': '0AV0', '24VDC': '1BB4', '48VDC': '1HB4', '110VDC': '1LB4' },
}

/** Smallest standard AC-3 contactor rating that covers the given FLA. */
export function getContactor(fla) {
  return CONTACTOR_SIZES.find(r => r[0] >= fla) || CONTACTOR_SIZES[CONTACTOR_SIZES.length - 1]
}

/**
 * Find the OLR range for a given FLA — preferring a range where FLA sits
 * within 80–100% of the range's max (not at the extreme low end), falling
 * back to the first range whose max covers the FLA, and finally the largest
 * available range if nothing else fits.
 */
export function getOLR(fla) {
  const preferred = OLR_RANGES.find(r => fla >= r[0] * 0.8 && fla <= r[1])
  return preferred || OLR_RANGES.find(r => fla <= r[1]) || OLR_RANGES[OLR_RANGES.length - 1]
}

export const IE_START_MULTIPLIERS = { IE4: 7.0, IE3: 6.5, IE1: 6.0, IE2: 6.0 } // IE-class → DOL start multiplier (default 6.0 for IE1/IE2/unlisted)

/**
 * @param {Object} p
 * @param {'1ph'|'3ph'} p.phase
 * @param {string|number} p.kw
 * @param {string|number} p.voltage
 * @param {string|number} p.pfVal
 * @param {string|number} p.eff - percent
 * @param {'IE1'|'IE2'|'IE3'|'IE4'} p.ieClass
 * @returns {{error:string}|{fla:number, startCurrent:number, contactor:Array, olr:Array,
 *   olrSetting:number, olrSettingMin:number, olrSettingMax:number, contactorAdequate:boolean}}
 */
export function contactorOlrSelection({ phase, kw, voltage, pfVal, eff, ieClass }) {
  const pf = (v) => parseFloat(String(v).replace(',', '.')) || 0
  const KW = pf(kw), V = pf(voltage), PF = pf(pfVal), EFF = pf(eff) / 100
  if (!KW || !V || !PF || !EFF) return { error: 'Enter motor kW, voltage, PF, and efficiency' }

  const inputPower = KW / EFF
  const fla = phase === '3ph'
    ? inputPower * 1000 / (SQRT3 * V * PF)
    : inputPower * 1000 / (V * PF)

  // IE3/IE4 motors have higher starting currents — upsize contactor consideration
  const startMultiplier = ieClass === 'IE4' ? 7.0 : ieClass === 'IE3' ? 6.5 : 6.0
  const startCurrent = fla * startMultiplier

  const contactor = getContactor(fla)
  const olr = getOLR(fla)

  const olrSetting = fla * 1.05
  const olrSettingMin = fla * 0.95
  const olrSettingMax = fla * 1.15

  const contactorAdequate = contactor[0] >= fla

  return { fla, startCurrent, contactor, olr, olrSetting, olrSettingMin, olrSettingMax, contactorAdequate }
}
