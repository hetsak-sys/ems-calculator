import { useState } from 'react'

const FORMULAS = [
  {
    category: "Ohm's Law",
    color: 'blue',
    items: [
      { name: "Voltage", formula: "V = I × R", note: "V in volts, I in amperes, R in ohms" },
      { name: "Current", formula: "I = V / R", note: "Rearranged from V = IR" },
      { name: "Resistance", formula: "R = V / I", note: "Rearranged from V = IR" },
    ]
  },
  {
    category: "Power (DC / 1-phase AC)",
    color: 'amber',
    items: [
      { name: "Active Power", formula: "P = V × I × PF", note: "watts (W)" },
      { name: "From resistance", formula: "P = I² × R = V² / R", note: "watts (W)" },
      { name: "Apparent Power", formula: "S = V × I", note: "volt-amperes (VA)" },
      { name: "Reactive Power", formula: "Q = V × I × sin(θ)", note: "var (VAr)" },
      { name: "Power Factor", formula: "PF = P / S = cos(θ)", note: "unitless, 0–1" },
    ]
  },
  {
    category: "3-Phase Power",
    color: 'green',
    items: [
      { name: "Active Power (3φ)", formula: "P = √3 × VL × IL × PF", note: "VL = line voltage" },
      { name: "Apparent Power (3φ)", formula: "S = √3 × VL × IL", note: "kVA" },
      { name: "Line ↔ Phase Voltage", formula: "VL = √3 × Vφ", note: "Star connection" },
      { name: "Line = Phase Current", formula: "IL = Iφ", note: "Star connection" },
      { name: "Line current (Delta)", formula: "IL = √3 × Iφ", note: "Delta: VL = Vφ" },
    ]
  },
  {
    category: "Motor (Electrical)",
    color: 'purple',
    items: [
      { name: "FLA (3φ)", formula: "I = P_input / (√3 × V × PF)", note: "P_input = P_shaft / η" },
      { name: "FLA (1φ)", formula: "I = P_input / (V × PF)", note: "P_input = P_shaft / η" },
      { name: "Efficiency", formula: "η = P_out / P_in × 100%", note: "Typical: 85–95%" },
      { name: "Slip", formula: "s = (Ns − Nr) / Ns", note: "Ns=sync speed, Nr=rotor speed" },
      { name: "Sync Speed", formula: "Ns = 120 × f / p", note: "f=freq(Hz), p=poles" },
    ]
  },
  {
    category: "Transformer",
    color: 'red',
    items: [
      { name: "Turns Ratio", formula: "n = Vp / Vs = Np / Ns", note: "= Is / Ip (ideal)" },
      { name: "Primary Current", formula: "Ip = S / Vp (1φ)", note: "S in VA" },
      { name: "Primary Current", formula: "Ip = S / (√3 × Vp) (3φ)", note: "S in VA" },
      { name: "kVA Rating", formula: "S = Vp × Ip = Vs × Is", note: "1-phase" },
      { name: "kVA Rating (3φ)", formula: "S = √3 × VL × IL", note: "3-phase" },
    ]
  },
  {
    category: "Capacitors & Reactance",
    color: 'cyan',
    items: [
      { name: "Capacitive Reactance", formula: "Xc = 1 / (2πfC)", note: "Ω; C in farads" },
      { name: "Inductive Reactance", formula: "XL = 2πfL", note: "Ω; L in henries" },
      { name: "Impedance (series RC)", formula: "Z = √(R² + Xc²)", note: "Ω" },
      { name: "PF Correction (kVAr)", formula: "Qc = P(tan θ₁ − tan θ₂)", note: "P in kW" },
      { name: "Capacitor value (1φ)", formula: "C = Qc / (V² × ω)", note: "C in farads" },
    ]
  },
  {
    category: "Cable & Voltage Drop",
    color: 'orange',
    items: [
      { name: "Resistance", formula: "R = ρ × L / A", note: "ρ=resistivity, L=length, A=area" },
      { name: "Volt Drop (1φ)", formula: "Vd = 2 × ρ × L × I / A", note: "V; ρ_Cu=0.0175" },
      { name: "Volt Drop (3φ)", formula: "Vd = √3 × ρ × L × I / A", note: "V; ρ_Al=0.028" },
      { name: "% Voltage Drop", formula: "%Vd = (Vd / V) × 100", note: "Max 3–5% (IEC)" },
      { name: "Current Density", formula: "J = I / A", note: "A/mm²; typical 1–4 A/mm²" },
    ]
  },
  {
    category: "Protection & Safety",
    color: 'red',
    items: [
      { name: "Earth Fault Loop", formula: "Zs = Ze + (R1 + R2)", note: "R1=line, R2=PE conductor" },
      { name: "Disconnection time", formula: "Ia = Uo / Zs", note: "Ia = trip current" },
      { name: "Protective Conductor", formula: "S = √(I²t / k)", note: "Adiabatic equation" },
      { name: "Short Circuit (3φ)", formula: "Isc = V / (√3 × Z)", note: "Z=source impedance" },
    ]
  },
  {
    category: "Useful Constants",
    color: 'gray',
    items: [
      { name: "√3", formula: "1.7321", note: "Used in all 3-phase" },
      { name: "Cu resistivity (20°C)", formula: "ρ = 0.0175 Ω·mm²/m", note: "" },
      { name: "Al resistivity (20°C)", formula: "ρ = 0.028 Ω·mm²/m", note: "" },
      { name: "1 HP", formula: "= 745.7 W", note: "" },
      { name: "1 kWh", formula: "= 3 600 000 J", note: "" },
      { name: "ε₀ (permittivity)", formula: "8.854 × 10⁻¹² F/m", note: "" },
      { name: "μ₀ (permeability)", formula: "4π × 10⁻⁷ H/m", note: "" },
    ]
  },
]

const COLOR_MAP = {
  blue:   { hdr: 'bg-[#0f1a2e] border-[#1a3a5a]', dot: 'bg-blue-500',   txt: 'text-blue-400' },
  amber:  { hdr: 'bg-[#1a1400] border-[#3a2e00]', dot: 'bg-amber-500',  txt: 'text-amber-400' },
  green:  { hdr: 'bg-[#0a1a0a] border-[#1a3a1a]', dot: 'bg-green-500',  txt: 'text-green-400' },
  purple: { hdr: 'bg-[#1a0a2a] border-[#3a1a5a]', dot: 'bg-purple-500', txt: 'text-purple-400' },
  red:    { hdr: 'bg-[#2a0a0a] border-[#5a1a1a]', dot: 'bg-red-500',    txt: 'text-red-400' },
  cyan:   { hdr: 'bg-[#0a1a2a] border-[#1a3a4a]', dot: 'bg-cyan-500',   txt: 'text-cyan-400' },
  orange: { hdr: 'bg-[#1a0f00] border-[#3a2a00]', dot: 'bg-orange-500', txt: 'text-orange-400' },
  gray:   { hdr: 'bg-[#1a1a1a] border-[#2a2a2a]', dot: 'bg-gray-500',   txt: 'text-gray-400' },
}

export default function FormulaReference({ history = [] }) {
  const [view, setView] = useState('formulas')  // 'formulas' | 'history'
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})

  const toggle = (cat) => setExpanded(e => ({ ...e, [cat]: !e[cat] }))

  const filtered = FORMULAS.map(section => ({
    ...section,
    items: section.items.filter(item =>
      !search || item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.formula.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(s => s.items.length > 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* View Toggle */}
      <div className="flex-shrink-0 flex gap-2 px-4 pt-3 pb-2">
        <button onClick={() => setView('formulas')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium ${view==='formulas' ? 'bg-amber-500 text-black' : 'bg-[#1c1c1c] text-gray-400'}`}>
          ∑ Formulas
        </button>
        <button onClick={() => setView('history')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium relative ${view==='history' ? 'bg-amber-500 text-black' : 'bg-[#1c1c1c] text-gray-400'}`}>
          📋 History {history.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{Math.min(history.length, 99)}</span>}
        </button>
      </div>

      {view === 'history' ? (
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600 text-sm">
              <div className="text-3xl mb-2">📋</div>
              No calculations yet
            </div>
          ) : (
            history.map((h, i) => (
              <div key={i} className="bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 mb-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-amber-400 text-xs font-bold">{h.tab}</span>
                  <span className="text-gray-600 text-xs">{h.time}</span>
                </div>
                <div className="text-gray-400 text-sm">{h.expr}</div>
                <div className="text-white font-bold mt-1">{h.result}</div>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="flex-shrink-0 px-4 pb-2">
            <div className="flex items-center bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <span className="pl-3 text-gray-600">🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search formulas..."
                className="flex-1 bg-transparent text-white text-sm px-3 py-2.5 outline-none"
              />
              {search && <button onClick={() => setSearch('')} className="pr-3 text-gray-500">✕</button>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {filtered.map(section => {
              const c = COLOR_MAP[section.color] || COLOR_MAP.gray
              const isOpen = expanded[section.category] !== false  // default open
              return (
                <div key={section.category} className="mb-3 border border-[#2a2a2a] rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggle(section.category)}
                    className={`w-full flex items-center justify-between px-4 py-3 ${c.hdr} border-b border-[#2a2a2a]`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${c.dot}`}></div>
                      <span className={`font-bold text-sm ${c.txt}`}>{section.category}</span>
                    </div>
                    <span className="text-gray-500 text-xs">{isOpen ? '▲' : '▼'} {section.items.length}</span>
                  </button>
                  {isOpen && section.items.map((item, i) => (
                    <div key={i} className="px-4 py-3 border-b border-[#1a1a1a] last:border-0 bg-[#0a0a0a]">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-gray-400 text-xs mt-0.5 flex-shrink-0">{item.name}</span>
                        <span className={`font-mono font-bold text-sm text-right ${c.txt}`}>{item.formula}</span>
                      </div>
                      {item.note && <div className="text-gray-600 text-xs mt-1">{item.note}</div>}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
