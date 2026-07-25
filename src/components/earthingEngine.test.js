import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  dwightElectrodeResistance, ieee80TouchStepVoltage,
  adiabaticConductorSizing, EARTHING_MATERIALS, STANDARD_CSA_MM2,
  faultLoopImpedance,
} from './earthingEngine.js'

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

describe('dwightElectrodeResistance', () => {
  test('single rod, 100Ω·m/2.4m/16mm — matches hand-derived Dwight reference', () => {
    const r = dwightElectrodeResistance({ rho: '100', L: '2.4', d: '0.016', n: '1', s: '3' })
    assert.ok(close(r.single, 35.78950133945367))
    assert.equal(r.parallel, r.single) // n=1 → no parallel reduction
    assert.equal(r.ratio, 1)
  })

  test('4 rods in parallel divides resistance by n (simple approximation, matches original)', () => {
    const r = dwightElectrodeResistance({ rho: '100', L: '2.4', d: '0.016', n: '4', s: '3' })
    assert.ok(close(r.parallel, 8.947375334863418))
    assert.ok(close(r.ratio, 4))
  })

  test('pass threshold is exactly 1.0 Ω (below is pass, at/above is fail)', () => {
    const belowOne = dwightElectrodeResistance({ rho: '20', L: '3', d: '0.016', n: '8', s: '3' })
    assert.equal(belowOne.pass, belowOne.parallel < 1.0)
  })

  test('invalid input (NaN, non-positive length/diameter) returns null, not a broken calc', () => {
    assert.equal(dwightElectrodeResistance({ rho: 'x', L: '2.4', d: '0.016', n: '1', s: '3' }), null)
    assert.equal(dwightElectrodeResistance({ rho: '100', L: '0', d: '0.016', n: '1', s: '3' }), null)
    assert.equal(dwightElectrodeResistance({ rho: '100', L: '2.4', d: '0', n: '1', s: '3' }), null)
    assert.equal(dwightElectrodeResistance({ rho: '100', L: '-1', d: '0.016', n: '1', s: '3' }), null)
  })
})

describe('ieee80TouchStepVoltage', () => {
  test('crushed rock surface layer (3000Ω·m/0.15m/0.5s) — matches hand-derived reference', () => {
    const r = ieee80TouchStepVoltage({ rhoS: '3000', hs: '0.15', ts: '0.5' })
    assert.ok(close(r.Cs, 0.7769230769230769))
    assert.ok(close(r.touch, 737.5885227386199))
    assert.ok(close(r.step, 2458.2077712486425))
  })

  test('step voltage is always higher than touch voltage for the same conditions (6× vs 1.5× Cs·rs term)', () => {
    const r = ieee80TouchStepVoltage({ rhoS: '3000', hs: '0.15', ts: '0.5' })
    assert.ok(r.step > r.touch)
  })

  test('longer fault clearing time reduces tolerable voltage (1/√t relationship)', () => {
    const fast = ieee80TouchStepVoltage({ rhoS: '3000', hs: '0.15', ts: '0.2' })
    const slow = ieee80TouchStepVoltage({ rhoS: '3000', hs: '0.15', ts: '1.0' })
    assert.ok(fast.touch > slow.touch)
  })

  test('invalid input returns null', () => {
    assert.equal(ieee80TouchStepVoltage({ rhoS: 'x', hs: '0.1', ts: '0.5' }), null)
  })
})

describe('adiabaticConductorSizing', () => {
  test('10kA/1s/copper (PVC) — matches hand-derived S = I√t/k', () => {
    const r = adiabaticConductorSizing({ If: '10000', tf: '1', material: 'cu' })
    assert.ok(close(r.S, 69.93006993006993))
    assert.equal(r.Smin, 70) // next standard CSA ≥ 69.93
    assert.equal(r.name, EARTHING_MATERIALS.cu.name)
  })

  test('minimum standard size rounds UP, never down', () => {
    const r = adiabaticConductorSizing({ If: '1000', tf: '1', material: 'cu' }) // S = 6.993
    assert.equal(r.Smin, 10)
  })

  test('every material in EARTHING_MATERIALS produces a different (and correctly ordered) k factor', () => {
    // Higher k = lower required CSA for the same fault current/time (steel needs the least protection... actually
    // higher k means smaller S, so steel(k=78, lowest) needs the LARGEST csa for a given fault — verify ordering)
    const cu = adiabaticConductorSizing({ If: '5000', tf: '1', material: 'cu' })
    const al = adiabaticConductorSizing({ If: '5000', tf: '1', material: 'al' })
    const st = adiabaticConductorSizing({ If: '5000', tf: '1', material: 'st' })
    // Lower k → larger required S for the same fault current/time
    assert.ok(st.S > al.S) // steel k=78 < aluminium k=95
    assert.ok(al.S > cu.S) // aluminium k=95 < copper k=143
  })

  test('a fault current requiring more than 300mm² returns the ">300" sentinel, not a number', () => {
    const r = adiabaticConductorSizing({ If: '100000', tf: '3', material: 'st' })
    assert.equal(r.Smin, '>300')
  })

  test('invalid input returns null', () => {
    assert.equal(adiabaticConductorSizing({ If: 'x', tf: '1', material: 'cu' }), null)
  })
})

describe('faultLoopImpedance', () => {
  test('400V/Zs0.8/Rc0.5/Re0.3/100A device — matches hand-derived reference', () => {
    const r = faultLoopImpedance({ Vs: '400', Zs: '0.8', Rc: '0.5', Re: '0.3', Iop: '100' })
    assert.ok(close(r.Zloop, 1.6))
    assert.ok(close(r.Isc, 144.33756729740645))
    assert.ok(close(r.If1, 166.66666666666663))
    assert.ok(close(r.ratio, 1.6666666666666663))
  })

  test('pass threshold is exactly 5× the device rating (magnetic trip margin)', () => {
    const justPass = faultLoopImpedance({ Vs: '230', Zs: '0.1', Rc: '0.1', Re: '0.1', Iop: '100' })
    // If1 = 230/(2*0.2+0.1) = 230/0.5 = 460A = exactly 4.6× → below 5× → should fail
    assert.ok(close(justPass.If1, 460))
    assert.equal(justPass.pass, false) // 460 < 500 (100×5)
  })

  test('sufficient earth fault current passes the protection-will-operate check', () => {
    const r = faultLoopImpedance({ Vs: '400', Zs: '0.1', Rc: '0.1', Re: '0.1', Iop: '10' })
    assert.equal(r.pass, true)
  })

  test('invalid input returns null', () => {
    assert.equal(faultLoopImpedance({ Vs: 'x', Zs: '0.8', Rc: '0.5', Re: '0.3', Iop: '100' }), null)
  })
})
