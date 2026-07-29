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

  // BS 215-family ACSR conductors NOT in the Eskom 240-152844641 spec but
  // widely encountered on-site in Southern Africa (Rabbit especially).
  // DIMENSIONAL DATA ONLY — stranding/diameter/mass per the widely-published
  // BS 215 Part 2 / IEC-equivalent tables. Ampacity is deliberately NOT
  // provided (ratings: null) because these conductors do not appear in the
  // verified Eskom rating source and no equivalent Rate A/B basis is
  // available [AI-18]. conductorLookup() returns dimensions with an honest
  // ratingsAvailable:false for these.
  gopher:    { type: 'ACSR', iecCode: 'BS215: 6/1/2.36',  diaMM: 7.08,  areaMM2: 31.6,   massKgKm: 106,  utsKN: 9.6,   resistanceOhmKm: 1.093,  ratings: null },
  weasel:    { type: 'ACSR', iecCode: 'BS215: 6/1/2.59',  diaMM: 7.77,  areaMM2: 38.4,   massKgKm: 128,  utsKN: 11.5,  resistanceOhmKm: 0.9077, ratings: null },
  ferret:    { type: 'ACSR', iecCode: 'BS215: 6/1/3.00',  diaMM: 9.00,  areaMM2: 49.5,   massKgKm: 172,  utsKN: 15.2,  resistanceOhmKm: 0.6766, ratings: null },
  rabbit:    { type: 'ACSR', iecCode: 'BS215: 6/1/3.35',  diaMM: 10.05, areaMM2: 61.7,   massKgKm: 214,  utsKN: 18.4,  resistanceOhmKm: 0.5426, ratings: null },
  otter:     { type: 'ACSR', iecCode: 'BS215: 6/1/4.22',  diaMM: 12.66, areaMM2: 97.9,   massKgKm: 339,  utsKN: 28.5,  resistanceOhmKm: 0.3434, ratings: null },
  dog:       { type: 'ACSR', iecCode: 'BS215: 6/4.72+7/1.57', diaMM: 14.15, areaMM2: 118.5, massKgKm: 394, utsKN: 32.7, resistanceOhmKm: 0.2733, ratings: null },
  lynx:      { type: 'ACSR', iecCode: 'BS215: 30/7/2.79', diaMM: 19.53, areaMM2: 226.2,  massKgKm: 842,  utsKN: 79.8,  resistanceOhmKm: 0.1441, ratings: null },
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

  // Dimension-only conductors (BS 215 family, e.g. Rabbit): real physical
  // data, but honestly NO ampacity — not present in the Eskom rating source.
  if (c.ratings === null) {
    return {
      verified: true,
      ratingsAvailable: false,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      type: c.type,
      iecCode: c.iecCode,
      diaMM: c.diaMM,
      areaMM2: c.areaMM2,
      massKgKm: c.massKgKm,
      utsKN: c.utsKN,
      resistanceOhmKm: c.resistanceOhmKm,
      ratingsMessage: 'This conductor is not in the Eskom rating source (240-152844641) — dimensional data is per the widely-published BS 215 tables, but no verified Rate A/B ampacity is available. Consult the fitting/conductor manufacturer datasheet for current rating.',
      standard: 'BS 215 Part 2 (dimensional data only — see ratingsMessage)',
    }
  }

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
    ratingsAvailable: true,
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
// Preformed Fitting Selection — dead-ends, splices, armor rods, guy grips.
// SOURCING NOTE [AI-18]: every major manufacturer (AFL, PLP, and others)
// colour-codes preformed fittings for on-site identification, BUT the
// colour-to-size mapping is MANUFACTURER-SPECIFIC and NOT standardized —
// documented cases exist of the same conductor mapping to different colours
// at different manufacturers (e.g. Panther: Red at one, Orange at another).
// A colour lookup table presented as authoritative would be actively
// dangerous. The real selection criterion, consistent across every
// manufacturer catalogue, is the CONDUCTOR DIAMETER matched against the
// fitting's tagged diameter range. This function therefore keys on
// diameter and instructs verification against the fitting's own
// identification tag — the honest version of what a colour table pretends
// to do.
// ---------------------------------------------------------------------

export const FITTING_TYPES = [
  { id: 'deadend',    label: 'Dead-End (Termination) Grip', use: 'Full-tension termination of the conductor at strain/terminal structures' },
  { id: 'splice',     label: 'Full-Tension Splice (Joint)', use: 'Mid-span joining of two conductor lengths at full mechanical tension' },
  { id: 'armorRods',  label: 'Armor Rods',                  use: 'Protecting the conductor at suspension clamps against fatigue/abrasion' },
  { id: 'guyGrip',    label: 'Guy Grip (Stay Wire)',        use: 'Terminating galvanized-steel stay/guy strand at anchors and pole eyes — sized to the STAY WIRE diameter, not the phase conductor' },
]

/**
 * Fitting selection guidance for a given conductor. Keys on conductor
 * diameter — the actual cross-manufacturer selection criterion — and
 * explicitly warns that colour codes are manufacturer-specific.
 * @param {string} conductorCode - key in CONDUCTORS
 * @param {string} fittingTypeId - key in FITTING_TYPES
 * @returns {Object|null}
 */
export function fittingSelection(conductorCode, fittingTypeId) {
  if (!conductorCode || !fittingTypeId) return null
  const key = String(conductorCode).trim().toLowerCase()
  const c = CONDUCTORS[key]
  const fitting = FITTING_TYPES.find(f => f.id === fittingTypeId)
  if (!c || !fitting) return null

  if (fittingTypeId === 'guyGrip') {
    return {
      conductorName: key.charAt(0).toUpperCase() + key.slice(1),
      fitting: fitting.label,
      applicable: false,
      message: 'Guy grips are sized to the stay/guy STRAND diameter (galvanized steel wire), not the phase conductor. Measure or read the stay strand diameter and match it against the guy grip\'s tagged diameter range.',
      colourWarning: COLOUR_WARNING,
    }
  }

  return {
    conductorName: key.charAt(0).toUpperCase() + key.slice(1),
    conductorType: c.type,
    fitting: fitting.label,
    fittingUse: fitting.use,
    applicable: true,
    matchDiameterMM: c.diaMM,
    guidance: `Select a ${fitting.label.toLowerCase()} whose tagged diameter range includes ${c.diaMM} mm, and whose material matches the conductor type (${c.type}). The fitting's identification tag (catalogue number + diameter range + nominal size) is the authoritative match — confirm against it before installation.`,
    colourWarning: COLOUR_WARNING,
    standard: 'Manufacturer-catalogue practice (AFL, PLP, and equivalents) — diameter-range matching; no national/IEC standard governs preformed-fitting colour codes',
  }
}

const COLOUR_WARNING = 'Colour codes on preformed fittings are MANUFACTURER-SPECIFIC, not standardized — the same conductor can carry different colours at different manufacturers, and colours repeat across size groups within one range. Never select a fitting by colour alone; always confirm against the fitting\'s own identification tag.'

// ---------------------------------------------------------------------
// Support Structure Typology — qualitative reference only, no fabricated
// strength/loading figures. Structure strength design (wind/ice loading,
// foundation design, tower member sizing) remains explicitly out of this
// module's field-quick scope, same boundary as sag-tension mechanics.
// ---------------------------------------------------------------------
export const STRUCTURE_TYPES = [
  { id: 'suspension', label: 'Suspension (Intermediate) Structure', role: 'Carries the conductor on straight-line sections; conductor hangs from suspension insulators/clamps and the structure sees mainly vertical + wind load, not line tension.' },
  { id: 'strain',     label: 'Strain (Tension) Structure',          role: 'Terminates conductor tension in one or both directions using dead-end fittings; placed at intervals along straight runs to limit cascade failure and at stringing section boundaries.' },
  { id: 'angle',      label: 'Angle Structure',                     role: 'Placed where the line changes direction; carries the resultant of the two conductor tension vectors, usually stayed/guyed along the bisector or built as a stronger strain structure.' },
  { id: 'terminal',   label: 'Terminal (Dead-End) Structure',       role: 'Final structure at a substation or line end; carries full one-sided conductor tension permanently, typically the heaviest-built structure on the line.' },
  { id: 'transposition', label: 'Transposition Structure',          role: 'Rotates phase positions on long lines to balance impedance between phases; encountered on longer sub-transmission and transmission lines.' },
]

export const STRUCTURE_MATERIALS = [
  { id: 'wood',     label: 'Wood Pole',            notes: 'Standard for MV/LV distribution reticulation up to 33kV (SANS 10280-1/NRS 033 territory); light, field-handleable, suited to areas without heavy plant access.' },
  { id: 'concrete', label: 'Concrete Pole',        notes: 'Common for sub-transmission and urban distribution; long service life and fire/termite immunity, at the cost of mass and transport/handling requirements.' },
  { id: 'lattice',  label: 'Lattice Steel Tower',  notes: 'Used where strength governs — heavy angle/terminal points and transmission-class lines; structural design falls under SANS 60826, outside this module\'s scope.' },
  { id: 'steelPole',label: 'Steel Monopole',       notes: 'Used where footprint is constrained (urban sub-transmission); foundation and structural design are specialist scope, as with lattice.' },
]

// ---------------------------------------------------------------------
// Clearance module history (superseded stages, kept for context):
//   2026-07-27: OHS Act Reg 15 text reproduced up to the 100kV band only;
//     145kV+ rows were truncated in the accessible secondary text and were
//     honestly omitted rather than guessed.
//   2026-07-28: HV/EHV (132kV+) safety clearances and servitude widths
//     added from Eskom ESKASABG3 Annex C (a document citing the OHS Act),
//     with ground/road/building clearances at those voltages left
//     explicitly unverified/out-of-scope.
//   2026-07-29 (this session): SANS 10280-1:2017 Annex E, Table E.1
//     obtained directly — a normative national standard, referenced
//     normatively by the OHS Act EMR itself. It supersedes BOTH prior
//     stages for ALL voltage bands (see the full sourcing note above
//     SANS10280_CLEARANCE_TABLE below) and closes every previously-open
//     gap: ground, road/rail, building/vegetation, and telecom/other-line
//     clearances are now verified end-to-end from LV through 765kV AC and
//     533kV DC. One conflict was found (275kV safety clearance: ESKASABG3
//     said 2.35m, SANS 10280-1 says 2.5m) and resolved in favour of SANS
//     10280-1 per Hertz's explicit decision — see the note below.
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// Voltage class (LV/MV/HV/EHV) — a general Southern African power-
// engineering convention used ONLY to label/categorize a voltage for the
// user's orientation. It is NOT itself a clearance-table boundary — the
// actual clearance bands come from SANS 10280-1 Table E.1's own
// "highest system voltage" column breaks, which don't align neatly to
// LV/MV/HV/EHV class edges.
// The transmission voltage PRESETS below (132/220/275/400/765 kV) are
// real, public Eskom/NTCSA transmission voltage classes — factual system
// voltages, not clearance figures — offered so the picker doesn't force
// free-text entry for common HV/EHV system voltages.
// ---------------------------------------------------------------------
export const VOLTAGE_CLASS_CONVENTION = 'General Southern African power-engineering convention (not an OHS Act clearance boundary): LV ≤1kV, MV >1–33kV, HV >33–132kV, EHV >132kV.'

export const TRANSMISSION_VOLTAGE_PRESETS = [132, 220, 275, 400, 765]

/**
 * @param {string|number} voltageKVInput
 * @returns {'LV'|'MV'|'HV'|'EHV'|null}
 */
export function voltageClass(voltageKVInput) {
  const voltageKV = pf(voltageKVInput)
  if (isNaN(voltageKV) || voltageKV <= 0) return null
  if (voltageKV <= 1.1) return 'LV'
  if (voltageKV <= 33) return 'MV'
  if (voltageKV <= 132) return 'HV'
  return 'EHV'
}

// ---------------------------------------------------------------------
// Minimum Clearances — SANS 10280-1:2017 (Edition 2.1, Amendment 1),
// Annex E (NORMATIVE), Table E.1 "Minimum clearances for power lines"
// and Table E.2 "Minimum vertical clearance requirements applicable to
// low voltage overhead lines... as well as road and railway crossings".
//
// SOURCING [AI-18]: SANS 10280-1 is referenced NORMATIVELY by the OHS
// Act Electrical Machinery Regulations (EMR) via section 44 — per the
// standard's own foreword: "This document is referenced in the
// Electrical Machinery Regulations (EMR) (section 44) of the
// Occupational Health and Safety Act, 1993 (Act No. 85 of 1993)."
// This is now the strongest single clearance source available to this
// project: a full national-standard table sourced directly, not a
// secondary document that cites it. It SUPERSEDES the prior
// ESKASABG3-sourced HV/EHV partial-scope data (2026-07-28 session) and
// the prior DST_34-1191/NRS-033-derived LV/MV clearance bands
// (2026-07-27 session), for ALL voltage bands, from LV through 765kV AC
// and 533kV DC.
//
// CROSS-VALIDATION: at 11/22/33/44/66/88/132/400/765kV and 533kV DC,
// this table's safetyClearanceM column matches the previously-verified
// ESKASABG3/Reg-15-derived data EXACTLY — confirming both trace to the
// same underlying OHS Act Reg 15 table.
//
// CONFLICT FOUND AND RESOLVED: at 275kV (SANS 10280-1's "300kV highest
// system voltage" row), the retired ESKASABG3 dataset gave a safety
// clearance of 2.35m; this table gives 2.5m. Per Hertz's explicit
// decision (2026-07-29 session), SANS 10280-1's 2.5m supersedes the
// ESKASABG3 figure: SANS 10280-1 is a normative national standard with
// a direct EMR reference, while ESKASABG3's figure was a secondary
// citation of the OHS Act via its own Annex C. The stale 2.35m figure
// is locked out by regression test below.
//
// SCOPE: this single table now covers minimum safety clearance, ground
// clearance, road/rail crossing clearance, clearance to buildings and
// vegetation, clearance to telecom lines/other power lines, and
// horizontal clearance — for every voltage band from LV through 765kV
// AC and 533kV DC. No partial-scope or out-of-scope case remains for AC
// voltages; the table is complete end-to-end. The only genuinely
// NOT-in-this-source figure remains structure (at-pole) phase
// clearances (structureClearance() below), which SANS 10280-1 Annex E
// does not cover.
// ---------------------------------------------------------------------
const SANS10280_STANDARD = 'SANS 10280-1:2017 (Edition 2.1, Amdt 1) — Overhead power lines for conditions prevailing in South Africa, Part 1: Safety, Annex E (normative), Table E.1. Referenced normatively by the OHS Act Electrical Machinery Regulations (EMR), section 44.'
const SANS10280_TABLE_E2_STANDARD = 'SANS 10280-1:2017 (Edition 2.1, Amdt 1), Annex E (normative), Table E.2 — LV (<1kV) ground clearance detail by conductor system and road/crossing category.'

// One row per Table E.1 column-1 "highest system r.m.s. voltage" — this
// is how the standard itself bands nominal system voltages. nominalKV is
// column 2. dc:true marks the single 533kV DC row (a separate
// insulation-co-ordination case per the standard's own footnote d).
export const SANS10280_CLEARANCE_TABLE = [
  { highestSystemKV: 1.1, nominalKV: null, safetyClearanceM: null, groundClearanceM: 4.9,  roadsRailM: 6.1,  buildingsVegetationM: 3.0, telecomOtherLinesM: 0.6, horizontalM: 3.0 },
  { highestSystemKV: 7.2,  nominalKV: 6.6,  safetyClearanceM: 0.15, groundClearanceM: 5.5,  roadsRailM: 6.2,  buildingsVegetationM: 3.0, telecomOtherLinesM: 0.7, horizontalM: 3.0 },
  { highestSystemKV: 12,   nominalKV: 11,   safetyClearanceM: 0.20, groundClearanceM: 5.5,  roadsRailM: 6.3,  buildingsVegetationM: 3.0, telecomOtherLinesM: 0.8, horizontalM: 3.0 },
  { highestSystemKV: 24,   nominalKV: 22,   safetyClearanceM: 0.32, groundClearanceM: 5.5,  roadsRailM: 6.4,  buildingsVegetationM: 3.0, telecomOtherLinesM: 0.9, horizontalM: 3.0 },
  { highestSystemKV: 36,   nominalKV: 33,   safetyClearanceM: 0.43, groundClearanceM: 5.5,  roadsRailM: 6.5,  buildingsVegetationM: 3.0, telecomOtherLinesM: 1.0, horizontalM: 3.0 },
  { highestSystemKV: 48,   nominalKV: 44,   safetyClearanceM: 0.54, groundClearanceM: 5.5,  roadsRailM: 6.6,  buildingsVegetationM: 3.0, telecomOtherLinesM: 1.1, horizontalM: 3.0 },
  { highestSystemKV: 72,   nominalKV: 66,   safetyClearanceM: 0.77, groundClearanceM: 5.7,  roadsRailM: 6.9,  buildingsVegetationM: 3.2, telecomOtherLinesM: 1.4, horizontalM: 3.0 },
  { highestSystemKV: 100,  nominalKV: 88,   safetyClearanceM: 1.00, groundClearanceM: 5.9,  roadsRailM: 7.1,  buildingsVegetationM: 3.4, telecomOtherLinesM: 1.6, horizontalM: 3.0 },
  { highestSystemKV: 145,  nominalKV: 132,  safetyClearanceM: 1.45, groundClearanceM: 6.3,  roadsRailM: 7.5,  buildingsVegetationM: 3.8, telecomOtherLinesM: 2.0, horizontalM: 3.0 },
  { highestSystemKV: 245,  nominalKV: 220,  safetyClearanceM: 2.1,  groundClearanceM: 7.0,  roadsRailM: 8.2,  buildingsVegetationM: 4.5, telecomOtherLinesM: 2.7, horizontalM: 3.0 },
  { highestSystemKV: 300,  nominalKV: 275,  safetyClearanceM: 2.5,  groundClearanceM: 7.4,  roadsRailM: 8.6,  buildingsVegetationM: 4.9, telecomOtherLinesM: 3.1, horizontalM: 3.0 },
  { highestSystemKV: 362,  nominalKV: 330,  safetyClearanceM: 2.9,  groundClearanceM: 7.8,  roadsRailM: 9.0,  buildingsVegetationM: 5.3, telecomOtherLinesM: 3.5, horizontalM: 3.0 },
  { highestSystemKV: 420,  nominalKV: 400,  safetyClearanceM: 3.2,  groundClearanceM: 8.1,  roadsRailM: 9.3,  buildingsVegetationM: 5.6, telecomOtherLinesM: 3.8, horizontalM: 3.2 },
  { highestSystemKV: 800,  nominalKV: 765,  safetyClearanceM: 5.5,  groundClearanceM: 10.4, roadsRailM: 11.6, buildingsVegetationM: 8.5, telecomOtherLinesM: 6.1, horizontalM: 5.5 },
  { highestSystemKV: 533,  nominalKV: 533,  safetyClearanceM: 3.7,  groundClearanceM: 8.6,  roadsRailM: 9.8,  buildingsVegetationM: 6.1, telecomOtherLinesM: 4.3, horizontalM: 3.7, dc: true },
]

// Table E.2 — LV (<1kV) ground clearance detail by conductor system and
// road/crossing category. Table E.1's <1kV row gives a single ground
// clearance figure (4.9m, footnoted "see table E.2") for the general
// case; this is the detail behind that footnote.
export const LV_GROUND_CLEARANCE_TABLE = {
  bare:       { proclaimedRoadsRailM: 6.1, otherRoadsM: 4.9, excludingRoadsM: 4.9 },
  abc:        { proclaimedRoadsRailM: 6.1, otherRoadsM: 4.9, excludingRoadsM: 3.7 },
  concentric: { proclaimedRoadsRailM: 6.1, otherRoadsM: 4.7, excludingRoadsM: 3.0 },
}

/**
 * Minimum clearances (safety, ground, roads/rail, buildings/vegetation,
 * telecom/other power lines, horizontal) for a given nominal overhead
 * line voltage, per SANS 10280-1:2017 Annex E, Table E.1 (normative).
 * Covers the full LV/MV/HV/EHV range in one verified table — no
 * partial-scope or out-of-scope cases remain for AC voltages.
 * @param {string|number} voltageKVInput
 * @param {string} [conductorType] - 'bare'|'abc'|'concentric'; only affects the <1kV LV band (Table E.2). Defaults to 'bare'.
 * @returns {Object|null}
 */
export function clearanceLookup(voltageKVInput, conductorType = 'bare') {
  const voltageKV = pf(voltageKVInput)
  if (isNaN(voltageKV) || voltageKV <= 0) return null

  const acRows = SANS10280_CLEARANCE_TABLE.filter(r => !r.dc)
  const row = acRows.find(r => voltageKV <= r.highestSystemKV) || acRows[acRows.length - 1]
  const vClass = voltageClass(voltageKV)

  if (row.highestSystemKV === 1.1) {
    const lvKey = ['bare', 'abc', 'concentric'].includes(conductorType) ? conductorType : 'bare'
    const lvDetail = LV_GROUND_CLEARANCE_TABLE[lvKey]
    return {
      voltageClass: vClass,
      voltageBandKV: row.highestSystemKV,
      nominalVoltageKV: row.nominalKV,
      safetyClearanceM: row.safetyClearanceM,
      groundClearanceM: lvDetail.excludingRoadsM,
      groundOtherRoadsM: lvDetail.otherRoadsM,
      aboveRoadsRailM: lvDetail.proclaimedRoadsRailM,
      toBuildingsVegetationM: row.buildingsVegetationM,
      toTelecomOtherLinesM: row.telecomOtherLinesM,
      horizontalM: row.horizontalM,
      conductorType: lvKey,
      standard: SANS10280_STANDARD + ' ' + SANS10280_TABLE_E2_STANDARD,
    }
  }

  return {
    voltageClass: vClass,
    voltageBandKV: row.highestSystemKV,
    nominalVoltageKV: row.nominalKV,
    safetyClearanceM: row.safetyClearanceM,
    groundClearanceM: row.groundClearanceM,
    aboveRoadsRailM: row.roadsRailM,
    toBuildingsVegetationM: row.buildingsVegetationM,
    toTelecomOtherLinesM: row.telecomOtherLinesM,
    horizontalM: row.horizontalM,
    standard: SANS10280_STANDARD,
  }
}

/**
 * 533kV DC clearance lookup — the only DC voltage in SANS 10280-1
 * Table E.1 (a separate insulation-co-ordination case, per the
 * standard's footnote d — "maximum voltage to earth, for which
 * insulation is designed").
 * @param {string|number} voltageKVInput
 * @returns {Object|null}
 */
export function clearanceLookupDC(voltageKVInput) {
  const voltageKV = pf(voltageKVInput)
  if (isNaN(voltageKV) || voltageKV <= 0) return null
  const row = SANS10280_CLEARANCE_TABLE.find(r => r.dc)
  if (Math.round(voltageKV) !== row.highestSystemKV) {
    return {
      outOfScope: true,
      message: `Only ${row.highestSystemKV} kV DC is listed in SANS 10280-1 Table E.1 — no other DC voltage is verified from this source.`,
    }
  }
  return {
    dc: true,
    voltageBandKV: row.highestSystemKV,
    nominalVoltageKV: row.nominalKV,
    safetyClearanceM: row.safetyClearanceM,
    groundClearanceM: row.groundClearanceM,
    aboveRoadsRailM: row.roadsRailM,
    toBuildingsVegetationM: row.buildingsVegetationM,
    toTelecomOtherLinesM: row.telecomOtherLinesM,
    horizontalM: row.horizontalM,
    standard: SANS10280_STANDARD,
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

// ---------------------------------------------------------------------
// Pole Planting — DST_34-1191 §4.5.9, Table 6 ("Planting depths of
// equivalent concrete and wood poles"), re-fetched and transcribed from
// the primary accessible text 2026-07-28. Planting and backfilling
// procedure itself is per DISSCAAO1 Rev 2, which is referenced by the
// clause but NOT accessible — only the depth table is reproduced here,
// with the procedural standard honestly flagged [AI-18].
//
// GUARD NOTE: an AI-generated "planting depth" example table circulating
// in a feature wishlist (e.g. "8m pole → 1.5m") does NOT match this
// source — Table 6 has no 8m row at all. Only the rows below are real.
// A regression test locks the fabricated 8m row out.
// ---------------------------------------------------------------------

export const POLE_PLANTING = {
  wood: [
    { id: 'w5',   lengthM: 5,  tipDiaMM: '80',      depthMM: 1000, transformerPole: false },
    { id: 'w7',   lengthM: 7,  tipDiaMM: '120',     depthMM: 1300, transformerPole: false },
    { id: 'w9',   lengthM: 9,  tipDiaMM: '140',     depthMM: 1500, transformerPole: false },
    { id: 'w10',  lengthM: 10, tipDiaMM: '160',     depthMM: 1700, transformerPole: false },
    { id: 'w10t', lengthM: 10, tipDiaMM: '180',     depthMM: 1700, transformerPole: true },
    { id: 'w11',  lengthM: 11, tipDiaMM: '140/180', depthMM: 1800, transformerPole: false },
    { id: 'w12',  lengthM: 12, tipDiaMM: '160/200', depthMM: 2000, transformerPole: false },
    { id: 'w13',  lengthM: 13, tipDiaMM: '160/200', depthMM: 2200, transformerPole: false },
    { id: 'w14',  lengthM: 14, tipDiaMM: '180',     depthMM: 2200, transformerPole: false },
    { id: 'w16',  lengthM: 16, tipDiaMM: '180',     depthMM: 2200, transformerPole: false },
    { id: 'w18',  lengthM: 18, tipDiaMM: '180',     depthMM: 2400, transformerPole: false },
  ],
  concrete: [
    { id: 'c4',   lengthM: 4,  classLabel: '1 kN',             depthMM: 800,  transformerPole: false },
    { id: 'c7',   lengthM: 7,  classLabel: '4 kN',             depthMM: 1300, transformerPole: false },
    { id: 'c9',   lengthM: 9,  classLabel: '6 kN',             depthMM: 1500, transformerPole: false },
    { id: 'c10',  lengthM: 10, classLabel: '8 kN',             depthMM: 1800, transformerPole: false },
    { id: 'c10t', lengthM: 10, classLabel: 'Transformer pole', depthMM: 1800, transformerPole: true },
    { id: 'c11',  lengthM: 11, classLabel: '8 kN',             depthMM: 1800, transformerPole: false },
  ],
}

const POLE_PLANTING_STANDARD = 'DST_34-1191 §4.5.9, Table 6 — planting depths of concrete and wood poles; planting/backfilling procedure per DISSCAAO1 Rev 2 (referenced by the clause, not accessible — consult it or local practice for the backfilling method itself)'

/**
 * Look up the standard planting depth for a listed pole. Table-listed
 * rows ONLY — no interpolation for unlisted lengths, because Table 6 is
 * a discrete table of the poles Eskom actually stocks, not a formula.
 * Above-ground height is simple arithmetic (length − depth), flagged as
 * a derived value, not a table figure.
 * @param {'wood'|'concrete'} material
 * @param {string} rowId - id in POLE_PLANTING[material]
 * @returns {Object|null}
 */
export function polePlanting(material, rowId) {
  const rows = POLE_PLANTING[material]
  if (!rows) return null
  const row = rows.find(r => r.id === rowId)
  if (!row) {
    return {
      verified: false,
      message: 'This pole length is not a row in DST_34-1191 Table 6 — the table is a discrete list of stocked pole sizes, not a formula, so depths for unlisted lengths are deliberately not interpolated. Select a listed pole, or consult DISSCAAO1/the pole supplier directly.',
    }
  }
  const depthM = row.depthMM / 1000
  const aboveGroundM = Math.round((row.lengthM - depthM) * 100) / 100
  return {
    verified: true,
    material,
    lengthM: row.lengthM,
    tipDiaMM: row.tipDiaMM || null,
    classLabel: row.classLabel || null,
    transformerPole: row.transformerPole,
    plantingDepthMM: row.depthMM,
    plantingDepthM: depthM,
    aboveGroundM, // derived: length − planting depth (arithmetic, not a table value)
    standard: POLE_PLANTING_STANDARD,
  }
}

// ---------------------------------------------------------------------
// Stringing & construction numeric rules — every figure clause-cited to
// DST_34-1191. These are the only numbers the Construction sub-tab
// presents; everything else there is qualitative sequence/checklist
// content. A test asserts each entry carries its clause reference.
// ---------------------------------------------------------------------
export const STRINGING_RULES = [
  { id: 'initialTension', label: 'Max initial (stringing) tension', value: '50% of UTS', clause: 'DST_34-1191 §4.6.2 (OHS Act design limit)' },
  { id: 'finalTension',   label: 'Max final tension', value: '40% of UTS', clause: 'DST_34-1191 §4.6.2 (OHS Act design limit, @ −5°C + 700 Pa wind)' },
  { id: 'jointsMiddle',   label: 'Joint placement', value: 'Middle third of span, as far as possible', clause: 'DST_34-1191 §4.6.3' },
  { id: 'jointsMinDist',  label: 'Min joint distance from a structure', value: '20 m', clause: 'DST_34-1191 §4.6.3' },
  { id: 'jointsCrossing', label: 'Joints in crossing spans', value: 'Not permitted', clause: 'DST_34-1191 §4.6.3' },
  { id: 'jointsType',     label: 'Joint type', value: 'Compression only, by Eskom-approved trained persons', clause: 'DST_34-1191 §4.6.3 / DSP0035 Rev 3' },
  { id: 'stayAssembly',   label: 'Standard MV stay assembly', value: '96 kN', clause: 'DST_34-1191 §4.5.8' },
  { id: 'stayBisector',   label: 'H-pole deviation > 60°', value: 'Bisector stays on both uprights', clause: 'DST_34-1191 §4.5.8' },
  { id: 'minSpan',        label: 'Minimum design span', value: '50 m (shorter ⇒ structure exceeding design limit)', clause: 'DST_34-1191 §4.5.10.2(j)' },
  { id: 'cValueStd',      label: 'Tension C-value, ACSR/AAAC (no dampers)', value: '1425', clause: 'DST_34-1191 §4.6.2 (RSAT)' },
  { id: 'cValueExtra',    label: 'Tension C-value, extra-strength ACSR', value: '2712', clause: 'DST_34-1191 §4.6.2 (RSAT)' },
  { id: 'cValueSteel',    label: 'Tension C-value, steel wire', value: '2242', clause: 'DST_34-1191 §4.6.2 (RSAT)' },
]

// ---------------------------------------------------------------------
// Line Construction Sequence — ordered qualitative reference. Each phase
// is anchored to the DST_34-1191 clause (or referenced standard) that
// governs it where one exists; phases with no accessible clause are
// honestly marked as general practice. No fabricated figures — the only
// numbers that appear are the clause-cited ones from STRINGING_RULES /
// POLE_PLANTING territory.
// ---------------------------------------------------------------------
export const CONSTRUCTION_SEQUENCE = [
  { id: 'approvals', phase: 1, title: 'Planning, wayleaves & statutory approvals',
    detail: 'Sign wayleave/servitude agreements with every private property owner on the route. Submit the project to Telkom in the prescribed manner and engage their regional representatives early. Obtain approvals from other statutory bodies as applicable (national/provincial roads, forestry, civil aviation, local authorities). Carry out an EIA for major/sensitive expansions or a scoping exercise for minor ones.',
    clause: 'DST_34-1191 §4.1.1–4.1.3, §4.2.1' },
  { id: 'survey', phase: 2, title: 'Route survey & structure pegging',
    detail: 'Peg structure positions to the design. Span lengths are governed by the lesser of ground-clearance, electrical, wind and weight spans from the structure strength tables — minimum design span 50 m. In poor soils, wind-span assumptions must be re-checked against actual bearing-pressure tests.',
    clause: 'DST_34-1191 §4.5.5–4.5.6, §4.5.10.2(j)' },
  { id: 'materials', phase: 3, title: 'Pole delivery, storage & handling',
    detail: 'Wood poles: minimum 55 MPa fibre strength per DSP_34-1647; CCA-treated poles are urban-only (not for rural lines). In dry climates (mean annual timber equilibrium moisture content below 100 g/kg) store poles at least 6 months before use — below 80 g/kg, one year — to limit pole twisting. Concrete poles must not be used in exposed high-lightning rural areas.',
    clause: 'DST_34-1191 §4.5.4 + notes' },
  { id: 'planting', phase: 4, title: 'Excavation & pole planting',
    detail: 'Plant poles and stays and backfill holes per DISSCAAO1 Rev 2, at the Table 6 planting depths (see the Pole Planting sub-tab). Poles must end up plumb and correctly compacted — this is an explicit pre-energization inspection item.',
    clause: 'DST_34-1191 §4.5.9 (Table 6), §4.10.2' },
  { id: 'stays', phase: 5, title: 'Stay installation & testing',
    detail: 'Standard MV stay assembly is 96 kN. Use as few stays as practical; bisector stays for angle structures where practical, and on both uprights of H-pole structures beyond 60° deviation. Conventional, rock or percussion anchors per soil conditions — installation testing per DSP-34-1657. Fit anti-climbing devices to struts.',
    clause: 'DST_34-1191 §4.5.8; DSP-34-1657 Rev 2' },
  { id: 'dressing', phase: 6, title: 'Pole-top hardware & insulator dressing',
    detail: 'Dress structures per the standard assembly drawings, phasing per D-DT-0311 (viewed from the source substation). Apply the insulation co-ordination and bonding practice chosen for the area (BIL downwires, 500 mm wood-path gap, bonding of insulator dead ends in polluted areas).',
    clause: 'DST_34-1191 §4.4.6–4.4.9 (Table 4), §4.5.7' },
  { id: 'stringing', phase: 7, title: 'Conductor stringing',
    detail: 'String through running blocks; construction/stringing stays, if left in place, must be slackened off slightly once stringing is complete. Initial (stringing) tension limited to 50% of UTS.',
    clause: 'DST_34-1191 §4.5.8, §4.6.2' },
  { id: 'sagging', phase: 8, title: 'Sagging, tensioning & jointing',
    detail: 'Sag to the RSAT sag/tension tables for the conductor and area (final tension limit 40% UTS at −5°C + 700 Pa wind; C-values chosen so standard lines need no dampers). Joints: compression type only by approved trained persons, in the middle third of the span where possible, never within 20 m of a structure, never in crossing spans.',
    clause: 'DST_34-1191 §4.6.2–4.6.3' },
  { id: 'equipment', phase: 9, title: 'Jumpers, pole-mounted equipment & earthing',
    detail: 'Fit covered (insulated) jumpers at auxiliary structures and equipment — treated as bare for safety clearances. Install and label transformers, isolators, fuses and reclosers per the Buyers\' Guide assemblies; earth per DST_34-1985 (MV/LV reticulation earthing — see the Earthing module).',
    clause: 'DST_34-1191 §4.2.4, §4.9; DST_34-1985' },
  { id: 'inspection', phase: 10, title: 'Pre-energization inspection & electrical tests',
    detail: 'Complete the §4.10.2 visual inspection checklist (every answer must be affirmative before energizing) and perform earth resistance tests at transformer and auxiliary structures per DST_34-1985 / SCSASAAL9. Record all results.',
    clause: 'DST_34-1191 §4.10' },
  { id: 'energize', phase: 11, title: 'Energization & handover',
    detail: 'Energize only once inspections and tests are recorded and passed. Hand over the recorded inspection/test documentation with the as-built layout.',
    clause: 'DST_34-1191 §4.10.1' },
]

// ---------------------------------------------------------------------
// Pre-Energization Inspection Checklist — DST_34-1191 §4.10.2, the
// standard's own visual-inspection list (item wording condensed; the
// clause requires every answer to be affirmative before the line may be
// energized). Grouped as in the source. Rendered as an interactive
// tick-off checklist, same UI precedent as the Grid-Tie compliance
// checklist.
// ---------------------------------------------------------------------
export const PRE_ENERGIZATION_CHECKLIST = [
  { group: 'General', items: [
    { id: 'gen-layout',   text: 'Installation corresponds with the layout drawing' },
    { id: 'gen-statutory',text: 'All necessary statutory approvals attained' },
  ]},
  { group: 'MV Lines', items: [
    { id: 'mv-config',    text: 'MV configuration used suits the job' },
    { id: 'mv-clearance', text: 'All clearances in accordance with the drawings and the OHS Act' },
    { id: 'mv-binding',   text: 'Conductors correctly bound to the insulators' },
    { id: 'mv-stayins',   text: 'Stay insulators fitted' },
    { id: 'mv-plumb',     text: 'Poles plumb and correctly compacted' },
    { id: 'mv-insul',     text: 'Insulators sound' },
    { id: 'mv-tension',   text: 'Conductor correctly tensioned' },
    { id: 'mv-hardware',  text: 'Line hardware correctly fitted' },
  ]},
  { group: 'Transformers', items: [
    { id: 'tx-label',     text: 'Transformer installation labelled correctly' },
    { id: 'tx-sa-fit',    text: 'MV surge arresters fitted correctly' },
    { id: 'tx-sa-earth',  text: 'MV surge arresters earthed correctly' },
    { id: 'tx-tank',      text: 'Transformer tank earthed correctly' },
    { id: 'tx-earthlead', text: 'Earth lead securely fixed to the pole' },
    { id: 'tx-fuse-label',text: 'Drop-out fuses correctly labelled' },
    { id: 'tx-fuse-align',text: 'Drop-out fuses correctly aligned' },
    { id: 'tx-fuse-rate', text: 'Fuse elements have the correct ratings' },
    { id: 'tx-fuse-op',   text: 'Drop-out fuses operate correctly' },
    { id: 'tx-fuse-ins',  text: 'Drop-out fuse insulators sound' },
    { id: 'tx-bushings',  text: 'Transformer bushings sound' },
    { id: 'tx-oil',       text: 'Transformer free from oil leaks' },
    { id: 'tx-tap',       text: 'Tap changer in the correct position and locked' },
    { id: 'tx-mount',     text: 'Unit mounted level and secured on the platform' },
    { id: 'tx-phasing',   text: 'Phasing correct' },
  ]},
  { group: 'Isolators / Air-Break Switches', items: [
    { id: 'iso-insul',    text: 'Insulators sound' },
    { id: 'iso-align',    text: 'Equipment aligned correctly (open and close)' },
    { id: 'iso-horn',     text: 'Arcing horn alignment correct' },
    { id: 'iso-mount',    text: 'Mounted to the manufacturer\u2019s specification' },
    { id: 'iso-lock',     text: 'Locking mechanisms (if fitted) operable' },
    { id: 'iso-footplate',text: 'Footplate for hand-operated gang isolators installed and correctly earthed' },
    { id: 'iso-earth',    text: 'Earthing conforms to requirements' },
  ]},
  { group: 'PMB / Sectionalizers', items: [
    { id: 'pmb-mount',    text: 'Mounted to the manufacturer\u2019s specification' },
    { id: 'pmb-insul',    text: 'Insulators sound' },
  ]},
  { group: 'Electrical Tests', items: [
    { id: 'test-earth',   text: 'Earth resistance test results at transformer and auxiliary structures recorded and attached (per DST_34-1985 / SCSASAAL9)' },
  ]},
]

export const PRE_ENERGIZATION_STANDARD = 'DST_34-1191 §4.10.2 — pre-energization visual inspection (every answer must be affirmative before the line may be energized); electrical tests per §4.10.3 / DST_34-1985'

// ---------------------------------------------------------------------
// Lightning Exposure — DST_34-1191 §4.4.9 notes.
//   Ns = Ng × (28·H^0.6 + W) × L × 10⁻³   [strikes/year to the line]
//   Ng = 0.04 × Td^1.25                    [from Weather Bureau thunder days]
// Ground flash density (Ng) must be supplied by the user for their area
// (from utility isokeraunic data or the Weather Bureau) — the standard's
// per-town Ng table is deliberately NOT reproduced, per the project's
// no-place-names rule; Ng in South Africa/Lesotho spans roughly 0.1–13
// strikes/km²/yr depending on area, which is why a local figure matters.
// ---------------------------------------------------------------------

/**
 * @param {Object} p
 * @param {string|number} [p.ngPerKm2Yr] - ground flash density; if blank, derived from thunderDays
 * @param {string|number} [p.thunderDays] - annual thunder days (Td), used only if Ng not given
 * @param {string|number} p.avgHeightM   - average structure height, m
 * @param {string|number} p.lineWidthM   - line width, m
 * @param {string|number} p.lengthKm     - line length, km
 * @returns {Object|null}
 */
export function lightningExposure({ ngPerKm2Yr, thunderDays, avgHeightM, lineWidthM, lengthKm } = {}) {
  const H = pf(avgHeightM)
  const W = pf(lineWidthM)
  const L = pf(lengthKm)
  if (isNaN(H) || H <= 0) return null
  if (isNaN(W) || W < 0) return null
  if (isNaN(L) || L <= 0) return null

  let ng = pf(ngPerKm2Yr)
  let ngDerivedFromTd = false
  if (isNaN(ng) || ng <= 0) {
    const td = pf(thunderDays)
    if (isNaN(td) || td <= 0) return null
    ng = 0.04 * Math.pow(td, 1.25)
    ngDerivedFromTd = true
  }

  const ns = ng * (28 * Math.pow(H, 0.6) + W) * L * 1e-3

  return {
    ngPerKm2Yr: Math.round(ng * 100) / 100,
    ngDerivedFromTd,
    strikesPerYear: Math.round(ns * 100) / 100,
    strikesPer100kmYear: Math.round((ns / L) * 100 * 100) / 100,
    standard: 'DST_34-1191 §4.4.9 notes — Ns = Ng(28H^0.6 + W)·L·10⁻³; Ng = 0.04·Td^1.25',
  }
}

// ---------------------------------------------------------------------
// Fault Finding / Maintenance — qualitative reference. Every mechanism
// below is drawn from DST_34-1191's own failure-mechanism discussion
// (clause cited per entry); the field indicators are standard trade
// diagnostics with no fabricated figures. A test asserts the only
// numerals appearing are the clause-cited ones.
// ---------------------------------------------------------------------
export const FAULT_FINDING = [
  { id: 'direct-strike', fault: 'Lightning — direct strike flashover',
    mechanism: 'A direct strike to an unshielded line nearly always flashes one or more conductors to earth at the pole closest to the strike; on low-BIL lines flashover may occur at several structures, on high-BIL lines at only one (with severe surge transmitted toward terminal equipment).',
    lookFor: 'Flash marks on insulators, fresh splintering on poles/cross-arms near the suspected strike point, operated arresters or blown fuses on the section.',
    clause: 'DST_34-1191 §4.4.3' },
  { id: 'power-arc', fault: 'Power-arc damage after flashover',
    mechanism: 'Most physical damage is caused by the power-frequency arc that follows a flashover (0,85 probability), not the surge itself. Damage severity depends on wood moisture content and arc penetration — worst where the arc penetrates rather than tracking the surface.',
    lookFor: 'Burnt/split poles and cross-arms; check that earth-wire wood-path gaps do not exceed 500 mm and that circumferential strapping is present at earth-wire termination points on either side of the gap.',
    clause: 'DST_34-1191 §4.4.5' },
  { id: 'induced', fault: 'Induced-voltage flashovers (nearby strikes)',
    mechanism: 'Induced voltages rarely exceed 200 kV (maximum order 250 kV) and appear near-identically on all phases — so phase-to-phase flashover is not expected; flashover is to ground wherever insulation strength to ground is below the induced level.',
    lookFor: 'Single-phase-to-earth trips in storms with no visible strike damage on the line itself; repeated trips on low-BIL sections.',
    clause: 'DST_34-1191 §4.4.4' },
  { id: 'pollution', fault: 'Pollution tracking / leakage burning',
    mechanism: 'In polluted environments (marine/industrial), small leakage currents across contaminated insulators can burn unbonded cross-arms and poles at the insulator dead ends.',
    lookFor: 'Charring at insulator attachment points on unbonded structures; verify bonding of insulator dead ends and stay wires in polluted areas; check insulator creepage class against the pollution level.',
    clause: 'DST_34-1191 §4.4.6, §4.4.1' },
  { id: 'joints', fault: 'Joint / connection failures',
    mechanism: 'Compression joints degrade if incorrectly made or wrongly placed; a failing joint runs hot, then burns down. Joints are compression-type only, made by approved trained persons, placed in the middle third of the span, never within 20 m of a structure and never in a crossing span.',
    lookFor: 'Discoloured/annealed conductor at joints (thermal imaging on load if available), joints found in prohibited positions during patrols.',
    clause: 'DST_34-1191 §4.6.3 / DSP0035' },
  { id: 'fatigue', fault: 'Conductor fatigue / aeolian vibration',
    mechanism: 'Standard lines are tensioned to C-values (1425 ACSR/AAAC) specifically chosen so dampers are unnecessary; lines tensioned beyond those values without damping are exposed to vibration fatigue at the clamps.',
    lookFor: 'Broken outer strands at suspension clamps and armour-rod ends; check as-built tensions against the RSAT tables if fatigue appears.',
    clause: 'DST_34-1191 §4.6.2' },
  { id: 'birds', fault: 'Bird streamers / electrocution faults',
    mechanism: 'Large birds bridging phase-to-earth gaps (or streamer discharges) cause transient trips, typically at structures rather than mid-span, and bird electrocutions at un-insulated jumpers.',
    lookFor: 'Carcasses/nests at structures on the tripping section; confirm covered jumpers at auxiliary structures, staggered bared sections, and bird-friendly pole-top configurations in sensitive areas.',
    clause: 'DST_34-1191 §4.2.2, §4.2.4' },
  { id: 'vegetation', fault: 'Vegetation / clearance encroachment',
    mechanism: 'Growth under and beside the line reduces statutory clearances until flashover or direct contact occurs, especially at maximum sag (high load, hot day).',
    lookFor: 'Burn marks on treetops under the line, clearance measurements against the Reg 15 table (see the Clearances sub-tab) at worst-case sag, servitude clearing state.',
    clause: 'OHS Act Electrical Machinery Regulations Reg 15' },
  { id: 'stays', fault: 'Stay / structure lean failures',
    mechanism: 'Slack, corroded or broken stays let angle and terminal structures lean, redistributing tension until hardware or the pole fails. Porcelain stay insulators add little surge insulation and can crack.',
    lookFor: 'Leaning poles at angles/terminations, slack or broken stay strands, missing anti-climbing devices, cracked stay insulators, anchor movement.',
    clause: 'DST_34-1191 §4.5.8, §4.4.7' },
]

// ---------------------------------------------------------------------
// Stringing Equipment Glossary — qualitative trade-terminology reference
// (no pictures, no fabricated specifications). Where a DST_34-1191 rule
// attaches to an item, the clause is cited; the rest is standard line-
// construction trade usage, marked as general reference.
// ---------------------------------------------------------------------
export const STRINGING_GLOSSARY = [
  { id: 'drum',       term: 'Conductor drum & drum stand (jack)', meaning: 'The reel the conductor ships on, mounted on braked stands so it pays out under control during stringing.' },
  { id: 'block',      term: 'Running block / stringing sheave', meaning: 'Free-running pulley hung at each structure so the conductor (or pilot wire) can be pulled through the section without dragging on hardware or ground.' },
  { id: 'pilot',      term: 'Pilot / draw wire', meaning: 'Light wire or rope pulled through the running blocks first, then used to pull the conductor itself through the section.' },
  { id: 'puller',     term: 'Puller & tensioner (tension stringing)', meaning: 'Machine pair keeping the conductor under controlled back-tension while it is pulled in, so it never touches the ground — the method of choice over roads, fences and crossings.' },
  { id: 'comealong',  term: 'Come-along (conductor grip)', meaning: 'Self-tightening clamp gripping the conductor so it can be pulled, held or dead-ended temporarily during sagging.' },
  { id: 'swivel',     term: 'Swivel connector', meaning: 'Rotating link between pilot wire and conductor that stops lay-direction twist being wound into the conductor during the pull.' },
  { id: 'dyno',       term: 'Dynamometer', meaning: 'In-line tension gauge used while sagging to bring the conductor to the table tension.' },
  { id: 'sagboard',   term: 'Sagging boards / sighting targets', meaning: 'Targets fixed at the calculated sag below the attachment points on two structures; the sagger sights between them and adjusts tension until the conductor low point touches the sight line.' },
  { id: 'sagtemp',    term: 'Conductor temperature (for sag tables)', meaning: 'Sag/tension tables are temperature-specific — the conductor temperature at time of sagging selects the table column. In this territory the tables come from RSAT.', clause: 'DST_34-1191 §4.6.2' },
  { id: 'constay',    term: 'Construction / stringing stays', meaning: 'Temporary stays supporting structures against one-sided stringing loads; if left in place they must be slackened off slightly once stringing is complete.', clause: 'DST_34-1191 §4.5.8' },
  { id: 'presstool',  term: 'Compression jointing tooling (dies & press)', meaning: 'Hydraulic press and conductor-specific dies for mid-span joints and dead-end sleeves — compression joints may only be made by persons who have passed approved compression-jointing training.', clause: 'DST_34-1191 §4.6.3 / DSP0035' },
]
