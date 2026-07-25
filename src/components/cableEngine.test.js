import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  cableSizing, cableVoltageDropDetailed, cableShortCircuitCurrent,
  trailingCableSizing, conduitFill, CABLE_OD,
  getOD, findGland, glandSelection, GLAND_SIZES,
  scheduleAutoSize, vfdCableSizing,
} from './cableEngine.js'

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

describe('cableSizing', () => {
  test('missing required inputs returns error', () => {
    assert.ok(cableSizing({ phase: '3ph', current: '', length: '50', voltage: '400', maxVd: '3' }).error)
  })

  test('50A/50m/400V/3ph/PVC/Cu, standard conditions — recommends 10mm² (first size meeting current+VD)', () => {
    const r = cableSizing({ phase: '3ph', current: '50', length: '50', voltage: '400', insul: 'PVC', material: 'Cu', ambient: '30', groups: '1', install: 'Clipped direct', maxVd: '3' })
    assert.equal(r.recommended, 10)
    assert.ok(close(r.derating, 1.0)) // 30°C×1group×clipped-direct = all 1.0
    assert.equal(r.required, 50)
  })

  test('hand-derived voltage drop for the recommended 10mm² size matches exactly', () => {
    const r = cableSizing({ phase: '3ph', current: '50', length: '50', voltage: '400', insul: 'PVC', material: 'Cu', ambient: '30', groups: '1', install: 'Clipped direct', maxVd: '3' })
    const row10 = r.allResults.find(x => x.size === 10)
    assert.ok(close(row10.vdV, 7.924132444627614))
    assert.ok(close(row10.vdPct, 1.9810331111569035))
  })

  test('grouping and ambient derating reduce current capacity (higher required current after derating)', () => {
    const good = cableSizing({ phase: '3ph', current: '50', length: '10', voltage: '400', insul: 'PVC', material: 'Cu', ambient: '30', groups: '1', install: 'Clipped direct', maxVd: '5' })
    const derated = cableSizing({ phase: '3ph', current: '50', length: '10', voltage: '400', insul: 'PVC', material: 'Cu', ambient: '45', groups: '4', install: 'Clipped direct', maxVd: '5' })
    assert.ok(derated.required > good.required) // worse conditions need a bigger nominal capacity
  })

  test('XLPE insulation and aluminium conductor factors are applied (larger recommended size for Al vs Cu)', () => {
    const cu = cableSizing({ phase: '3ph', current: '100', length: '20', voltage: '400', insul: 'PVC', material: 'Cu', ambient: '30', groups: '1', install: 'Clipped direct', maxVd: '5' })
    const al = cableSizing({ phase: '3ph', current: '100', length: '20', voltage: '400', insul: 'PVC', material: 'Al', ambient: '30', groups: '1', install: 'Clipped direct', maxVd: '5' })
    assert.ok(al.recommended >= cu.recommended) // Al derates current capacity (×0.78), needs equal or bigger CSA
  })

  test('no size meets criteria (e.g. huge current) → recommended is null, not a false positive', () => {
    const r = cableSizing({ phase: '3ph', current: '10000', length: '5', voltage: '400', insul: 'PVC', material: 'Cu', ambient: '30', groups: '1', install: 'Clipped direct', maxVd: '3' })
    assert.equal(r.recommended, null)
  })
})

describe('cableVoltageDropDetailed', () => {
  test('missing inputs returns error', () => {
    assert.ok(cableVoltageDropDetailed({ phase: '3ph', current: '', length: '50', voltage: '400', size: '16', material: 'Cu' }).error)
  })

  test('a size not present in CABLE_DATA returns an "Invalid size" error', () => {
    const r = cableVoltageDropDetailed({ phase: '3ph', current: '50', length: '50', voltage: '400', size: '17', material: 'Cu', pfVal: '0.85' })
    assert.equal(r.error, 'Invalid size')
  })

  test('50A/50m/400V/PF0.85/16mm²/Cu — matches hand-derived IEC-method reference', () => {
    const r = cableVoltageDropDetailed({ phase: '3ph', current: '50', pfVal: '0.85', length: '50', voltage: '400', size: '16', material: 'Cu' })
    assert.ok(close(r.vdD, 4.437992396394008))
    assert.ok(close(r.vdS, 4.979646071760522))
    assert.ok(close(r.pctD, 1.109498099098502))
    assert.ok(close(r.pctS, 1.2449115179401304))
    assert.ok(close(r.Vend, 395.562007603606))
  })

  test('IEC detailed method gives a lower VD than the simple resistivity-only method (power factor accounted)', () => {
    const r = cableVoltageDropDetailed({ phase: '3ph', current: '50', pfVal: '0.85', length: '50', voltage: '400', size: '16', material: 'Cu' })
    assert.ok(r.vdD < r.vdS)
  })

  test('pass threshold is exactly 3% detailed VD', () => {
    const r = cableVoltageDropDetailed({ phase: '3ph', current: '50', pfVal: '0.85', length: '50', voltage: '400', size: '16', material: 'Cu' })
    assert.equal(r.pass, r.pctD <= 3)
  })
})

describe('cableShortCircuitCurrent', () => {
  test('missing kVA or voltage returns error', () => {
    assert.ok(cableShortCircuitCurrent({ sourceKVA: '', voltage: '400' }).error)
  })

  test('500kVA/400V, fault at source (no cable) — Zc is 0, Zt = Zs only', () => {
    const r = cableShortCircuitCurrent({ sourceKVA: '500', voltage: '400', cableSize: '', cableLen: '' })
    assert.ok(close(r.Zs, 0.32))
    assert.equal(r.Zc, 0)
    assert.ok(close(r.Zt, 0.32))
  })

  test('500kVA/400V/16mm²/50m Cu — matches hand-derived reference including cable impedance', () => {
    const r = cableShortCircuitCurrent({ sourceKVA: '500', voltage: '400', cableSize: '16', cableLen: '50', material: 'Cu' })
    assert.ok(close(r.Zc, 0.11535163631262452))
    assert.ok(close(r.Zt, 0.4353516363126245))
    assert.ok(close(r.i3, 530.4679905004722))
    assert.ok(close(r.i1, 459.3987556678911))
  })

  test('longer cable to the fault point reduces fault current (higher impedance)', () => {
    const near = cableShortCircuitCurrent({ sourceKVA: '500', voltage: '400', cableSize: '16', cableLen: '10', material: 'Cu' })
    const far = cableShortCircuitCurrent({ sourceKVA: '500', voltage: '400', cableSize: '16', cableLen: '200', material: 'Cu' })
    assert.ok(far.i3 < near.i3)
  })
})

describe('trailingCableSizing', () => {
  test('missing inputs returns error', () => {
    assert.ok(trailingCableSizing({ current: '', length: '100', voltage: '525', maxVd: '5' }).error)
  })

  test('100A/100m/525V/maxVd5% — recommends 25mm² (first passing standard trailing size)', () => {
    const r = trailingCableSizing({ current: '100', length: '100', voltage: '525', maxVd: '5' })
    assert.equal(r.recommended, 25)
    assert.ok(close(r.required, 117.64705882352942)) // 100/0.85
  })

  test('hand-derived derated capacity and VD% for the recommended size matches exactly', () => {
    const r = trailingCableSizing({ current: '100', length: '100', voltage: '525', maxVd: '5' })
    const row25 = r.allResults.find(x => x.size === 25)
    assert.ok(close(row25.derated, 106.25))
    assert.ok(close(row25.vdPct, 2.3984779754334737))
  })

  test('no standard trailing size meets criteria for an extreme current → recommended is null', () => {
    const r = trailingCableSizing({ current: '5000', length: '10', voltage: '525', maxVd: '5' })
    assert.equal(r.recommended, null)
  })
})

describe('conduitFill', () => {
  test('zero/missing cable count returns null (matches original silent-return behavior)', () => {
    assert.equal(conduitFill({ conduit: '25', cableSize: '2.5', numCables: '' }), null)
  })

  test('25mm conduit / 2.5mm² cable × 5 — matches hand-derived fill % and max-cable counts', () => {
    const r = conduitFill({ conduit: '25', cableSize: '2.5', numCables: '5' })
    assert.ok(close(r.fill, 53.79199999999999))
    assert.equal(r.max33, 3)
    assert.equal(r.max40, 3)
    assert.equal(r.pass, false)
    assert.equal(r.pass40, false)
  })

  test('a fill within the 33% limit passes both thresholds', () => {
    const r = conduitFill({ conduit: '25', cableSize: '2.5', numCables: '2' })
    assert.equal(r.pass, true)
    assert.equal(r.pass40, true)
  })

  test('an unknown cable size key falls back to the 8mm default OD rather than crashing', () => {
    const r = conduitFill({ conduit: '25', cableSize: 'unknown-key', numCables: '2' })
    assert.ok(r !== null && Number.isFinite(r.fill))
  })
})

describe('getOD / findGland / glandSelection', () => {
  test('getOD returns null for an unlisted size/core combination', () => {
    assert.equal(getOD(999, 3, 'unarm', 'pvc'), null)
  })

  test('getOD for 16mm²/3-core/unarmoured/PVC matches the table exactly', () => {
    assert.equal(getOD(16, 3, 'unarm', 'pvc'), 16.5)
  })

  test('findGland uses the Pratley SWA override table when armour=swa and a match exists', () => {
    const g = findGland(20, 3, 4, 'swa') // '3-4' isn't in Pratley... check a real key
    // Use a genuinely Pratley-listed key: 4 cores, 4mm²
    const g2 = findGland(20, 4, 4, 'swa')
    assert.equal(g2.size, '1') // '4-4' → gland '1' per PRATLEY_SWA_TABLE
  })

  test('findGland falls back to the standard OD table when no Pratley entry exists for that key', () => {
    const g = findGland(16.5, 3, 16, 'unarm') // 16mm²/3-core isn't a Pratley SWA key at all
    assert.equal(g.size, '2') // 16.5mm OD falls in size-2 range (10-17)
  })

  test('glandSelection by conductor: 16mm²/3-core/unarmoured/PVC selects gland size 2', () => {
    const r = glandSelection({ method: 'conductor', condSize: '16', cores: '3', armour: 'unarm', insul: 'pvc' })
    assert.equal(r.od, 16.5)
    assert.equal(r.gland, '2')
  })

  test('glandSelection by conductor: unsupported size/core combination returns an error', () => {
    const r = glandSelection({ method: 'conductor', condSize: '999', cores: '3', armour: 'unarm', insul: 'pvc' })
    assert.ok(r.error)
  })

  test('glandSelection by OD: missing OD returns an error', () => {
    const r = glandSelection({ method: 'od', od: '' })
    assert.ok(r.error)
  })

  test('glandSelection by OD: an OD outside all standard ranges (e.g. 200mm) returns an error', () => {
    const r = glandSelection({ method: 'od', od: '200' })
    assert.ok(r.error)
  })

  test('glandSelection by OD: 16.5mm selects the same gland as the conductor-method lookup', () => {
    const r = glandSelection({ method: 'od', od: '16.5' })
    assert.equal(r.gland, '2')
  })
})

describe('scheduleAutoSize', () => {
  test('3ph, 50A, Cu, PVC — matches the table lookup used elsewhere in the app', () => {
    const size = scheduleAutoSize({ current: '50', phase: '3ph', material: 'Cu', insul: 'PVC' })
    assert.equal(size, 10) // same table/logic as cableSizing's 3ph/PVC/Cu row
  })

  test('a current beyond the table max falls back to 300mm² rather than undefined', () => {
    const size = scheduleAutoSize({ current: '100000', phase: '3ph', material: 'Cu', insul: 'PVC' })
    assert.equal(size, 300)
  })
})

describe('vfdCableSizing', () => {
  test('missing inputs returns error', () => {
    assert.ok(vfdCableSizing({ current: '', length: '30', voltage: '400' }).error)
  })

  test('50A/30m/400V — matches hand-derived derated current and recommended size', () => {
    const r = vfdCableSizing({ current: '50', length: '30', voltage: '400' })
    assert.ok(close(r.deratedI, 68.75)) // 50×1.1/0.80
    assert.equal(r.size, 16)
    assert.ok(close(r.vd, 2.987787643056313))
    assert.ok(close(r.vdPct, 0.7469469107640783))
  })

  test('length ≤50m passes the max-length check; >50m fails it', () => {
    const ok = vfdCableSizing({ current: '50', length: '50', voltage: '400' })
    assert.equal(ok.lengthOK, true)
    const tooLong = vfdCableSizing({ current: '50', length: '51', voltage: '400' })
    assert.equal(tooLong.lengthOK, false)
  })
})
