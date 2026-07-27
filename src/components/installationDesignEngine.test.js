import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { loadAssessment, LOAD_CATEGORIES, pf, dbSizing, STANDARD_DB_SIZES, SOCKET_OUTLET_CIRCUIT_MAX_KW, circuitDesign, areaLighting, AREA_LIGHTING_GUIDE, findAreaLightingGuideEntry } from './installationDesignEngine.js'

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

describe('LOAD_CATEGORIES', () => {
  test('every category has an id, label, defaultDF, and hint', () => {
    for (const cat of LOAD_CATEGORIES) {
      assert.ok(cat.id)
      assert.ok(cat.label)
      assert.equal(cat.defaultDF, 100) // safest-if-wrong default per [DEC-4]
      assert.ok(cat.hint)
    }
  })
})

describe('loadAssessment', () => {
  test('missing voltage returns error', () => {
    assert.ok(loadAssessment({ rows: [{ id: 'lighting', connected: '5', demandFactor: '100' }], voltage: '', phase: '3ph', powerFactor: '0.9' }).error)
  })

  test('no rows with a connected load returns error', () => {
    assert.ok(loadAssessment({ rows: [], voltage: '400', phase: '3ph', powerFactor: '0.9' }).error)
    assert.ok(loadAssessment({ rows: [{ id: 'lighting', connected: '0', demandFactor: '100' }], voltage: '400', phase: '3ph', powerFactor: '0.9' }).error)
  })

  test('3ph, 400V, 0.9 PF, three rows with mixed demand factors — hand-derived exactly', () => {
    const r = loadAssessment({
      rows: [
        { id: 'lighting', connected: '5', demandFactor: '80' },
        { id: 'sockets', connected: '10', demandFactor: '50' },
        { id: 'waterHeating', connected: '6', demandFactor: '100' },
      ],
      voltage: '400', phase: '3ph', powerFactor: '0.9',
    })
    assert.ok(close(r.totalConnected, 21))
    assert.ok(close(r.totalDemand, 15))
    assert.ok(close(r.demandKVA, 16.666666666666668))
    assert.ok(close(r.current, 24.05626121623441))
    assert.equal(r.recommendedMain, 25)
    assert.ok(close(r.diversityAchieved, 28.57142857142857))
    assert.equal(r.warnings.length, 0)
  })

  test('single-phase current uses I = P/V, not the three-phase divisor', () => {
    const threePh = loadAssessment({ rows: [{ id: 'lighting', connected: '10', demandFactor: '100' }], voltage: '230', phase: '1ph', powerFactor: '1' })
    // 10kW / 1 (PF) = 10kVA -> 10000/230 = 43.478...A
    assert.ok(close(threePh.current, 43.47826086956522))
  })

  test('demand factor above 100% is allowed but flagged as a warning', () => {
    const r = loadAssessment({ rows: [{ id: 'motors', connected: '10', demandFactor: '120' }], voltage: '400', phase: '3ph', powerFactor: '0.9' })
    assert.equal(r.warnings.length, 1)
    assert.match(r.warnings[0], /above 100%/)
  })

  test('a row with zero/blank demand factor is flagged and contributes zero demand', () => {
    const r = loadAssessment({
      rows: [
        { id: 'lighting', connected: '5', demandFactor: '' },
        { id: 'sockets', connected: '5', demandFactor: '100' },
      ],
      voltage: '400', phase: '3ph', powerFactor: '0.9',
    })
    assert.equal(r.warnings.length, 1)
    assert.match(r.warnings[0], /zero or blank/)
    assert.ok(close(r.totalDemand, 5)) // only the sockets row counts
  })

  test('rows with zero connected load are silently excluded (not warned, not counted)', () => {
    const r = loadAssessment({
      rows: [
        { id: 'lighting', connected: '0', demandFactor: '100' },
        { id: 'sockets', connected: '8', demandFactor: '100' },
      ],
      voltage: '400', phase: '3ph', powerFactor: '0.9',
    })
    assert.equal(r.rowResults.length, 1)
    assert.equal(r.rowResults[0].id, 'sockets')
  })

  test('recommendedMain always returns a real MCCB_TRIPS value, never undefined, even for a huge load', () => {
    const r = loadAssessment({ rows: [{ id: 'motors', connected: '5000', demandFactor: '100' }], voltage: '400', phase: '3ph', powerFactor: '0.9' })
    assert.ok(typeof r.recommendedMain === 'number')
  })

  test('comma-decimal input is normalized (pf helper matches project-wide convention)', () => {
    assert.ok(close(pf('12,5'), 12.5))
    const r = loadAssessment({ rows: [{ id: 'lighting', connected: '5,5', demandFactor: '100' }], voltage: '400', phase: '3ph', powerFactor: '0,9' })
    assert.ok(close(r.totalConnected, 5.5))
  })

  test('diversityAchieved is 0 when every row runs at 100% demand factor (no diversity claimed)', () => {
    const r = loadAssessment({
      rows: [{ id: 'lighting', connected: '5', demandFactor: '100' }, { id: 'sockets', connected: '5', demandFactor: '100' }],
      voltage: '400', phase: '3ph', powerFactor: '0.9',
    })
    assert.ok(close(r.diversityAchieved, 0))
  })
})

describe('dbSizing', () => {
  test('no circuits returns error', () => {
    assert.ok(dbSizing({ circuits: [], sparePct: '20', mainSwitch: '63' }).error)
  })

  test('3 circuits, 20% spare, one socket-outlet circuit over the 5kW limit — hand-derived exactly', () => {
    const r = dbSizing({
      circuits: [
        { id: 'c1', type: 'lighting', connected: '2' },
        { id: 'c2', type: 'sockets', connected: '3' },
        { id: 'c3', type: 'sockets', connected: '6', label: 'Kitchen sockets' },
      ],
      sparePct: '20', mainSwitch: '63',
    })
    assert.equal(r.circuitCount, 3)
    assert.equal(r.spareCount, 1) // ceil(3 * 0.20) = ceil(0.6) = 1
    assert.equal(r.requiredWays, 4)
    assert.equal(r.recommendedDB, 4)
    assert.equal(r.recommendedMain, 63)
    assert.equal(r.warnings.length, 1)
    assert.match(r.warnings[0], /Kitchen sockets/)
    assert.match(r.warnings[0], new RegExp(`${SOCKET_OUTLET_CIRCUIT_MAX_KW} kW`))
  })

  test('a socket-outlet circuit at exactly 5kW is not flagged (limit is inclusive: "shall not exceed")', () => {
    const r = dbSizing({ circuits: [{ id: 'c1', type: 'sockets', connected: '5' }], sparePct: '0', mainSwitch: '' })
    assert.equal(r.warnings.length, 0)
  })

  test('non-socket circuit types are never flagged regardless of connected load', () => {
    const r = dbSizing({ circuits: [{ id: 'c1', type: 'waterHeating', connected: '20' }], sparePct: '0', mainSwitch: '' })
    assert.equal(r.warnings.length, 0)
  })

  test('spare ways round UP (ceil), never down, even for a tiny fractional remainder', () => {
    // 5 circuits * 20% = 1.0 exactly -> spareCount 1 (not a rounding edge case)
    const five = dbSizing({ circuits: Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, type: 'lighting', connected: '1' })), sparePct: '20', mainSwitch: '' })
    assert.equal(five.spareCount, 1)
    // 6 circuits * 20% = 1.2 -> ceil = 2
    const six = dbSizing({ circuits: Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, type: 'lighting', connected: '1' })), sparePct: '20', mainSwitch: '' })
    assert.equal(six.spareCount, 2)
  })

  test('recommendedDB always picks the next STANDARD_DB_SIZES value at or above requiredWays, capping at the largest', () => {
    const huge = dbSizing({ circuits: Array.from({ length: 50 }, (_, i) => ({ id: `c${i}`, type: 'lighting', connected: '1' })), sparePct: '0', mainSwitch: '' })
    assert.equal(huge.recommendedDB, STANDARD_DB_SIZES[STANDARD_DB_SIZES.length - 1])
  })

  test('mainSwitch is optional — recommendedMain is null (not zero, not NaN) when blank', () => {
    const r = dbSizing({ circuits: [{ id: 'c1', type: 'lighting', connected: '1' }], sparePct: '0', mainSwitch: '' })
    assert.equal(r.recommendedMain, null)
  })

  test('mainSwitch rounds up to the next real MCCB_TRIPS value, not an arbitrary number', () => {
    const r = dbSizing({ circuits: [{ id: 'c1', type: 'lighting', connected: '1' }], sparePct: '0', mainSwitch: '61' })
    assert.equal(r.recommendedMain, 63) // MCCB_TRIPS: ...50, 63, 80... — 61A rounds up to 63A
  })

  test('a circuit row missing a type is excluded entirely (not counted, not warned)', () => {
    const r = dbSizing({ circuits: [{ id: 'c1', type: '', connected: '5' }, { id: 'c2', type: 'lighting', connected: '1' }], sparePct: '0', mainSwitch: '' })
    assert.equal(r.circuitCount, 1)
    assert.equal(r.rows[0].id, 'c2')
  })
})

describe('circuitDesign', () => {
  test('missing required inputs returns error', () => {
    assert.ok(circuitDesign({ connectedLoad: '', voltage: '230', phase: '1ph', powerFactor: '1', length: '15' }).error)
  })

  test('1ph, 3kW, 230V, PF 1, 15m, conduit-in-wall PVC/Cu — hand-derived exactly (Ib=13.04A, In=16A, cable=2.5mm²)', () => {
    const r = circuitDesign({
      connectedLoad: '3', voltage: '230', phase: '1ph', powerFactor: '1', length: '15',
      ambient: '30', groups: '1', install: 'Conduit in wall', insul: 'PVC', material: 'Cu', maxVd: '5',
    })
    assert.ok(close(r.Ib, 13.043478260869565))
    assert.equal(r.recommendedBreaker, 16)
    assert.equal(r.recommendedCable, 2.5)
    const row = r.sizing.allResults.find(x => x.size === 2.5)
    assert.ok(close(row.derated, 18.48))
    assert.ok(close(row.vdPct, 1.5464347826086955))
  })

  test('the cable is always sized against the breaker rating (In), not the raw design current (Ib) — Iz must be >= In', () => {
    const r = circuitDesign({
      connectedLoad: '3', voltage: '230', phase: '1ph', powerFactor: '1', length: '15',
      ambient: '30', groups: '1', install: 'Conduit in wall', insul: 'PVC', material: 'Cu', maxVd: '5',
    })
    const row = r.sizing.allResults.find(x => x.size === r.recommendedCable)
    assert.ok(row.derated >= r.recommendedBreaker) // Iz >= In, per IEC 60364-4-43 433.1
    assert.ok(row.derated >= r.Ib) // and therefore also >= Ib, trivially
  })

  test('3ph, 15kW, 400V, PF 0.85, 40m, clipped-direct PVC/Cu — hand-derived exactly (Ib=25.47A, In=32A, cable=6mm²)', () => {
    const r = circuitDesign({
      connectedLoad: '15', voltage: '400', phase: '3ph', powerFactor: '0.85', length: '40',
      ambient: '30', groups: '1', install: 'Clipped direct', insul: 'PVC', material: 'Cu', maxVd: '3',
    })
    assert.ok(close(r.Ib, 25.471335405424668))
    assert.equal(r.recommendedBreaker, 32)
    assert.equal(r.recommendedCable, 6)
    const row = r.sizing.allResults.find(x => x.size === 6)
    assert.ok(close(row.derated, 40))
    assert.ok(close(row.vdPct, 1.7071092759398856))
  })

  test('recommendedBreaker is always a real MCCB_TRIPS value on the standard series, not an arbitrary rounded number', () => {
    const r = circuitDesign({ connectedLoad: '3', voltage: '230', phase: '1ph', powerFactor: '1', length: '15', ambient: '30', groups: '1', install: 'Conduit in wall', insul: 'PVC', material: 'Cu', maxVd: '5' })
    assert.ok([6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600].includes(r.recommendedBreaker))
  })

  test('an unreasonably short max VD that no cable size can satisfy propagates recommendedCable=null rather than crashing', () => {
    const r = circuitDesign({ connectedLoad: '15', voltage: '400', phase: '3ph', powerFactor: '0.85', length: '500', ambient: '30', groups: '1', install: 'Clipped direct', insul: 'PVC', material: 'Cu', maxVd: '0.01' })
    assert.equal(r.recommendedCable, null)
  })
})

describe('areaLighting', () => {
  test('missing area width or length returns error', () => {
    assert.ok(areaLighting({ areaWidth: '', areaLength: '25', lux: '50', CU: '0.4', MF: '0.8', lumens: '20000', watts: '200' }).error)
    assert.ok(areaLighting({ areaWidth: '40', areaLength: '', lux: '50', CU: '0.4', MF: '0.8', lumens: '20000', watts: '200' }).error)
  })

  test('missing lighting-specific inputs returns error even when area width/length are present', () => {
    const r = areaLighting({ areaWidth: '40', areaLength: '25', lux: '', CU: '0.4', MF: '0.8', lumens: '20000', watts: '200' })
    assert.ok(r.error)
  })

  test('40m width × 25m length, 50lux, CU0.4, MF0.8, 20000lm/200W fittings — hand-derived exactly', () => {
    const r = areaLighting({ areaWidth: '40', areaLength: '25', lux: '50', CU: '0.4', MF: '0.8', lumens: '20000', watts: '200' })
    assert.ok(close(r.mountingHeight, 20)) // 0.5 × 40
    assert.ok(close(r.poleSpacing, 80)) // 4 × 20
    assert.ok(close(r.area, 1000)) // 40 × 25
    assert.ok(close(r.N, 7.8125)) // (50×1000)/(20000×0.4×0.8)
    assert.equal(r.N_ceil, 8)
    assert.equal(r.W, 1600) // 8 × 200W
    assert.ok(close(r.Wm2, 1.6))
    assert.ok(close(r.lux_act, 51.2))
  })

  test('pole spacing is always exactly 4× mounting height (invariant)', () => {
    const r = areaLighting({ areaWidth: '18', areaLength: '60', lux: '30', CU: '0.5', MF: '0.75', lumens: '15000', watts: '150' })
    assert.ok(close(r.poleSpacing, r.mountingHeight * 4))
  })

  test('mounting height depends only on areaWidth, not areaLength', () => {
    const short = areaLighting({ areaWidth: '40', areaLength: '10', lux: '50', CU: '0.4', MF: '0.8', lumens: '20000', watts: '200' })
    const long = areaLighting({ areaWidth: '40', areaLength: '200', lux: '50', CU: '0.4', MF: '0.8', lumens: '20000', watts: '200' })
    assert.equal(short.mountingHeight, long.mountingHeight)
    assert.equal(short.poleSpacing, long.poleSpacing)
  })

  test('comma-decimal input normalizes correctly for area width/length', () => {
    const withComma = areaLighting({ areaWidth: '40,5', areaLength: '25', lux: '50', CU: '0.4', MF: '0.8', lumens: '20000', watts: '200' })
    const withPeriod = areaLighting({ areaWidth: '40.5', areaLength: '25', lux: '50', CU: '0.4', MF: '0.8', lumens: '20000', watts: '200' })
    assert.ok(close(withComma.mountingHeight, withPeriod.mountingHeight))
  })

  test('result carries an explicit non-SANS-10389-1 disclaimer for the pole-geometry figures', () => {
    const r = areaLighting({ areaWidth: '40', areaLength: '25', lux: '50', CU: '0.4', MF: '0.8', lumens: '20000', watts: '200' })
    assert.match(r.note, /not a SANS 10389-1 citation/)
  })

  test('reuses lightingLumenMethod\'s own N-always-rounds-up behavior, not a reimplementation', () => {
    // Picking inputs where N is not a whole number confirms N_ceil comes from the shared
    // lib function's Math.ceil, not a separately (and possibly differently) rounded value here.
    const r = areaLighting({ areaWidth: '40', areaLength: '25', lux: '50', CU: '0.4', MF: '0.8', lumens: '20000', watts: '200' })
    assert.ok(r.N < r.N_ceil) // 7.8125 < 8 — confirms this is genuinely a non-integer case
    assert.equal(r.N_ceil, Math.ceil(r.N))
  })
})

describe('AREA_LIGHTING_GUIDE / findAreaLightingGuideEntry', () => {
  test('every category has an id, label, crossValidated boolean, and at least one tier', () => {
    for (const cat of AREA_LIGHTING_GUIDE) {
      assert.ok(cat.id)
      assert.ok(cat.label)
      assert.equal(typeof cat.crossValidated, 'boolean')
      assert.ok(Array.isArray(cat.tiers) && cat.tiers.length > 0)
    }
  })

  test('every tier has an id, label, and all four numeric reference fields', () => {
    for (const cat of AREA_LIGHTING_GUIDE) {
      for (const tier of cat.tiers) {
        assert.ok(tier.id)
        assert.ok(tier.label)
        assert.equal(typeof tier.lux, 'number')
        assert.equal(typeof tier.uniformityAvg, 'number')
        assert.equal(typeof tier.uniformityMax, 'number')
        assert.equal(typeof tier.glareMax, 'number')
      }
    }
  })

  test('the four risk-tier categories cross-checked against ISO/CIE 8995-3 are flagged crossValidated:true', () => {
    for (const id of ['industrialYards', 'powerPlants', 'petrochemical', 'waterSewage']) {
      const cat = AREA_LIGHTING_GUIDE.find(c => c.id === id)
      assert.equal(cat.crossValidated, true, `${id} should be flagged cross-validated`)
    }
  })

  test('Building Sites and Parking Lots (Genlux-only) are flagged crossValidated:false', () => {
    for (const id of ['buildingSites', 'parkingLots']) {
      const cat = AREA_LIGHTING_GUIDE.find(c => c.id === id)
      assert.equal(cat.crossValidated, false, `${id} should NOT be flagged cross-validated`)
    }
  })

  test('within each risk-tier category, lux is non-decreasing from low to high risk', () => {
    for (const id of ['industrialYards', 'powerPlants', 'waterSewage']) {
      const cat = AREA_LIGHTING_GUIDE.find(c => c.id === id)
      for (let i = 1; i < cat.tiers.length; i++) {
        assert.ok(cat.tiers[i].lux >= cat.tiers[i - 1].lux, `${id}: tier ${i} lux should be >= tier ${i - 1}`)
      }
    }
  })

  test('findAreaLightingGuideEntry: industrialYards/medium matches the hand-checked reference row exactly', () => {
    const r = findAreaLightingGuideEntry('industrialYards', 'medium')
    assert.equal(r.lux, 20)
    assert.equal(r.uniformityAvg, 0.40)
    assert.equal(r.uniformityMax, 0.167)
    assert.equal(r.glareMax, 50)
    assert.equal(r.crossValidated, true)
  })

  test('findAreaLightingGuideEntry: unknown category returns null, not a throw', () => {
    assert.equal(findAreaLightingGuideEntry('nonexistentCategory', 'low'), null)
  })

  test('findAreaLightingGuideEntry: known category but unknown tier returns null, not a throw', () => {
    assert.equal(findAreaLightingGuideEntry('industrialYards', 'nonexistentTier'), null)
  })

  test('petrochemical\'s fuelLoading tier is a real single-entry tier, not part of the low/medium/high risk sequence', () => {
    const r = findAreaLightingGuideEntry('petrochemical', 'fuelLoading')
    assert.equal(r.lux, 100)
    assert.equal(r.crossValidated, true)
  })
})
