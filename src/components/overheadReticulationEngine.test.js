import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  conductorLookup, clearanceLookup, structureClearance, phaseSpacing,
  CONDUCTORS, CLEARANCE_BANDS,
} from './overheadReticulationEngine.js'

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

describe('conductorLookup', () => {
  test('returns known ACSR conductor (Hare)', () => {
    const r = conductorLookup('Hare')
    assert.equal(r.type, 'ACSR')
    assert.equal(r.ratingA, 290)
    assert.equal(r.areaMM2, 122.48)
  })

  test('returns known AAAC conductor (Oak)', () => {
    const r = conductorLookup('oak')
    assert.equal(r.type, 'AAAC')
    assert.equal(r.ratingA, 290)
  })

  test('case-insensitive lookup', () => {
    assert.equal(conductorLookup('SQUIRREL').ratingA, 110)
    assert.equal(conductorLookup('Squirrel').ratingA, 110)
  })

  test('comma-in-name-irrelevant, unknown code returns null', () => {
    assert.equal(conductorLookup('unobtainium'), null)
    assert.equal(conductorLookup(''), null)
    assert.equal(conductorLookup(null), null)
  })

  test('all 9 standard conductors are present', () => {
    assert.equal(Object.keys(CONDUCTORS).length, 9)
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

  test('33kV band (top of MV/LV scope)', () => {
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
    // L = 0.1km (100m), theta=0 -> cos^4(0)=1 -> spacing = 0.1*(4*1+1)+0.4 = 0.9m
    const r = phaseSpacing({ spanM: '100', angleDeg: '0', voltageKV: '22' })
    assert.equal(r.verified, true)
    assert.ok(close(r.requiredSpacingM, 0.9))
  })

  test('22kV verified calculation, vertical config (angle=90)', () => {
    // cos^4(90deg) = 0 -> spacing = L*(0+1)+0.4 = L+0.4
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
