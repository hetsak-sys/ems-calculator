import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  selectRelayFunctions,
  recommendCtAccuracyClass,
  recommendRelaySelection,
} from './relaySelectionEngine.js'

// ── selectRelayFunctions ─────────────────────────────────────────────────────
test('selectRelayFunctions: feeder + hr returns SEF referencing the HR earth-fault flow', () => {
  const r = selectRelayFunctions('feeder', 'hr')
  assert.equal(r.outOfScope, false)
  assert.ok(r.functions.some(f => f.includes('SEF')))
  assert.ok(r.note.includes('HR flow'))
})

test('selectRelayFunctions: feeder + solid returns SEF referencing the solid-earth flow', () => {
  const r = selectRelayFunctions('feeder', 'solid')
  assert.equal(r.outOfScope, false)
  assert.ok(r.note.includes('solid-earth flow'))
})

test('selectRelayFunctions: transformer + hr recommends REF with IEEE 242 citation', () => {
  const r = selectRelayFunctions('transformer', 'hr')
  assert.ok(r.functions.some(f => f.includes('REF')))
  assert.ok(r.standardsRefs.some(s => s.includes('IEEE 242')))
})

test('selectRelayFunctions: transformer + solid does not force REF (optional per note)', () => {
  const r = selectRelayFunctions('transformer', 'solid')
  assert.ok(r.note.toLowerCase().includes('optional'))
})

test('selectRelayFunctions: generator returns an explicit out-of-scope result, never a guessed recommendation', () => {
  const r = selectRelayFunctions('generator', 'hr')
  assert.equal(r.outOfScope, true)
  assert.ok(r.message.includes('§5.3'))
  assert.equal(r.functions, undefined, 'out-of-scope result must not carry a functions array a caller could mistake for a real recommendation')
})

test('selectRelayFunctions: throws on unknown application', () => {
  assert.throws(() => selectRelayFunctions('substation-yard', 'hr'))
})

test('selectRelayFunctions: throws on unknown earthing method', () => {
  assert.throws(() => selectRelayFunctions('feeder', 'floating'))
})

// ── recommendCtAccuracyClass ─────────────────────────────────────────────────
test('recommendCtAccuracyClass: chooses the smallest standard ALF that covers the required ratio', () => {
  // maxFault 4500A, CT rated 300A => required ALF = 15 => exact match on standard series
  const r = recommendCtAccuracyClass({ maxFaultCurrentPrimary: 4500, ctRatedPrimary: 300 })
  assert.ok(Math.abs(r.requiredAlf - 15) < 1e-9)
  assert.equal(r.recommendedClass, '5P15')
})

test('recommendCtAccuracyClass: rounds up to the next standard class when required ALF falls between series values', () => {
  // required ALF = 4300/300 = 14.33 => next standard value is 15
  const r = recommendCtAccuracyClass({ maxFaultCurrentPrimary: 4300, ctRatedPrimary: 300 })
  assert.equal(r.recommendedClass, '5P15')
})

test('recommendCtAccuracyClass: honors 10P prefix', () => {
  const r = recommendCtAccuracyClass({ maxFaultCurrentPrimary: 4500, ctRatedPrimary: 300, protectionClassPrefix: '10P' })
  assert.equal(r.recommendedClass, '10P15')
})

test('recommendCtAccuracyClass: required ALF beyond the standard series (30) returns null class with a warning, never a guessed class', () => {
  const r = recommendCtAccuracyClass({ maxFaultCurrentPrimary: 20000, ctRatedPrimary: 300 })
  assert.equal(r.recommendedClass, null)
  assert.ok(r.warnings.some(w => w.includes('exceeds the standard series')))
})

test('recommendCtAccuracyClass: always includes the PX-not-covered limitation warning', () => {
  const r = recommendCtAccuracyClass({ maxFaultCurrentPrimary: 4500, ctRatedPrimary: 300 })
  assert.ok(r.warnings.some(w => w.includes('PX')))
})

test('recommendCtAccuracyClass: throws on non-positive fault current or CT rating', () => {
  assert.throws(() => recommendCtAccuracyClass({ maxFaultCurrentPrimary: 0, ctRatedPrimary: 300 }))
  assert.throws(() => recommendCtAccuracyClass({ maxFaultCurrentPrimary: 4500, ctRatedPrimary: 0 }))
})

test('recommendCtAccuracyClass: throws on an invalid protection class prefix', () => {
  assert.throws(() => recommendCtAccuracyClass({ maxFaultCurrentPrimary: 4500, ctRatedPrimary: 300, protectionClassPrefix: '15P' }))
})

// ── recommendRelaySelection (combined wizard) ────────────────────────────────
test('recommendRelaySelection: combines relay functions and CT class for an in-scope application', () => {
  const r = recommendRelaySelection({
    application: 'feeder', earthingMethod: 'hr',
    maxFaultCurrentPrimary: 4500, ctRatedPrimary: 300,
  })
  assert.equal(r.outOfScope, false)
  assert.ok(r.relayFunctions.length > 0)
  assert.equal(r.ctAccuracyClass, '5P15')
  assert.ok(r.standardsRefs.some(s => s.includes('IEC 61869-2')))
})

test('recommendRelaySelection: generator application short-circuits to out-of-scope before any CT calc runs', () => {
  const r = recommendRelaySelection({
    application: 'generator', earthingMethod: 'hr',
    maxFaultCurrentPrimary: 4500, ctRatedPrimary: 300,
  })
  assert.equal(r.outOfScope, true)
  assert.equal(r.ctAccuracyClass, undefined)
})
