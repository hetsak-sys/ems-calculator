import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { lightingLumenMethod } from './lumenMethod.js'

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

// These 3 tests are migrated unchanged from pqEngine.test.js (2026-07-26
// extraction) — same assertions, same expected values, just relocated
// alongside the function's new home in src/lib.
describe('lightingLumenMethod', () => {
  test('100m²/300lux/CU0.65/MF0.80/4000lm/36W fittings — matches hand-derived reference', () => {
    const r = lightingLumenMethod({ area: '100', lux: '300', CU: '0.65', MF: '0.80', lumens: '4000', watts: '36' })
    assert.ok(close(r.N, 14.423076923076923))
    assert.equal(r.N_ceil, 15) // always rounds UP — partial fittings aren't installable
    assert.equal(r.W, 540) // 15 × 36W
    assert.ok(close(r.Wm2, 5.4))
    assert.ok(close(r.lux_act, 312)) // actual illuminance with the rounded-up fitting count
  })

  test('actual illuminance after rounding up fittings is always ≥ the required illuminance', () => {
    const r = lightingLumenMethod({ area: '100', lux: '300', CU: '0.65', MF: '0.80', lumens: '4000', watts: '36' })
    assert.ok(r.lux_act >= 300)
  })

  test('missing/non-numeric input returns null', () => {
    assert.equal(lightingLumenMethod({ area: '', lux: '300', CU: '0.65', MF: '0.80', lumens: '4000', watts: '36' }), null)
  })

  // New test (2026-07-26): the comma-decimal fix bundled with this extraction.
  // Per [TST-8] ("every fixed bug adds the test that would have caught it") —
  // this is the case that silently produced a wrong answer before the fix.
  test('comma-decimal input normalizes correctly (Android decimal keyboard behavior)', () => {
    const withComma = lightingLumenMethod({ area: '100', lux: '300', CU: '0,65', MF: '0.80', lumens: '4000', watts: '36' })
    const withPeriod = lightingLumenMethod({ area: '100', lux: '300', CU: '0.65', MF: '0.80', lumens: '4000', watts: '36' })
    assert.ok(close(withComma.N, withPeriod.N))
    assert.equal(withComma.N_ceil, withPeriod.N_ceil)
  })

  test('a legitimate all-zero-adjacent edge case is not mistaken for missing input (isNaN guard, not falsy guard)', () => {
    // area/lux/lumens/watts can't sensibly be 0 in this formula (division by
    // zero or a zero result), but this confirms the guard rejects on NaN
    // specifically, not on falsy — matching the original pre-extraction
    // behavior exactly (see lumenMethod.js's pf() comment).
    assert.equal(lightingLumenMethod({ area: '0', lux: '300', CU: '0.65', MF: '0.80', lumens: '4000', watts: '36' }).N, 0)
  })
})
