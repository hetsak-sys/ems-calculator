import { useState } from 'react'

const SQRT3 = Math.sqrt(3)
const pf = (v) => parseFloat(String(v).replace(',', '.')) || 0

function NumInput({ label, value, onChange, unit, placeholder = '0', note }) {
  return (
    <div className="mb-3">
      {label && <label className="text-gray-400 text-xs mb-1 block">{label}{note && <span className="text-gray-600 ml-1">({note})</span>}</label>}
      <div className="flex items-center bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value.replace(',', '.'))}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-white text-lg px-4 py-3 outline-none"
        />
        {unit && <span className="text-gray-500 text-sm px-3">{unit}</span>}
      </div>
    </div>
  )
}

function ResultRow({ label, value, unit, accent, warn }) {
  return (
    <div className={`flex justify-between items-center px-4 py-3 border-b border-[#1a1a1a] last:border-0 ${accent?'bg-[#1a1500]':''} ${warn?'bg-[#1a0000]':''}`}>
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`font-bold ${accent?'text-amber-400 text-lg':warn?'text-red-400':''} text-white`}>
        {value} <span className="text-xs font-normal text-gray-500">{unit}</span>
      </span>
    </div>
  )
}

function ResultBox({ title, rows }) {
  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
      <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
        <span className="text-amber-400 text-xs font-bold">{title || 'RESULTS'}</span>
      </div>
      {rows.map((r, i) => <ResultRow key={i} {...r} />)}
    </div>
  )
}

function ErrBox({ msg }) {
  return msg ? <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">{msg}</div> : null
}

// Voltage levels
const VOLTAGES = [
  { label: '400V LV', vll: 400 },
  { label: '3.3kV MV', vll: 3300 },
  { label: '6.6kV MV', vll: 6600 },
  { label: '11kV MV', vll: 11000 },
  { label: '22kV MV', vll: 22000 },
  { label: '33kV MV', vll: 33000 },
]

// Fault durations for thermal rating
const DURATIONS = [
  { label: '5s', s: 5 },
  { label: '10s', s: 10 },
  { label: '30s', s: 30 },
  { label: '60s', s: 60 },
  { label: 'Cont.', s: null },
]

// ── NER Sizing ─────────────────────────────────────────────────────────────
function NerSizing({ addHistory }) {
  const [voltIdx, setVoltIdx] = useState(2)   // default 6.6kV
  const [faultCurrent, setFaultCurrent] = useState('') // desired earth fault limit (A)
  const [durIdx, setDurIdx] = useState(1)     // 10s default
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const calculate = () => {
    setError('')
    const V = VOLTAGES[voltIdx]
    const If = pf(faultCurrent)
    if (!If) { setError('Enter desired earth fault current limit'); return }
    if (If <= 0) { setError('Current must be positive'); return }

    const Vln = V.vll / SQRT3
    // NER resistance
    const R = Vln / If

    // Thermal rating — I²t
    const dur = DURATIONS[durIdx]
    // k factor for resistor material (stainless steel typical = 100)
    const k = 100
    // Continuous rating: use steady-state power
    const powerCont = If * If * R  // watts
    const powerKW = powerCont / 1000

    // For timed: thermal energy = I² × R × t (joules)
    const energy = dur.s ? (If * If * R * dur.s) : null

    // NCRT (Neutral Current Ratio Transformer) sizing
    // Typically 1A or 5A secondary
    // CT ratio = If / 1 or If / 5
    const nctRatio1A = Math.ceil(If / 1)
    const nctRatio5A = Math.ceil(If / 5)

    // NER voltage — voltage across resistor during fault = If × R = Vln (by definition)
    // Voltage rating of NER = Vln
    const nerVoltage = Vln.toFixed(0)

    setResult({ R: R.toFixed(2), Vln: Vln.toFixed(1), If, powerKW: powerKW.toFixed(2), energy: energy ? (energy/1000).toFixed(2) : 'N/A', nctRatio1A, nctRatio5A, nerVoltage, voltLabel: V.label, durLabel: dur.label })
    addHistory({ tab: 'NER', expr: `${V.label} If=${If}A`, result: `R=${R.toFixed(2)}Ω` })
  }

  return (
    <div className="px-4 py-3">
      <div className="bg-[#0a1a2e] border border-[#1a3a5a] rounded-xl px-4 py-3 mb-4">
        <div className="text-blue-400 text-xs font-bold mb-1">NER Sizing — Neutral Earthing Resistor</div>
        <div className="text-gray-500 text-xs">Limits earth fault current on MV/LV systems. R = Vln ÷ If(limit)</div>
      </div>

      {/* Voltage selector */}
      <div className="mb-4">
        <label className="text-gray-400 text-xs mb-2 block">System Voltage</label>
        <div className="flex flex-wrap gap-2">
          {VOLTAGES.map((v, i) => (
            <button key={i} onClick={() => setVoltIdx(i)}
              className={`px-3 py-2 rounded-xl text-xs font-medium ${voltIdx===i?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <NumInput
        label="Earth Fault Current Limit (If)"
        value={faultCurrent}
        onChange={setFaultCurrent}
        unit="A"
        note="typically 5–400A for MV, 50–1000A for LV"
        placeholder="e.g. 10"
      />

      {/* Fault duration */}
      <div className="mb-4">
        <label className="text-gray-400 text-xs mb-2 block">Fault Duration (for thermal rating)</label>
        <div className="flex gap-2">
          {DURATIONS.map((d, i) => (
            <button key={i} onClick={() => setDurIdx(i)}
              className={`flex-1 py-2 rounded-xl text-xs ${durIdx===i?'bg-blue-600 text-white':'bg-[#1c1c1c] text-gray-400'}`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <button onClick={calculate} className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">CALCULATE NER</button>
      <ErrBox msg={error} />

      {result && <>
        <ResultBox title="NER PARAMETERS" rows={[
          { label: 'System', value: result.voltLabel, unit: '' },
          { label: 'Phase-to-Neutral Voltage', value: result.Vln, unit: 'V' },
          { label: '➤ NER Resistance', value: result.R, unit: 'Ω', accent: true },
          { label: '➤ NER Voltage Rating', value: result.nerVoltage, unit: 'V (Vln)', accent: true },
          { label: '➤ Continuous Current Rating', value: result.If, unit: 'A', accent: true },
          { label: 'Continuous Power Dissipation', value: result.powerKW, unit: 'kW' },
          { label: `Thermal Energy (${result.durLabel})`, value: result.energy, unit: 'kJ' },
        ]} />

        <ResultBox title="NCRT SIZING (Neutral CT)" rows={[
          { label: 'NCRT Ratio (1A secondary)', value: `${result.nctRatio1A}/1`, unit: 'A' },
          { label: 'NCRT Ratio (5A secondary)', value: `${result.nctRatio5A}/5`, unit: 'A' },
          { label: 'NCRT Voltage Class', value: result.nerVoltage, unit: 'V minimum' },
        ]} />

        <div className="bg-[#0f1520] border border-[#1e2a3a] rounded-xl px-4 py-3 text-xs text-gray-500 mb-4">
          <div className="text-blue-400 font-bold mb-2">NER Design Notes</div>
          <div>• R = Vln ÷ If — resistor limits fault current to safe level</div>
          <div>• NER voltage rating ≥ Vln (phase to neutral voltage)</div>
          <div>• Continuous rating: resistor must carry If continuously without overheating</div>
          <div>• Timed rating: higher current OK for fault duration only</div>
          <div>• NCRT monitors NER current — trips on earth fault</div>
          <div>• For MV: If = 5–10A typical low-resistance earthing (mine standard)</div>
          <div>• For LV: If = 50–200A typical</div>
          <div>• SANS 10198 / IEC 60364 applies</div>
        </div>
      </>}
    </div>
  )
}

// ── NCRT Monitoring ────────────────────────────────────────────────────────
function NcrtMonitoring() {
  const [nerR, setNerR] = useState('')
  const [voltIdx, setVoltIdx] = useState(2)
  const [ctRatio, setCtRatio] = useState('')
  const [relayPickup, setRelayPickup] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const calculate = () => {
    setError('')
    const R = pf(nerR), CT = pf(ctRatio), pickup = pf(relayPickup)
    const V = VOLTAGES[voltIdx]
    if (!R) { setError('Enter NER resistance'); return }
    const Vln = V.vll / SQRT3
    const maxFaultCurrent = Vln / R
    const ctSecCurrent = CT > 0 ? (maxFaultCurrent / CT).toFixed(3) : null
    const sensitivity = CT > 0 && pickup > 0 ? (pickup * CT).toFixed(2) : null

    setResult({
      Vln: Vln.toFixed(1),
      maxFaultCurrent: maxFaultCurrent.toFixed(2),
      ctSecCurrent,
      sensitivity,
      voltLabel: V.label,
    })
  }

  return (
    <div className="px-4 py-3">
      <div className="bg-[#0a1a2e] border border-[#1a3a5a] rounded-xl px-4 py-3 mb-4">
        <div className="text-blue-400 text-xs font-bold mb-1">NCRT Monitoring — Neutral CT Settings</div>
        <div className="text-gray-500 text-xs">Verify relay sensitivity against NER fault current</div>
      </div>

      <div className="mb-4">
        <label className="text-gray-400 text-xs mb-2 block">System Voltage</label>
        <div className="flex flex-wrap gap-2">
          {VOLTAGES.map((v, i) => (
            <button key={i} onClick={() => setVoltIdx(i)}
              className={`px-3 py-2 rounded-xl text-xs font-medium ${voltIdx===i?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <NumInput label="NER Resistance" value={nerR} onChange={setNerR} unit="Ω" placeholder="e.g. 382" />
      <NumInput label="NCRT Ratio (primary)" value={ctRatio} onChange={setCtRatio} unit="A" placeholder="e.g. 10 (for 10/1)" />
      <NumInput label="Relay Pickup Setting (secondary)" value={relayPickup} onChange={setRelayPickup} unit="A" placeholder="e.g. 0.5" />

      <button onClick={calculate} className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">CALCULATE</button>
      <ErrBox msg={error} />

      {result && <ResultBox title="NCRT MONITORING" rows={[
        { label: 'System', value: result.voltLabel, unit: '' },
        { label: 'Phase-to-Neutral Voltage', value: result.Vln, unit: 'V' },
        { label: 'Max Earth Fault Current (primary)', value: result.maxFaultCurrent, unit: 'A' },
        ...(result.ctSecCurrent ? [{ label: 'CT Secondary Current at Max Fault', value: result.ctSecCurrent, unit: 'A', accent: true }] : []),
        ...(result.sensitivity ? [{ label: 'Minimum Primary Fault for Relay Trip', value: result.sensitivity, unit: 'A' }] : []),
      ]} />}
    </div>
  )
}

// ── MAIN ───────────────────────────────────────────────────────────────────
const SUB_TABS = [
  { id: 'ner',  label: 'NER Size', icon: '⏚' },
  { id: 'ncrt', label: 'NCRT',     icon: '◎' },
]

export default function NerCalculator({ addHistory }) {
  const [sub, setSub] = useState('ner')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex overflow-x-auto scrollbar-none bg-[#0a0a0a] border-b border-[#2a2a2a] px-2 py-2 gap-2">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className={`flex-shrink-0 flex flex-col items-center px-4 py-1.5 rounded-lg min-w-[70px] ${sub===t.id?'bg-amber-500 text-black':'text-gray-500'}`}>
            <span className="text-base">{t.icon}</span>
            <span className="text-[11px] mt-0.5 font-medium">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {sub === 'ner'  && <NerSizing addHistory={addHistory} />}
        {sub === 'ncrt' && <NcrtMonitoring />}
      </div>
    </div>
  )
}
