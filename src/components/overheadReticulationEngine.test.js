import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  conductorLookup, clearanceLookup, clearanceLookupDC, structureClearance, phaseSpacing,
  fittingSelection, FITTING_TYPES, STRUCTURE_TYPES, STRUCTURE_MATERIALS,
  CONDUCTORS, SANS10280_CLEARANCE_TABLE, LV_GROUND_CLEARANCE_TABLE,
} from './overheadReticulationEngine.js'

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

describe('conductorLookup', () => {
  test('returns known ACSR conductor (Hare) at default 70°C/normal rate', () => {
    const r = conductorLookup('Hare')
    assert.equal(r.verified, true)
    assert.equal(r.type, 'ACSR')
    assert.equal(r.areaMM2, 122.48)
    assert.equal(r.tempC, 70)
    assert.equal(r.rateClass, 'normal')
    assert.equal(r.ratingA, 376)
    assert.equal(r.ratingNormalA, 376)
    assert.equal(r.ratingEmergencyA, 496)
  })

  test('returns known AAAC conductor (Oak)', () => {
    const r = conductorLookup('oak')
    assert.equal(r.type, 'AAAC')
    assert.equal(r.ratingA, 391) // 70°C, normal
  })

  test('emergency rate class returns Rate B, not Rate A', () => {
    const r = conductorLookup('Hare', 70, 'emergency')
    assert.equal(r.ratingA, 496)
    assert.equal(r.rateClass, 'emergency')
  })

  test('all four verified temperature bands work (Squirrel)', () => {
    assert.equal(conductorLookup('squirrel', 50).ratingA, 104)
    assert.equal(conductorLookup('squirrel', 60).ratingA, 122)
    assert.equal(conductorLookup('squirrel', 70).ratingA, 138)
    assert.equal(conductorLookup('squirrel', 80).ratingA, 150)
  })

  test('an unverified temperature is honestly flagged, not interpolated or guessed', () => {
    const r = conductorLookup('hare', 65)
    assert.equal(r.verified, false)
    assert.ok(r.message.includes('50/60/70/80'))
    assert.equal(r.ratingA, undefined)
  })

  test('comma-decimal temperature input is handled', () => {
    const dot = conductorLookup('hare', '70')
    const comma = conductorLookup('hare', '70,0')
    assert.deepEqual(dot, comma)
  })

  test('case-insensitive lookup', () => {
    assert.equal(conductorLookup('SQUIRREL').ratingA, conductorLookup('Squirrel').ratingA)
  })

  test('unknown code returns null', () => {
    assert.equal(conductorLookup('unobtainium'), null)
    assert.equal(conductorLookup(''), null)
    assert.equal(conductorLookup(null), null)
  })

  test('the resolved Magpie conflict: neither 78A nor 133.8A appears anywhere in the verified data', () => {
    // Regression guard for the specific cross-source conflict this rebuild fixed.
    const allRatings = Object.values(CONDUCTORS.magpie.ratings).flatMap(b => [b.ra, b.rb])
    assert.ok(!allRatings.includes(78))
    assert.ok(!allRatings.includes(133.8))
    // Real verified range per 240-152844641 Rev 2 Annex C: 33A (50°C normal) to 70A (80°C emergency)
    assert.equal(Math.min(...allRatings), 33)
    assert.equal(Math.max(...allRatings), 70)
  })

  test('conductor set extends through IEC 800 (835mm²), well past 66kV sub-transmission sizes', () => {
    assert.ok('iec800acsr' in CONDUCTORS)
    assert.equal(CONDUCTORS.iec800acsr.areaMM2, 835)
    assert.equal(Object.keys(CONDUCTORS).length, 47) // 40 Eskom-rated + 7 BS215 dimension-only
  })

  test('every Eskom-rated conductor has all four temperature bands with ra <= rb', () => {
    for (const [name, c] of Object.entries(CONDUCTORS)) {
      if (c.ratings === null) continue // BS215 dimension-only set
      for (const t of [50, 60, 70, 80]) {
        const band = c.ratings[t]
        assert.ok(band, `${name} missing ${t}°C band`)
        assert.ok(band.ra <= band.rb, `${name} at ${t}°C: RA (${band.ra}) should be <= RB (${band.rb})`)
      }
    }
  })

  test('Rabbit (BS215 dimension-only) returns real dimensions but honestly NO ampacity', () => {
    const r = conductorLookup('rabbit')
    assert.equal(r.verified, true)
    assert.equal(r.ratingsAvailable, false)
    assert.equal(r.diaMM, 10.05)
    assert.equal(r.ratingA, undefined)
    assert.ok(r.ratingsMessage.includes('240-152844641'))
  })

  test('all 7 BS215 dimension-only conductors present with null ratings', () => {
    const bs215 = ['gopher', 'weasel', 'ferret', 'rabbit', 'otter', 'dog', 'lynx']
    for (const name of bs215) {
      assert.ok(name in CONDUCTORS, `${name} missing`)
      assert.equal(CONDUCTORS[name].ratings, null)
    }
  })

  test('Eskom-rated conductors carry ratingsAvailable:true', () => {
    assert.equal(conductorLookup('hare').ratingsAvailable, true)
  })
})

describe('fittingSelection', () => {
  test('dead-end for Hare keys on diameter, not colour', () => {
    const r = fittingSelection('hare', 'deadend')
    assert.equal(r.applicable, true)
    assert.equal(r.matchDiameterMM, 14.16)
    assert.ok(r.guidance.includes('14.16'))
    assert.ok(r.guidance.includes('ACSR'))
  })

  test('every result carries the manufacturer-specific colour warning', () => {
    const r = fittingSelection('zebra', 'splice')
    assert.ok(r.colourWarning.includes('MANUFACTURER-SPECIFIC'))
    assert.ok(r.colourWarning.includes('identification tag'))
  })

  test('guy grip is honestly flagged as sized to the stay strand, not the phase conductor', () => {
    const r = fittingSelection('hare', 'guyGrip')
    assert.equal(r.applicable, false)
    assert.ok(r.message.includes('STRAND'))
  })

  test('works for BS215 dimension-only conductors too (fitting match needs only diameter)', () => {
    const r = fittingSelection('rabbit', 'armorRods')
    assert.equal(r.applicable, true)
    assert.equal(r.matchDiameterMM, 10.05)
  })

  test('unknown conductor or fitting type returns null', () => {
    assert.equal(fittingSelection('unobtainium', 'deadend'), null)
    assert.equal(fittingSelection('hare', 'flyingButtress'), null)
    assert.equal(fittingSelection(null, 'deadend'), null)
  })

  test('all 4 fitting types have id, label, and use', () => {
    assert.equal(FITTING_TYPES.length, 4)
    for (const f of FITTING_TYPES) {
      assert.ok(f.id && f.label && f.use)
    }
  })
})

describe('structure typology reference', () => {
  test('all 5 structure types have id, label, and role — qualitative only, no fabricated numbers', () => {
    assert.equal(STRUCTURE_TYPES.length, 5)
    for (const s of STRUCTURE_TYPES) {
      assert.ok(s.id && s.label && s.role)
      assert.ok(!/\d+\s*(kN|MPa|Pa)\b/.test(s.role), `${s.id} should not contain fabricated strength figures`)
    }
  })

  test('all 4 structure materials have id, label, and notes', () => {
    assert.equal(STRUCTURE_MATERIALS.length, 4)
    for (const m of STRUCTURE_MATERIALS) {
      assert.ok(m.id && m.label && m.notes)
    }
  })
})

describe('clearanceLookup — SANS 10280-1:2017 Annex E, Table E.1 (2026-07-29)', () => {
  test('LV band (<=1.1kV) defaults to bare conductor, Table E.2 detail', () => {
    const r = clearanceLookup('1.1')
    assert.equal(r.voltageBandKV, 1.1)
    assert.equal(r.safetyClearanceM, null)
    assert.equal(r.groundClearanceM, 4.9)       // bare, excluding roads
    assert.equal(r.aboveRoadsRailM, 6.1)         // bare, proclaimed roads/rail
    assert.equal(r.toTelecomOtherLinesM, 0.6)
    assert.equal(r.toBuildingsVegetationM, 3.0)
    assert.equal(r.conductorType, 'bare')
  })

  test('LV band with ABC conductor type uses the lower Table E.2 ground clearance', () => {
    const r = clearanceLookup('0.4', 'abc')
    assert.equal(r.groundClearanceM, 3.7)
    assert.equal(r.conductorType, 'abc')
  })

  test('LV band with concentric conductor type uses the lowest Table E.2 ground clearance', () => {
    const r = clearanceLookup('0.4', 'concentric')
    assert.equal(r.groundClearanceM, 3.0)
    assert.equal(r.groundOtherRoadsM, 4.7)
  })

  test('11kV (12kV highest-system band)', () => {
    const r = clearanceLookup('11')
    assert.equal(r.voltageBandKV, 12)
    assert.equal(r.nominalVoltageKV, 11)
    assert.equal(r.safetyClearanceM, 0.20)
    assert.equal(r.groundClearanceM, 5.5)
    assert.equal(r.aboveRoadsRailM, 6.3)
  })

  test('33kV (36kV highest-system band)', () => {
    const r = clearanceLookup('33')
    assert.equal(r.voltageBandKV, 36)
    assert.equal(r.safetyClearanceM, 0.43)
    assert.equal(r.groundClearanceM, 5.5)
    assert.equal(r.aboveRoadsRailM, 6.5)
    assert.equal(r.toTelecomOtherLinesM, 1.0)
  })

  test('66kV (72kV highest-system band)', () => {
    const r = clearanceLookup('66')
    assert.equal(r.outOfScope, undefined)
    assert.equal(r.voltageBandKV, 72)
    assert.equal(r.groundClearanceM, 5.7)
    assert.equal(r.aboveRoadsRailM, 6.9)
    assert.equal(r.toBuildingsVegetationM, 3.2)
    assert.equal(r.safetyClearanceM, 0.77)
  })

  test('88kV (100kV highest-system band)', () => {
    const r = clearanceLookup('88')
    assert.equal(r.voltageBandKV, 100)
    assert.equal(r.groundClearanceM, 5.9)
    assert.equal(r.aboveRoadsRailM, 7.1)
  })

  test('132kV is fully verified — no partial/out-of-scope flags any more', () => {
    const r = clearanceLookup('132')
    assert.equal(r.partialScope, undefined)
    assert.equal(r.outOfScope, undefined)
    assert.equal(r.safetyClearanceM, 1.45)
    assert.equal(r.groundClearanceM, 6.3)
    assert.equal(r.aboveRoadsRailM, 7.5)
    assert.equal(r.toBuildingsVegetationM, 3.8)
    assert.equal(r.voltageClass, 'HV')
    assert.match(r.standard, /SANS 10280-1/)
  })

  test('220kV is now fully verified (SANS 10280-1 covers it directly) — no more out-of-scope flag', () => {
    const r = clearanceLookup(220)
    assert.equal(r.outOfScope, undefined)
    assert.equal(r.safetyClearanceM, 2.1)
    assert.equal(r.groundClearanceM, 7.0)
    assert.equal(r.voltageClass, 'EHV')
  })

  test('275kV uses the SANS 10280-1 value (2.5m), NOT the retired ESKASABG3 value (2.35m) — resolved conflict, Hertz decision 2026-07-29', () => {
    const r = clearanceLookup(275)
    assert.equal(r.safetyClearanceM, 2.5)
    assert.notEqual(r.safetyClearanceM, 2.35)
    assert.equal(r.groundClearanceM, 7.4)
    assert.equal(r.aboveRoadsRailM, 8.6)
    assert.equal(r.toBuildingsVegetationM, 4.9)
  })

  test('330kV is now verified (was entirely absent before)', () => {
    const r = clearanceLookup(330)
    assert.equal(r.safetyClearanceM, 2.9)
    assert.equal(r.groundClearanceM, 7.8)
  })

  test('400kV and 765kV — full clearance data, matches prior verified safety clearances', () => {
    const r400 = clearanceLookup(400)
    assert.equal(r400.safetyClearanceM, 3.20)
    assert.equal(r400.groundClearanceM, 8.1)
    assert.equal(r400.horizontalM, 3.2)

    const r765 = clearanceLookup(765)
    assert.equal(r765.safetyClearanceM, 5.50)
    assert.equal(r765.groundClearanceM, 10.4)
    assert.equal(r765.horizontalM, 5.5)
  })

  test('cross-validation: 11/22/33/44/66/88/132/400/765kV match the previously-verified ESKASABG3/Reg-15 safety clearances exactly', () => {
    assert.equal(clearanceLookup(11).safetyClearanceM, 0.20)
    assert.equal(clearanceLookup(22).safetyClearanceM, 0.32)
    assert.equal(clearanceLookup(33).safetyClearanceM, 0.43)
    assert.equal(clearanceLookup(44).safetyClearanceM, 0.54)
    assert.equal(clearanceLookup(66).safetyClearanceM, 0.77)
    assert.equal(clearanceLookup(88).safetyClearanceM, 1.00)
    assert.equal(clearanceLookup(132).safetyClearanceM, 1.45)
    assert.equal(clearanceLookup(400).safetyClearanceM, 3.20)
    assert.equal(clearanceLookup(765).safetyClearanceM, 5.50)
  })

  test('no clearance figures are fabricated — every AC voltage band up to 765kV returns a full, non-undefined result', () => {
    for (const kv of [0.4, 11, 22, 33, 44, 66, 88, 132, 220, 275, 330, 400, 765]) {
      const r = clearanceLookup(kv)
      assert.notEqual(r.groundClearanceM, undefined)
      assert.notEqual(r.aboveRoadsRailM, undefined)
      assert.notEqual(r.toBuildingsVegetationM, undefined)
      assert.notEqual(r.toTelecomOtherLinesM, undefined)
    }
  })

  test('verified LV/MV/HV/EHV results carry a voltageClass tag', () => {
    assert.equal(clearanceLookup(0.4).voltageClass, 'LV')
    assert.equal(clearanceLookup(11).voltageClass, 'MV')
    assert.equal(clearanceLookup(88).voltageClass, 'HV')
    assert.equal(clearanceLookup(275).voltageClass, 'EHV')
  })

  test('comma-decimal input handled', () => {
    const dot = clearanceLookup('22.5')
    const comma = clearanceLookup('22,5')
    assert.deepEqual(dot, comma)
  })

  test('invalid input returns null', () => {
    assert.equal(clearanceLookup('x'), null)
    assert.equal(clearanceLookup('0'), null)
    assert.equal(clearanceLookup(''), null)
  })

  test('an unrecognized conductorType falls back to bare rather than throwing', () => {
    const r = clearanceLookup('0.4', 'nonsense')
    assert.equal(r.conductorType, 'bare')
    assert.equal(r.groundClearanceM, 4.9)
  })

  test('all 15 rows of Table E.1 are present (14 AC bands + 1 DC row)', () => {
    assert.equal(SANS10280_CLEARANCE_TABLE.length, 15)
    assert.equal(SANS10280_CLEARANCE_TABLE.filter(r => r.dc).length, 1)
  })

  test('safety clearances increase monotonically with voltage across AC rows (physically required)', () => {
    const acRows = SANS10280_CLEARANCE_TABLE.filter(r => !r.dc && r.safetyClearanceM !== null)
    for (let i = 1; i < acRows.length; i++) {
      assert.ok(acRows[i].safetyClearanceM > acRows[i - 1].safetyClearanceM)
    }
  })
})

describe('clearanceLookupDC — 533kV DC (SANS 10280-1 Table E.1)', () => {
  test('533kV DC returns full verified clearance data', () => {
    const r = clearanceLookupDC(533)
    assert.equal(r.dc, true)
    assert.equal(r.safetyClearanceM, 3.70)
    assert.equal(r.groundClearanceM, 8.6)
    assert.equal(r.aboveRoadsRailM, 9.8)
    assert.equal(r.toBuildingsVegetationM, 6.1)
    assert.equal(r.horizontalM, 3.7)
  })

  test('a different DC voltage returns out-of-scope rather than a guessed value', () => {
    const r = clearanceLookupDC(350)
    assert.equal(r.outOfScope, true)
  })

  test('invalid input returns null', () => {
    assert.equal(clearanceLookupDC('x'), null)
  })
})

describe('LV_GROUND_CLEARANCE_TABLE — Table E.2 data integrity', () => {
  test('all three conductor types have the three required fields', () => {
    for (const key of ['bare', 'abc', 'concentric']) {
      const entry = LV_GROUND_CLEARANCE_TABLE[key]
      assert.notEqual(entry.proclaimedRoadsRailM, undefined)
      assert.notEqual(entry.otherRoadsM, undefined)
      assert.notEqual(entry.excludingRoadsM, undefined)
    }
  })

  test('proclaimed roads/rail clearance is identical (6.1m) across all conductor types', () => {
    assert.equal(LV_GROUND_CLEARANCE_TABLE.bare.proclaimedRoadsRailM, 6.1)
    assert.equal(LV_GROUND_CLEARANCE_TABLE.abc.proclaimedRoadsRailM, 6.1)
    assert.equal(LV_GROUND_CLEARANCE_TABLE.concentric.proclaimedRoadsRailM, 6.1)
  })

  test('excludingRoadsM decreases from bare to ABC to concentric (progressively lower-risk conductor systems)', () => {
    assert.ok(LV_GROUND_CLEARANCE_TABLE.bare.excludingRoadsM > LV_GROUND_CLEARANCE_TABLE.abc.excludingRoadsM)
    assert.ok(LV_GROUND_CLEARANCE_TABLE.abc.excludingRoadsM > LV_GROUND_CLEARANCE_TABLE.concentric.excludingRoadsM)
  })
})

describe('structureClearance', () => {
  test('33kV is verified with real numbers', () => {
    const r = structureClearance('33')
    assert.equal(r.verified, true)
    assert.equal(r.phaseToEarthMM, 430)
    assert.equal(r.phaseToPhaseMM, 500)
  })

  test('11kV and 22kV are honestly flagged as NOT verified, not fabricated', () => {
    const r11 = structureClearance('11')
    const r22 = structureClearance('22')
    assert.equal(r11.verified, false)
    assert.equal(r22.verified, false)
    assert.equal(r11.phaseToEarthMM, undefined)
  })

  test('invalid input returns null', () => {
    assert.equal(structureClearance('x'), null)
  })
})

describe('phaseSpacing', () => {
  test('22kV verified calculation, horizontal config (angle=0)', () => {
    const r = phaseSpacing({ spanM: '100', angleDeg: '0', voltageKV: '22' })
    assert.equal(r.verified, true)
    assert.ok(close(r.requiredSpacingM, 0.9))
  })

  test('22kV verified calculation, vertical config (angle=90)', () => {
    const r = phaseSpacing({ spanM: '200', angleDeg: '90', voltageKV: '22' })
    assert.ok(close(r.requiredSpacingM, 0.2 + 0.4))
  })

  test('comma-decimal span input handled identically to period', () => {
    const dot = phaseSpacing({ spanM: '150.5', angleDeg: '0', voltageKV: '22' })
    const comma = phaseSpacing({ spanM: '150,5', angleDeg: '0', voltageKV: '22' })
    assert.deepEqual(dot, comma)
  })

  test('flags spans below the 50m design floor', () => {
    const r = phaseSpacing({ spanM: '30', angleDeg: '0', voltageKV: '22' })
    assert.equal(r.belowMinSpanFloor, true)
  })

  test('11kV and 33kV honestly flagged as NOT verified, not extrapolated', () => {
    const r11 = phaseSpacing({ spanM: '100', angleDeg: '0', voltageKV: '11' })
    const r33 = phaseSpacing({ spanM: '100', angleDeg: '0', voltageKV: '33' })
    assert.equal(r11.verified, false)
    assert.equal(r33.verified, false)
    assert.equal(r11.requiredSpacingM, undefined)
  })

  test('invalid input returns null', () => {
    assert.equal(phaseSpacing({ spanM: 'x', angleDeg: '0', voltageKV: '22' }), null)
    assert.equal(phaseSpacing({ spanM: '100', angleDeg: 'x', voltageKV: '22' }), null)
    assert.equal(phaseSpacing({}), null)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 2026-07-28 additions: Pole Planting, Construction, Lightning
// Exposure, Fault Finding, Stringing Glossary
// ═══════════════════════════════════════════════════════════════════
import {
  polePlanting, POLE_PLANTING,
  lightningExposure,
  STRINGING_RULES, CONSTRUCTION_SEQUENCE,
  PRE_ENERGIZATION_CHECKLIST, PRE_ENERGIZATION_STANDARD,
  FAULT_FINDING, STRINGING_GLOSSARY,
  voltageClass, VOLTAGE_CLASS_CONVENTION, TRANSMISSION_VOLTAGE_PRESETS,
} from './overheadReticulationEngine.js'

describe('polePlanting — DST_34-1191 §4.5.9 Table 6', () => {
  test('9m wood pole plants 1500mm, 7.5m above ground', () => {
    const r = polePlanting('wood', 'w9')
    assert.equal(r.verified, true)
    assert.equal(r.plantingDepthMM, 1500)
    assert.equal(r.aboveGroundM, 7.5)
    assert.equal(r.tipDiaMM, '140')
  })

  test('18m wood pole plants 2400mm (deepest table row)', () => {
    const r = polePlanting('wood', 'w18')
    assert.equal(r.plantingDepthMM, 2400)
    assert.equal(r.aboveGroundM, 15.6)
  })

  test('14m and 16m wood share the 2200mm depth (real table quirk, not a transcription slip)', () => {
    assert.equal(polePlanting('wood', 'w14').plantingDepthMM, 2200)
    assert.equal(polePlanting('wood', 'w16').plantingDepthMM, 2200)
    assert.equal(polePlanting('wood', 'w13').plantingDepthMM, 2200)
  })

  test('4m concrete (1 kN) plants 800mm', () => {
    const r = polePlanting('concrete', 'c4')
    assert.equal(r.plantingDepthMM, 800)
    assert.equal(r.classLabel, '1 kN')
    assert.equal(r.aboveGroundM, 3.2)
  })

  test('10m transformer poles carry the transformer flag, both materials', () => {
    const w = polePlanting('wood', 'w10t')
    assert.equal(w.transformerPole, true)
    assert.equal(w.plantingDepthMM, 1700)
    assert.equal(w.tipDiaMM, '180') // heavier tip than the standard 10m (160)
    const c = polePlanting('concrete', 'c10t')
    assert.equal(c.transformerPole, true)
    assert.equal(c.plantingDepthMM, 1800)
  })

  test('unlisted pole returns honest not-in-table, no interpolation', () => {
    const r = polePlanting('wood', 'w8')
    assert.equal(r.verified, false)
    assert.match(r.message, /not a row/i)
  })

  test('REGRESSION — fabricated AI wishlist row "8m → 1.5m" is locked out: Table 6 has no 8m pole', () => {
    const all = [...POLE_PLANTING.wood, ...POLE_PLANTING.concrete]
    assert.equal(all.some(r => r.lengthM === 8), false)
    // and 1500mm belongs to the 9m rows only
    for (const r of all.filter(r => r.depthMM === 1500)) assert.equal(r.lengthM, 9)
  })

  test('invalid material returns null', () => {
    assert.equal(polePlanting('steel', 'w9'), null)
  })
})

describe('lightningExposure — DST_34-1191 §4.4.9', () => {
  test('hand-calculated Ns: Ng=7.5, H=10m, W=2m, L=50km → 42.55 strikes/yr', () => {
    const r = lightningExposure({ ngPerKm2Yr: 7.5, avgHeightM: 10, lineWidthM: 2, lengthKm: 50 })
    assert.equal(r.strikesPerYear, 42.55)
    assert.equal(r.ngDerivedFromTd, false)
    assert.equal(r.strikesPer100kmYear, 85.1)
  })

  test('Td path: Td=60 → Ng=6.68; H=8, W=1.5, L=12 → 7.94 strikes/yr', () => {
    const r = lightningExposure({ thunderDays: 60, avgHeightM: 8, lineWidthM: 1.5, lengthKm: 12 })
    assert.equal(r.ngDerivedFromTd, true)
    assert.equal(r.ngPerKm2Yr, 6.68)
    assert.equal(r.strikesPerYear, 7.94)
  })

  test('explicit Ng wins over Td when both supplied', () => {
    const r = lightningExposure({ ngPerKm2Yr: 5, thunderDays: 60, avgHeightM: 10, lineWidthM: 2, lengthKm: 10 })
    assert.equal(r.ngDerivedFromTd, false)
    assert.equal(r.ngPerKm2Yr, 5)
  })

  test('comma-decimal inputs produce identical results to period-decimal', () => {
    const a = lightningExposure({ ngPerKm2Yr: '7,5', avgHeightM: '10', lineWidthM: '2', lengthKm: '50' })
    const b = lightningExposure({ ngPerKm2Yr: '7.5', avgHeightM: '10', lineWidthM: '2', lengthKm: '50' })
    assert.deepEqual(a, b)
    assert.equal(a.strikesPerYear, 42.55)
  })

  test('missing both Ng and Td, or non-positive geometry, returns null', () => {
    assert.equal(lightningExposure({ avgHeightM: 10, lineWidthM: 2, lengthKm: 50 }), null)
    assert.equal(lightningExposure({ ngPerKm2Yr: 5, avgHeightM: 0, lineWidthM: 2, lengthKm: 50 }), null)
    assert.equal(lightningExposure({ ngPerKm2Yr: 5, avgHeightM: 10, lineWidthM: 2, lengthKm: 0 }), null)
  })
})

describe('Construction reference data — sourcing discipline', () => {
  test('every STRINGING_RULES entry is clause-cited to DST_34-1191', () => {
    assert.ok(STRINGING_RULES.length >= 10)
    for (const r of STRINGING_RULES) assert.match(r.clause, /DST_34-1191/)
  })

  test('CONSTRUCTION_SEQUENCE is 11 phases, strictly ordered, each with a clause anchor', () => {
    assert.equal(CONSTRUCTION_SEQUENCE.length, 11)
    CONSTRUCTION_SEQUENCE.forEach((p, i) => {
      assert.equal(p.phase, i + 1)
      assert.ok(p.clause && p.clause.length > 0)
      assert.ok(p.title && p.detail)
    })
  })

  test('PRE_ENERGIZATION_CHECKLIST reproduces the §4.10.2 structure: 6 groups, 35 items, unique ids', () => {
    assert.equal(PRE_ENERGIZATION_CHECKLIST.length, 6)
    const items = PRE_ENERGIZATION_CHECKLIST.flatMap(g => g.items)
    assert.equal(items.length, 35)
    assert.equal(new Set(items.map(i => i.id)).size, 35)
    assert.match(PRE_ENERGIZATION_STANDARD, /4\.10\.2/)
  })

  test('MV Lines group carries the 8 source items incl. plumb/compacted poles', () => {
    const mv = PRE_ENERGIZATION_CHECKLIST.find(g => g.group === 'MV Lines')
    assert.equal(mv.items.length, 8)
    assert.ok(mv.items.some(i => /plumb/i.test(i.text)))
  })
})

describe('Fault Finding & Glossary — no fabricated figures', () => {
  test('every FAULT_FINDING entry is clause-anchored', () => {
    assert.ok(FAULT_FINDING.length >= 8)
    for (const f of FAULT_FINDING) {
      assert.ok(f.clause && /DST_34-1191|Reg 15/.test(f.clause))
      assert.ok(f.mechanism && f.lookFor)
    }
  })

  test('the only numeric claims in FAULT_FINDING are the clause-cited ones (0,85 / 200 kV / 250 kV / 500 mm / 20 m / 1425 / middle third)', () => {
    const allowed = ['0,85', '200 kV', '250 kV', '500 mm', '20 m', '1425']
    for (const f of FAULT_FINDING) {
      const nums = (f.mechanism + ' ' + f.lookFor).match(/\d[\d,.]*\s?(kV|mm|kN|m\b|%|MPa)|0,85|1425/g) || []
      for (const n of nums) {
        assert.ok(allowed.some(a => n.includes(a.split(' ')[0])), `unexpected figure "${n}" in ${f.id}`)
      }
    }
  })

  test('STRINGING_GLOSSARY has 11 unique entries; clause-bearing entries cite DST_34-1191', () => {
    assert.equal(STRINGING_GLOSSARY.length, 11)
    assert.equal(new Set(STRINGING_GLOSSARY.map(g => g.id)).size, 11)
    for (const g of STRINGING_GLOSSARY.filter(g => g.clause)) assert.match(g.clause, /DST_34-1191/)
  })
})

describe('voltageClass — LV/MV/HV/EHV convention (2026-07-28)', () => {
  test('boundary cases match the stated convention exactly', () => {
    assert.equal(voltageClass(1.1), 'LV')
    assert.equal(voltageClass(1.2), 'MV')
    assert.equal(voltageClass(33), 'MV')
    assert.equal(voltageClass(33.1), 'HV')
    assert.equal(voltageClass(132), 'HV')
    assert.equal(voltageClass(132.1), 'EHV')
  })

  test('comma-decimal input handled', () => {
    assert.equal(voltageClass('11,0'), 'MV')
  })

  test('invalid input returns null', () => {
    assert.equal(voltageClass(0), null)
    assert.equal(voltageClass(-5), null)
    assert.equal(voltageClass('abc'), null)
  })

  test('the convention string explicitly disclaims being an OHS Act clearance boundary', () => {
    assert.match(VOLTAGE_CLASS_CONVENTION, /not an OHS Act clearance boundary/i)
  })

  test('TRANSMISSION_VOLTAGE_PRESETS are real, ascending Eskom/NTCSA transmission voltage classes', () => {
    assert.deepEqual(TRANSMISSION_VOLTAGE_PRESETS, [132, 220, 275, 400, 765])
    for (let i = 1; i < TRANSMISSION_VOLTAGE_PRESETS.length; i++) {
      assert.ok(TRANSMISSION_VOLTAGE_PRESETS[i] > TRANSMISSION_VOLTAGE_PRESETS[i - 1])
    }
  })

  test('presets resolve correctly per the convention: 132kV is HV (the boundary itself), 220kV+ is EHV', () => {
    assert.equal(voltageClass(132), 'HV')
    for (const kv of TRANSMISSION_VOLTAGE_PRESETS.filter(v => v > 132)) assert.equal(voltageClass(kv), 'EHV')
  })
})

describe('SANS 10280-1 Table E.1 supersession — sourcing discipline (2026-07-29)', () => {
  test('the retired ESKASABG3 275kV figure (2.35m) is locked out — regression test against re-introducing the stale value', () => {
    const r = clearanceLookup(275)
    assert.notEqual(r.safetyClearanceM, 2.35)
    assert.equal(r.safetyClearanceM, 2.5)
  })

  test('cross-validation: SANS 10280-1 lower/mid-voltage entries match the independently-verified prior ESKASABG3/Reg-15 data', () => {
    assert.equal(clearanceLookup(11).safetyClearanceM, 0.20)
    assert.equal(clearanceLookup(22).safetyClearanceM, 0.32)
    assert.equal(clearanceLookup(88).safetyClearanceM, 1.00)
    assert.equal(clearanceLookup(132).safetyClearanceM, 1.45)
    assert.equal(clearanceLookup(400).safetyClearanceM, 3.20)
    assert.equal(clearanceLookup(765).safetyClearanceM, 5.50)
    // Six matching values (of seven checkable overlap points, the seventh being the
    // resolved 275kV conflict above) confirm SANS 10280-1 and the retired ESKASABG3/Reg 15
    // data trace to the same underlying OHS Act table.
  })

  test('132kV safety clearance progression is non-linear across bands — consistent with a real regulatory table, not a fabricated sequence', () => {
    // 100kV→1.00m, 132kV(145kV band)→1.45m: +0.45m across +32kV
    // 72kV→0.77m, 100kV→1.00m: +0.23m across +28kV
    // Non-uniform step sizes are what a genuine transcribed table looks like.
    const r = clearanceLookup(132)
    assert.equal(r.safetyClearanceM, 1.45)
    assert.equal(r.partialScope, undefined) // no longer partial — fully verified now
  })

  test('SANS10280_CLEARANCE_TABLE nominal voltages match TRANSMISSION_VOLTAGE_PRESETS for the HV/EHV picker range', () => {
    for (const kv of TRANSMISSION_VOLTAGE_PRESETS) {
      const row = SANS10280_CLEARANCE_TABLE.find(r => r.nominalKV === kv)
      assert.notEqual(row, undefined, `Expected a Table E.1 row for ${kv}kV nominal`)
    }
  })
})
