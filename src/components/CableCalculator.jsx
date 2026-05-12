import { useState } from 'react'

// IEC 60364 inspired base ratings (A) — Copper, PVC insulation, 30°C, clipped direct
// [size mm², 1ph rating, 3ph rating]
const COPPER_PVC = [
  [1.5, 17.5, 16.5], [2.5, 24, 23], [4, 32, 31], [6, 41, 40],
  [10, 57, 54], [16, 76, 73], [25, 99, 96], [35, 121, 119],
  [50, 150, 144], [70, 191, 184], [95, 232, 223], [120, 269, 259],
  [150, 309, 299], [185, 353, 341], [240, 415, 403], [300, 477, 464],
]

// XLPE factor over PVC (approx +15%)
const XLPE_FACTOR = 1.15

// Aluminium factor vs copper
const AL_FACTOR = 0.78

// Ambient temperature derating (ref = 30°C, PVC)
const AMBIENT_DERATING = {
  25: 1.03, 30: 1.00, 35: 0.94, 40: 0.87, 45: 0.79, 50: 0.71, 55: 0.61
}

// Grouping derating (number of circuits)
const GROUP_DERATING = { 1: 1.00, 2: 0.80, 3: 0.70, 4: 0.65, 5: 0.60, 6: 0.57 }

// Installation method factors
const INSTALL_FACTOR = {
  'Clipped direct': 1.00,
  'Free air':       1.04,
  'Conduit in wall':0.77,
  'Trunking':       0.85,
  'Buried direct':  0.96,
}

function getCableRating(size, phase, insulation, material) {
  const row = COPPER_PVC.find(r => r[0] === size)
  if (!row) return 0
  let base = phase === '1ph' ? row[1] : row[2]
  if (insulation === 'XLPE') base *= XLPE_FACTOR
  if (material === 'Al')    base *= AL_FACTOR
  return base
}

const RESISTIVITY = { Cu: 0.0175, Al: 0.028 }  // Ω·mm²/m

function voltDrop(size, current, length, material, phase, voltage) {
  const rho = RESISTIVITY[material]
  // Vd = multiplier × rho × L × I / A
  const mult = phase === '1ph' ? 2 : Math.sqrt(3)
  const vd = (mult * rho * length * current) / size
  const pct = (vd / voltage) * 100
  return { vd: vd.toFixed(2), pct: pct.toFixed(2) }
}

export default function CableCalculator({ addHistory }) {
  const [phase, setPhase]     = useState('3ph')
  const [current, setCurrent] = useState('')
  const [length, setLength]   = useState('')
  const [voltage, setVoltage] = useState('400')
  const [insul, setInsul]     = useState('PVC')
  const [material, setMat]    = useState('Cu')
  const [ambient, setAmbient] = useState('30')
  const [groups, setGroups]   = useState('1')
  const [install, setInstall] = useState('Clipped direct')
  const [maxVd, setMaxVd]     = useState('3')
  const [results, setResults] = useState(null)
  const [error, setError]     = useState('')

  const calculate = () => {
    setError('')
    const I = parseFloat(current)
    const L = parseFloat(length)
    const V = parseFloat(voltage)
    if (!I || !L || !V) { setError('Enter current, length, and voltage'); return }
    if (I <= 0 || L <= 0 || V <= 0) { setError('Values must be positive'); return }

    const tempFactor  = AMBIENT_DERATING[parseInt(ambient)] || 1.00
    const grpFactor   = GROUP_DERATING[Math.min(parseInt(groups), 6)] || 0.57
    const instFactor  = INSTALL_FACTOR[install] || 1.00
    const totalDerating = tempFactor * grpFactor * instFactor

    // Required current capacity after derating
    const required = I / totalDerating

    // Find minimum cable size
    const sizes = COPPER_PVC.map(r => r[0])
    let recommended = null
    const allResults = []

    for (const size of sizes) {
      const baseRating = getCableRating(size, phase, insul, material)
      const deratedRating = baseRating * totalDerating
      const vd = voltDrop(size, I, L, material, phase, V)
      const pass = deratedRating >= I && parseFloat(vd.pct) <= parseFloat(maxVd)

      allResults.push({
        size,
        baseRating: baseRating.toFixed(1),
        deratedRating: deratedRating.toFixed(1),
        vdV: vd.vd,
        vdPct: vd.pct,
        currentOK: deratedRating >= I,
        vdOK: parseFloat(vd.pct) <= parseFloat(maxVd),
        pass
      })

      if (pass && !recommended) recommended = size
    }

    if (!recommended) {
      setError('⚠ No standard size found for these conditions. Review inputs or use parallel cables.')
    }

    setResults({ recommended, allResults, totalDerating: (totalDerating * 100).toFixed(1), required: required.toFixed(1) })
    if (recommended) addHistory({ tab: 'Cable', expr: `${I}A ${L}m ${phase} ${material}-${insul}`, result: `${recommended}mm²` })
  }

  const Toggle = ({ label, options, value, onChange }) => (
    <div className="mb-3">
      <label className="text-gray-400 text-xs mb-1 block">{label}</label>
      <div className="flex gap-2">
        {options.map(([v, l]) => (
          <button key={v} onClick={() => onChange(v)}
            className={`flex-1 py-2 rounded-xl text-sm ${value===v ? 'bg-amber-500 text-black font-bold' : 'bg-[#1c1c1c] text-gray-400'}`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-3">

        <Toggle label="Phase" options={[['1ph','1φ Single'],['3ph','3φ Three']]} value={phase} onChange={setPhase} />
        <Toggle label="Insulation" options={[['PVC','PVC (70°C)'],['XLPE','XLPE (90°C)']]} value={insul} onChange={setInsul} />
        <Toggle label="Conductor Material" options={[['Cu','Copper'],['Al','Aluminium']]} value={material} onChange={setMat} />

        <InputField label="Design Current (Ib)" value={current} onChange={setCurrent} unit="A" />
        <InputField label="Cable Length (one-way)" value={length} onChange={setLength} unit="m" />
        <InputField label="System Voltage" value={voltage} onChange={setVoltage} unit="V" />
        <InputField label="Max Voltage Drop" value={maxVd} onChange={setMaxVd} unit="%" />

        {/* Derating inputs */}
        <div className="mb-3">
          <label className="text-gray-400 text-xs mb-1 block">Ambient Temperature</label>
          <select value={ambient} onChange={e => setAmbient(e.target.value)}
            className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm outline-none">
            {Object.keys(AMBIENT_DERATING).map(t => <option key={t} value={t}>{t}°C (×{AMBIENT_DERATING[t]})</option>)}
          </select>
        </div>

        <div className="mb-3">
          <label className="text-gray-400 text-xs mb-1 block">Number of Grouped Circuits</label>
          <select value={groups} onChange={e => setGroups(e.target.value)}
            className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm outline-none">
            {Object.entries(GROUP_DERATING).map(([g, f]) => <option key={g} value={g}>{g} circuit{g>1?'s':''} (×{f})</option>)}
          </select>
        </div>

        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-1 block">Installation Method</label>
          <select value={install} onChange={e => setInstall(e.target.value)}
            className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm outline-none">
            {Object.entries(INSTALL_FACTOR).map(([k, v]) => <option key={k} value={k}>{k} (×{v})</option>)}
          </select>
        </div>

        <button onClick={calculate}
          className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">
          CALCULATE
        </button>

        {error && <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}

        {results && (
          <>
            {/* Summary */}
            <div className="bg-[#0f1a0f] border border-[#1a3a1a] rounded-xl px-4 py-3 mb-4">
              <div className="text-green-400 text-xs font-bold mb-2">DERATING SUMMARY</div>
              <div className="text-gray-400 text-xs">Combined derating factor: <span className="text-white">{results.totalDerating}%</span></div>
              <div className="text-gray-400 text-xs mt-1">Required derated capacity: <span className="text-white">{results.required} A</span></div>
              {results.recommended
                ? <div className="mt-2 text-xl font-bold text-green-400">✓ Recommended: {results.recommended} mm²</div>
                : <div className="mt-2 text-red-400 font-bold">No single cable size meets both criteria</div>
              }
            </div>

            {/* Results table */}
            <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
              <div className="bg-[#1a1a0a] px-4 py-2 grid grid-cols-5 text-[10px] text-gray-500 font-bold border-b border-[#2a2a2a]">
                <span>SIZE</span><span>DERATED</span><span>VD(V)</span><span>VD%</span><span>STATUS</span>
              </div>
              {results.allResults.map(row => (
                <div key={row.size}
                  className={`px-4 py-2.5 grid grid-cols-5 text-xs border-b border-[#1a1a1a] last:border-0 ${row.pass ? 'bg-[#001a00]' : ''} ${row.size === results.recommended ? 'bg-[#002a00]' : ''}`}>
                  <span className={`font-bold ${row.size === results.recommended ? 'text-green-400' : 'text-white'}`}>{row.size}mm²</span>
                  <span className={row.currentOK ? 'text-green-400' : 'text-red-400'}>{row.deratedRating}A</span>
                  <span className="text-gray-300">{row.vdV}V</span>
                  <span className={row.vdOK ? 'text-green-400' : 'text-red-400'}>{row.vdPct}%</span>
                  <span>{row.pass ? '✓ OK' : (row.currentOK && !row.vdOK ? '⚠ VD' : (!row.currentOK ? '✗ I' : '✗'))}</span>
                </div>
              ))}
            </div>

            <div className="bg-[#0f1520] border border-[#1e2a3a] rounded-xl px-4 py-3 text-xs text-gray-500 mb-4">
              <div className="text-blue-400 font-bold mb-1">Notes</div>
              <div>• VD = voltage drop (max {maxVd}% recommended for IEC)</div>
              <div>• Ratings based on IEC 60364 guidelines</div>
              <div>• Always verify against local SANS/NRS standards</div>
              <div>• For parallel cables, halve the current per cable</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function InputField({ label, value, onChange, unit }) {
  return (
    <div className="mb-3">
      <label className="text-gray-400 text-xs mb-1 block">{label}</label>
      <div className="flex items-center bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <input type="number" value={value} onChange={e => onChange(e.target.value)}
          inputMode="decimal" step="any"
          className="flex-1 bg-transparent text-white text-lg px-4 py-3 outline-none"
          placeholder="0" />
        <span className="text-gray-500 text-sm px-3">{unit}</span>
      </div>
    </div>
  )
}
