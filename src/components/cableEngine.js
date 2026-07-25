// cableEngine.js — pure calculation functions extracted from CableCalculator.jsx
// (2026-07-25, per debt.md's "no automated test suite for most modules" item).
// Formulas and reference tables copied exactly from the original inline
// calculate() handlers — no numeric changes.

export const SQRT3 = Math.sqrt(3)

/** Comma-tolerant numeric parse (same as shared.jsx's pf()). */
export function pf(v) { return parseFloat(String(v).replace(',', '.')) || 0 }

// [size mm², PVC-3ph-A, PVC-1ph-A... actually: size, currentA_1ph_col, currentA_3ph_col, R_cu, R_al, X]
// Columns: [size, iRow1(1ph base @ some ref), iRow2(3ph base), R_cu (Ω/km), R_al (Ω/km), X (Ω/km)]
export const CABLE_DATA = [
  [1.5,  17.5,16.5,12.10,20.00,0.10],[2.5,  24,  23,  7.41, 12.10,0.10],
  [4,    32,  31,  4.61, 7.41, 0.10],[6,    41,  40,  3.08, 4.61, 0.10],
  [10,   57,  54,  1.83, 3.08, 0.09],[16,   76,  73,  1.15, 1.83, 0.09],
  [25,   99,  96,  0.727,1.20, 0.09],[35,   121, 119, 0.524,0.868,0.08],
  [50,   150, 144, 0.387,0.641,0.08],[70,   191, 184, 0.268,0.443,0.08],
  [95,   232, 223, 0.193,0.320,0.08],[120,  269, 259, 0.153,0.253,0.08],
  [150,  309, 299, 0.124,0.206,0.08],[185,  353, 341, 0.0991,0.164,0.08],
  [240,  415, 403, 0.0754,0.125,0.08],[300, 477, 464, 0.0601,0.100,0.08],
]
export const XLPE_FACTOR = 1.15
export const AL_FACTOR = 0.78
export const AMBIENT = { '-20':1.36,'-15':1.31,'-10':1.26,'-5':1.21,'0':1.15,'5':1.10,'10':1.05,'15':1.03,'20':1.01,'25':1.03,'30':1.00,'35':0.94,'40':0.87,'45':0.79,'50':0.71,'55':0.61,'60':0.50 }
export const GROUP = { '1':1.00,'2':0.80,'3':0.70,'4':0.65,'5':0.60,'6':0.57 }
export const INSTALL = { 'Clipped direct':1.00,'Free air':1.04,'Conduit in wall':0.77,'Trunking':0.85,'Buried direct':0.96,'Buried in duct':0.80 }

// ── 1. Cable Sizing (current-carrying capacity + voltage drop table) ────
/**
 * @param {Object} p
 * @param {'1ph'|'3ph'} p.phase
 * @param {string|number} p.current
 * @param {string|number} p.length
 * @param {string|number} p.voltage
 * @param {'PVC'|'XLPE'} p.insul
 * @param {'Cu'|'Al'} p.material
 * @param {string} p.ambient - key into AMBIENT
 * @param {string} p.groups - key into GROUP
 * @param {string} p.install - key into INSTALL
 * @param {string|number} p.maxVd - max voltage drop, %
 * @returns {{error:string}|{recommended:number|null, allResults:Array, derating:number, required:number}}
 */
export function cableSizing({ phase, current, length, voltage, insul, material, ambient, groups, install, maxVd }) {
  const I = pf(current), L = pf(length), V = pf(voltage)
  if (!I || !L || !V) return { error: 'Enter current, length, and voltage' }
  const tF = AMBIENT[ambient] || 1, gF = GROUP[groups] || 0.57, iF = INSTALL[install] || 1
  const derating = tF * gF * iF, required = I / derating
  let recommended = null
  const allResults = CABLE_DATA.map(row => {
    let base = phase === '1ph' ? row[1] : row[2]
    if (insul === 'XLPE') base *= XLPE_FACTOR
    if (material === 'Al') base *= AL_FACTOR
    const derated = base * derating
    const R = material === 'Cu' ? row[3] : row[4]
    const mult = phase === '1ph' ? 2 : SQRT3
    const vdV = (mult * R * L * I) / 1000, vdPct = (vdV / V * 100)
    const pass = derated >= I && vdPct <= pf(maxVd)
    if (pass && !recommended) recommended = row[0]
    return { size: row[0], derated, vdV, vdPct, currentOK: derated >= I, vdOK: vdPct <= pf(maxVd), pass }
  })
  return { recommended, allResults, derating, required }
}

// ── 2. Detailed Voltage Drop — IEC method (R·cosφ + X·sinφ) ─────────────
/**
 * @param {Object} p
 * @param {'1ph'|'3ph'} p.phase
 * @param {string|number} p.current
 * @param {string|number} p.pfVal
 * @param {string|number} p.length
 * @param {string|number} p.voltage
 * @param {string|number} p.size - must match a CABLE_DATA row's size exactly
 * @param {'Cu'|'Al'} p.material
 * @returns {{error:string}|{vdD:number, vdS:number, pctD:number, pctS:number, Vend:number, pass:boolean}}
 */
export function cableVoltageDropDetailed({ phase, current, pfVal, length, voltage, size, material }) {
  const I = pf(current), L = pf(length), V = pf(voltage), PF = pf(pfVal), S = pf(size)
  if (!I || !L || !V || !S) return { error: 'Fill all fields' }
  const row = CABLE_DATA.find(r => r[0] === S)
  if (!row) return { error: 'Invalid size' }
  const R = material === 'Cu' ? row[3] : row[4], X = row[5], sinPhi = Math.sqrt(1 - PF * PF)
  const mult = phase === '1ph' ? 2 : SQRT3
  const vdD = (mult * I * L * (R * PF + X * sinPhi)) / 1000
  const vdS = (mult * R * L * I) / 1000
  const pctD = (vdD / V * 100), pctS = (vdS / V * 100)
  return { vdD, vdS, pctD, pctS, Vend: V - vdD, pass: pctD <= 3 }
}

// ── 3. Short Circuit (Fault) Current at end of cable run ────────────────
/**
 * @param {Object} p
 * @param {string|number} p.sourceKVA
 * @param {string|number} p.voltage
 * @param {string|number} p.cableSize
 * @param {string|number} p.cableLen - 0/blank = fault at source
 * @param {'Cu'|'Al'} p.material
 * @returns {{error:string}|{Zs:number, Zc:number, Zt:number, i3:number, i1:number}}
 */
export function cableShortCircuitCurrent({ sourceKVA, voltage, cableSize, cableLen, material }) {
  const kVA = pf(sourceKVA), V = pf(voltage), L = pf(cableLen), S = pf(cableSize)
  if (!kVA || !V) return { error: 'Enter source kVA and voltage' }
  const Zs = (V * V) / (kVA * 1000)
  let Zc = 0
  if (L && S) {
    const row = CABLE_DATA.find(r => r[0] === S)
    if (row) {
      const R = (material === 'Cu' ? row[3] : row[4]) * L / 1000, X = row[5] * L / 1000
      Zc = Math.sqrt((2 * R) ** 2 + (2 * X) ** 2)
    }
  }
  const Zt = Zs + Zc
  const i3 = V / (SQRT3 * Zt), i1 = V / (2 * Zt)
  return { Zs, Zc, Zt, i3, i1 }
}

// ── 4. Mining Trailing Cable Sizing ──────────────────────────────────────
export const TRAILING = [
  [4,42,4.61,0.55],[6,53,3.08,0.71],[10,72,1.83,1.01],[16,96,1.15,1.42],
  [25,125,0.727,2.05],[35,152,0.524,2.72],[50,183,0.387,3.60],[70,232,0.268,4.80],
  [95,278,0.193,6.30],[120,320,0.153,7.80],[150,365,0.124,9.40],[185,415,0.0991,11.5],
]
export const TRAILING_DERATING = 0.85

/**
 * @param {Object} p
 * @param {string|number} p.current
 * @param {string|number} p.length
 * @param {string|number} p.voltage
 * @param {string|number} p.maxVd
 * @returns {{error:string}|{recommended:number|null, allResults:Array, required:number}}
 */
export function trailingCableSizing({ current, length, voltage, maxVd }) {
  const I = pf(current), L = pf(length), V = pf(voltage)
  if (!I || !L || !V) return { error: 'Enter current, length, voltage' }
  const derating = TRAILING_DERATING, required = I / derating
  let recommended = null
  const allResults = TRAILING.map(row => {
    const derated = row[1] * derating, vdV = (SQRT3 * row[2] * L * I) / 1000, vdPct = (vdV / V * 100)
    const pass = derated >= I && vdPct <= pf(maxVd)
    if (pass && !recommended) recommended = row[0]
    return { size: row[0], derated, vdPct, weight: row[3] * L, pass, currentOK: derated >= I, vdOK: vdPct <= pf(maxVd) }
  })
  return { recommended, allResults, required }
}

// ── 5. Conduit Fill ───────────────────────────────────────────────────────
export const CONDUIT_SIZES = [16,20,25,32,40,50,63,75,100]
export const CABLE_OD = { '1.5':7.6,'2.5':8.2,'4':9.2,'6':10.2,'10':12.2,'16':14.2,'25':17.5,'35':19.5,'50':22.3,'70':26.7,'95':30.5,'120':33.5 }

/**
 * @param {Object} p
 * @param {string|number} p.conduit - conduit internal diameter, mm
 * @param {string} p.cableSize - key into CABLE_OD
 * @param {string|number} p.numCables
 * @returns {null|{fill:number, max33:number, max40:number, pass:boolean, pass40:boolean}}
 *          null if numCables is missing/zero (matches original silent-return behavior)
 */
export function conduitFill({ conduit, cableSize, numCables }) {
  const D = pf(conduit), d = CABLE_OD[cableSize] || 8, N = pf(numCables)
  if (!N) return null
  const cA = Math.PI * (D / 2) ** 2, ca = Math.PI * (d / 2) ** 2
  const fill = (N * ca / cA * 100)
  return {
    fill,
    max33: Math.floor(cA * 0.33 / ca),
    max40: Math.floor(cA * 0.40 / ca),
    pass: N * ca <= cA * 0.33,
    pass40: N * ca <= cA * 0.40,
  }
}

// ── 6. Cable Gland Selection ──────────────────────────────────────────────
export const GLAND_SIZES = [
  { size: '0',  min: 3,   max: 7,   thread: 'M16',  a2: 'Size 0',  cw: 'CW0'  },
  { size: '1',  min: 6,   max: 12,  thread: 'M20',  a2: 'Size 1',  cw: 'CW1'  },
  { size: '2',  min: 10,  max: 17,  thread: 'M25',  a2: 'Size 2',  cw: 'CW2'  },
  { size: '3',  min: 14,  max: 21,  thread: 'M32',  a2: 'Size 3',  cw: 'CW3'  },
  { size: '4',  min: 18,  max: 27,  thread: 'M40',  a2: 'Size 4',  cw: 'CW4'  },
  { size: '5',  min: 24,  max: 34,  thread: 'M50',  a2: 'Size 5',  cw: 'CW5'  },
  { size: '6',  min: 30,  max: 45,  thread: 'M63',  a2: 'Size 6',  cw: 'CW6'  },
  { size: '7',  min: 42,  max: 60,  thread: 'M75',  a2: 'Size 7',  cw: 'CW7'  },
  { size: '8', min: 60, max: 75, thread: 'M90',  a2: 'Size 8', cw: 'CW8' },
  { size: '9', min: 75, max: 95, thread: 'M100', a2: 'Size 9', cw: 'CW9' },
]

export const PRATLEY_SWA_TABLE = {
  '2-1.5': { gland: '0', cw: 'CW16', min: 8,  max: 11 },
  '3-1.5': { gland: '0', cw: 'CW16', min: 9,  max: 12 },
  '4-1.5': { gland: '1', cw: 'CW20', min: 10, max: 13 },
  '2-2.5': { gland: '0', cw: 'CW16', min: 9,  max: 12 },
  '3-2.5': { gland: '1', cw: 'CW20', min: 10, max: 13 },
  '4-2.5': { gland: '1', cw: 'CW20', min: 12, max: 15 },
  '2-4':   { gland: '1', cw: 'CW20', min: 10, max: 14 },
  '3-4':   { gland: '1', cw: 'CW20', min: 12, max: 15 },
  '4-4':   { gland: '1', cw: 'CW20', min: 14, max: 17 },
  '2-6':   { gland: '1', cw: 'CW20', min: 11, max: 15 },
  '3-6':   { gland: '1', cw: 'CW20', min: 13, max: 17 },
  '4-6':   { gland: '1', cw: 'CW20', min: 15, max: 18 },
  '2-10':  { gland: '1', cw: 'CW20', min: 14, max: 18 },
  '3-10':  { gland: '1', cw: 'CW20', min: 16, max: 20 },
  '4-10':  { gland: '1', cw: 'CW20', min: 17, max: 21 },
  '4-16':  { gland: '2', cw: 'CW25', min: 20, max: 27 },
  '4-25':  { gland: '3', cw: 'CW32', min: 26, max: 33 },
  '4-35':  { gland: '4', cw: 'CW40', min: 31, max: 38 },
  '3-50':  { gland: '5', cw: 'CW50', min: 36, max: 44 },
  '4-50':  { gland: '5', cw: 'CW50', min: 38, max: 46 },
  '3-70':  { gland: '5', cw: 'CW50', min: 40, max: 48 },
  '4-70':  { gland: '6', cw: 'CW63', min: 44, max: 52 },
  '3-95':  { gland: '6', cw: 'CW63', min: 46, max: 54 },
  '4-95':  { gland: '6', cw: 'CW63', min: 48, max: 56 },
  '3-120': { gland: '6', cw: 'CW63', min: 50, max: 58 },
  '4-120': { gland: '7', cw: 'CW75', min: 54, max: 60 },
  '3-150': { gland: '7', cw: 'CW7',  min: 58, max: 64 },
  '4-150': { gland: '7', cw: 'CW7',  min: 60, max: 66 },
  '3-185': { gland: '8', cw: 'CW8',  min: 65, max: 72 },
  '4-185': { gland: '8', cw: 'CW8',  min: 68, max: 75 },
  '3-240': { gland: '9', cw: 'CW9',  min: 74, max: 82 },
  '4-240': { gland: '9', cw: 'CW9',  min: 78, max: 86 },
  '3-300': { gland: '9', cw: 'CW9',  min: 82, max: 90 },
  '4-300': { gland: '9', cw: 'CW9',  min: 86, max: 95 },
}

// [size, cores, PVC-unarm OD, PVC-SWA OD, XLPE-unarm OD, XLPE-SWA OD]
export const CABLE_OD_TABLE = [
  [1.5,  2,  8.2,   11.0,  8.5,   11.5 ], [1.5,  3,  8.8,   11.8,  9.0,   12.0 ], [1.5,  4,  9.8,   13.0,  10.0,  13.5 ],
  [2.5,  2,  9.0,   12.0,  9.5,   12.5 ], [2.5,  3,  9.8,   13.0,  10.2,  13.5 ], [2.5,  4,  11.0,  14.5,  11.5,  15.0 ],
  [4,    2,  10.0,  13.5,  10.5,  14.0 ], [4,    3,  11.0,  14.5,  11.5,  15.0 ], [4,    4,  12.5,  16.5,  13.0,  17.0 ],
  [6,    2,  11.0,  14.5,  11.5,  15.0 ], [6,    3,  12.2,  16.0,  12.8,  16.8 ], [6,    4,  14.0,  18.0,  14.5,  18.8 ],
  [10,   2,  12.8,  16.8,  13.5,  17.5 ], [10,   3,  14.2,  18.5,  15.0,  19.5 ], [10,   4,  16.5,  21.0,  17.0,  22.0 ],
  [16,   2,  14.5,  19.0,  15.2,  20.0 ], [16,   3,  16.5,  21.5,  17.0,  22.5 ], [16,   4,  19.0,  24.5,  20.0,  25.5 ],
  [25,   2,  17.0,  22.0,  17.8,  23.0 ], [25,   3,  19.5,  25.5,  20.5,  26.5 ], [25,   4,  22.5,  29.0,  23.5,  30.0 ],
  [35,   2,  19.0,  25.0,  20.0,  26.0 ], [35,   3,  22.0,  28.5,  23.0,  30.0 ], [35,   4,  25.5,  33.0,  26.5,  34.5 ],
  [50,   2,  21.5,  28.5,  22.5,  30.0 ], [50,   3,  25.0,  32.5,  26.0,  34.0 ], [50,   4,  29.0,  37.5,  30.5,  39.5 ],
  [70,   2,  24.5,  32.5,  25.5,  34.0 ], [70,   3,  28.5,  37.0,  30.0,  39.0 ], [70,   4,  33.5,  43.0,  35.0,  45.0 ],
  [95,   2,  27.5,  36.5,  29.0,  38.5 ], [95,   3,  32.5,  42.0,  34.0,  44.0 ], [95,   4,  38.0,  49.0,  40.0,  51.5 ],
  [120,  2,  30.5,  40.5,  32.0,  42.5 ], [120,  3,  36.0,  46.5,  37.5,  48.5 ], [120,  4,  42.5,  54.5,  44.5,  57.0 ],
  [150,  2,  33.5,  44.5,  35.0,  46.5 ], [150,  3,  39.5,  51.0,  41.5,  53.5 ], [150,  4,  46.5,  59.5,  49.0,  62.5 ],
  [185, 2, 37.0, 49.0, 39.0, 51.5], [185, 3, 43.5, 56.5, 45.5, 59.0], [185, 4, 51.5, 65.5, 54.0, 68.5],
  [240, 3, 66.0, 80.0, 69.0, 83.0], [240, 4, 70.0, 84.0, 73.0, 87.0],
  [300, 3, 74.0, 88.0, 77.0, 91.0], [300, 4, 78.0, 92.0, 81.0, 95.0],
]

/** Look up typical cable OD for a given conductor size/cores/armour/insulation. Returns null if no data. */
export function getOD(size, cores, armoured, insul) {
  const row = CABLE_OD_TABLE.find(r => r[0] === size && r[1] === cores)
  if (!row) return null
  if (armoured === 'swa') return insul === 'xlpe' ? row[5] : row[3]
  return insul === 'xlpe' ? row[4] : row[2]
}

/** Find the correct gland for a given OD (Pratley SWA override table takes precedence for armoured cable). */
export function findGland(od, cores, size, armour) {
  if (armour === 'swa') {
    const key = `${cores}-${size}`
    const pratley = PRATLEY_SWA_TABLE[key]
    if (pratley) {
      return { size: pratley.gland, min: pratley.min, max: pratley.max, thread: pratley.cw, a2: `Size ${pratley.gland}`, cw: pratley.cw }
    }
  }
  return GLAND_SIZES.find(g => od >= g.min && od <= g.max) || null
}

/**
 * @param {Object} p
 * @param {'conductor'|'od'} p.method
 * @param {string|number} [p.condSize] - required for method='conductor'
 * @param {string|number} [p.cores]
 * @param {'unarm'|'swa'} [p.armour]
 * @param {'pvc'|'xlpe'} [p.insul]
 * @param {string|number} [p.od] - required for method='od', measured OD in mm
 * @returns {{error:string}|{od:number, gland:string, thread:string, type:string, glandType:string, min:number, max:number}}
 */
export function glandSelection({ method, condSize, cores, armour, insul, od }) {
  if (method === 'conductor') {
    const size = pf(condSize), coreN = pf(cores)
    const typOD = getOD(size, coreN, armour, insul)
    if (!typOD) return { error: 'No data for this combination' }
    const gland = findGland(typOD, coreN, size, armour)
    if (!gland) return { error: 'Cable OD outside standard gland range' }
    return {
      od: typOD, gland: gland.size, thread: gland.thread,
      type: armour === 'swa' ? gland.cw : gland.a2,
      glandType: armour === 'swa' ? 'BW (Indoor) / CW (Outdoor)' : 'A2 (Unarmoured)',
      min: gland.min, max: gland.max,
    }
  } else {
    const OD = pf(od)
    if (!OD) return { error: 'Enter cable outer diameter' }
    const gland = findGland(OD)
    if (!gland) return { error: 'OD outside standard gland range (3–60mm)' }
    return {
      od: OD, gland: gland.size, thread: gland.thread,
      type: `${gland.a2} (unarm) / ${gland.cw} (SWA)`,
      glandType: 'Check armour type',
      min: gland.min, max: gland.max,
    }
  }
}

// ── 7. Cable Schedule auto-size lookup ───────────────────────────────────
// Uses the first 3 columns of CABLE_DATA (size, 1ph current, 3ph current) — a
// deliberately trimmed local copy in the original component (no R/X columns
// needed for a size-only lookup). Reproduced here for exact behavior parity.
export const CABLE_DATA_SCHEDULE = CABLE_DATA.map(r => [r[0], r[1], r[2]])

/**
 * @param {Object} p
 * @param {string|number} p.current
 * @param {'1ph'|'3ph'} p.phase
 * @param {'Cu'|'Al'} p.material
 * @param {'PVC'|'XLPE'} p.insul
 * @returns {number} recommended size in mm² (300 if nothing in the table fits, matching original)
 */
export function scheduleAutoSize({ current, phase, material, insul }) {
  const I = pf(current)
  const idx = phase === '1ph' ? 1 : 2
  const xlpe = insul === 'XLPE' ? 1.15 : 1
  const al = material === 'Al' ? 0.78 : 1
  const row = CABLE_DATA_SCHEDULE.find(r => r[idx] * xlpe * al >= I)
  return row ? row[0] : 300
}

// ── 8. VFD Output Cable Sizing ────────────────────────────────────────────
export const VFD_CABLE = [
  [1.5,17.5],[2.5,24],[4,32],[6,41],[10,57],[16,76],[25,99],[35,121],
  [50,150],[70,191],[95,232],[120,269],[150,309],[185,353],[240,415],
]
export const VFD_R_MAP = { 1.5:12.1,2.5:7.41,4:4.61,6:3.08,10:1.83,16:1.15,25:0.727,35:0.524,50:0.387,70:0.268,95:0.193,120:0.153,150:0.124,185:0.0991,240:0.0754 }
export const VFD_HARMONIC_FACTOR = 1.1
export const VFD_SCREEN_DERATING = 0.80
export const VFD_MAX_LENGTH_M = 50

/**
 * @param {Object} p
 * @param {string|number} p.current
 * @param {string|number} p.length
 * @param {string|number} p.voltage
 * @returns {{error:string}|{size:number, deratedI:number, vd:number, vdPct:number, lengthOK:boolean, maxLen:number}}
 */
export function vfdCableSizing({ current, length, voltage }) {
  const I = pf(current), L = pf(length), V = pf(voltage)
  if (!I || !L || !V) return { error: 'Enter current, length, and voltage' }
  // Harmonic correction (×1.1) + screening derating (÷0.80)
  const deratedI = I * VFD_HARMONIC_FACTOR / VFD_SCREEN_DERATING
  const row = VFD_CABLE.find(r => r[1] >= deratedI)
  const size = row ? row[0] : 300
  const R = VFD_R_MAP[size] || 0.1
  const vd = (SQRT3 * R * L * I) / 1000
  const vdPct = (vd / V * 100)
  return { size, deratedI, vd, vdPct, lengthOK: L <= VFD_MAX_LENGTH_M, maxLen: VFD_MAX_LENGTH_M }
}
