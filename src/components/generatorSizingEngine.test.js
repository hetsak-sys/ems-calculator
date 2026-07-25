import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  knownLoadSizing, loadScheduleTotals, generatorSizingFromTotals,
  transformerSizing, faultLevelFromImpedance,
  GEN_SIZES, TRAFO_SIZES, START_MULT, nextStd,
} from './generatorSizingEngine.js'

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

describe('knownLoadSizing', () => {
  test('200kW/PF0.8/eff90%/1600m/35°C/37kW-DOL-motor — matches hand-derived reference', () => {
    const r = knownLoadSizing({ kw: '200', kwPf: '0.8', eff: '90', altitude: '1600', temp: '35', largestMotorKw: '37', startMethod: 'DOL' })
    assert.ok(close(r.kVA_load, 277.77777777777777))
    assert.ok(close(r.kVA_start, 300.625))
    assert.ok(close(r.derate, 0.964))
    assert.ok(close(r.kVA_req, 311.85165975103735))
    assert.equal(r.gen, 350) // next standard size ≥ 311.85
  })

  test('empty kw input degrades to a zero-load result rather than throwing (pf() fallback means the isNaN guard is never actually reachable — same as the original inline code)', () => {
    const r = knownLoadSizing({ kw: '', kwPf: '0.8', eff: '90', altitude: '1600', temp: '35', largestMotorKw: '37', startMethod: 'DOL' })
    assert.ok(r !== null)
    assert.equal(r.kVA_load, 0)
  })

  test('governing kVA is the larger of steady-state load and motor starting kVA', () => {
    // Small load, huge motor start -> starting kVA should govern
    const r = knownLoadSizing({ kw: '10', kwPf: '0.8', eff: '90', altitude: '1000', temp: '25', largestMotorKw: '37', startMethod: 'DOL' })
    assert.ok(r.kVA_start > r.kVA_load)
    assert.ok(close(r.kVA_req, r.kVA_start / 1)) // derate=1 at 1000m/25°C, so kVA_req = kVA_start
  })

  test('VFD start method contributes minimal starting kVA (1.0× multiplier) vs DOL (6.5×)', () => {
    const dol = knownLoadSizing({ kw: '10', kwPf: '0.8', eff: '90', altitude: '1000', temp: '25', largestMotorKw: '37', startMethod: 'DOL' })
    const vfd = knownLoadSizing({ kw: '10', kwPf: '0.8', eff: '90', altitude: '1000', temp: '25', largestMotorKw: '37', startMethod: 'VFD' })
    assert.ok(vfd.kVA_start < dol.kVA_start)
  })
})

describe('loadScheduleTotals', () => {
  test('two-load schedule (50kW motor DOL + 20kW resistive) — matches hand-derived reference', () => {
    const loads = [
      { kw: '50', pf: '0.85', df: '100', type: 'Motor', start: 'DOL' },
      { kw: '20', pf: '0.9', df: '80', type: 'Resistive', start: 'N/A' },
    ]
    const r = loadScheduleTotals(loads)
    assert.ok(close(r.sumKW, 66))
    assert.ok(close(r.sumKVAR, 38.736370597560764))
    assert.ok(close(r.totKVA, 76.5278145975146))
    assert.ok(close(r.sysPF, 0.8624315269829158))
    assert.ok(close(r.maxStartKVA, 382.3529411764706))
  })

  test('non-motor loads never contribute to maxStartKVA regardless of their "start" field', () => {
    const loads = [{ kw: '100', pf: '0.9', df: '100', type: 'Resistive', start: 'DOL' }]
    const r = loadScheduleTotals(loads)
    assert.equal(r.maxStartKVA, 0)
  })

  test('maxStartKVA is the single LARGEST motor start, not the sum of all motor starts', () => {
    const loads = [
      { kw: '50', pf: '0.85', df: '100', type: 'Motor', start: 'DOL' },
      { kw: '10', pf: '0.85', df: '100', type: 'Motor', start: 'DOL' },
    ]
    const r = loadScheduleTotals(loads)
    const bigMotorStart = (50 / 0.85) * 6.5
    assert.ok(close(r.maxStartKVA, bigMotorStart))
  })

  test('an empty load schedule returns zeroed totals, not a crash', () => {
    const r = loadScheduleTotals([])
    assert.equal(r.sumKW, 0)
    assert.equal(r.totKVA, 0)
    assert.equal(r.sysPF, 1) // fallback when totKVA is 0
  })

  test('power factor is floored at 0.01 to avoid division-by-near-zero blowup', () => {
    const loads = [{ kw: '10', pf: '0', df: '100', type: 'Resistive', start: 'N/A' }]
    const r = loadScheduleTotals(loads)
    assert.ok(Number.isFinite(r.rows[0].dKVA))
  })
})

describe('generatorSizingFromTotals', () => {
  test('governing=382.35kVA (motor start dominates)/1600m/35°C/25%margin/PF0.8 — matches hand-derived reference', () => {
    const totals = { totKVA: 76.5278145975146, maxStartKVA: 382.3529411764706 }
    const r = generatorSizingFromTotals({ totals, altitude: '1600', ambTemp: '35', margin: '25', genPF: '0.8' })
    assert.ok(close(r.altFactor, 0.964))
    assert.equal(r.tempFactor, 1)
    assert.ok(close(r.netFactor, 0.964))
    assert.ok(close(r.governing, 382.3529411764706)) // maxStartKVA wins over totKVA
    assert.ok(close(r.withMargin, 477.9411764705883))
    assert.ok(close(r.required, 495.7896021479132))
    assert.equal(r.stdSize, 500)
  })

  test('governing picks totKVA when it exceeds maxStartKVA (steady-state load dominates)', () => {
    const totals = { totKVA: 500, maxStartKVA: 50 }
    const r = generatorSizingFromTotals({ totals, altitude: '1000', ambTemp: '25', margin: '20', genPF: '0.8' })
    assert.ok(close(r.governing, 500))
  })
})

describe('transformerSizing', () => {
  test('11000V/400V/500kVA-generator/5%Z — matches hand-derived reference', () => {
    const r = transformerSizing({ vPri: '11000', vSec: '400', genStdSize: 500, pctZ: '5' })
    assert.ok(close(r.ratio, 27.5))
    assert.ok(close(r.ip, 26.243194054073896))
    assert.ok(close(r.is_, 721.6878364870322))
    assert.equal(r.stdKVA, 500) // 500 is already a standard transformer size
    assert.ok(close(r.zBase, 0.32))
    assert.ok(close(r.zOhm, 0.016))
  })

  test('stdKVA is computed BEFORE zBase references it (the ordering fix from debt.md, re-verified here)', () => {
    // A non-standard generator size (e.g. 1500 sits exactly on a std size, use 1450 to force rounding)
    const r = transformerSizing({ vPri: '11000', vSec: '400', genStdSize: 1450, pctZ: '5' })
    assert.equal(r.stdKVA, 1600) // rounds UP to next standard transformer size
    // zBase MUST be computed from the rounded stdKVA (1600), not the raw genStdSize (1450)
    const expectedZBase = (400 * 400) / (1600 * 1000)
    assert.ok(close(r.zBase, expectedZBase))
  })
})

describe('faultLevelFromImpedance', () => {
  test('400V/500kVA-transformer/5%Z/15%Xd — matches hand-derived reference', () => {
    const r = faultLevelFromImpedance({ vSec: '400', trafoStdKVA: 500, pctZ: '5', xdPct: '15' })
    assert.ok(close(r.baseVA, 500000))
    assert.ok(close(r.zBase, 0.32))
    assert.ok(close(r.iBase, 721.6878364870322))
    assert.ok(close(r.xdPu, 0.15))
    assert.ok(close(r.zTraPu, 0.05))
    assert.ok(close(r.zTot, 0.2))
    assert.ok(close(r.isc3, 3608.439182435161))
    assert.ok(close(r.kAsc, 3.608439182435161))
    assert.ok(close(r.mvasc, 2.5))
  })

  test('lower total impedance (gen+transformer reactance) gives a higher fault current', () => {
    const stiff = faultLevelFromImpedance({ vSec: '400', trafoStdKVA: 500, pctZ: '4', xdPct: '10' })
    const soft = faultLevelFromImpedance({ vSec: '400', trafoStdKVA: 500, pctZ: '6', xdPct: '20' })
    assert.ok(stiff.isc3 > soft.isc3)
  })
})

describe('shared reference data (GEN_SIZES / TRAFO_SIZES / START_MULT / nextStd)', () => {
  test('GEN_SIZES and TRAFO_SIZES are ascending', () => {
    for (let i = 1; i < GEN_SIZES.length; i++) assert.ok(GEN_SIZES[i] > GEN_SIZES[i - 1])
    for (let i = 1; i < TRAFO_SIZES.length; i++) assert.ok(TRAFO_SIZES[i] > TRAFO_SIZES[i - 1])
  })

  test('START_MULT: DOL has the highest multiplier, VFD the lowest non-zero, N/A is zero', () => {
    assert.ok(START_MULT.DOL > START_MULT['Star-Delta'])
    assert.ok(START_MULT.DOL > START_MULT['Soft-Start'])
    assert.equal(START_MULT['N/A'], 0)
    assert.ok(START_MULT.VFD > 0 && START_MULT.VFD < START_MULT.DOL)
  })

  test('nextStd rounds up to the next value in the array, or the max if beyond range', () => {
    assert.equal(nextStd(GEN_SIZES, 45), 50)
    assert.equal(nextStd(GEN_SIZES, 10), 10) // exact match
    assert.equal(nextStd(GEN_SIZES, 5000), 2000) // beyond range -> largest available
  })
})
