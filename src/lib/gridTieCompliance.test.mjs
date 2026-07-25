import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifySSEGCategory, GRID_TIE_COMPLIANCE_CHECKLIST,
  dcAcRatio, recommendInverterAcRating,
} from './gridTieCompliance.js'

describe('classifySSEGCategory', () => {
  test('10 kVA falls in Category A1 (0-13.8 kVA)', () => {
    const r = classifySSEGCategory(10)
    assert.equal(r.category.id, 'A1')
    assert.equal(r.aboveSseegScope, false)
  })

  test('exactly 13.8 kVA (the A1/A2 boundary) falls in A1, not A2 (boundary is inclusive on the lower category per the >min, <=max rule)', () => {
    const r = classifySSEGCategory(13.8)
    assert.equal(r.category.id, 'A1')
  })

  test('50 kVA falls in Category A2 (>13.8-100 kVA)', () => {
    const r = classifySSEGCategory(50)
    assert.equal(r.category.id, 'A2')
  })

  test('500 kVA falls in Category A3 (100-1000 kVA)', () => {
    const r = classifySSEGCategory(500)
    assert.equal(r.category.id, 'A3')
  })

  test('1000 kVA and above is flagged as above SSEG scope entirely (NRS 097-1 territory, not 097-2)', () => {
    const r = classifySSEGCategory(1000)
    assert.equal(r.aboveSseegScope, true)
    assert.equal(r.category, null)
  })

  test('every classification includes the mandatory-registration note (never silently omitted)', () => {
    const r = classifySSEGCategory(50)
    assert.ok(r.notes.some(n => n.toLowerCase().includes('registration')))
  })

  test('zero or negative capacity falls back to A1 by convention rather than returning null', () => {
    const r = classifySSEGCategory(0)
    assert.equal(r.category.id, 'A1')
  })
})

describe('GRID_TIE_COMPLIANCE_CHECKLIST', () => {
  test('includes the Lesotho jurisdiction-check item (per the file header jurisdiction note)', () => {
    const item = GRID_TIE_COMPLIANCE_CHECKLIST.find(i => i.id === 'jurisdiction-check')
    assert.ok(item)
    assert.ok(item.requirement.toLowerCase().includes('lesotho'))
  })

  test('every checklist item has a topic, requirement, and reference (no incomplete entries)', () => {
    for (const item of GRID_TIE_COMPLIANCE_CHECKLIST) {
      assert.ok(item.id && item.topic && item.requirement && item.reference)
    }
  })
})

describe('dcAcRatio', () => {
  test('ratio below 1.0 is flagged as array undersized relative to inverter', () => {
    const r = dcAcRatio(4000, 5000)
    assert.equal(r.ratio, 0.8)
    assert.ok(r.assessment.toLowerCase().includes('undersized'))
  })

  test('ratio within 1.1-1.3 is described as typical/within common practice', () => {
    const r = dcAcRatio(5500, 5000)
    assert.equal(r.ratio, 1.1)
    assert.ok(r.assessment.includes('1.1-1.3'))
  })

  test('ratio above 1.4 is flagged for meaningful clipping risk', () => {
    const r = dcAcRatio(8000, 5000)
    assert.equal(r.ratio, 1.6)
    assert.ok(r.assessment.toLowerCase().includes('clipping'))
  })

  test('ratio is rounded to 2 decimal places', () => {
    const r = dcAcRatio(5000, 3000)
    assert.equal(r.ratio, 1.67) // 1.6666... rounds to 1.67
  })
})

describe('recommendInverterAcRating', () => {
  test('defaults to a 1.2 target oversizing ratio', () => {
    const r = recommendInverterAcRating(6000)
    assert.equal(r, 5000) // 6000/1.2
  })

  test('honors an explicit target ratio', () => {
    const r = recommendInverterAcRating(6000, 1.3)
    assert.ok(Math.abs(r - 6000 / 1.3) < 0.01)
  })
})
