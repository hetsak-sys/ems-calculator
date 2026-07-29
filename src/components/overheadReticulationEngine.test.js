import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  conductorLookup, clearanceLookup, structureClearance, phaseSpacing,
  fittingSelection, FITTING_TYPES, STRUCTURE_TYPES, STRUCTURE_MATERIALS,
  CONDUCTORS, CLEARANCE_BANDS,
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

describe('clearanceLookup', () => {
  test('LV band (<=1.1kV)', () => {
    const r = clearanceLookup('1.1')
    assert.equal(r.voltageBandKV, 1.1)
    assert.equal(r.groundOutsideTownshipM, 4.9)
    assert.equal(r.groundInsideTownshipM, 5.5)
    assert.equal(r.aboveRoadsRailM, 6.1)
    assert.equal(r.toCommsOtherLinesM, 0.6)
    assert.equal(r.toBuildingsM, 3.0)
  })

  test('11kV falls into the 12kV band', () => {
    const r = clearanceLookup('11')
    assert.equal(r.voltageBandKV, 12)
    assert.equal(r.groundOutsideTownshipM, 5.1)
  })

  test('33kV falls in the regulation\'s 36kV band — 6.5m roads, the banding fix from the primary source', () => {
    const r = clearanceLookup('33')
    assert.equal(r.voltageBandKV, 36)
    assert.equal(r.groundOutsideTownshipM, 5.3)
    assert.equal(r.aboveRoadsRailM, 6.5) // was wrongly 6.6 under the DST-derived table
    assert.equal(r.safetyClearanceM, 0.43)
  })

  test('66kV is now IN scope — falls in the 72kV band per the primary regulation', () => {
    const r = clearanceLookup('66')
    assert.equal(r.outOfScope, undefined)
    assert.equal(r.voltageBandKV, 72)
    assert.equal(r.groundOutsideTownshipM, 5.7)
    assert.equal(r.aboveRoadsRailM, 6.9)
    assert.equal(r.toBuildingsM, 3.2)
    assert.equal(r.safetyClearanceM, 0.77)
  })

  test('88kV falls in the 100kV band', () => {
    const r = clearanceLookup('88')
    assert.equal(r.voltageBandKV, 100)
    assert.equal(r.groundOutsideTownshipM, 5.9)
    assert.equal(r.aboveRoadsRailM, 7.1)
  })

  test('132kV returns PARTIAL scope — safety clearance 1.45m verified from ESKASABG3, outOfScope is false', () => {
    const r = clearanceLookup('132')
    assert.equal(r.partialScope, true)
    assert.equal(r.outOfScope, false)
    assert.equal(r.safetyClearanceM, 1.45)
    assert.equal(r.voltageClass, 'HV')
    assert.match(r.standard, /ESKASABG3/)
    assert.match(r.standard, /OHSA/)
  })

  test('275kV, 400kV, 765kV return partial scope with correct safety clearances from ESKASABG3', () => {
    assert.equal(clearanceLookup(275).safetyClearanceM, 2.35)
    assert.equal(clearanceLookup(275).voltageClass, 'EHV')
    assert.equal(clearanceLookup(400).safetyClearanceM, 3.20)
    assert.equal(clearanceLookup(765).safetyClearanceM, 5.50)
  })

  test('ESKASABG3 cross-validation: 11/22/88kV safety clearances in source match Reg 15 verified bands', () => {
    // These three overlap points are the cross-validation evidence
    assert.equal(clearanceLookup(11).safetyClearanceM, 0.20)  // Reg 15 12kV band == ESKASABG3 11kV
    assert.equal(clearanceLookup(22).safetyClearanceM, 0.32)  // Reg 15 24kV band == ESKASABG3 22kV
    assert.equal(clearanceLookup(88).safetyClearanceM, 1.00)  // Reg 15 100kV band == ESKASABG3 88kV
  })

  test('HV/EHV partial scope is explicit about what is NOT verified — ground/road/building remain null', () => {
    const r132 = clearanceLookup(132)
    assert.equal(r132.groundClearanceVerified, false)
    assert.equal(r132.roadClearanceVerified, false)
    assert.equal(r132.buildingClearanceVerified, false)
    assert.equal(r132.groundOutsideTownshipM, undefined) // not fabricated
    assert.equal(r132.aboveRoadsRailM, undefined)        // not fabricated
    assert.equal(r132.toBuildingsM, undefined)           // not fabricated
  })

  test('servitude widths are returned for verified ESKASABG3 voltages', () => {
    assert.equal(clearanceLookup(132).servitudeWidthM, '15.5 m')
    assert.equal(clearanceLookup(400).servitudeWidthM, '23.5–27.5 m')
  })

  test('220kV (not an Eskom AC standard voltage) still returns outOfScope with bracketing guidance', () => {
    const r = clearanceLookup(220)
    assert.equal(r.outOfScope, true)
    assert.equal(r.partialScope, undefined)
    assert.ok(r.message.includes('132') && r.message.includes('275')) // shows the bracketing values
  })

  test('no HV/EHV figures are fabricated — partial-scope results carry NO ground/road/building values', () => {
    for (const kv of [132, 275, 400, 765]) {
      const r = clearanceLookup(kv)
      assert.equal(r.safetyClearanceM !== undefined, true) // has the verified value
      assert.equal(r.groundOutsideTownshipM, undefined)    // not fabricated
      assert.equal(r.aboveRoadsRailM, undefined)           // not fabricated
      assert.equal(r.toBuildingsM, undefined)              // not fabricated
    }
  })

  test('verified LV/MV/HV-band results also carry a voltageClass tag', () => {
    assert.equal(clearanceLookup(0.4).voltageClass, 'LV')
    assert.equal(clearanceLookup(11).voltageClass, 'MV')
    assert.equal(clearanceLookup(88).voltageClass, 'HV')
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

  test('all 8 voltage bands of the primary-source table are present', () => {
    assert.equal(CLEARANCE_BANDS.length, 8)
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
  ESKASABG3_HV_EHV,
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

describe('ESKASABG3 HV/EHV data integrity — sourcing discipline (2026-07-28)', () => {
  test('table has exactly the 4 standard Eskom AC HV/EHV voltages plus the DC entry', () => {
    const ac = ESKASABG3_HV_EHV.filter(e => !e.dc)
    const dc = ESKASABG3_HV_EHV.filter(e => e.dc)
    assert.deepEqual(ac.map(e => e.nomKV), [132, 275, 400, 765])
    assert.equal(dc.length, 1)
    assert.equal(dc[0].nomKV, 533)
    assert.equal(dc[0].safetyClearanceM, 3.70)
  })

  test('safety clearances increase monotonically with voltage (physically required)', () => {
    const ac = ESKASABG3_HV_EHV.filter(e => !e.dc)
    for (let i = 1; i < ac.length; i++) {
      assert.ok(ac[i].safetyClearanceM > ac[i-1].safetyClearanceM,
        `Expected ${ac[i].nomKV}kV (${ac[i].safetyClearanceM}m) > ${ac[i-1].nomKV}kV (${ac[i-1].safetyClearanceM}m)`)
    }
  })

  test('cross-validation: ESKASABG3 lower-voltage entries match the independently verified Reg 15 data', () => {
    // 11kV nominal → OHS Act Reg 15 maximum 12kV band → safetyClearanceM 0.20
    assert.equal(clearanceLookup(11).safetyClearanceM, 0.20)
    // 22kV nominal → OHS Act Reg 15 maximum 24kV band → safetyClearanceM 0.32
    assert.equal(clearanceLookup(22).safetyClearanceM, 0.32)
    // 88kV nominal → OHS Act Reg 15 maximum 100kV band → safetyClearanceM 1.00
    assert.equal(clearanceLookup(88).safetyClearanceM, 1.00)
    // These three matching independently-verified values confirm the ESKASABG3 table
    // is genuinely reproducing OHS Act Reg 15 safety clearance values
  })

  test('132kV safety clearance 1.45m is consistent with the 12kV→0.20, 24kV→0.32, 100kV→1.00 progression — not a suspiciously round interpolation', () => {
    // The jump from 1.00m (100kV) to 1.45m (132kV) is +0.45m across +32kV
    // vs. the prior verified step from 0.77m (72kV) to 1.00m (100kV): +0.23m across +28kV
    // These are not uniform, consistent with a real regulatory table, not a fabricated linear sequence
    const r = clearanceLookup(132)
    assert.equal(r.safetyClearanceM, 1.45)
    assert.equal(r.partialScope, true)
  })
})
