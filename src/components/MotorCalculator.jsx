import { useState } from 'react'

const SQRT3 = Math.sqrt(3)

function calcMotorCurrent({ phase, kw, hp, voltage, pf, efficiency }) {
  const pfN = parseFloat(pf) || 0.85
  const effN = (parseFloat(efficiency) || 90) / 100
  let powerW = 0

  if (kw) powerW = parseFloat(kw) * 1000
  else if (hp) powerW = parseFloat(hp) * 745.7
  else return null

  const v = parseFloat(voltage)
  if (!v || !pfN || !effN) return null

  let fla, inputPower
  inputPower = powerW / effN  // power drawn from supply

  if (phase === '1ph') {
    fla = inputPower / (v * pfN)
  } else {
    fla = inputPower / (SQRT3 * v * pfN)
  }

  const kva = (phase === '1ph' ? v * fla : SQRT3 * v * fla) / 1000
  const kvar = kva * Math.sqrt(1 - pfN * pfN)
  const startCurrent = fla * 6  // typical DOL starting current

  return {
    fla: fla.toFixed(2),
    kva: kva.toFixed(3),
    kvar: kvar.toFixed(3),
    inputkW: (inputPower / 1000).toFixed(3),
    startCurrent: startCurrent.toFixed(1),
  }
}

export default function MotorCalculator({ addHistory }) {
  const [phase, setPhase]       = useState('3ph')
  const [inputType, setInputType] = useState('kw')  // 'kw' or 'hp'
  const [kw, setKw]             = useState('')
  const [hp, setHp]             = useState('')
  const [voltage, setVoltage]   = useState('400')
  const [pf, setPf]             = useState('0.85')
  const [eff, setEff]           = useState('90')
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState('')

  const calculate = () => {
    setError('')
    if (!voltage) { setError('Enter voltage'); return }
    if (!kw && !hp) { setError('Enter power (kW or HP)'); return }
    const res = calcMotorCurrent({
      phase, kw: inputType === 'kw' ? kw : '', hp: inputType === 'hp' ? hp : '',
      voltage, pf, efficiency: eff
    })
    if (!res) { setError('Invalid inputs'); return }
    setResult(res)
    addHistory({ tab: 'Motor', expr: `${phase} ${inputType==='kw'?kw+'kW':hp+'HP'} @ ${voltage}V PF${pf}`, result: `${res.fla}A` })
  }

  const Field = ({ label, value, onChange, unit, keyboardType = 'numeric' }) => (
    <div className="mb-3">
      <label className="text-gray-400 text-xs mb-1 block">{label}</label>
      <div className="flex items-center bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          inputMode={keyboardType} step="any"
          className="flex-1 bg-transparent text-white text-lg px-4 py-3 outline-none"
          placeholder="0"
        />
        {unit && <span className="text-gray-500 text-sm px-3">{unit}</span>}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-3">

        {/* Phase selector */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">Phase</label>
          <div className="flex gap-2">
            {['1ph','3ph'].map(p => (
              <button key={p} onClick={() => setPhase(p)}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm ${phase===p ? 'bg-amber-500 text-black' : 'bg-[#1c1c1c] text-gray-400'}`}>
                {p === '1ph' ? 'Single Phase (1φ)' : 'Three Phase (3φ)'}
              </button>
            ))}
          </div>
        </div>

        {/* Power input type */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">Power Unit</label>
          <div className="flex gap-2">
            {[['kw','kW'],['hp','HP']].map(([id, lbl]) => (
              <button key={id} onClick={() => setInputType(id)}
                className={`flex-1 py-2 rounded-xl text-sm ${inputType===id ? 'bg-blue-600 text-white' : 'bg-[#1c1c1c] text-gray-400'}`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {inputType === 'kw'
          ? <Field label="Motor Output Power" value={kw} onChange={setKw} unit="kW" />
          : <Field label="Motor Output Power" value={hp} onChange={setHp} unit="HP" />
        }

        <Field label={`Supply Voltage ${phase==='3ph' ? '(Line-to-Line)' : '(Line-to-Neutral)'}`} value={voltage} onChange={setVoltage} unit="V" />
        <Field label="Power Factor (0.6 – 1.0)" value={pf} onChange={setPf} unit="PF" />
        <Field label="Motor Efficiency" value={eff} onChange={setEff} unit="%" />

        <button onClick={calculate}
          className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">
          CALCULATE
        </button>

        {error && <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}

        {result && (
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
            <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
              <span className="text-amber-400 text-xs font-bold">RESULTS</span>
            </div>
            <ResultRow label="Full Load Current (FLA)" value={result.fla} unit="A" accent />
            <ResultRow label="Apparent Power (kVA)" value={result.kva} unit="kVA" />
            <ResultRow label="Reactive Power (kVAr)" value={result.kvar} unit="kVAr" />
            <ResultRow label="Input Power (kW drawn)" value={result.inputkW} unit="kW" />
            <ResultRow label="DOL Starting Current (×6)" value={result.startCurrent} unit="A" />
          </div>
        )}

        {/* Formula reminder */}
        <div className="bg-[#0f1520] border border-[#1e2a3a] rounded-xl px-4 py-3 text-xs text-gray-500">
          <div className="text-blue-400 font-bold mb-1">Formula Used</div>
          {phase === '3ph'
            ? <div>I = P_input ÷ (√3 × V × PF) &nbsp;|&nbsp; P_input = P_out ÷ η</div>
            : <div>I = P_input ÷ (V × PF) &nbsp;|&nbsp; P_input = P_out ÷ η</div>
          }
        </div>

      </div>
    </div>
  )
}

function ResultRow({ label, value, unit, accent }) {
  return (
    <div className={`flex justify-between items-center px-4 py-3 border-b border-[#1a1a1a] last:border-0 ${accent ? 'bg-[#1a1500]' : ''}`}>
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`font-bold text-lg ${accent ? 'text-amber-400' : 'text-white'}`}>{value} <span className={`text-sm font-normal ${accent ? 'text-amber-600' : 'text-gray-500'}`}>{unit}</span></span>
    </div>
  )
}
