import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  conductorLookup, clearanceLookup, structureClearance, phaseSpacing,
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
    assert.equal(Object.keys(CONDUCTORS).length, 40)
  })

  test('every conductor has all four temperature bands with ra <= rb', () => {
    for (const [name, c] of Object.entries(CONDUCTORS)) {
      for (const t of [50, 60, 70, 80]) {
        const band = c.ratings[t]
        assert.ok(band, `${name} missing ${t}°C band`)
        assert.ok(band.ra <= band.rb, `${name} at ${t}°C: RA (${band.ra}) should be <= RB (${band.rb})`)
      }
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

  test('33kV band (top of MV/LV clearance scope)', () => {
    const r = clearanceLookup('33')
    assert.equal(r.voltageBandKV, 33)
    assert.equal(r.groundOutsideTownshipM, 5.3)
    assert.equal(r.aboveRoadsRailM, 6.6)
  })

  test('above 33kV is flagged out of scope, not silently answered', () => {
    const r = clearanceLookup('66')
    assert.equal(r.outOfScope, true)
    assert.ok(r.message.includes('transmission'))
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

  test('all 5 voltage bands present in the source table', () => {
    assert.equal(CLEARANCE_BANDS.length, 5)
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
