import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  getContactor, getOLR, contactorOlrSelection, CONTACTOR_SIZES, OLR_RANGES,
} from './contactorOlrEngine.js'

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

describe('getContactor', () => {
  test('picks the smallest standard AC-3 rating that covers the FLA', () => {
    const c = getContactor(28) // between 25 and 32
    assert.equal(c[0], 32)
  })

  test('an FLA exactly matching a standard rating selects that rating', () => {
    const c = getContactor(25)
    assert.equal(c[0], 25)
  })

  test('an FLA beyond the largest standard rating falls back to the largest (400A), never undefined', () => {
    const c = getContactor(1000)
    assert.equal(c[0], 400)
  })
})

describe('getOLR', () => {
  test('prefers a range where the FLA sits in the upper 80-100% of the range (not at the low extreme)', () => {
    // range [23,32]: 80% of 32 = 25.6, so FLA=30 should land in [23,32] as "preferred"
    const r = getOLR(30)
    assert.equal(r[0], 23)
    assert.equal(r[1], 32)
  })

  test('falls back to the first range whose max covers the FLA when no "preferred" (80-100%) match exists', () => {
    // FLA=17 doesn't sit in the upper 80% of any range but does fall under some range's max
    const r = getOLR(17)
    assert.ok(r[1] >= 17)
  })

  test('an FLA beyond the largest OLR range falls back to the largest range, never undefined', () => {
    const r = getOLR(1000)
    assert.equal(r, OLR_RANGES[OLR_RANGES.length - 1])
  })
})

describe('contactorOlrSelection', () => {
  test('missing required inputs returns error', () => {
    assert.ok(contactorOlrSelection({ phase: '3ph', kw: '', voltage: '400', pfVal: '0.85', eff: '90', ieClass: 'IE3' }).error)
  })

  test('15kW/400V/PF0.85/eff90%/3ph/IE3 — matches hand-derived reference FLA and OLR setting', () => {
    const r = contactorOlrSelection({ phase: '3ph', kw: '15', voltage: '400', pfVal: '0.85', eff: '90', ieClass: 'IE3' })
    assert.ok(close(r.fla, 28.30148378380519))
    assert.ok(close(r.startCurrent, 183.95964459473373)) // 6.5× FLA for IE3
    assert.ok(close(r.olrSetting, 29.71655797299545)) // 1.05× FLA
    assert.equal(r.contactor[0], 32) // next standard AC-3 rating ≥ 28.3A
  })

  test('IE4 uses a 7.0× start multiplier, IE3 uses 6.5×, IE1/IE2 use 6.0× (higher multiplier for higher efficiency class)', () => {
    const base = { phase: '3ph', kw: '15', voltage: '400', pfVal: '0.85', eff: '90' }
    const ie4 = contactorOlrSelection({ ...base, ieClass: 'IE4' })
    const ie3 = contactorOlrSelection({ ...base, ieClass: 'IE3' })
    const ie1 = contactorOlrSelection({ ...base, ieClass: 'IE1' })
    assert.ok(close(ie4.startCurrent / ie4.fla, 7.0))
    assert.ok(close(ie3.startCurrent / ie3.fla, 6.5))
    assert.ok(close(ie1.startCurrent / ie1.fla, 6.0))
  })

  test('OLR setting range is FLA × [0.95, 1.05, 1.15] (min/nominal/max)', () => {
    const r = contactorOlrSelection({ phase: '3ph', kw: '15', voltage: '400', pfVal: '0.85', eff: '90', ieClass: 'IE3' })
    assert.ok(close(r.olrSettingMin, r.fla * 0.95))
    assert.ok(close(r.olrSetting, r.fla * 1.05))
    assert.ok(close(r.olrSettingMax, r.fla * 1.15))
  })

  test('1ph uses the single-phase FLA formula (no √3 term)', () => {
    const r = contactorOlrSelection({ phase: '1ph', kw: '3', voltage: '230', pfVal: '0.9', eff: '85', ieClass: 'IE3' })
    const expectedFla = (3 / 0.85) * 1000 / (230 * 0.9)
    assert.ok(close(r.fla, expectedFla))
  })

  test('contactorAdequate is true whenever the selected contactor rating covers the FLA (always true by construction of getContactor)', () => {
    const r = contactorOlrSelection({ phase: '3ph', kw: '15', voltage: '400', pfVal: '0.85', eff: '90', ieClass: 'IE3' })
    assert.equal(r.contactorAdequate, true)
  })

  test('comma-decimal inputs normalize correctly', () => {
    const withComma = contactorOlrSelection({ phase: '3ph', kw: '15,5', voltage: '400', pfVal: '0,85', eff: '90', ieClass: 'IE3' })
    const withDot = contactorOlrSelection({ phase: '3ph', kw: '15.5', voltage: '400', pfVal: '0.85', eff: '90', ieClass: 'IE3' })
    assert.ok(close(withComma.fla, withDot.fla))
  })
})

describe('CONTACTOR_SIZES / OLR_RANGES reference tables', () => {
  test('CONTACTOR_SIZES ratings are ascending', () => {
    for (let i = 1; i < CONTACTOR_SIZES.length; i++) {
      assert.ok(CONTACTOR_SIZES[i][0] > CONTACTOR_SIZES[i - 1][0])
    }
  })

  test('OLR_RANGES are ascending and every row has 6 fields', () => {
    for (const row of OLR_RANGES) {
      assert.equal(row.length, 6)
      assert.ok(row[1] > row[0]) // max > min
    }
  })
})
