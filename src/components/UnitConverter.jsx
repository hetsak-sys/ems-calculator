import { useState } from 'react'

// Conversion table: all values = multiplier to base unit
const CATEGORIES = {
  Length: {
    base: 'm',
    units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, inch: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 }
  },
  Mass: {
    base: 'kg',
    units: { mg: 1e-6, g: 0.001, kg: 1, tonne: 1000, lb: 0.453592, oz: 0.028350, 'UK ton': 1016.05, 'US ton': 907.185 }
  },
  Temperature: {
    base: '°C', // special handling
    units: { '°C': null, '°F': null, 'K': null }
  },
  Area: {
    base: 'm²',
    units: { 'mm²': 1e-6, 'cm²': 1e-4, 'm²': 1, 'km²': 1e6, 'ft²': 0.092903, 'in²': 0.000645, acre: 4046.86, ha: 10000 }
  },
  Volume: {
    base: 'L',
    units: { mL: 0.001, L: 1, 'm³': 1000, 'ft³': 28.3168, 'in³': 0.016387, 'gal(US)': 3.78541, 'gal(UK)': 4.54609, 'fl.oz': 0.029574 }
  },
  Speed: {
    base: 'm/s',
    units: { 'm/s': 1, 'km/h': 0.277778, 'mph': 0.44704, 'knots': 0.514444, 'ft/s': 0.3048, 'ft/min': 0.00508 }
  },
  Data: {
    base: 'B',
    units: { b: 0.125, B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1.0995e12, Kb: 128, Mb: 131072, Gb: 134217728 }
  },
  Time: {
    base: 's',
    units: { ms: 0.001, s: 1, min: 60, h: 3600, day: 86400, week: 604800, month: 2629800, year: 31557600 }
  },
  Power: {
    base: 'W',
    units: { mW: 0.001, W: 1, kW: 1000, MW: 1e6, HP: 745.7, 'BTU/h': 0.293071, 'kcal/h': 1.163, VA: 1 }
  },
  Pressure: {
    base: 'Pa',
    units: { Pa: 1, kPa: 1000, MPa: 1e6, bar: 100000, mbar: 100, psi: 6894.76, atm: 101325, mmHg: 133.322, kgf_cm2: 98066.5 }
  },
  Energy: {
    base: 'J',
    units: { J: 1, kJ: 1000, MJ: 1e6, kWh: 3600000, cal: 4.18400, kcal: 4184, BTU: 1055.06, 'eV': 1.602e-19 }
  },
  Frequency: {
    base: 'Hz',
    units: { Hz: 1, kHz: 1000, MHz: 1e6, GHz: 1e9, rpm: 1/60 }
  },
}

function convertTemp(value, from, to) {
  let celsius
  if (from === '°C') celsius = value
  else if (from === '°F') celsius = (value - 32) * 5 / 9
  else celsius = value - 273.15  // K

  if (to === '°C') return celsius
  if (to === '°F') return celsius * 9 / 5 + 32
  return celsius + 273.15  // K
}

function convert(value, from, to, category) {
  if (!value || isNaN(value)) return ''
  if (category === 'Temperature') return convertTemp(parseFloat(value), from, to).toPrecision(8).replace(/\.?0+$/, '')

  const cat = CATEGORIES[category]
  const base = parseFloat(value) * cat.units[from]
  const result = base / cat.units[to]

  if (Math.abs(result) >= 1e10 || (Math.abs(result) < 1e-6 && result !== 0)) {
    return result.toExponential(6)
  }
  return parseFloat(result.toPrecision(8)).toString()
}

const CAT_ICONS = {
  Length: '📏', Mass: '⚖', Temperature: '🌡', Area: '▣', Volume: '🧪',
  Speed: '💨', Data: '💾', Time: '⏱', Power: '⚡', Pressure: '🔵',
  Energy: '🔋', Frequency: '〰',
}

export default function UnitConverter() {
  const [category, setCategory] = useState('Length')
  const [fromUnit, setFromUnit] = useState('m')
  const [toUnit, setToUnit]     = useState('ft')
  const [fromVal, setFromVal]   = useState('')
  const [toVal, setToVal]       = useState('')

  const catData = CATEGORIES[category]
  const units = Object.keys(catData.units)

  const handleFrom = (v) => {
    setFromVal(v)
    setToVal(v ? convert(v, fromUnit, toUnit, category) : '')
  }
  const handleTo = (v) => {
    setToVal(v)
    setFromVal(v ? convert(v, toUnit, fromUnit, category) : '')
  }
  const swapUnits = () => {
    setFromUnit(toUnit)
    setToUnit(fromUnit)
    setFromVal(toVal)
    setToVal(fromVal)
  }

  const changeFrom = (u) => {
    setFromUnit(u)
    setToVal(fromVal ? convert(fromVal, u, toUnit, category) : '')
  }
  const changeTo = (u) => {
    setToUnit(u)
    setToVal(fromVal ? convert(fromVal, fromUnit, u, category) : '')
  }
  const changeCategory = (c) => {
    setCategory(c)
    const newUnits = Object.keys(CATEGORIES[c].units)
    setFromUnit(newUnits[0])
    setToUnit(newUnits[1] || newUnits[0])
    setFromVal('')
    setToVal('')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Category Tabs */}
      <div className="flex-shrink-0 flex overflow-x-auto scrollbar-none bg-[#0a0a0a] px-2 py-2 gap-2 border-b border-[#2a2a2a]">
        {Object.keys(CATEGORIES).map(cat => (
          <button key={cat} onClick={() => changeCategory(cat)}
            className={`flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-xl text-xs ${category===cat ? 'bg-amber-500 text-black font-bold' : 'bg-[#1c1c1c] text-gray-400'}`}>
            <span>{CAT_ICONS[cat]}</span>
            <span className="mt-0.5">{cat}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* From */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">From</label>
          <div className="flex items-center bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden mb-2">
            <input type="number" value={fromVal} onChange={e => handleFrom(e.target.value)}
              inputMode="decimal" placeholder="Enter value"
              className="flex-1 bg-transparent text-white text-2xl px-4 py-4 outline-none" />
            <span className="text-amber-400 font-bold px-4 text-sm">{fromUnit}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {units.map(u => (
              <button key={u} onClick={() => changeFrom(u)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${fromUnit===u ? 'bg-amber-500 text-black' : 'bg-[#1c1c1c] text-gray-400'}`}>
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* Swap button */}
        <div className="flex justify-center mb-4">
          <button onClick={swapUnits}
            className="bg-[#2a2a2a] text-gray-300 px-6 py-2 rounded-xl text-sm font-medium">
            ⇅ Swap
          </button>
        </div>

        {/* To */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">To</label>
          <div className="flex items-center bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden mb-2">
            <input type="number" value={toVal} onChange={e => handleTo(e.target.value)}
              inputMode="decimal" placeholder="Result"
              className="flex-1 bg-transparent text-white text-2xl px-4 py-4 outline-none" />
            <span className="text-blue-400 font-bold px-4 text-sm">{toUnit}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {units.map(u => (
              <button key={u} onClick={() => changeTo(u)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${toUnit===u ? 'bg-blue-600 text-white' : 'bg-[#1c1c1c] text-gray-400'}`}>
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* Quick conversion table */}
        {fromVal && (
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
            <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
              <span className="text-amber-400 text-xs font-bold">{fromVal} {fromUnit} = ALL UNITS</span>
            </div>
            {units.filter(u => u !== fromUnit).map(u => (
              <div key={u} className="flex justify-between px-4 py-2.5 border-b border-[#1a1a1a] last:border-0 text-sm">
                <span className="text-gray-400">{u}</span>
                <span className="text-white font-medium">{convert(fromVal, fromUnit, u, category)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
