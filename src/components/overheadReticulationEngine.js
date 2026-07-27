// overheadReticulationEngine.js — pure calculation functions for the new
// MV/LV Reticulation — Overhead module (§5.6.3), scoped 2026-07-26/27 and
// built engine-first per the project's standing pattern.
//
// SOURCING NOTE (per [AI-18]) — read before trusting any number in this file:
// SANS 10280-1 (the standard this module is named for) is a paywalled SABS
// publication and could not be accessed directly for this build.
//
// CONDUCTOR DATA (updated 2026-07-27): originally sourced from DST_34-1191
// Table 7 (2011), which gave a single flat current rating per conductor.
// That was superseded after finding a real cross-source conflict (DST's
// Magpie rating of 78A vs. a supplier datasheet's 133.8A for the identical
// construction) that turned out to be neither number being wrong — current
// rating is genuinely temperature-dependent and DST's single figure never
// stated which operating temperature or rate class it represented.
//
// All conductor data below is now sourced from a single, current, clean
// document instead: "Phase Conductor Standard for Eskom Overhead Lines",
// Unique Identifier 240-152844641, Rev 2 (2021), Eskom Line Engineering
// Services — Annex C (conductor properties/ampacity) and the per-conductor
// specification sheets. This explicitly supersedes the older documents
// (TSP 41-264, DSP 34-377) that DST_34-1191's Table 7 traced back to, and
// gives ampacity as Rate A (normal/continuous) and Rate B (emergency) at
// four conductor operating temperatures (50/60/70/80°C), citing its own
// methodology source ("Determination of conductor ratings in Eskom",
// 240-147806256). This is a generic/secondary-sourced planning reference
// (same UI treatment as the fuse-curve and Area Lighting precedents), not
// a primary SANS 10280-1 citation — but it is now internally consistent
// and current, rather than a single unexplained number.
//
// SCOPE: extended 2026-07-27 to cover ACSR/AAAC/AAC conductors from
// Squirrel up through IEC 800 (835mm²) — comfortably past 66kV
// sub-transmission conductor sizes, all from this one source. Clearances,
// structure clearances, and pole spacing (below) remain capped at 33kV per
// DST_34-1191/NRS 033 and were NOT re-scoped in this pass — conductor data
// and line clearances are separate standards with separate scope boundaries.

function pf(v) { return parseFloat(String(v).replace(',', '.')) }

const CONDUCTOR_STANDARD = 'Phase Conductor Standard for Eskom Overhead Lines, 240-152844641 Rev 2 (2021), Annex C — ampacity per "Determination of conductor ratings in Eskom" (240-147806256)'

// ---------------------------------------------------------------------
// Conductor Sizing (Overhead) — 240-152844641 Rev 2 Annex C + spec sheets
// Bare ACSR/AAAC/AAC conductors. Distinct from Cable module's insulated-
// conductor derating — no insulation, no derating factors apply. Current
// ratings are genuinely temperature-dependent (see sourcing note above),
// hence the {temp: {ra, rb}} shape rather than one flat number.
// ---------------------------------------------------------------------
export const CONDUCTORS = {
  squirrel:  { type: 'ACSR', iecCode: '20.98-A1/S1A-6/1/2.11',          diaMM: 6.33,  areaMM2: 24.48,  massKgKm: 85.2,   utsKN: 8.02,   resistanceOhmKm: 1.3677, ratings: { 50: { ra: 104, rb: 143 }, 60: { ra: 122, rb: 165 }, 70: { ra: 138, rb: 183 }, 80: { ra: 150, rb: 198 } } },
  magpie:    { type: 'ACSR', iecCode: '10.58-A1/S1A-3/2.12-4/2.12',     diaMM: 6.35,  areaMM2: 24.71,  massKgKm: 139.7,  utsKN: 18.573, resistanceOhmKm: 2.707,  ratings: { 50: { ra: 33,  rb: 40  }, 60: { ra: 47,  rb: 52  }, 70: { ra: 58,  rb: 62  }, 80: { ra: 67,  rb: 70  } } },
  fox:       { type: 'ACSR', iecCode: '36.68-A1/S1A-6/1/2.79',          diaMM: 8.37,  areaMM2: 42.8,   massKgKm: 149,    utsKN: 13.1,   resistanceOhmKm: 0.7822, ratings: { 50: { ra: 148, rb: 203 }, 60: { ra: 173, rb: 234 }, 70: { ra: 196, rb: 258 }, 80: { ra: 213, rb: 279 } } },
  mink:      { type: 'ACSR', iecCode: '63.13-A1/S1A-6/1/3.66',          diaMM: 10.98, areaMM2: 73.65,  massKgKm: 257,    utsKN: 21.9,   resistanceOhmKm: 0.4546, ratings: { 50: { ra: 206, rb: 285 }, 60: { ra: 241, rb: 325 }, 70: { ra: 270, rb: 361 }, 80: { ra: 294, rb: 391 } } },
  horse:     { type: 'ACSR', iecCode: '73.36-A1/S1A-12/7/2.79',         diaMM: 13.95, areaMM2: 116.16, massKgKm: 541,    utsKN: 60.7,   resistanceOhmKm: 0.3939, ratings: { 50: { ra: 246, rb: 343 }, 60: { ra: 290, rb: 389 }, 70: { ra: 322, rb: 428 }, 80: { ra: 351, rb: 462 } } },
  hare:      { type: 'ACSR', iecCode: '104.98-A1/S1A-6/1/4.72',         diaMM: 14.16, areaMM2: 122.48, massKgKm: 427,    utsKN: 36,     resistanceOhmKm: 0.2733, ratings: { 50: { ra: 280, rb: 392 }, 60: { ra: 335, rb: 448 }, 70: { ra: 376, rb: 496 }, 80: { ra: 410, rb: 538 } } },
  tiger:     { type: 'ACSR', iecCode: '131.23-A1/S1A-30/7/2.36',        diaMM: 16.52, areaMM2: 161.85, massKgKm: 606,    utsKN: 58.7,   resistanceOhmKm: 0.2202, ratings: { 50: { ra: 322, rb: 466 }, 60: { ra: 393, rb: 535 }, 70: { ra: 444, rb: 593 }, 80: { ra: 485, rb: 643 } } },
  wolf:      { type: 'ACSR', iecCode: '158.06-A1/S1A-30/7/2.59',        diaMM: 18.13, areaMM2: 194.94, massKgKm: 730,    utsKN: 69.2,   resistanceOhmKm: 0.1828, ratings: { 50: { ra: 363, rb: 528 }, 60: { ra: 444, rb: 605 }, 70: { ra: 498, rb: 671 }, 80: { ra: 547, rb: 727 } } },
  chickadee: { type: 'ACSR', iecCode: '200.93-A1/S1A-18/1/3.77',        diaMM: 18.87, areaMM2: 212.09, massKgKm: 643,    utsKN: 44.9,   resistanceOhmKm: 0.1427, ratings: { 50: { ra: 419, rb: 602 }, 60: { ra: 496, rb: 691 }, 70: { ra: 559, rb: 761 }, 80: { ra: 608, rb: 823 } } },
  panther:   { type: 'ACSR', iecCode: '212.06-A1/S1A-30/7/3.00',        diaMM: 21,    areaMM2: 261.54, massKgKm: 970,    utsKN: 90.8,   resistanceOhmKm: 0.1363, ratings: { 50: { ra: 441, rb: 642 }, 60: { ra: 536, rb: 737 }, 70: { ra: 606, rb: 818 }, 80: { ra: 662, rb: 883 } } },
  bear:      { type: 'ACSR', iecCode: '264.42-A1/S1A-30/7/3.35',        diaMM: 23.45, areaMM2: 326.12, massKgKm: 1220,   utsKN: 112,    resistanceOhmKm: 0.1093, ratings: { 50: { ra: 521, rb: 767 }, 60: { ra: 625, rb: 873 }, 70: { ra: 706, rb: 962 }, 80: { ra: 773, rb: 1041 } } },
  kingbird:  { type: 'ACSR', iecCode: '323.01-A1/S1A-18/1/4.78',        diaMM: 23.9,  areaMM2: 340.96, massKgKm: 1038,   utsKN: 71.32,  resistanceOhmKm: 0.0891, ratings: { 50: { ra: 586, rb: 831 }, 60: { ra: 684, rb: 949 }, 70: { ra: 771, rb: 1045 }, 80: { ra: 837, rb: 1136 } } },
  iec315acsr:{ type: 'ACSR', iecCode: '315-A1/S1A-45/2.99-7/1.99',      diaMM: 23.9,  areaMM2: 337,    massKgKm: 1039.6, utsKN: 79.03,  resistanceOhmKm: 0.0917, ratings: { 50: { ra: 573, rb: 834 }, 60: { ra: 687, rb: 952 }, 70: { ra: 774, rb: 1050 }, 80: { ra: 844, rb: 1134 } } },
  goat:      { type: 'ACSR', iecCode: '324.31-A1/S1A-30/7/3.71',        diaMM: 25.97, areaMM2: 399.98, massKgKm: 1500,   utsKN: 136,    resistanceOhmKm: 0.0891, ratings: { 50: { ra: 618, rb: 866 }, 60: { ra: 726, rb: 996 }, 70: { ra: 813, rb: 1102 }, 80: { ra: 889, rb: 1197 } } },
  tern:      { type: 'ACSR', iecCode: '403.77-A1/S1A-45/3.38-7/2.25',   diaMM: 27,    areaMM2: 431.60, massKgKm: 1340,   utsKN: 98.7,   resistanceOhmKm: 0.0718, ratings: { 50: { ra: 665, rb: 963 }, 60: { ra: 792, rb: 1110 }, 70: { ra: 894, rb: 1231 }, 80: { ra: 970, rb: 1324 } } },
  zebra:     { type: 'ACSR', iecCode: '428.88-A1/S1A-54/7/3.18',        diaMM: 28.62, areaMM2: 484.48, massKgKm: 1630,   utsKN: 133,    resistanceOhmKm: 0.0674, ratings: { 50: { ra: 710, rb: 1022 }, 60: { ra: 832, rb: 1161 }, 70: { ra: 938, rb: 1285 }, 80: { ra: 1024, rb: 1391 } } },
  iec450acsr:{ type: 'ACSR', iecCode: '450-A1/S1A-45/3.57-7/2.38',      diaMM: 28.5,  areaMM2: 481,    massKgKm: 1485.2, utsKN: 107.47, resistanceOhmKm: 0.0642, ratings: { 50: { ra: 726, rb: 1053 }, 60: { ra: 867, rb: 1207 }, 70: { ra: 970, rb: 1330 }, 80: { ra: 1057, rb: 1432 } } },
  rail:      { type: 'ACSR', iecCode: '483.84-A1/S1A-45/3.70-7/2.47',   diaMM: 29.59, areaMM2: 517.39, massKgKm: 1610,   utsKN: 117,    resistanceOhmKm: 0.0598, ratings: { 50: { ra: 755, rb: 1109 }, 60: { ra: 902, rb: 1273 }, 70: { ra: 1101, rb: 1408 }, 80: { ra: 1130, rb: 1527 } } },
  iec500acsr:{ type: 'ACSR', iecCode: '500-A1/S1A-45/3.76-7/2.51',      diaMM: 30.1,  areaMM2: 535,    massKgKm: 1650.2, utsKN: 119.41, resistanceOhmKm: 0.0578, ratings: { 50: { ra: 781, rb: 1133 }, 60: { ra: 933, rb: 1300 }, 70: { ra: 1043, rb: 1434 }, 80: { ra: 1135, rb: 1540 } } },
  iec560acsr:{ type: 'ACSR', iecCode: '560-A1/S1A-45/3.98-7/2.65',      diaMM: 31.8,  areaMM2: 599,    massKgKm: 1848.2, utsKN: 133.74, resistanceOhmKm: 0.0516, ratings: { 50: { ra: 844, rb: 1230 }, 60: { ra: 1008, rb: 1411 }, 70: { ra: 1128, rb: 1556 }, 80: { ra: 1226, rb: 1673 } } },
  iec630acsr:{ type: 'ACSR', iecCode: '630-A1/S1A-45/4.22-7/2.81',      diaMM: 33.8,  areaMM2: 674,    massKgKm: 2079.2, utsKN: 150.45, resistanceOhmKm: 0.0459, ratings: { 50: { ra: 909, rb: 1343 }, 60: { ra: 1087, rb: 1544 }, 70: { ra: 1216, rb: 1704 }, 80: { ra: 1325, rb: 1838 } } },
  dinosaur:  { type: 'ACSR', iecCode: '661.72-A1/S1A-54/3.95-19/2.36',  diaMM: 35.55, areaMM2: 744.84, massKgKm: 2493,   utsKN: 202.92, resistanceOhmKm: 0.0437, ratings: { 50: { ra: 938, rb: 1380 }, 60: { ra: 1120, rb: 1585 }, 70: { ra: 1267, rb: 1763 }, 80: { ra: 1379, rb: 1906 } } },
  bersfort:  { type: 'ACSR', iecCode: '687.36-A1/S1A-48/4.27-7/3.32',   diaMM: 35.58, areaMM2: 747.96, massKgKm: 2386,   utsKN: 177.65, resistanceOhmKm: 0.0420, ratings: { 50: { ra: 965, rb: 1420 }, 60: { ra: 1153, rb: 1630 }, 70: { ra: 1304, rb: 1814 }, 80: { ra: 1417, rb: 1957 } } },
  iec800acsr:{ type: 'ACSR', iecCode: '800-A1/S1A-72/3.76-7/2.51',      diaMM: 37.6,  areaMM2: 835,    massKgKm: 2480.2, utsKN: 167.41, resistanceOhmKm: 0.0361, ratings: { 50: { ra: 1089, rb: 1595 }, 60: { ra: 1280, rb: 1838 }, 70: { ra: 1435, rb: 2021 }, 80: { ra: 1555, rb: 2177 } } },

  acacia:    { type: 'AAAC', iecCode: '23.79-A2-7/2.08',  diaMM: 6.24,  areaMM2: 23.79, massKgKm: 65,     utsKN: 6.69,   resistanceOhmKm: 1.39,   ratings: { 50: { ra: 108, rb: 153 }, 60: { ra: 129, rb: 176 }, 70: { ra: 145, rb: 194 }, 80: { ra: 157, rb: 210 } } },
  code35:    { type: 'AAAC', iecCode: '42.18-A2-7/2.77',  diaMM: 8.31,  areaMM2: 42.18, massKgKm: 115,    utsKN: 11.86,  resistanceOhmKm: 0.785,  ratings: { 50: { ra: 158, rb: 216 }, 60: { ra: 188, rb: 248 }, 70: { ra: 209, rb: 275 }, 80: { ra: 230, rb: 299 } } },
  pine:      { type: 'AAAC', iecCode: '71.65-A2-7/3.61',  diaMM: 10.83, areaMM2: 71.65, massKgKm: 196,    utsKN: 20.2,   resistanceOhmKm: 0.462,  ratings: { 50: { ra: 219, rb: 302 }, 60: { ra: 261, rb: 346 }, 70: { ra: 293, rb: 385 }, 80: { ra: 320, rb: 418 } } },
  oak:       { type: 'AAAC', iecCode: '118.9-A2-7/4.65',  diaMM: 13.95, areaMM2: 118.9, massKgKm: 325,    utsKN: 33.33,  resistanceOhmKm: 0.279,  ratings: { 50: { ra: 297, rb: 417 }, 60: { ra: 350, rb: 479 }, 70: { ra: 391, rb: 530 }, 80: { ra: 432, rb: 575 } } },
  iec160aaac:{ type: 'AAAC', iecCode: '184-A2-19/3.51',   diaMM: 17.6,  areaMM2: 184,   massKgKm: 506.1,  utsKN: 54.32,  resistanceOhmKm: 0.1798, ratings: { 50: { ra: 382, rb: 549 }, 60: { ra: 455, rb: 630 }, 70: { ra: 512, rb: 693 }, 80: { ra: 558, rb: 749 } } },
  iec315aaac:{ type: 'AAAC', iecCode: '363-A2-37/3.53',   diaMM: 24.7,  areaMM2: 363,   massKgKm: 998.9,  utsKN: 106.95, resistanceOhmKm: 0.0916, ratings: { 50: { ra: 573, rb: 834 }, 60: { ra: 686, rb: 959 }, 70: { ra: 772, rb: 1064 }, 80: { ra: 848, rb: 1151 } } },
  iec400aaac:{ type: 'AAAC', iecCode: '460-A2-37/3.98',   diaMM: 27.9,  areaMM2: 460,   massKgKm: 1268.4, utsKN: 135.81, resistanceOhmKm: 0.0721, ratings: { 50: { ra: 676, rb: 988 }, 60: { ra: 813, rb: 1133 }, 70: { ra: 911, rb: 1252 }, 80: { ra: 994, rb: 1362 } } },
  iec450aaac:{ type: 'AAAC', iecCode: '518-A2-37/4.22',   diaMM: 29.6,  areaMM2: 518,   massKgKm: 1426.9, utsKN: 152.79, resistanceOhmKm: 0.0641, ratings: { 50: { ra: 734, rb: 1074 }, 60: { ra: 883, rb: 1233 }, 70: { ra: 989, rb: 1363 }, 80: { ra: 1078, rb: 1481 } } },
  iec500aaac:{ type: 'AAAC', iecCode: '575-A2-37/4.45',   diaMM: 31.2,  areaMM2: 575,   massKgKm: 1585.5, utsKN: 169.76, resistanceOhmKm: 0.0577, ratings: { 50: { ra: 790, rb: 1160 }, 60: { ra: 945, rb: 1332 }, 70: { ra: 1063, rb: 1480 }, 80: { ra: 1161, rb: 1601 } } },
  iec560aaac:{ type: 'AAAC', iecCode: '645-A2-61/3.67',   diaMM: 33,    areaMM2: 645,   massKgKm: 1778.4, utsKN: 190.14, resistanceOhmKm: 0.0516, ratings: { 50: { ra: 850, rb: 1254 }, 60: { ra: 1018, rb: 1441 }, 70: { ra: 1145, rb: 1601 }, 80: { ra: 1248, rb: 1737 } } },
  iec630aaac:{ type: 'AAAC', iecCode: '725-A2-61/3.89',   diaMM: 35,    areaMM2: 725,   massKgKm: 2000.7, utsKN: 213.9,  resistanceOhmKm: 0.0458, ratings: { 50: { ra: 918, rb: 1364 }, 60: { ra: 1102, rb: 1575 }, 70: { ra: 1237, rb: 1744 }, 80: { ra: 1351, rb: 1887 } } },
  iec710aaac:{ type: 'AAAC', iecCode: '817-A2-61/4.13',   diaMM: 37.2,  areaMM2: 817,   massKgKm: 2254.8, utsKN: 241.07, resistanceOhmKm: 0.0407, ratings: { 50: { ra: 997, rb: 1489 }, 60: { ra: 1202, rb: 1718 }, 70: { ra: 1351, rb: 1903 }, 80: { ra: 1475, rb: 2059 } } },
  iec800aaac:{ type: 'AAAC', iecCode: '921-A2-61/4.38',   diaMM: 39.5,  areaMM2: 921,   massKgKm: 2540.6, utsKN: 271.62, resistanceOhmKm: 0.0361, ratings: { 50: { ra: 1093, rb: 1622 }, 60: { ra: 1318, rb: 1863 }, 70: { ra: 1480, rb: 2066 }, 80: { ra: 1611, rb: 2244 } } },

  hornet:    { type: 'AAC', iecCode: '157.62-A1-19/3.25', diaMM: 16.25, areaMM2: 157.62, massKgKm: 435,  utsKN: 26,     resistanceOhmKm: 0.1825, ratings: { 50: { ra: 357, rb: 510 }, 60: { ra: 427, rb: 584 }, 70: { ra: 478, rb: 647 }, 80: { ra: 524, rb: 700 } } },
  centipede: { type: 'AAC', iecCode: '415.22-A1-37/3.78', diaMM: 26.46, areaMM2: 415.22, massKgKm: 1150, utsKN: 67.2,   resistanceOhmKm: 0.0694, ratings: { 50: { ra: 695, rb: 975 }, 60: { ra: 816, rb: 1121 }, 70: { ra: 913, rb: 1242 }, 80: { ra: 1002, rb: 1349 } } },
  bull:      { type: 'AAC', iecCode: '865.36-A1-61/4.25', diaMM: 38.25, areaMM2: 865.36, massKgKm: 2400, utsKN: 139,    resistanceOhmKm: 0.0334, ratings: { 50: { ra: 1150, rb: 1654 }, 60: { ra: 1365, rb: 1900 }, 70: { ra: 1517, rb: 2117 }, 80: { ra: 1660, rb: 2291 } } },
}

const VALID_TEMPS = [50, 60, 70, 80]

/**
 * Look up standard conductor properties by code name (e.g. "Hare", "Zebra").
 * Current rating is temperature- and rate-class-dependent — pass the
 * assumed maximum conductor operating temperature (50/60/70/80°C) and
 * whether you want Rate A (normal/continuous) or Rate B (emergency).
 * @param {string} code
 * @param {number} [tempC=70] - one of 50, 60, 70, 80
 * @param {'normal'|'emergency'} [rateClass='normal']
 * @returns {Object|null}
 */
export function conductorLookup(code, tempC = 70, rateClass = 'normal') {
  if (!code) return null
  const key = String(code).trim().toLowerCase()
  const c = CONDUCTORS[key]
  if (!c) return null

  const temp = Math.round(pf(tempC))
  if (!VALID_TEMPS.includes(temp)) {
    return {
      verified: false,
      message: `Conductor operating temperature must be one of ${VALID_TEMPS.join('/')}°C — the four bands this data is verified at.`,
    }
  }

  const band = c.ratings[temp]
  const ratingA = rateClass === 'emergency' ? band.rb : band.ra

  return {
    verified: true,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    type: c.type,
    iecCode: c.iecCode,
    diaMM: c.diaMM,
    areaMM2: c.areaMM2,
    massKgKm: c.massKgKm,
    utsKN: c.utsKN,
    resistanceOhmKm: c.resistanceOhmKm,
    tempC: temp,
    rateClass,
    ratingA,
    ratingNormalA: band.ra,
    ratingEmergencyA: band.rb,
    standard: CONDUCTOR_STANDARD,
  }
}

// ---------------------------------------------------------------------
// Clearances — Table 8, DST_34-1191 / NRS 033 Table 4
// Minimum clearances for bare MV overhead lines, sourced from the OHS Act
// Electrical Machinery Regulations (Reg. 15), cross-verified in both docs.
// ---------------------------------------------------------------------
export const CLEARANCE_BANDS = [
  { maxKV: 1.1, groundOutsideM: 4.9, groundTownshipM: 5.5, roadsRailM: 6.1, commsOtherLinesM: 0.6, buildingsM: 3.0 },
  { maxKV: 7.2, groundOutsideM: 5.0, groundTownshipM: 5.5, roadsRailM: 6.2, commsOtherLinesM: 0.7, buildingsM: 3.0 },
  { maxKV: 12,  groundOutsideM: 5.1, groundTownshipM: 5.5, roadsRailM: 6.3, commsOtherLinesM: 0.8, buildingsM: 3.0 },
  { maxKV: 24,  groundOutsideM: 5.2, groundTownshipM: 5.5, roadsRailM: 6.4, commsOtherLinesM: 0.9, buildingsM: 3.0 },
  { maxKV: 33,  groundOutsideM: 5.3, groundTownshipM: 5.5, roadsRailM: 6.6, commsOtherLinesM: 1.0, buildingsM: 3.0 },
]

/**
 * Minimum clearances (ground, roads/rail, comms/other lines, buildings)
 * for a given nominal MV overhead line voltage, up to 33 kV.
 * @param {string|number} voltageKVInput
 * @returns {Object|null}
 */
export function clearanceLookup(voltageKVInput) {
  const voltageKV = pf(voltageKVInput)
  if (isNaN(voltageKV) || voltageKV <= 0) return null

  if (voltageKV > 33) {
    return {
      outOfScope: true,
      message: 'Voltages above 33 kV are transmission-class (steel lattice/tower structures under SANS 60826) — outside the scope of this MV/LV wood-pole distribution module.',
    }
  }

  const band = CLEARANCE_BANDS.find(b => voltageKV <= b.maxKV) || CLEARANCE_BANDS[CLEARANCE_BANDS.length - 1]
  return {
    voltageBandKV: band.maxKV,
    groundOutsideTownshipM: band.groundOutsideM,
    groundInsideTownshipM: band.groundTownshipM,
    aboveRoadsRailM: band.roadsRailM,
    toCommsOtherLinesM: band.commsOtherLinesM,
    toBuildingsM: band.buildingsM,
    standard: 'OHS Act Electrical Machinery Regulations Reg. 15, as reproduced in DST_34-1191 Table 8 and NRS 033:1996 Table 4 (cross-verified — both independently cite the same regulation)',
  }
}

/**
 * Structure-level (at-the-pole) minimum phase clearances. ONLY verified for
 * 33 kV per DST_34-1191 §4.11.4 — 11kV/22kV structure clearances were not
 * found in accessible source text and are deliberately NOT fabricated here.
 * @param {string|number} voltageKVInput
 * @returns {Object|null}
 */
export function structureClearance(voltageKVInput) {
  const voltageKV = pf(voltageKVInput)
  if (isNaN(voltageKV) || voltageKV <= 0) return null

  if (Math.round(voltageKV) === 33) {
    return {
      verified: true,
      phaseToEarthMM: 430,
      phaseToPhaseMM: 500,
      standard: 'DST_34-1191 §4.11.4 (33 kV structure minimum clearances)',
    }
  }
  return {
    verified: false,
    message: 'Structure (at-pole) phase clearances for this voltage were not found in accessible source text — only 33 kV values are verified. Consult a registered SANS 10280-1 copy directly, or use the electrical span/phase-spacing calculation for 22 kV.',
  }
}

// ---------------------------------------------------------------------
// Pole Spacing (rule-of-thumb) — §4.5.11, DST_34-1191
// Electrical span/phase-spacing formula. ONLY the C=0.4m constant for 22kV
// was found in accessible source text — deliberately not extrapolated to
// other voltages. This is NOT a sag-tension/structural span calculation
// (that's explicitly deferred per the §5.1 scope decision) — it only
// relates conductor swing under wind to the phase spacing needed at the
// pole top for a given span.
// ---------------------------------------------------------------------

/**
 * @param {Object} p
 * @param {string|number} p.spanM     - span length, m
 * @param {string|number} p.angleDeg  - conductor swing angle from horizontal, degrees
 * @param {string|number} p.voltageKV - nominal voltage, kV (only 22kV verified)
 * @returns {Object|null}
 */
export function phaseSpacing({ spanM, angleDeg, voltageKV } = {}) {
  const span = pf(spanM)
  const angle = pf(angleDeg)
  const voltage = pf(voltageKV)
  if (isNaN(span) || span <= 0) return null
  if (isNaN(angle)) return null

  if (isNaN(voltage) || Math.round(voltage) !== 22) {
    return {
      verified: false,
      message: 'The span/spacing formula\'s clearance constant (C) is only verified for 22 kV in accessible source text. Enter 22 kV to use this calculation, or consult a registered SANS 10280-1 copy for other voltages.',
    }
  }

  const L = span / 1000 // km
  const thetaRad = (angle * Math.PI) / 180
  const C = 0.4 // m, 22kV verified constant (DST_34-1191 §4.5.11)
  const requiredSpacingM = L * (4 * Math.pow(Math.cos(thetaRad), 4) + 1) + C

  return {
    verified: true,
    requiredSpacingM: Math.round(requiredSpacingM * 1000) / 1000,
    belowMinSpanFloor: span < 50, // DST_34-1191 §4.5.10.2(j) design floor
    standard: 'DST_34-1191 §4.5.11 electrical span/phase-spacing formula, C=0.4m verified for 22 kV',
  }
}
