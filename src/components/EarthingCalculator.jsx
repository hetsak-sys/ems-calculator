import { useState } from 'react'
import { SQRT3, pf, NumInput, SelectInput, ToggleInput, ResultBox, InfoBox, ErrBox, CalcButton, SubTabBar } from './shared'
import { useSite } from './SiteContext'

// ── 1. Earth Electrode Resistance ──────────────────────────────────────────
function ElectrodeResistance({ addHistory }) {
  const [type, setType] = useState('rod')
  const [rho, setRho] = useState('100')       // soil resistivity Ω·m
  const [length, setLength] = useState('')     // rod length m
  const [diameter, setDiameter] = useState('0.016') // rod diameter m (16mm typical)
  const [depth, setDepth] = useState('')       // burial depth m (plate/strip)
  const [width, setWidth] = useState('')       // plate width m
  const [numRods, setNumRods] = useState('1')  // parallel rods
  const [spacing, setSpacing] = useState('')   // rod spacing m
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  // Typical soil resistivity values
  const SOIL_TYPES = [
    ['10',   'Sea water (10 Ω·m)'],
    ['50',   'Wet clay / marsh (50 Ω·m)'],
    ['100',  'Moist soil / loam (100 Ω·m)'],
    ['300',  'Dry clay / sandy loam (300 Ω·m)'],
    ['500',  'Dry sand / gravel (500 Ω·m)'],
    ['1000', 'Rock / granite (1000 Ω·m)'],
    ['3000', 'Dry rock (3000 Ω·m)'],
    ['custom', 'Custom value'],
  ]

  const calculate = () => {
    setError('')
    const ρ = pf(rho), L = pf(length), d = pf(diameter), N = pf(numRods) || 1

    if (!ρ) { setError('Enter soil resistivity'); return }

    let R1 = null // single electrode resistance

    if (type === 'rod') {
      if (!L || !d) { setError('Enter rod length and diameter'); return }
      // Dwight formula: R = (ρ / 2πL) × (ln(4L/d) − 1)
      R1 = (ρ / (2 * Math.PI * L)) * (Math.log(4 * L / d) - 1)
    } else if (type === 'plate') {
      if (!width) { setError('Enter plate dimensions'); return }
      const A = width * width  // square plate area m²
      // R = ρ / (4 × √(π × A))
      R1 = ρ / (4 * Math.sqrt(Math.PI * A))
    } else if (type === 'strip') {
      if (!L || !depth) { setError('Enter strip length and burial depth'); return }
      const w = 0.025  // 25mm wide strip
      // R = (ρ / πL) × (ln(2L² / (w × depth)) + 0.5)
      R1 = (ρ / (Math.PI * L)) * (Math.log((2 * L * L) / (w * depth)) + 0.5)
    }

    if (R1 === null || !isFinite(R1)) { setError('Invalid inputs'); return }

    // Parallel rods (spacing factor)
    let Rparallel = R1
    if (N > 1 && type === 'rod') {
      const S = pf(spacing)
      // Simplified: Rn = R1/N × (1 + (η × R1 / (ρ × 2πS)))
      // Simpler approximation for field use:
      const mu = S > 0 ? Math.max(0.5, 1 - (0.5 * L / (S * N))) : 1
      Rparallel = (R1 * mu) / N
    }

    setResult({
      R1: R1.toFixed(3),
      Rparallel: Rparallel.toFixed(3),
      N,
      pass10: Rparallel <= 10,
      pass1: Rparallel <= 1,
    })
    addHistory({ tab: 'Earthing', expr: `${type} ρ=${ρ} L=${length}m ×${N}`, result: `${Rparallel.toFixed(2)}Ω` })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Earth Electrode Resistance" lines={['Dwight formula for rods | Simplified for plates and strips', 'Soil resistivity is the most important variable — measure on site']} />

      {/* Electrode type */}
      <div className="mb-3">
        <label className="text-gray-400 text-xs mb-2 block">Electrode Type</label>
        <div className="flex gap-2">
          {[['rod', 'Earth Rod'], ['plate', 'Earth Plate'], ['strip', 'Earth Strip']].map(([id, l]) => (
            <button key={id} onClick={() => { setType(id); setResult(null) }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold ${type === id ? 'bg-amber-500 text-black' : 'bg-[#1c1c1c] text-gray-400'}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* Soil resistivity */}
      <SelectInput label="Soil Type / Resistivity" value={rho} onChange={setRho}
        options={SOIL_TYPES.filter(s => s[0] !== 'custom')} />
      <NumInput label="Soil Resistivity (custom or measured)" value={rho} onChange={setRho} unit="Ω·m" note="measure with Wenner method" />

      {type === 'rod' && <>
        <NumInput label="Rod Length" value={length} onChange={setLength} unit="m" placeholder="e.g. 3" />
        <NumInput label="Rod Diameter" value={diameter} onChange={setDiameter} unit="m" placeholder="0.016 (16mm)" />
        <NumInput label="Number of Parallel Rods" value={numRods} onChange={setNumRods} unit="rods" placeholder="1" />
        {pf(numRods) > 1 && <NumInput label="Rod Spacing" value={spacing} onChange={setSpacing} unit="m" note="must be ≥ rod length for best effect" />}
      </>}

      {type === 'plate' && <>
        <NumInput label="Plate Side Length (square plate)" value={width} onChange={setWidth} unit="m" placeholder="e.g. 0.6" />
      </>}

      {type === 'strip' && <>
        <NumInput label="Strip Length" value={length} onChange={setLength} unit="m" />
        <NumInput label="Burial Depth" value={depth} onChange={setDepth} unit="m" placeholder="e.g. 0.5" />
      </>}

      <CalcButton onClick={calculate} label="CALCULATE RESISTANCE" />
      <ErrBox msg={error} />

      {result && <>
        <ResultBox rows={[
          { label: 'Single Electrode Resistance', value: result.R1, unit: 'Ω' },
          ...(result.N > 1 ? [{ label: `${result.N} Electrodes in Parallel`, value: result.Rparallel, unit: 'Ω', accent: true }] : [{ label: 'Earth Resistance', value: result.R1, unit: 'Ω', accent: true }]),
          { label: '≤ 10Ω (general earthing)', value: result.pass10 ? '✓ PASS' : '✗ FAIL', unit: '', accent: result.pass10, warn: !result.pass10 },
          { label: '≤ 1Ω (substation/MV)', value: result.pass1 ? '✓ PASS' : '✗ FAIL', unit: '', accent: result.pass1, warn: !result.pass1 },
        ]} />
        <InfoBox color="amber" title="Typical Requirements" lines={[
          '• General LV installations: ≤ 10Ω (SANS 10142)',
          '• MV substations: ≤ 1Ω recommended',
          '• Mining: often ≤ 1Ω required per DMR regulations',
          '• High soil resistivity sites (Letseng rock): use parallel rods or grid',
          '• Always verify with on-site fall-of-potential test',
        ]} />
      </>}
    </div>
  )
}

// ── 2. Touch & Step Voltage ────────────────────────────────────────────────
function TouchStepVoltage({ addHistory }) {
  const [earthResistance, setEarthR] = useState('')
  const [faultCurrent, setFaultI] = useState('')
  const [rho, setRho] = useState('100')
  const [faultTime, setFaultTime] = useState('0.5')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const calculate = () => {
    setError('')
    const RE = pf(earthResistance), If = pf(faultCurrent), ρ = pf(rho), ts = pf(faultTime)
    if (!RE || !If) { setError('Enter earth resistance and fault current'); return }

    // Ground potential rise (GPR)
    const GPR = If * RE

    // IEEE 80 simplified touch and step voltage limits
    // For 50kg person (typical), ts = fault clearing time
    // Etouch = (1000 + 1.5×ρs) × 0.116/√ts
    // Estep  = (1000 + 6×ρs) × 0.116/√ts
    const ρs = ρ  // surface layer resistivity (using soil ρ as conservative estimate)
    const factor = ts > 0 ? 0.116 / Math.sqrt(ts) : 0

    const Etouch_limit = (1000 + 1.5 * ρs) * factor
    const Estep_limit  = (1000 + 6 * ρs) * factor

    // Actual mesh voltage (touch) ≈ 50–60% of GPR for simple grid
    // Actual step voltage ≈ 10–20% of GPR
    const Emesh_actual = GPR * 0.55  // conservative estimate
    const Estep_actual = GPR * 0.15

    const touchPass = Emesh_actual <= Etouch_limit
    const stepPass  = Estep_actual <= Estep_limit

    setResult({ GPR: GPR.toFixed(1), Etouch_limit: Etouch_limit.toFixed(1), Estep_limit: Estep_limit.toFixed(1), Emesh_actual: Emesh_actual.toFixed(1), Estep_actual: Estep_actual.toFixed(1), touchPass, stepPass })
    addHistory({ tab: 'Touch/Step', expr: `RE=${RE}Ω If=${If}A`, result: `GPR=${GPR.toFixed(0)}V` })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Touch & Step Voltage — IEEE 80 Simplified" lines={['Estimates only — full IEEE 80 analysis required for formal design', 'Based on 50kg body weight, feet in parallel']} />
      <NumInput label="Earth Grid Resistance" value={earthResistance} onChange={setEarthR} unit="Ω" />
      <NumInput label="Earth Fault Current" value={faultCurrent} onChange={setFaultI} unit="A" />
      <NumInput label="Soil Resistivity" value={rho} onChange={setRho} unit="Ω·m" />
      <NumInput label="Fault Clearing Time" value={faultTime} onChange={setFaultTime} unit="s" note="protection operating time" />
      <CalcButton onClick={calculate} />
      <ErrBox msg={error} />
      {result && <>
        <ResultBox title="GROUND POTENTIAL RISE" rows={[
          { label: 'GPR (If × RE)', value: result.GPR, unit: 'V', accent: true },
        ]} />
        <ResultBox title="TOUCH VOLTAGE" rows={[
          { label: 'Estimated Mesh Voltage', value: result.Emesh_actual, unit: 'V' },
          { label: 'IEEE 80 Touch Limit', value: result.Etouch_limit, unit: 'V' },
          { label: 'Status', value: result.touchPass ? '✓ SAFE' : '✗ UNSAFE — redesign grid', unit: '', accent: result.touchPass, warn: !result.touchPass },
        ]} />
        <ResultBox title="STEP VOLTAGE" rows={[
          { label: 'Estimated Step Voltage', value: result.Estep_actual, unit: 'V' },
          { label: 'IEEE 80 Step Limit', value: result.Estep_limit, unit: 'V' },
          { label: 'Status', value: result.stepPass ? '✓ SAFE' : '✗ UNSAFE — redesign grid', unit: '', accent: result.stepPass, warn: !result.stepPass },
        ]} />
        <InfoBox color="red" title="⚠ Important" lines={[
          'This is a simplified estimate — mesh voltage assumed at 55% of GPR',
          'Actual values depend on grid geometry, conductor spacing, and soil layers',
          'A full IEEE 80 / IEC 60479 analysis is required for substation design',
          'At Letseng high-resistivity rock sites, surface crushed rock layer is critical',
        ]} />
      </>}
    </div>
  )
}

// ── 3. Earth Grid Resistance ───────────────────────────────────────────────
function EarthGrid({ addHistory }) {
  const [rho, setRho] = useState('100')
  const [length, setLength] = useState('')    // total conductor length m
  const [area, setArea] = useState('')        // grid area m²
  const [depth, setDepth] = useState('0.6')  // burial depth m
  const [rods, setRods] = useState('0')
  const [rodLen, setRodLen] = useState('3')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const calculate = () => {
    setError('')
    const ρ = pf(rho), Lt = pf(length), A = pf(area), h = pf(depth), n = pf(rods), lr = pf(rodLen)
    if (!ρ || !Lt || !A) { setError('Enter resistivity, conductor length, and grid area'); return }

    // Schwarz formula: Rg = ρ/(π×Lt) × (ln(2Lt/d) − K1) + ρ/(4×√(π×A))
    // d = conductor diameter (typically 10mm = 0.01m)
    const d = 0.01
    // K1 factor depends on grid shape — use 1.0 for square grid
    const K1 = 1.0
    const Rgrid = (ρ / (Math.PI * Lt)) * (Math.log((2 * Lt) / d) - K1) + ρ / (4 * Math.sqrt(Math.PI * A))

    // Rod contribution (if any)
    let Rrods = Infinity
    if (n > 0 && lr > 0) {
      const R1rod = (ρ / (2 * Math.PI * lr)) * (Math.log(4 * lr / 0.016) - 1)
      Rrods = R1rod / n
    }

    // Combined: 1/Rtotal = 1/Rgrid + 1/Rrods (simplified)
    const Rtotal = n > 0 ? (Rgrid * Rrods) / (Rgrid + Rrods) : Rgrid

    setResult({
      Rgrid: Rgrid.toFixed(3),
      Rrods: n > 0 ? Rrods.toFixed(3) : null,
      Rtotal: Rtotal.toFixed(3),
      pass1: Rtotal <= 1,
      pass10: Rtotal <= 10,
    })
    addHistory({ tab: 'Earth Grid', expr: `ρ=${ρ} A=${A}m² L=${Lt}m`, result: `${Rtotal.toFixed(3)}Ω` })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Earth Grid Resistance — Schwarz Formula" lines={['For substation earth mats and grids', 'Enter total conductor length and grid area']} />
      <NumInput label="Soil Resistivity" value={rho} onChange={setRho} unit="Ω·m" />
      <NumInput label="Total Conductor Length" value={length} onChange={setLength} unit="m" note="sum of all grid conductors" />
      <NumInput label="Grid Area" value={area} onChange={setArea} unit="m²" note="length × width of grid" />
      <NumInput label="Burial Depth" value={depth} onChange={setDepth} unit="m" placeholder="0.6" />
      <NumInput label="Number of Earth Rods" value={rods} onChange={setRods} unit="rods" placeholder="0" />
      {pf(rods) > 0 && <NumInput label="Rod Length" value={rodLen} onChange={setRodLen} unit="m" />}
      <CalcButton onClick={calculate} label="CALCULATE GRID RESISTANCE" />
      <ErrBox msg={error} />
      {result && <>
        <ResultBox rows={[
          { label: 'Grid Conductor Resistance', value: result.Rgrid, unit: 'Ω' },
          ...(result.Rrods ? [{ label: 'Rods Resistance', value: result.Rrods, unit: 'Ω' }] : []),
          { label: '➤ Combined Grid Resistance', value: result.Rtotal, unit: 'Ω', accent: true },
          { label: '≤ 1Ω (substation)', value: result.pass1 ? '✓ PASS' : '✗ FAIL', unit: '', accent: result.pass1, warn: !result.pass1 },
          { label: '≤ 10Ω (general)', value: result.pass10 ? '✓ PASS' : '✗ FAIL', unit: '', accent: result.pass10, warn: !result.pass10 },
        ]} />
        <InfoBox color="amber" title="Reducing Grid Resistance" lines={[
          '• Increase total conductor length (add more conductors)',
          '• Increase grid area (most effective)',
          '• Add earth rods (especially in high-resistivity soil)',
          '• Use deep-driven rods to reach lower-resistivity layers',
          '• Soil treatment (bentonite, conductive concrete)',
        ]} />
      </>}
    </div>
  )
}

// ── 4. Fault Loop Impedance ────────────────────────────────────────────────
function FaultLoop({ addHistory }) {
  const [voltage, setVoltage] = useState('230')  // L-N voltage
  const [ze, setZe] = useState('')               // external impedance Ω
  const [r1, setR1] = useState('')               // line conductor resistance Ω
  const [r2, setR2] = useState('')               // PE conductor resistance Ω
  const [circuitType, setCircuitType] = useState('B')  // MCB type
  const [rating, setRating] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  // Max Zs for IEC 60364 disconnection — B, C, D type MCBs
  // [rating, max Zs for 0.4s (B), max Zs for 0.4s (C), max Zs for 0.4s (D)]
  const MCB_ZS = {
    'B': { 6: 7.67, 10: 4.60, 16: 2.87, 20: 2.30, 25: 1.84, 32: 1.44, 40: 1.15, 50: 0.92, 63: 0.73 },
    'C': { 6: 3.83, 10: 2.30, 16: 1.44, 20: 1.15, 25: 0.92, 32: 0.72, 40: 0.57, 50: 0.46, 63: 0.37 },
    'D': { 6: 1.91, 10: 1.15, 16: 0.72, 20: 0.57, 25: 0.46, 32: 0.36, 40: 0.29, 50: 0.23, 63: 0.18 },
  }

  const calculate = () => {
    setError('')
    const V = pf(voltage), Ze = pf(ze), R1 = pf(r1), R2 = pf(r2), In = pf(rating)
    if (!V || !R1 || !R2) { setError('Enter voltage, R1, and R2'); return }
    const Zs = Ze + R1 + R2
    const If = V / Zs
    const maxZs = MCB_ZS[circuitType]?.[In]
    const pass = maxZs ? Zs <= maxZs : null
    setResult({ Zs: Zs.toFixed(4), If: If.toFixed(1), maxZs: maxZs ? maxZs.toFixed(4) : 'N/A', pass })
    addHistory({ tab: 'FaultLoop', expr: `${V}V Zs=${Zs.toFixed(3)}Ω`, result: `If=${If.toFixed(0)}A` })
  }

  const RATINGS = ['6', '10', '16', '20', '25', '32', '40', '50', '63']

  return (
    <div className="px-4 py-3">
      <InfoBox title="Earth Fault Loop Impedance" lines={['Zs = Ze + (R1 + R2)', 'Verifies disconnection time compliance per IEC 60364']} />
      <NumInput label="Supply Voltage (L-N)" value={voltage} onChange={setVoltage} unit="V" note="230V for 400V system" />
      <NumInput label="External Earth Loop Impedance (Ze)" value={ze} onChange={setZe} unit="Ω" note="from DNO or measured" />
      <NumInput label="Line Conductor Resistance (R1)" value={r1} onChange={setR1} unit="Ω" note="at operating temperature" />
      <NumInput label="PE Conductor Resistance (R2)" value={r2} onChange={setR2} unit="Ω" note="at operating temperature" />
      <div className="mb-3">
        <label className="text-gray-400 text-xs mb-2 block">MCB Type</label>
        <div className="flex gap-2">
          {['B', 'C', 'D'].map(t => (
            <button key={t} onClick={() => setCircuitType(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${circuitType === t ? 'bg-amber-500 text-black' : 'bg-[#1c1c1c] text-gray-400'}`}>
              Type {t}
            </button>
          ))}
        </div>
      </div>
      <SelectInput label="MCB Rating" value={rating} onChange={setRating}
        options={[['', 'Select rating...'], ...RATINGS.map(r => [r, `${r}A`])]} />
      <CalcButton onClick={calculate} />
      <ErrBox msg={error} />
      {result && <ResultBox rows={[
        { label: 'Total Loop Impedance Zs', value: result.Zs, unit: 'Ω', accent: true },
        { label: 'Prospective Fault Current', value: result.If, unit: 'A' },
        { label: `Max Zs for Type ${circuitType} ${rating}A`, value: result.maxZs, unit: 'Ω' },
        ...(result.pass !== null ? [{ label: 'Disconnection Compliance', value: result.pass ? '✓ COMPLIANT' : '✗ NON-COMPLIANT', unit: '', accent: result.pass, warn: !result.pass }] : []),
      ]} />}
    </div>
  )
}

// ── 5. Earth Conductor Sizing (Adiabatic) ──────────────────────────────────
function EarthConductor({ addHistory }) {
  const [faultI, setFaultI] = useState('')
  const [time, setTime] = useState('1')
  const [material, setMaterial] = useState('Cu')
  const [insulation, setInsulation] = useState('PVC')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  // k factors per IEC 60364-5-54 / BS 7671
  const K_FACTORS = {
    Cu:  { PVC: 115, XLPE: 143, bare: 228, conduit: 135 },
    Al:  { PVC: 74,  XLPE: 94,  bare: 148, conduit: 87  },
    Steel: { bare: 52 },
  }

  const STANDARD_SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300]

  const calculate = () => {
    setError('')
    const I = pf(faultI), t = pf(time)
    if (!I || !t) { setError('Enter fault current and duration'); return }
    const k = K_FACTORS[material]?.[insulation] || K_FACTORS[material]?.bare || 115
    // S = √(I²t) / k  in mm²
    const S = Math.sqrt(I * I * t) / k
    const nextSize = STANDARD_SIZES.find(s => s >= S) || 300
    setResult({ S: S.toFixed(2), nextSize, k, energy: (I * I * t).toFixed(0) })
    addHistory({ tab: 'Earth Cond', expr: `${I}A ${t}s ${material}`, result: `${nextSize}mm²` })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Earth Conductor Sizing — Adiabatic Equation" lines={['S = √(I²t) / k', 'IEC 60364-5-54 / BS 7671 Table 54.3']} />
      <NumInput label="Fault Current" value={faultI} onChange={setFaultI} unit="A" />
      <NumInput label="Fault Duration" value={time} onChange={setTime} unit="s" note="protection clearing time" />
      <ToggleInput label="Conductor Material" options={[['Cu', 'Copper'], ['Al', 'Aluminium']]} value={material} onChange={setMaterial} />
      <SelectInput label="Insulation Type" value={insulation} onChange={setInsulation}
        options={[['PVC', 'PVC (k=115 Cu / 74 Al)'], ['XLPE', 'XLPE (k=143 Cu / 94 Al)'], ['bare', 'Bare conductor (k=228 Cu / 148 Al)']]} />
      <CalcButton onClick={calculate} label="SIZE EARTH CONDUCTOR" />
      <ErrBox msg={error} />
      {result && <ResultBox rows={[
        { label: 'Thermal Energy (I²t)', value: result.energy, unit: 'A²s' },
        { label: 'k Factor Used', value: result.k, unit: '' },
        { label: 'Calculated Minimum Size', value: result.S, unit: 'mm²' },
        { label: '➤ Nearest Standard Size', value: result.nextSize, unit: 'mm²', accent: true },
      ]} />}
    </div>
  )
}

// ── MAIN ───────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'electrode', label: 'Electrode',  icon: '⏚' },
  { id: 'touchstep', label: 'Touch/Step', icon: '⚠' },
  { id: 'grid',      label: 'Grid',       icon: '⊞' },
  { id: 'faultloop', label: 'Fault Loop', icon: '↺' },
  { id: 'conductor', label: 'Earth Cond', icon: '≋' },
]

export default function EarthingCalculator({ addHistory }) {
  const [sub, setSub] = useState('electrode')
  const map = {
    electrode: <ElectrodeResistance addHistory={addHistory} />,
    touchstep: <TouchStepVoltage addHistory={addHistory} />,
    grid:      <EarthGrid addHistory={addHistory} />,
    faultloop: <FaultLoop addHistory={addHistory} />,
    conductor: <EarthConductor addHistory={addHistory} />,
  }
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SubTabBar tabs={TABS} active={sub} onChange={setSub} />
      <div className="flex-1 overflow-y-auto">{map[sub]}</div>
    </div>
  )
}
