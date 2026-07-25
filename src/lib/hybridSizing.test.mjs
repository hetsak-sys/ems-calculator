import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  batteryBridgeSizing, generatorEnergyDeficit, generatorRunHoursForEnergy,
  hybridSystemSummary, generatorOutputFromSizingResult,
} from './hybridSizing.js'

const close = (a, b, eps = 1e-2) => Math.abs(a - b) < eps

describe('batteryBridgeSizing', () => {
  test('10kWh/day load, 6kWh/day solar, 2-day bridge, 50% DoD, 48V, 85% RTE — matches hand-derived reference', () => {
    const r = batteryBridgeSizing({
      dailyLoadWh: 10000, dailySolarOutputWh: 6000, bridgeDays: 2,
      dodFraction: 0.5, systemVoltageV: 48, roundTripEfficiency: 0.85,
    })
    assert.ok(close(r.dailyDeficitWh, 4000))
    assert.ok(close(r.requiredUsableEnergyWh, 8000))
    assert.ok(close(r.requiredCapacityWh, 18823.53))
    assert.ok(close(r.requiredCapacityAh, 392.16))
  })

  test('when solar output meets or exceeds load, deficit is clamped to zero (never negative)', () => {
    const r = batteryBridgeSizing({
      dailyLoadWh: 5000, dailySolarOutputWh: 8000, bridgeDays: 2,
      dodFraction: 0.5, systemVoltageV: 48,
    })
    assert.equal(r.dailyDeficitWh, 0)
    assert.equal(r.requiredUsableEnergyWh, 0)
  })

  test('more bridge days scales required capacity proportionally', () => {
    const oneDay = batteryBridgeSizing({ dailyLoadWh: 10000, dailySolarOutputWh: 6000, bridgeDays: 1, dodFraction: 0.5, systemVoltageV: 48 })
    const threeDay = batteryBridgeSizing({ dailyLoadWh: 10000, dailySolarOutputWh: 6000, bridgeDays: 3, dodFraction: 0.5, systemVoltageV: 48 })
    assert.ok(close(threeDay.requiredCapacityWh, oneDay.requiredCapacityWh * 3))
  })
})

describe('generatorEnergyDeficit', () => {
  test('extended deficit beyond battery bridge coverage requires generator energy', () => {
    const r = generatorEnergyDeficit({
      dailyLoadWh: 10000, dailySolarOutputWh: 6000,
      batteryUsableCapacityWh: 8000, extendedLowSunDays: 5,
    })
    assert.ok(close(r.totalDeficitWh, 20000)) // 4000/day × 5 days
    assert.ok(close(r.generatorEnergyRequiredWh, 12000)) // 20000 - 8000 battery coverage
  })

  test('generator energy required is clamped to zero when battery alone covers the full period', () => {
    const r = generatorEnergyDeficit({
      dailyLoadWh: 10000, dailySolarOutputWh: 6000,
      batteryUsableCapacityWh: 50000, extendedLowSunDays: 5,
    })
    assert.equal(r.generatorEnergyRequiredWh, 0)
  })

  test('days battery can bridge alone is Infinity when there is no daily deficit at all', () => {
    const r = generatorEnergyDeficit({
      dailyLoadWh: 5000, dailySolarOutputWh: 8000,
      batteryUsableCapacityWh: 5000, extendedLowSunDays: 5,
    })
    assert.equal(r.daysBatteryCanBridgeAlone, Infinity)
  })
})

describe('generatorRunHoursForEnergy', () => {
  test('run hours = energy required ÷ generator output power', () => {
    const r = generatorRunHoursForEnergy({ energyWh: 12000, generatorOutputW: 4000 })
    assert.ok(close(r.runHours, 3))
    assert.equal(r.fuelRequiredL, null) // not supplied
  })

  test('fuel required is computed only when a consumption rate is supplied', () => {
    const r = generatorRunHoursForEnergy({ energyWh: 12000, generatorOutputW: 4000, fuelConsumptionLPerHour: 5 })
    assert.ok(close(r.runHours, 3))
    assert.ok(close(r.fuelRequiredL, 15)) // 3h × 5L/h
  })

  test('charge efficiency below 1.0 increases required run time', () => {
    const ideal = generatorRunHoursForEnergy({ energyWh: 12000, generatorOutputW: 4000, chargeEfficiency: 1.0 })
    const lossy = generatorRunHoursForEnergy({ energyWh: 12000, generatorOutputW: 4000, chargeEfficiency: 0.8 })
    assert.ok(lossy.runHours > ideal.runHours)
  })
})

describe('generatorOutputFromSizingResult', () => {
  test('uses the DERATED output (stdSize × netFactor), not raw nameplate — the exact mistake the adapter exists to prevent', () => {
    const r = generatorOutputFromSizingResult({ stdSize: 100, netFactor: 0.9, gpf: 0.8 })
    assert.equal(r.nameplateKVA, 100)
    assert.ok(close(r.deratedOutputKVA, 90)) // 100 × 0.9, NOT the raw 100
    assert.ok(close(r.deratedOutputW, 72000)) // 90 × 0.8 × 1000
  })

  test('no derating (netFactor=1) means derated output equals nameplate × PF only', () => {
    const r = generatorOutputFromSizingResult({ stdSize: 50, netFactor: 1, gpf: 0.8 })
    assert.ok(close(r.deratedOutputKVA, 50))
    assert.ok(close(r.deratedOutputW, 40000))
  })
})

describe('hybridSystemSummary', () => {
  test('full chain: battery bridge + generator deficit + runtime combine consistently', () => {
    const r = hybridSystemSummary({
      dailyLoadWh: 10000, dailySolarOutputWh: 6000, bridgeDays: 2, extendedLowSunDays: 5,
      dodFraction: 0.5, systemVoltageV: 48, roundTripEfficiency: 0.85,
      generatorOutputW: 4000, fuelConsumptionLPerHour: 5,
    })
    assert.ok(close(r.battery.requiredUsableEnergyWh, 8000))
    assert.ok(close(r.deficit.generatorEnergyRequiredWh, 12000))
    assert.ok(r.runtime.runHours > 0)
    assert.ok(r.runtime.fuelRequiredL > 0)
  })

  test('warns when extendedLowSunDays is shorter than bridgeDays (design inconsistency)', () => {
    const r = hybridSystemSummary({
      dailyLoadWh: 10000, dailySolarOutputWh: 6000, bridgeDays: 5, extendedLowSunDays: 2,
      dodFraction: 0.5, systemVoltageV: 48, generatorOutputW: 4000,
    })
    assert.ok(r.warnings.some(w => w.includes('extendedLowSunDays')))
  })

  test('does not warn when design periods are consistent and generator is adequately sized', () => {
    const r = hybridSystemSummary({
      dailyLoadWh: 10000, dailySolarOutputWh: 6000, bridgeDays: 2, extendedLowSunDays: 5,
      dodFraction: 0.5, systemVoltageV: 48, roundTripEfficiency: 0.85, generatorOutputW: 4000,
    })
    assert.equal(r.warnings.length, 0)
  })
})
