import React, { useState } from 'react'

// ── Conversion definitions ─────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'power', label: 'Power', icon: '⚡',
    units: [
      { id: 'W',   name: 'Watt',       factor: 1        },
      { id: 'kW',  name: 'Kilowatt',   factor: 1e3      },
      { id: 'MW',  name: 'Megawatt',   factor: 1e6      },
      { id: 'HP',  name: 'Horsepower', factor: 745.7    },
      { id: 'kVA', name: 'kVA (pf=1)', factor: 1e3      },
      { id: 'BTU/h',name:'BTU/hr',     factor: 0.29307  },
    ],
  },
  {
    id: 'energy', label: 'Energy', icon: '🔋',
    units: [
      { id: 'J',    name: 'Joule',      factor: 1       },
      { id: 'kJ',   name: 'Kilojoule',  factor: 1e3     },
      { id: 'kWh',  name: 'kWh',        factor: 3.6e6   },
      { id: 'MWh',  name: 'MWh',        factor: 3.6e9   },
      { id: 'cal',  name: 'Calorie',    factor: 4.184   },
      { id: 'BTU',  name: 'BTU',        factor: 1055.06 },
    ],
  },
  {
    id: 'current', label: 'Current', icon: '〰',
    units: [
      { id: 'A',   name: 'Ampere',      factor: 1    },
      { id: 'mA',  name: 'Milliamp',    factor: 1e-3 },
      { id: 'μA',  name: 'Microamp',    factor: 1e-6 },
      { id: 'kA',  name: 'Kiloamp',     factor: 1e3  },
    ],
  },
  {
    id: 'voltage', label: 'Voltage', icon: 'V',
    units: [
      { id: 'V',   name: 'Volt',        factor: 1    },
      { id: 'mV',  name: 'Millivolt',   factor: 1e-3 },
      { id: 'kV',  name: 'Kilovolt',    factor: 1e3  },
      { id: 'MV',  name: 'Megavolt',    factor: 1e6  },
    ],
  },
  {
    id: 'resistance', label: 'Resistance', icon: 'Ω',
    units: [
      { id: 'Ω',   name: 'Ohm',         factor: 1    },
      { id: 'mΩ',  name: 'Milliohm',    factor: 1e-3 },
      { id: 'kΩ',  name: 'Kilohm',      factor: 1e3  },
      { id: 'MΩ',  name: 'Megohm',      factor: 1e6  },
      { id: 'GΩ',  name: 'Gigohm',      factor: 1e9  },
    ],
  },
  {
    id: 'length', label: 'Length', icon: '↔',
    units: [
      { id: 'mm',  name: 'Millimetre',  factor: 0.001  },
      { id: 'cm',  name: 'Centimetre',  factor: 0.01   },
      { id: 'm',   name: 'Metre',       factor: 1      },
      { id: 'km',  name: 'Kilometre',   factor: 1000   },
      { id: 'in',  name: 'Inch',        factor: 0.0254 },
      { id: 'ft',  name: 'Foot',        factor: 0.3048 },
      { id: 'yd',  name: 'Yard',        factor: 0.9144 },
      { id: 'mi',  name: 'Mile',        factor: 1609.34},
    ],
  },
  {
    id: 'area', label: 'Area (Cable)', icon: '□',
    units: [
      { id: 'mm²',  name: 'mm² (cable)', factor: 1         },
      { id: 'cm²',  name: 'cm²',         factor: 100       },
      { id: 'm²',   name: 'm²',          factor: 1e6       },
      { id: 'in²',  name: 'in²',         factor: 645.16    },
      { id: 'kcmil',name: 'kcmil/MCM',   factor: 506.707   },
      { id: 'AWG',  name: 'AWG approx → see table', factor: null },
    ],
  },
  {
    id: 'pressure', label: 'Pressure', icon: '⊙',
    units: [
      { id: 'Pa',   name: 'Pascal',      factor: 1        },
      { id: 'kPa',  name: 'Kilopascal',  factor: 1e3      },
      { id: 'MPa',  name: 'Megapascal',  factor: 1e6      },
      { id: 'bar',  name: 'Bar',         factor: 1e5      },
      { id: 'psi',  name: 'PSI',         factor: 6894.76  },
      { id: 'atm',  name: 'Atmosphere',  factor: 101325   },
    ],
  },
  {
    id: 'torque', label: 'Torque', icon: '↺',
    units: [
      { id: 'Nm',   name: 'Newton·metre', factor: 1       },
      { id: 'kNm',  name: 'kN·m',         factor: 1000    },
      { id: 'ft·lb',name: 'ft·lb',        factor: 1.35582 },
      { id: 'in·lb',name: 'in·lb',        factor: 0.11298 },
      { id: 'kgm',  name: 'kg·m',         factor: 9.80665 },
    ],
  },
  {
    id: 'temp', label: 'Temperature', icon: '°',
    units: [
      { id: '°C', name: 'Celsius',    factor: null },
      { id: '°F', name: 'Fahrenheit', factor: null },
      { id: 'K',  name: 'Kelvin',     factor: null },
    ],
    special: 'temperature',
  },
  {
    id: 'mass', label: 'Mass', icon: '⊡',
    units: [
      { id: 'g',   name: 'Gram',      factor: 0.001   },
      { id: 'kg',  name: 'Kilogram',  factor: 1       },
      { id: 't',   name: 'Tonne',     factor: 1000    },
      { id: 'lb',  name: 'Pound',     factor: 0.45359 },
      { id: 'oz',  name: 'Ounce',     factor: 0.02835 },
    ],
  },
  {
    id: 'speed', label: 'Speed', icon: '→',
    units: [
      { id: 'm/s',  name: 'm/s',      factor: 1         },
      { id: 'km/h', name: 'km/h',     factor: 0.27778   },
      { id: 'mph',  name: 'mph',      factor: 0.44704   },
      { id: 'rpm',  name: 'RPM (→ rad/s × r)', factor: null },
    ],
  },
]

// Temperature special conversions
function convertTemp(val, from, to) {
  let celsius
  if (from === '°C') celsius = val
  else if (from === '°F') celsius = (val - 32) * 5 / 9
  else celsius = val - 273.15
  if (to === '°C') return celsius
  if (to === '°F') return celsius * 9 / 5 + 32
  return celsius + 273.15
}

function fmt(n) {
  if (!isFinite(n)) return 'Error'
  if (Math.abs(n) >= 1e9 || (Math.abs(n) < 1e-4 && n !== 0)) return n.toExponential(4)
  return parseFloat(n.toPrecision(8)).toString()
}

export default function ConvertCalculator({ theme: T }) {
  const [catId, setCatId]   = useState('power')
  const [fromId, setFromId] = useState('')
  const [toId, setToId]     = useState('')
  const [input, setInput]   = useState('')
  const [result, setResult] = useState(null)

  const cat = CATEGORIES.find(c => c.id === catId)

  const changeCategory = (id) => {
    setCatId(id); setFromId(''); setToId(''); setResult(null); setInput('')
  }

  const convert = () => {
    const val = parseFloat(input)
    if (isNaN(val) || !fromId || !toId) return

    if (cat.special === 'temperature') {
      setResult(fmt(convertTemp(val, fromId, toId)))
      return
    }

    const fromUnit = cat.units.find(u => u.id === fromId)
    const toUnit   = cat.units.find(u => u.id === toId)
    if (!fromUnit?.factor || !toUnit?.factor) { setResult('Use reference table'); return }

    const base = val * fromUnit.factor
    setResult(fmt(base / toUnit.factor))
  }

  // Accent color based on category
  const accent = '#fbbf24'

  return (
    <div className="flex flex-col h-full">
      {/* Category scroll */}
      <div className="flex shrink-0 overflow-x-auto px-2 pt-3 pb-2 gap-2"
        style={{ borderBottom: '1px solid #1a1a1a' }}>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => changeCategory(c.id)}
            className="flex flex-col items-center px-3 py-2 rounded-xl text-xs shrink-0"
            style={{
              backgroundColor: catId === c.id ? '#1a1400' : '#0f0f0f',
              border: `1px solid ${catId === c.id ? '#f59e0b' : '#1f1f1f'}`,
              color: catId === c.id ? '#f59e0b' : '#6b7280',
              minWidth: '56px',
            }}>
            <span className="text-base mb-0.5">{c.icon}</span>
            <span style={{ fontSize: '10px' }}>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Converter body */}
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        <div className="text-sm font-bold mb-4" style={{ color: accent }}>
          {cat.icon} {cat.label}
        </div>

        {/* Input */}
        <div className="mb-4">
          <label className="block text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>Value</label>
          <input
            type="text" inputMode="decimal"
            value={input} onChange={e => { setInput(e.target.value); setResult(null) }}
            placeholder="Enter value..."
            className="w-full px-3 py-3 rounded-xl text-white text-base"
            style={{ backgroundColor: '#111', border: '1px solid #2a2a2a' }}
          />
        </div>

        {/* From / To selectors */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {['From', 'To'].map(dir => {
            const val = dir === 'From' ? fromId : toId
            const set = dir === 'From' ? setFromId : setToId
            return (
              <div key={dir}>
                <label className="block text-xs font-bold mb-2" style={{ color: '#9ca3af' }}>{dir}</label>
                <div className="flex flex-col gap-1.5">
                  {cat.units.map(u => (
                    <button key={u.id} onClick={() => { set(u.id); setResult(null) }}
                      className="w-full text-left px-3 py-2 rounded-xl text-sm"
                      style={{
                        backgroundColor: val === u.id ? '#1a1400' : '#0f0f0f',
                        border: `1px solid ${val === u.id ? '#f59e0b' : '#1f1f1f'}`,
                        color: val === u.id ? '#f59e0b' : '#9ca3af',
                        fontFamily: 'monospace',
                      }}>
                      {u.id}
                      <span className="text-xs ml-2" style={{ color: '#4b5563' }}>{u.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Convert button */}
        <button onClick={convert}
          className="w-full py-3 rounded-xl font-bold text-sm mb-4"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000' }}>
          Convert ⇄
        </button>

        {/* Result */}
        {result && fromId && toId && (
          <div className="rounded-xl p-4 mb-4"
            style={{ backgroundColor: '#0a0a0a', border: '1px solid #2a2a2a' }}>
            <div className="text-xs mb-1" style={{ color: '#6b7280' }}>Result</div>
            <div className="text-xs mb-2" style={{ color: '#9ca3af' }}>
              {input} {fromId} =
            </div>
            <div className="text-3xl font-bold font-mono" style={{ color: '#f59e0b' }}>
              {result}
            </div>
            <div className="text-base mt-1 font-mono" style={{ color: '#9ca3af' }}>
              {toId}
            </div>
          </div>
        )}

        {/* Quick reference for cable area AWG */}
        {catId === 'area' && (
          <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid #1a1a1a' }}>
            <div className="px-3 py-2 text-xs font-bold" style={{ backgroundColor: '#0f0f0f', color: '#6b7280' }}>
              AWG ↔ mm² QUICK REFERENCE
            </div>
            {[
              ['AWG 14', '2.08 mm²'], ['AWG 12', '3.31 mm²'], ['AWG 10', '5.26 mm²'],
              ['AWG 8',  '8.37 mm²'], ['AWG 6', '13.3 mm²'],  ['AWG 4', '21.2 mm²'],
              ['AWG 2', '33.6 mm²'],  ['AWG 1/0','53.5 mm²'], ['AWG 4/0','107 mm²'],
            ].map(([awg, mm]) => (
              <div key={awg} className="flex justify-between px-3 py-2 text-xs"
                style={{ borderTop: '1px solid #111', color: '#9ca3af' }}>
                <span style={{ color: '#6b7280' }}>{awg}</span>
                <span className="font-mono">{mm}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
