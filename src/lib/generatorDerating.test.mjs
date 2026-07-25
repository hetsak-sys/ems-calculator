import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { calculateGeneratorDerating, GEN_SIZES } from './generatorDerating.js'

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

describe('calculateGeneratorDerating', () => {
  test('at/below 1000m and at/below 40°C, no derating applies (both factors are 1.0)', () => {
    const r = calculateGeneratorDerating({ altitudeM: 1000, ambientTempC: 25 })
    assert.equal(r.altFactor, 1)
    assert.equal(r.tempFactor, 1)
    assert.equal(r.netFactor, 1)
  })

  test('1600m/35°C — matches hand-derived ISO 8528-1 convention reference (altitude derates, temp does not)', () => {
    const r = calculateGeneratorDerating({ altitudeM: 1600, ambientTempC: 35 })
    assert.ok(close(r.altFactor, 0.964)) // 1 - (600/500)*0.03
    assert.equal(r.tempFactor, 1) // 35°C is at/below the 40°C threshold
    assert.ok(close(r.netFactor, 0.964))
  })

  test('3100m/45°C — both altitude and temperature derating apply and combine multiplicatively', () => {
    const r = calculateGeneratorDerating({ altitudeM: 3100, ambientTempC: 45 })
    assert.ok(close(r.altFactor, 0.874))
    assert.ok(close(r.tempFactor, 0.95))
    assert.ok(close(r.netFactor, 0.874 * 0.95))
  })

  test('altitude derating is linear at -3% per 500m above 1000m', () => {
    const at1500 = calculateGeneratorDerating({ altitudeM: 1500, ambientTempC: 20 })
    const at2000 = calculateGeneratorDerating({ altitudeM: 2000, ambientTempC: 20 })
    assert.ok(close(at1500.altFactor - at2000.altFactor, 0.03))
  })

  test('temperature derating is linear at -1% per °C above 40°C', () => {
    const at41 = calculateGeneratorDerating({ altitudeM: 500, ambientTempC: 41 })
    const at42 = calculateGeneratorDerating({ altitudeM: 500, ambientTempC: 42 })
    assert.ok(close(at41.tempFactor - at42.tempFactor, 0.01))
  })

  test('GEN_SIZES is a complete ascending standard kVA list (10 through 2000)', () => {
    assert.equal(GEN_SIZES[0], 10)
    assert.equal(GEN_SIZES[GEN_SIZES.length - 1], 2000)
    for (let i = 1; i < GEN_SIZES.length; i++) {
      assert.ok(GEN_SIZES[i] > GEN_SIZES[i - 1])
    }
  })
})
