import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { loadAssessment, LOAD_CATEGORIES, pf } from './installationDesignEngine.js'

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

describe('LOAD_CATEGORIES', () => {
  test('every category has an id, label, defaultDF, and hint', () => {
    for (const cat of LOAD_CATEGORIES) {
      assert.ok(cat.id)
      assert.ok(cat.label)
      assert.equal(cat.defaultDF, 100) // safest-if-wrong default per [DEC-4]
      assert.ok(cat.hint)
    }
  })
})

describe('loadAssessment', () => {
  test('missing voltage returns error', () => {
    assert.ok(loadAssessment({ rows: [{ id: 'lighting', connected: '5', demandFactor: '100' }], voltage: '', phase: '3ph', powerFactor: '0.9' }).error)
  })

  test('no rows with a connected load returns error', () => {
    assert.ok(loadAssessment({ rows: [], voltage: '400', phase: '3ph', powerFactor: '0.9' }).error)
    assert.ok(loadAssessment({ rows: [{ id: 'lighting', connected: '0', demandFactor: '100' }], voltage: '400', phase: '3ph', powerFactor: '0.9' }).error)
  })

  test('3ph, 400V, 0.9 PF, three rows with mixed demand factors — hand-derived exactly', () => {
    const r = loadAssessment({
      rows: [
        { id: 'lighting', connected: '5', demandFactor: '80' },
        { id: 'sockets', connected: '10', demandFactor: '50' },
        { id: 'waterHeating', connected: '6', demandFactor: '100' },
      ],
      voltage: '400', phase: '3ph', powerFactor: '0.9',
    })
    assert.ok(close(r.totalConnected, 21))
    assert.ok(close(r.totalDemand, 15))
    assert.ok(close(r.demandKVA, 16.666666666666668))
    assert.ok(close(r.current, 24.05626121623441))
    assert.equal(r.recommendedMain, 25)
    assert.ok(close(r.diversityAchieved, 28.57142857142857))
    assert.equal(r.warnings.length, 0)
  })

  test('single-phase current uses I = P/V, not the three-phase divisor', () => {
    const threePh = loadAssessment({ rows: [{ id: 'lighting', connected: '10', demandFactor: '100' }], voltage: '230', phase: '1ph', powerFactor: '1' })
    // 10kW / 1 (PF) = 10kVA -> 10000/230 = 43.478...A
    assert.ok(close(threePh.current, 43.47826086956522))
  })

  test('demand factor above 100% is allowed but flagged as a warning', () => {
    const r = loadAssessment({ rows: [{ id: 'motors', connected: '10', demandFactor: '120' }], voltage: '400', phase: '3ph', powerFactor: '0.9' })
    assert.equal(r.warnings.length, 1)
    assert.match(r.warnings[0], /above 100%/)
  })

  test('a row with zero/blank demand factor is flagged and contributes zero demand', () => {
    const r = loadAssessment({
      rows: [
        { id: 'lighting', connected: '5', demandFactor: '' },
        { id: 'sockets', connected: '5', demandFactor: '100' },
      ],
      voltage: '400', phase: '3ph', powerFactor: '0.9',
    })
    assert.equal(r.warnings.length, 1)
    assert.match(r.warnings[0], /zero or blank/)
    assert.ok(close(r.totalDemand, 5)) // only the sockets row counts
  })

  test('rows with zero connected load are silently excluded (not warned, not counted)', () => {
    const r = loadAssessment({
      rows: [
        { id: 'lighting', connected: '0', demandFactor: '100' },
        { id: 'sockets', connected: '8', demandFactor: '100' },
      ],
      voltage: '400', phase: '3ph', powerFactor: '0.9',
    })
    assert.equal(r.rowResults.length, 1)
    assert.equal(r.rowResults[0].id, 'sockets')
  })

  test('recommendedMain always returns a real MCCB_TRIPS value, never undefined, even for a huge load', () => {
    const r = loadAssessment({ rows: [{ id: 'motors', connected: '5000', demandFactor: '100' }], voltage: '400', phase: '3ph', powerFactor: '0.9' })
    assert.ok(typeof r.recommendedMain === 'number')
  })

  test('comma-decimal input is normalized (pf helper matches project-wide convention)', () => {
    assert.ok(close(pf('12,5'), 12.5))
    const r = loadAssessment({ rows: [{ id: 'lighting', connected: '5,5', demandFactor: '100' }], voltage: '400', phase: '3ph', powerFactor: '0,9' })
    assert.ok(close(r.totalConnected, 5.5))
  })

  test('diversityAchieved is 0 when every row runs at 100% demand factor (no diversity claimed)', () => {
    const r = loadAssessment({
      rows: [{ id: 'lighting', connected: '5', demandFactor: '100' }, { id: 'sockets', connected: '5', demandFactor: '100' }],
      voltage: '400', phase: '3ph', powerFactor: '0.9',
    })
    assert.ok(close(r.diversityAchieved, 0))
  })
})
