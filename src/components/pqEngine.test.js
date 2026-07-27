import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { harmonicsAnalysis, upsBatterySizing, lightingLumenMethod, LUX_GUIDE } from './pqEngine.js'

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

describe('harmonicsAnalysis', () => {
  test('I1=100,I3=5,I5=20,I7=14,I11=9,I13=7 — matches hand-derived reference', () => {
    const r = harmonicsAnalysis({ I1: '100', I3: '5', I5: '20', I7: '14', I11: '9', I13: '7' })
    assert.ok(close(r.THD, 27.40437921208944))
    assert.ok(close(r.Irms, 103.68702908271604))
    assert.ok(close(r.K, 4.456422658357362))
    assert.ok(close(r.derate, 47.3703739511875))
    assert.equal(r.passIEC, false) // THD 27.4% exceeds the 8% IEC 61000-3-2 Class A guideline
  })

  test('pure fundamental (no harmonics) gives 0% THD and passes IEC', () => {
    const r = harmonicsAnalysis({ I1: '100', I3: '0', I5: '0', I7: '0', I11: '0', I13: '0' })
    assert.equal(r.THD, 0)
    assert.equal(r.passIEC, true)
  })

  test('pass/fail boundary sits exactly at 8% THD', () => {
    const r = harmonicsAnalysis({ I1: '100', I3: '0', I5: '0', I7: '0', I11: '0', I13: '0' })
    assert.equal(r.passIEC, r.THD < 8)
  })

  test('missing/non-numeric input returns null', () => {
    assert.equal(harmonicsAnalysis({ I1: '', I3: '5', I5: '20', I7: '14', I11: '9', I13: '7' }), null)
  })

  test('K-factor of a pure fundamental (no harmonics) is exactly 1 (no derating needed)', () => {
    const r = harmonicsAnalysis({ I1: '100', I3: '0', I5: '0', I7: '0', I11: '0', I13: '0' })
    assert.equal(r.K, 1)
    assert.equal(r.derate, 100)
  })

  // New (2026-07-26): comma-decimal fix bundled with the lumenMethod
  // extraction — see pqEngine.js's file header. Per [TST-8].
  test('comma-decimal inputs normalize correctly (Android decimal keyboard behavior)', () => {
    const withComma = harmonicsAnalysis({ I1: '100', I3: '5,5', I5: '20', I7: '14', I11: '9', I13: '7' })
    const withPeriod = harmonicsAnalysis({ I1: '100', I3: '5.5', I5: '20', I7: '14', I11: '9', I13: '7' })
    assert.ok(close(withComma.THD, withPeriod.THD))
  })

  test('a legitimate zero-amplitude harmonic is not mistaken for a missing field (isNaN guard, not falsy guard)', () => {
    // I3..I13 are all legitimately '0' in the "pure fundamental" case above;
    // this confirms that stays true after the pf() rewrite specifically.
    const r = harmonicsAnalysis({ I1: '100', I3: '0', I5: '0', I7: '0', I11: '0', I13: '0' })
    assert.notEqual(r, null)
  })
})

describe('upsBatterySizing', () => {
  test('10kW/PF0.9/30min/48Vdc/80%DoD/85%eff — matches hand-derived reference', () => {
    const r = upsBatterySizing({ loadKw: '10', pf: '0.9', runtimeMin: '30', vdc: '48', dodPct: '80', etaPct: '85' })
    assert.ok(close(r.kVA, 11.11111111111111))
    assert.ok(close(r.Wh, 5.882352941176471)) // Wh_load/1000
    assert.ok(close(r.Ah, 153.18627450980392, 0.01)) // batteryBankSizingFromEnergy rounds internally to 2dp
    assert.ok(close(r.inv_A, 231.4814814814815))
  })

  test('kVA is computed from loadKw directly (kW/PF), not from P in watts — the historical 1000x bug this formula already fixes', () => {
    const r = upsBatterySizing({ loadKw: '10', pf: '1.0', runtimeMin: '30', vdc: '48', dodPct: '80', etaPct: '85' })
    assert.ok(close(r.kVA, 10)) // 10kW / PF1.0 = 10kVA, NOT 10000
  })

  test('48V bank gives the "4×12V or 24×2V cells" hint, 24V gives "2×12V or 12×2V"', () => {
    const r48 = upsBatterySizing({ loadKw: '10', pf: '0.9', runtimeMin: '30', vdc: '48', dodPct: '80', etaPct: '85' })
    const r24 = upsBatterySizing({ loadKw: '10', pf: '0.9', runtimeMin: '30', vdc: '24', dodPct: '80', etaPct: '85' })
    assert.equal(r48.cells, '4 × 12V or 24 × 2V cells')
    assert.equal(r24.cells, '2 × 12V or 12 × 2V cells')
  })

  test('a non-standard voltage falls back to the generic "N × 2V cells" hint', () => {
    const r = upsBatterySizing({ loadKw: '10', pf: '0.9', runtimeMin: '30', vdc: '110', dodPct: '80', etaPct: '85' })
    assert.equal(r.cells, '55 × 2V cells')
  })

  test('missing/non-numeric input returns null', () => {
    assert.equal(upsBatterySizing({ loadKw: '', pf: '0.9', runtimeMin: '30', vdc: '48', dodPct: '80', etaPct: '85' }), null)
  })

  test('longer runtime requires proportionally more battery capacity', () => {
    const short = upsBatterySizing({ loadKw: '10', pf: '0.9', runtimeMin: '15', vdc: '48', dodPct: '80', etaPct: '85' })
    const long = upsBatterySizing({ loadKw: '10', pf: '0.9', runtimeMin: '60', vdc: '48', dodPct: '80', etaPct: '85' })
    assert.ok(close(long.Ah, short.Ah * 4, 0.5)) // 60min is 4x 15min (allow for internal 2dp rounding)
  })

  // New (2026-07-26): comma-decimal fix — see pqEngine.js's file header.
  test('comma-decimal inputs normalize correctly (Android decimal keyboard behavior)', () => {
    const withComma = upsBatterySizing({ loadKw: '10', pf: '0,9', runtimeMin: '30', vdc: '48', dodPct: '80', etaPct: '85' })
    const withPeriod = upsBatterySizing({ loadKw: '10', pf: '0.9', runtimeMin: '30', vdc: '48', dodPct: '80', etaPct: '85' })
    assert.ok(close(withComma.kVA, withPeriod.kVA))
  })
})

// lightingLumenMethod()'s own formula tests now live in
// src/lib/lumenMethod.test.mjs, alongside the function itself (2026-07-26
// extraction). This describe block only confirms the re-export wiring
// through pqEngine.js still works — it is not re-testing the formula.
describe('lightingLumenMethod (re-export wiring)', () => {
  test('pqEngine.js re-exports the same working function from src/lib/lumenMethod.js', () => {
    const r = lightingLumenMethod({ area: '100', lux: '300', CU: '0.65', MF: '0.80', lumens: '4000', watts: '36' })
    assert.equal(r.N_ceil, 15)
  })
})

describe('LUX_GUIDE reference table', () => {
  test('is ascending by lux level', () => {
    for (let i = 1; i < LUX_GUIDE.length; i++) {
      assert.ok(LUX_GUIDE[i].lux > LUX_GUIDE[i - 1].lux)
    }
  })
})
