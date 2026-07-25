import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  transformerParameters, pfCorrection, PFC_CAPACITOR_STEPS_KVAR,
  busbarRating, motorStartingComparison, MOTOR_STARTING_FACTORS,
} from './powerSysEngine.js'

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

describe('transformerParameters', () => {
  test('1000kVA/11000V/400V/6%Z/PF0.85/eff98% — matches hand-derived reference', () => {
    const r = transformerParameters({ kva: '1000', vpri: '11000', vsec: '400', zpc: '6', pf: '0.85', eff: '98' })
    assert.ok(close(r.ratio, 27.5))
    assert.ok(close(r.Ipri, 52.48638810814779))
    assert.ok(close(r.Isec, 1443.3756729740644))
    assert.ok(close(r.Isc3, 24.056261216234407))
    assert.ok(close(r.Isc1, 20.832722213258997))
    assert.ok(close(r.Ploss, 17.34693877551018))
  })

  test('1-phase fault is always 86.6% of the 3-phase fault (fixed approximation ratio)', () => {
    const r = transformerParameters({ kva: '1000', vpri: '11000', vsec: '400', zpc: '6', pf: '0.85', eff: '98' })
    assert.ok(close(r.Isc1 / r.Isc3, 0.866))
  })

  test('invalid/missing input returns null', () => {
    assert.equal(transformerParameters({ kva: '', vpri: '11000', vsec: '400', zpc: '6', pf: '0.85', eff: '98' }), null)
  })

  test('lower impedance % gives a higher fault current (inverse relationship)', () => {
    const lowZ = transformerParameters({ kva: '1000', vpri: '11000', vsec: '400', zpc: '4', pf: '0.85', eff: '98' })
    const highZ = transformerParameters({ kva: '1000', vpri: '11000', vsec: '400', zpc: '8', pf: '0.85', eff: '98' })
    assert.ok(lowZ.Isc3 > highZ.Isc3)
  })
})

describe('pfCorrection', () => {
  test('500kW/PF0.75→0.95/400V — matches hand-derived reference', () => {
    const r = pfCorrection({ kw: '500', pf1: '0.75', pf2: '0.95', vv: '400' })
    assert.ok(close(r.Qc, 276.6164992546669))
    assert.ok(close(r.Ibefore, 962.2504486493763))
    assert.ok(close(r.Iafter, 759.671406828455))
    assert.ok(close(r.Ic, 399.26152576743465))
    assert.ok(close(r.saving, 21.052631578947363))
    assert.equal(r.bank, 300) // next standard step ≥ 276.62 kVAr
  })

  test('invalid power factor (≥1, or target >1) is rejected, not silently computed', () => {
    assert.equal(pfCorrection({ kw: '500', pf1: '1.0', pf2: '0.95', vv: '400' }), null)
    assert.equal(pfCorrection({ kw: '500', pf1: '0.75', pf2: '1.01', vv: '400' }), null)
  })

  test('a Qc beyond the largest standard bank (300 kVAr) returns the ">300" sentinel', () => {
    const r = pfCorrection({ kw: '5000', pf1: '0.6', pf2: '0.98', vv: '400' })
    assert.equal(r.bank, '>300')
  })

  test('every standard capacitor bank step is ascending (sanity check on the reference table)', () => {
    for (let i = 1; i < PFC_CAPACITOR_STEPS_KVAR.length; i++) {
      assert.ok(PFC_CAPACITOR_STEPS_KVAR[i] > PFC_CAPACITOR_STEPS_KVAR[i - 1])
    }
  })
})

describe('busbarRating', () => {
  test('copper, 50×5mm, 2 bars/phase, 30°C ambient — matches hand-derived reference', () => {
    const r = busbarRating({ mat: 'cu', w: '50', thick: '5', bars: '2', temp: '30' })
    assert.equal(r.area, 500)
    assert.ok(close(r.I, 1044.465935734187))
    assert.ok(close(r.Isc, 71.5))
    assert.ok(close(r.R, 0.03448))
  })

  test('copper carries more current than aluminium for the same cross-section (higher current density)', () => {
    const cu = busbarRating({ mat: 'cu', w: '50', thick: '5', bars: '1', temp: '30' })
    const al = busbarRating({ mat: 'al', w: '50', thick: '5', bars: '1', temp: '30' })
    assert.ok(cu.I > al.I)
  })

  test('higher ambient temperature reduces the continuous current rating', () => {
    const cool = busbarRating({ mat: 'cu', w: '50', thick: '5', bars: '1', temp: '20' })
    const hot = busbarRating({ mat: 'cu', w: '50', thick: '5', bars: '1', temp: '60' })
    assert.ok(hot.I < cool.I)
  })

  test('invalid/missing input returns null', () => {
    assert.equal(busbarRating({ mat: 'cu', w: '', thick: '5', bars: '2', temp: '30' }), null)
  })
})

describe('motorStartingComparison', () => {
  test('75kW/400V/eff92%/PF0.88/DOL — matches hand-derived reference', () => {
    const r = motorStartingComparison({ kw: '75', vv: '400', eff: '92', pf: '0.88', method: 'dol' })
    assert.ok(close(r.Ifull, 133.71192622659936))
    assert.ok(close(r.Istart, 869.1275204728959)) // 6.5× FLC for DOL
    assert.ok(close(r.kVA, 602.149209486166))
    assert.ok(close(r.dip, 3010.74604743083))
    assert.equal(r.torque, 1.5)
  })

  test('VFD has the lowest starting current multiplier of all methods (soft-start electronics)', () => {
    const dol = motorStartingComparison({ kw: '75', vv: '400', eff: '92', pf: '0.88', method: 'dol' })
    const vfd = motorStartingComparison({ kw: '75', vv: '400', eff: '92', pf: '0.88', method: 'vfd' })
    assert.ok(vfd.Istart < dol.Istart)
  })

  test('every starting method in MOTOR_STARTING_FACTORS has a start multiplier ≥1 (never reduces current)', () => {
    for (const method of Object.keys(MOTOR_STARTING_FACTORS)) {
      assert.ok(MOTOR_STARTING_FACTORS[method].start >= 1)
    }
  })

  test('invalid/missing input returns null', () => {
    assert.equal(motorStartingComparison({ kw: '', vv: '400', eff: '92', pf: '0.88', method: 'dol' }), null)
  })
})
