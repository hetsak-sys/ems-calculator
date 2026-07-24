import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  maxEarthFaultCurrentHR,
  hrSefPickup,
  solidEarthSefPickup,
} from './earthFaultProtectionEngine.js'

// ── maxEarthFaultCurrentHR ───────────────────────────────────────────────────
test('maxEarthFaultCurrentHR: matches Vln/R hand calc for 6.6kV/382Ω', () => {
  // Vln = 6600/sqrt(3) = 3810.5V; I = 3810.5/382 = 9.977A
  const result = maxEarthFaultCurrentHR(6600, 382)
  const expected = (6600 / Math.sqrt(3)) / 382
  assert.ok(Math.abs(result - expected) < 1e-9)
  assert.ok(Math.abs(result - 9.977) < 0.01)
})

test('maxEarthFaultCurrentHR: throws on non-positive voltage', () => {
  assert.throws(() => maxEarthFaultCurrentHR(0, 382))
  assert.throws(() => maxEarthFaultCurrentHR(-100, 382))
})

test('maxEarthFaultCurrentHR: throws on non-positive resistance', () => {
  assert.throws(() => maxEarthFaultCurrentHR(6600, 0))
  assert.throws(() => maxEarthFaultCurrentHR(6600, -5))
})

// ── hrSefPickup (Flow A) ─────────────────────────────────────────────────────
test('hrSefPickup: 15% pickup on a known fault current matches hand calc', () => {
  // maxFault = 9.977A (from above); pickup 15% => primary 1.4966A; CT 10/1 => secondary 0.14966A
  const r = hrSefPickup({ systemVoltageLL: 6600, nerResistanceOhm: 382, ctRatioPrimary: 10, pickupPercent: 15 })
  const expectedMax = (6600 / Math.sqrt(3)) / 382
  assert.ok(Math.abs(r.maxFaultCurrent - expectedMax) < 1e-9)
  assert.ok(Math.abs(r.pickupPrimary - expectedMax * 0.15) < 1e-9)
  assert.ok(Math.abs(r.pickupSecondary - (expectedMax * 0.15) / 10) < 1e-9)
})

test('hrSefPickup: boundary — pickup at exactly 100% equals max fault current, no over-100 warning', () => {
  const r = hrSefPickup({ systemVoltageLL: 6600, nerResistanceOhm: 382, ctRatioPrimary: 10, pickupPercent: 100 })
  assert.ok(Math.abs(r.pickupPrimary - r.maxFaultCurrent) < 1e-9)
  assert.ok(!r.warnings.some(w => w.includes('exceeds 100%')))
})

test('hrSefPickup: boundary — pickup over 100% triggers the never-operates warning', () => {
  const r = hrSefPickup({ systemVoltageLL: 6600, nerResistanceOhm: 382, ctRatioPrimary: 10, pickupPercent: 101 })
  assert.ok(r.warnings.some(w => w.includes('exceeds 100%')))
})

test('hrSefPickup: very low pickup percent triggers CT summation/measurement-error warning', () => {
  // pickupPrimary should fall below 1% of CT rated primary (10A) => below 0.1A
  const r = hrSefPickup({ systemVoltageLL: 6600, nerResistanceOhm: 382, ctRatioPrimary: 10, pickupPercent: 0.5 })
  assert.ok(r.warnings.some(w => w.includes('CT summation')))
})

test('hrSefPickup: throws when CT ratio is missing or non-positive', () => {
  assert.throws(() => hrSefPickup({ systemVoltageLL: 6600, nerResistanceOhm: 382, ctRatioPrimary: 0, pickupPercent: 15 }))
})

test('hrSefPickup: throws when pickup percent is missing, zero, or negative', () => {
  assert.throws(() => hrSefPickup({ systemVoltageLL: 6600, nerResistanceOhm: 382, ctRatioPrimary: 10 }))
  assert.throws(() => hrSefPickup({ systemVoltageLL: 6600, nerResistanceOhm: 382, ctRatioPrimary: 10, pickupPercent: 0 }))
  assert.throws(() => hrSefPickup({ systemVoltageLL: 6600, nerResistanceOhm: 382, ctRatioPrimary: 10, pickupPercent: -5 }))
})

test('hrSefPickup: always reports the non-numeric MHSA compliance note (never a fabricated numeric claim)', () => {
  const r = hrSefPickup({ systemVoltageLL: 6600, nerResistanceOhm: 382, ctRatioPrimary: 10, pickupPercent: 15 })
  assert.ok(r.localComplianceNote.includes('MHSA'))
  assert.ok(!/\d+%\s*MHSA|MHSA.*\d+%/.test(r.localComplianceNote), 'compliance note must not attach a fabricated numeric MHSA figure')
})

// ── solidEarthSefPickup (Flow B) ─────────────────────────────────────────────
test('solidEarthSefPickup: computes primary equivalent from secondary pickup and CT ratio', () => {
  const r = solidEarthSefPickup({ pickupSecondaryA: 7, ctRatioPrimary: 300, ctRatioSecondary: 1, delaySeconds: 2 })
  assert.ok(Math.abs(r.pickupPrimary - 7 * 300) < 1e-9)
})

test('solidEarthSefPickup: within-range pickup and delay produce no warnings', () => {
  const r = solidEarthSefPickup({ pickupSecondaryA: 7, ctRatioPrimary: 300, ctRatioSecondary: 1, delaySeconds: 2 })
  assert.equal(r.warnings.length, 0)
})

test('solidEarthSefPickup: delay under 1s triggers nuisance-trip warning', () => {
  const r = solidEarthSefPickup({ pickupSecondaryA: 7, ctRatioPrimary: 300, ctRatioSecondary: 1, delaySeconds: 0.5 })
  assert.ok(r.warnings.some(w => w.includes('nuisance-trip')))
})

test('solidEarthSefPickup: pickup outside 5-10A range triggers an out-of-range warning', () => {
  const low = solidEarthSefPickup({ pickupSecondaryA: 2, ctRatioPrimary: 300, ctRatioSecondary: 1, delaySeconds: 2 })
  const high = solidEarthSefPickup({ pickupSecondaryA: 15, ctRatioPrimary: 300, ctRatioSecondary: 1, delaySeconds: 2 })
  assert.ok(low.warnings.some(w => w.includes('5-10 A')))
  assert.ok(high.warnings.some(w => w.includes('5-10 A')))
})

test('solidEarthSefPickup: throws on non-positive pickup, CT ratio, or negative delay', () => {
  assert.throws(() => solidEarthSefPickup({ pickupSecondaryA: 0, ctRatioPrimary: 300, delaySeconds: 2 }))
  assert.throws(() => solidEarthSefPickup({ pickupSecondaryA: 7, ctRatioPrimary: 0, delaySeconds: 2 }))
  assert.throws(() => solidEarthSefPickup({ pickupSecondaryA: 7, ctRatioPrimary: 300, delaySeconds: -1 }))
})

// ── Cross-flow regression guard ──────────────────────────────────────────────
// The two flows must never share a pickup-basis assumption. This test would
// have caught a "% of NER" value being accidentally treated as an absolute
// secondary amps value, or vice versa.
test('cross-flow guard: HR flow pickup scales with pickupPercent; solid-earth flow pickup does not accept a percent-shaped input silently', () => {
  const hrLow = hrSefPickup({ systemVoltageLL: 6600, nerResistanceOhm: 382, ctRatioPrimary: 10, pickupPercent: 10 })
  const hrHigh = hrSefPickup({ systemVoltageLL: 6600, nerResistanceOhm: 382, ctRatioPrimary: 10, pickupPercent: 20 })
  assert.ok(hrHigh.pickupPrimary > hrLow.pickupPrimary, 'HR flow must scale with percent input')

  // Passing a "10" or "20" into solidEarthSefPickup's pickupSecondaryA must be
  // treated as literal amps (10A/20A), NOT reinterpreted as a percentage —
  // confirming the two flows' input semantics never silently cross over.
  const solid10 = solidEarthSefPickup({ pickupSecondaryA: 10, ctRatioPrimary: 300, ctRatioSecondary: 1, delaySeconds: 2 })
  assert.ok(Math.abs(solid10.pickupPrimary - 10 * 300) < 1e-9, 'solid-earth flow must treat pickupSecondaryA as literal amps, not a percent')
})
