import { useState } from 'react'

export default function TransformerCalculator({ addHistory }) {
  const [mode, setMode] = useState('kva') // what to solve for
  const [vp, setVp]     = useState('')
  const [vs, setVs]     = useState('')
  const [kva, setKva]   = useState('')
  const [eff, setEff]   = useState('98')
  const [phases, setPhases] = useState('3ph')
  const [result, setResult] = useState(null)
  const [error, setError]   = useState('')

  const calculate = () => {
    setError('')
    const VP = parseFloat(vp)
    const VS = parseFloat(vs)
    const KVA = parseFloat(kva)
    const EFF = (parseFloat(eff) || 98) / 100
    const SQRT3 = Math.sqrt(3)

    if (mode === 'currents') {
      if (!VP || !VS || !KVA) { setError('Enter Vp, Vs, and kVA'); return }
      const n = VP / VS
      let Ip, Is
      if (phases === '3ph') {
        Ip = (KVA * 1000) / (SQRT3 * VP)
        Is = (KVA * 1000) / (SQRT3 * VS)
      } else {
        Ip = (KVA * 1000) / VP
        Is = (KVA * 1000) / VS
      }
      const outputKW = KVA * EFF
      const losses = KVA * (1 - EFF)
      setResult({
        title: 'Transformer Currents',
        rows: [
          { label: 'Turns Ratio (Vp:Vs)', value: `${n.toFixed(4)} : 1`, accent: true },
          { label: 'Primary Current (Ip)', value: `${Ip.toFixed(2)} A` },
          { label: 'Secondary Current (Is)', value: `${Is.toFixed(2)} A` },
          { label: 'Output Power (at η)', value: `${outputKW.toFixed(2)} kW` },
          { label: 'Estimated Losses', value: `${(losses * 1000).toFixed(0)} W` },
        ]
      })
      addHistory({ tab: 'Transformer', expr: `${KVA}kVA ${VP}/${VS}V ${phases}`, result: `Ip=${Ip.toFixed(1)}A Is=${Is.toFixed(1)}A` })
    }
    else if (mode === 'kva') {
      if (!VP || !VS) { setError('Enter Vp and Vs, plus one current'); return }
      // Ask for Ip, derive kVA
      const IP = parseFloat(document.getElementById('ip_input')?.value)
      if (!IP) { setError('Enter primary current (Ip)'); return }
      let kvaCalc
      if (phases === '3ph') {
        kvaCalc = (SQRT3 * VP * IP) / 1000
      } else {
        kvaCalc = (VP * IP) / 1000
      }
      const IS = kvaCalc * 1000 / (phases === '3ph' ? SQRT3 * VS : VS)
      const n = VP / VS
      setResult({
        title: 'Transformer kVA from Ip',
        rows: [
          { label: 'Transformer kVA', value: `${kvaCalc.toFixed(2)} kVA`, accent: true },
          { label: 'Turns Ratio (Vp:Vs)', value: `${n.toFixed(4)} : 1` },
          { label: 'Secondary Current (Is)', value: `${IS.toFixed(2)} A` },
          { label: 'Output Power (at η)', value: `${(kvaCalc * EFF).toFixed(2)} kW` },
        ]
      })
      addHistory({ tab: 'Transformer', expr: `${VP}/${VS}V Ip=${IP}A`, result: `${kvaCalc.toFixed(2)}kVA` })
    }
    else if (mode === 'voltage') {
      if (!VP || !KVA) { setError('Enter Vp and kVA, plus turns ratio'); return }
      const N = parseFloat(document.getElementById('n_input')?.value)
      if (!N) { setError('Enter turns ratio n (Vp/Vs)'); return }
      const VSCalc = VP / N
      let Ip, Is
      if (phases === '3ph') {
        Ip = (KVA * 1000) / (Math.sqrt(3) * VP)
        Is = (KVA * 1000) / (Math.sqrt(3) * VSCalc)
      } else {
        Ip = (KVA * 1000) / VP
        Is = (KVA * 1000) / VSCalc
      }
      setResult({
        title: 'Secondary Voltage from Ratio',
        rows: [
          { label: 'Secondary Voltage (Vs)', value: `${VSCalc.toFixed(2)} V`, accent: true },
          { label: 'Primary Current (Ip)', value: `${Ip.toFixed(2)} A` },
          { label: 'Secondary Current (Is)', value: `${Is.toFixed(2)} A` },
        ]
      })
    }
  }

  const MODES = [
    { id: 'currents', label: 'Currents' },
    { id: 'kva',      label: 'kVA' },
    { id: 'voltage',  label: 'Voltage' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-3">

        {/* Mode */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">Solve For</label>
          <div className="flex gap-2">
            {MODES.map(m => (
              <button key={m.id} onClick={() => { setMode(m.id); setResult(null); setError('') }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${mode===m.id ? 'bg-amber-500 text-black' : 'bg-[#1c1c1c] text-gray-400'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Phase */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">Transformer Type</label>
          <div className="flex gap-2">
            {[['1ph','Single Phase (1φ)'],['3ph','Three Phase (3φ)']].map(([id,l]) => (
              <button key={id} onClick={() => setPhases(id)}
                className={`flex-1 py-2.5 rounded-xl text-sm ${phases===id ? 'bg-blue-600 text-white' : 'bg-[#1c1c1c] text-gray-400'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <TField label="Primary Voltage (Vp)" value={vp} onChange={setVp} unit="V" />
        <TField label="Secondary Voltage (Vs)" value={vs} onChange={setVs} unit="V" />

        {mode === 'currents' && (
          <TField label="Transformer Rating" value={kva} onChange={setKva} unit="kVA" />
        )}
        {mode === 'kva' && (
          <TField label="Primary Current (Ip)" id="ip_input" unit="A" />
        )}
        {mode === 'voltage' && (
          <>
            <TField label="Transformer Rating" value={kva} onChange={setKva} unit="kVA" />
            <TField label="Turns Ratio n = Vp/Vs" id="n_input" unit=":1" />
          </>
        )}

        <TField label="Efficiency" value={eff} onChange={setEff} unit="%" />

        <button onClick={calculate}
          className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">
          CALCULATE
        </button>

        {error && <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}

        {result && (
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
            <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
              <span className="text-amber-400 text-xs font-bold">{result.title.toUpperCase()}</span>
            </div>
            {result.rows.map((row, i) => (
              <div key={i} className={`flex justify-between items-center px-4 py-3 border-b border-[#1a1a1a] last:border-0 ${row.accent ? 'bg-[#1a1500]' : ''}`}>
                <span className="text-gray-400 text-sm">{row.label}</span>
                <span className={`font-bold ${row.accent ? 'text-amber-400 text-lg' : 'text-white'}`}>{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Formula Reference */}
        <div className="bg-[#0f1520] border border-[#1e2a3a] rounded-xl px-4 py-3 text-xs text-gray-500 mb-4">
          <div className="text-blue-400 font-bold mb-2">Transformer Formulas</div>
          <div className="space-y-1">
            <div>n = Vp / Vs = Np / Ns = Is / Ip</div>
            <div>1φ: S(kVA) = Vp × Ip / 1000 = Vs × Is / 1000</div>
            <div>3φ: S(kVA) = √3 × VL × IL / 1000</div>
            <div>Output kW = kVA × η (efficiency)</div>
          </div>
        </div>

      </div>
    </div>
  )
}

function TField({ label, value, onChange, unit, id }) {
  return (
    <div className="mb-3">
      <label className="text-gray-400 text-xs mb-1 block">{label}</label>
      <div className="flex items-center bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <input id={id} type="text" value={value} onChange={e => onChange && onChange(e.target.value)}
          inputMode="decimal" step="any"
          className="flex-1 bg-transparent text-white text-lg px-4 py-3 outline-none"
          placeholder="0" />
        <span className="text-gray-500 text-sm px-3">{unit}</span>
      </div>
    </div>
  )
}
