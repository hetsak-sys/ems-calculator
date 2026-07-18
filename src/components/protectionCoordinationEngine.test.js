import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  idmtOperatingTime,
  genericAnsiFusePoints,
  fuseOperatingTime,
  estimateTotalClearingTime,
  translateAcrossTransformer,
  evaluateChain,
  checkChainMargins,
  validatePoint,
  validateChain,
  computeReferralFactors,
} from './protectionCoordinationEngine.js'

// ── IDMT relay operating time ───────────────────────────────────────────────
test('idmtOperatingTime: matches known SI curve example', () => {
  // TMS=0.1, curve SI (k=0.14, a=0.02), PSM = 800/100 = 8
  // t = 0.1 * 0.14 / (8^0.02 - 1)
  const t = idmtOperatingTime('si', 100, 800, 0.1)
  const expected = (0.1 * 0.14) / (Math.pow(8, 0.02) - 1)
  assert.ok(Math.abs(t - expected) < 1e-9, `expected ${expected}, got ${t}`)
})

test('idmtOperatingTime: returns null when fault current at or below pickup', () => {
  assert.equal(idmtOperatingTime('si', 100, 100, 0.1), null)
  assert.equal(idmtOperatingTime('si', 100, 50, 0.1), null)
})

test('idmtOperatingTime: higher fault current gives shorter operating time', () => {
  const tLow = idmtOperatingTime('ei', 100, 200, 0.2)
  const tHigh = idmtOperatingTime('ei', 100, 2000, 0.2)
  assert.ok(tHigh < tLow, 'operating time should decrease as fault current increases')
})

test('idmtOperatingTime: throws on unknown curve id', () => {
  assert.throws(() => idmtOperatingTime('bogus', 100, 800, 0.1))
})

test('idmtOperatingTime: throws on non-positive pickup', () => {
  assert.throws(() => idmtOperatingTime('si', 0, 800, 0.1))
})

// ── Generic ANSI fuse curve generation ──────────────────────────────────────
test('genericAnsiFusePoints: K-link points are monotonically decreasing in time as current rises', () => {
  const { points } = genericAnsiFusePoints(40, 'K')
  assert.equal(points.length, 3)
  // points are [current, time] sorted by ascending time in the way they're built
  // (slow anchor first, then mid, then fast) — verify time strictly decreases
  // as we go from the slow anchor to the fast anchor.
  assert.ok(points[0][1] > points[1][1])
  assert.ok(points[1][1] > points[2][1])
  // and current strictly increases in the same direction
  assert.ok(points[0][0] < points[1][0])
  assert.ok(points[1][0] < points[2][0])
})

test('genericAnsiFusePoints: T-link is slower than K-link at the same rating', () => {
  const k = genericAnsiFusePoints(40, 'K')
  const t = genericAnsiFusePoints(40, 'T')
  // At the same rating, T (slow) should melt at a higher current than K (fast)
  // for the same fast-end (0.1s) test time — i.e. T's fast-anchor current > K's.
  const kFastCurrent = k.points[2][0]
  const tFastCurrent = t.points[2][0]
  assert.ok(tFastCurrent > kFastCurrent, 'T-link should require higher current to melt as fast as K-link')
})

test('genericAnsiFusePoints: higher current rating shifts the whole curve right', () => {
  const small = genericAnsiFusePoints(10, 'K')
  const large = genericAnsiFusePoints(100, 'K')
  // slow-anchor current for 100A rating should exceed that for 10A rating
  assert.ok(large.points[0][0] > small.points[0][0])
})

// ── Fuse operating time interpolation ───────────────────────────────────────
test('fuseOperatingTime: interpolates between two known points in log-log space', () => {
  const points = [[10, 100], [100, 1]] // [current, time]
  // at 100x current increase (10 -> 100), time drops from 100 -> 1 (100x)
  // geometric midpoint of current (sqrt(10*100) ~= 31.62) should give
  // geometric midpoint of time (sqrt(100*1) = 10)
  const t = fuseOperatingTime(points, Math.sqrt(10 * 100))
  assert.ok(Math.abs(t - 10) < 1e-6, `expected ~10, got ${t}`)
})

test('fuseOperatingTime: returns null outside the defined current range', () => {
  const points = [[10, 100], [100, 1]]
  assert.equal(fuseOperatingTime(points, 5), null)
  assert.equal(fuseOperatingTime(points, 200), null)
})

test('fuseOperatingTime: throws with fewer than 2 points', () => {
  assert.throws(() => fuseOperatingTime([[10, 100]], 20))
})

// ── Total clearing time estimate ────────────────────────────────────────────
test('estimateTotalClearingTime: applies the higher allowance below 0.1s', () => {
  const melt = 0.05
  const total = estimateTotalClearingTime(melt)
  assert.ok(Math.abs(total - melt * 1.15) < 1e-9)
})

test('estimateTotalClearingTime: applies the lower allowance at or above 0.1s', () => {
  const melt = 1.0
  const total = estimateTotalClearingTime(melt)
  assert.ok(Math.abs(total - melt * 1.10) < 1e-9)
})

// ── Transformer current translation ─────────────────────────────────────────
test('translateAcrossTransformer: toPrimary reduces current by turns ratio', () => {
  // 11000/400 transformer, 1000A on secondary -> primary current = 1000 / (11000/400)
  const iPrimary = translateAcrossTransformer(1000, 11000, 400, 'toPrimary')
  const expected = 1000 / (11000 / 400)
  assert.ok(Math.abs(iPrimary - expected) < 1e-9)
})

test('translateAcrossTransformer: toSecondary and toPrimary are inverse operations', () => {
  const iSec = 500
  const iPri = translateAcrossTransformer(iSec, 11000, 400, 'toPrimary')
  const back = translateAcrossTransformer(iPri, 11000, 400, 'toSecondary')
  assert.ok(Math.abs(back - iSec) < 1e-9)
})

test('translateAcrossTransformer: throws on unknown side', () => {
  assert.throws(() => translateAcrossTransformer(100, 11000, 400, 'sideways'))
})

test('translateAcrossTransformer: throws on zero or missing voltages instead of returning Infinity/NaN', () => {
  assert.throws(() => translateAcrossTransformer(100, 0, 400, 'toPrimary'))
  assert.throws(() => translateAcrossTransformer(100, 11000, 0, 'toPrimary'))
  assert.throws(() => translateAcrossTransformer(100, undefined, 400, 'toPrimary'))
})

// ── Validation ───────────────────────────────────────────────────────────────
test('validatePoint: relay requires positive pickup and TMS', () => {
  assert.deepEqual(validatePoint({ type: 'relay', pickupA: 100, tms: 0.1 }), [])
  assert.ok(validatePoint({ type: 'relay', pickupA: 0, tms: 0.1 }).length > 0)
  assert.ok(validatePoint({ type: 'relay', pickupA: 100, tms: 0 }).length > 0)
  assert.ok(validatePoint({ type: 'relay', pickupA: 100 }).length > 0) // tms missing entirely
})

test('validatePoint: generic-ansi fuse requires a rating', () => {
  assert.deepEqual(validatePoint({ type: 'fuse', fuseSource: 'generic-ansi', ratingA: 40, fuseClass: 'K' }), [])
  assert.ok(validatePoint({ type: 'fuse', fuseSource: 'generic-ansi', ratingA: 0 }).length > 0)
})

test('validatePoint: custom fuse requires at least 2 valid curve points', () => {
  assert.deepEqual(validatePoint({ type: 'fuse', fuseSource: 'custom', customPoints: [[10, 100], [100, 1]] }), [])
  assert.ok(validatePoint({ type: 'fuse', fuseSource: 'custom', customPoints: [[10, 100]] }).length > 0)
  assert.ok(validatePoint({ type: 'fuse', fuseSource: 'custom', customPoints: [] }).length > 0)
  // rows with a zero don't count toward the minimum of 2
  assert.ok(validatePoint({ type: 'fuse', fuseSource: 'custom', customPoints: [[10, 100], [0, 0]] }).length > 0)
})

test('validatePoint: fuse with no curve source selected is flagged', () => {
  assert.ok(validatePoint({ type: 'fuse' }).length > 0)
})

test('validatePoint: transformer requires positive kVA and both voltages', () => {
  assert.deepEqual(validatePoint({ type: 'transformer', kva: 500, vPrimary: 11000, vSecondary: 400 }), [])
  assert.ok(validatePoint({ type: 'transformer', kva: 0, vPrimary: 11000, vSecondary: 400 }).length > 0)
  assert.ok(validatePoint({ type: 'transformer', kva: 500, vPrimary: 0, vSecondary: 400 }).length > 0)
  assert.ok(validatePoint({ type: 'transformer', kva: 500, vPrimary: 11000, vSecondary: 0 }).length > 0)
})

test('validatePoint: unknown type is flagged', () => {
  assert.ok(validatePoint({ type: 'mystery' }).length > 0)
})

test('validateChain: maps validatePoint across every point, preserving id and order', () => {
  const chain = [
    { id: 'p1', type: 'relay', pickupA: 100, tms: 0.1 },
    { id: 'p2', type: 'relay', pickupA: 0, tms: 0.1 },
  ]
  const results = validateChain(chain)
  assert.equal(results.length, 2)
  assert.equal(results[0].id, 'p1')
  assert.deepEqual(results[0].errors, [])
  assert.equal(results[1].id, 'p2')
  assert.ok(results[1].errors.length > 0)
})

// ── Referral factors (for the plot's shared current axis) ──────────────────
test('computeReferralFactors: all factor 1 with no transformers in the chain', () => {
  const chain = [
    { id: 'p1', type: 'relay' },
    { id: 'p2', type: 'relay' },
  ]
  assert.deepEqual(computeReferralFactors(chain), [1, 1])
})

test('computeReferralFactors: factor updates for every point after a transformer, not the transformer itself', () => {
  const chain = [
    { id: 'p1', type: 'relay' },
    { id: 'p2', type: 'transformer', vPrimary: 11000, vSecondary: 400 },
    { id: 'p3', type: 'relay' },
  ]
  const factors = computeReferralFactors(chain)
  assert.equal(factors[0], 1)          // before the transformer
  assert.equal(factors[1], 1)          // the transformer point itself uses the pre-crossing factor
  assert.equal(factors[2], 11000 / 400) // after the transformer
})

test('computeReferralFactors: referred current matches translateAcrossTransformer round-trip', () => {
  const chain = [
    { id: 'p1', type: 'relay' },
    { id: 'p2', type: 'transformer', vPrimary: 11000, vSecondary: 400 },
    { id: 'p3', type: 'relay' },
  ]
  const factors = computeReferralFactors(chain)
  const actualPrimaryCurrent = translateAcrossTransformer(1000, 11000, 400, 'toPrimary')
  const referredBackToLoadEnd = actualPrimaryCurrent * factors[2]
  assert.ok(Math.abs(referredBackToLoadEnd - 1000) < 1e-9, 'referring the primary current back should recover the original secondary-side value')
})

test('computeReferralFactors: chains through multiple transformers', () => {
  const chain = [
    { id: 'p1', type: 'relay' },
    { id: 'p2', type: 'transformer', vPrimary: 11000, vSecondary: 400 },
    { id: 'p3', type: 'relay' },
    { id: 'p4', type: 'transformer', vPrimary: 33000, vSecondary: 11000 },
    { id: 'p5', type: 'relay' },
  ]
  const factors = computeReferralFactors(chain)
  assert.equal(factors[4], (11000 / 400) * (33000 / 11000))
})

test('computeReferralFactors: an invalid transformer (zero voltage) leaves the running factor unchanged rather than throwing', () => {
  const chain = [
    { id: 'p1', type: 'relay' },
    { id: 'p2', type: 'transformer', vPrimary: 0, vSecondary: 400 },
    { id: 'p3', type: 'relay' },
  ]
  assert.doesNotThrow(() => computeReferralFactors(chain))
  assert.equal(computeReferralFactors(chain)[2], 1)
})

// ── Chain evaluation ─────────────────────────────────────────────────────────
test('evaluateChain: relay-only chain, all points operate at high fault current', () => {
  const chain = [
    { id: 'p1', type: 'relay', label: 'Downstream', curveId: 'si', pickupA: 50, tms: 0.1 },
    { id: 'p2', type: 'relay', label: 'Upstream', curveId: 'ei', pickupA: 200, tms: 0.3 },
  ]
  const results = evaluateChain(chain, 2000)
  assert.equal(results.length, 2)
  assert.ok(results[0].timeS > 0)
  assert.ok(results[1].timeS > 0)
})

test('evaluateChain: translates current across a transformer point', () => {
  const chain = [
    { id: 'p1', type: 'relay', label: 'Secondary-side relay', curveId: 'si', pickupA: 100, tms: 0.1 },
    { id: 'p2', type: 'transformer', label: 'Transformer', kva: 500, vPrimary: 11000, vSecondary: 400 },
    { id: 'p3', type: 'relay', label: 'Primary-side relay', curveId: 'ei', pickupA: 20, tms: 0.2 },
  ]
  // 1000A fault at the secondary-side load end; translated to primary for p3
  const results = evaluateChain(chain, 1000)
  const expectedPrimaryCurrent = 1000 / (11000 / 400)
  assert.ok(Math.abs(results[2].currentA - expectedPrimaryCurrent) < 1e-9)
})

test('evaluateChain: fuse point with generic ANSI curve reports null outside its range', () => {
  const chain = [
    { id: 'p1', type: 'fuse', label: 'Pole fuse', fuseSource: 'generic-ansi', fuseClass: 'K', ratingA: 40 },
  ]
  const results = evaluateChain(chain, 1) // far below any 40A fuse's melting current
  assert.equal(results[0].timeS, null)
})

test('evaluateChain: a point with no override inherits the running fault current, flagged as inherited', () => {
  const chain = [
    { id: 'p1', type: 'relay', label: 'Downstream', curveId: 'si', pickupA: 50, tms: 0.1 },
    { id: 'p2', type: 'relay', label: 'Upstream, no override', curveId: 'ei', pickupA: 200, tms: 0.3 },
  ]
  const results = evaluateChain(chain, 2000)
  assert.equal(results[0].currentA, 2000)
  assert.equal(results[0].inherited, true) // p1 itself has no faultCurrentA, inherits the initial value
  assert.equal(results[1].currentA, 2000)
  assert.equal(results[1].inherited, true)
})

test('evaluateChain: a point with an explicit faultCurrentA override is used instead of the inherited value, and propagates onward', () => {
  const chain = [
    { id: 'p1', type: 'relay', label: 'Downstream', curveId: 'si', pickupA: 50, tms: 0.1 },
    { id: 'p2', type: 'relay', label: 'Upstream, real network study figure', curveId: 'ei', pickupA: 200, tms: 0.3, faultCurrentA: 3500 },
    { id: 'p3', type: 'relay', label: 'Further upstream, no override', curveId: 'ei', pickupA: 400, tms: 0.3 },
  ]
  const results = evaluateChain(chain, 2000)
  assert.equal(results[0].currentA, 2000)
  assert.equal(results[1].currentA, 3500)
  assert.equal(results[1].inherited, false)
  // p3 has no override of its own, so it inherits from p2's overridden value, not the original initialFaultA
  assert.equal(results[2].currentA, 3500)
  assert.equal(results[2].inherited, true)
})

test('evaluateChain: throws on unknown point type', () => {
  const chain = [{ id: 'p1', type: 'mystery' }]
  assert.throws(() => evaluateChain(chain, 1000))
})

// ── Margin checking ──────────────────────────────────────────────────────────
test('checkChainMargins: passes when upstream clears comfortably after downstream', () => {
  const evaluated = [
    { id: 'p1', type: 'relay', timeS: 0.20 },
    { id: 'p2', type: 'relay', timeS: 0.65 },
  ]
  const margins = checkChainMargins(evaluated, 0.35)
  assert.equal(margins.length, 1)
  assert.equal(margins[0].pass, true)
  assert.ok(Math.abs(margins[0].marginS - 0.45) < 1e-9)
})

test('checkChainMargins: fails when the margin is too tight', () => {
  const evaluated = [
    { id: 'p1', type: 'relay', timeS: 0.30 },
    { id: 'p2', type: 'relay', timeS: 0.40 },
  ]
  const margins = checkChainMargins(evaluated, 0.35)
  assert.equal(margins[0].pass, false)
})

test('checkChainMargins: skips transformer points entirely', () => {
  const evaluated = [
    { id: 'p1', type: 'relay', timeS: 0.20 },
    { id: 'p2', type: 'transformer', timeS: null },
    { id: 'p3', type: 'relay', timeS: 0.60 },
  ]
  const margins = checkChainMargins(evaluated, 0.35)
  assert.equal(margins.length, 1) // only one adjacent pair once the transformer point is excluded
  assert.equal(margins[0].fromId, 'p1')
  assert.equal(margins[0].toId, 'p3')
  assert.equal(margins[0].pass, true)
})

test('checkChainMargins: reports null/not-applicable when a device does not operate', () => {
  const evaluated = [
    { id: 'p1', type: 'fuse', timeS: null },
    { id: 'p2', type: 'relay', timeS: 0.60 },
  ]
  const margins = checkChainMargins(evaluated, 0.35)
  assert.equal(margins[0].pass, null)
  assert.equal(margins[0].marginS, null)
})

test('checkChainMargins: three-device chain produces two adjacent-pair checks', () => {
  const evaluated = [
    { id: 'p1', type: 'fuse', timeS: 0.05 },
    { id: 'p2', type: 'relay', timeS: 0.45 },
    { id: 'p3', type: 'relay', timeS: 0.90 },
  ]
  const margins = checkChainMargins(evaluated, 0.35)
  assert.equal(margins.length, 2)
  assert.equal(margins[0].pass, true)  // 0.45 - 0.05 = 0.40 >= 0.35
  assert.equal(margins[1].pass, true)  // 0.90 - 0.45 = 0.45 >= 0.35
})
