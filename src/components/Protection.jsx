import { useState } from 'react'
import { ResultCard, useResultCard } from './shared'
import ProtectionCoordination from './ProtectionCoordination'

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

function GenCardBtn({ onClick }) {
  return (
    <button onClick={onClick}
      className="w-full bg-[#1a1a2e] border border-[#2a2a5a] text-blue-300 font-bold py-3 rounded-xl text-sm mb-4">
      📄 Generate Result Card
    </button>
  )
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

// ── NER Sizing ────────────────────────────────────────────────────────────────
function NerSizing({ addHistory }) {
  const [voltIdx, setVoltIdx] = useState(2)   // default 6.6kV
  const [faultCurrent, setFaultCurrent] = useState('') // desired earth fault limit (A)
  const [durIdx, setDurIdx] = useState(1)     // 10s default
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const { cardData, showCard, hideCard } = useResultCard()

  const calculate = () => {
    setError('')
    setResult(null)
    const V = VOLTAGES[voltIdx]
    const If = pf(faultCurrent)
    if (!If) { setError('Enter desired earth fault current limit'); return }
    if (If <= 0) { setError('Current must be positive'); return }

    const Vln = V.vll / SQRT3
    const R = Vln / If

    const dur = DURATIONS[durIdx]
    const powerCont = If * If * R
    const powerKW = powerCont / 1000
    const energy = dur.s ? (If * If * R * dur.s) : null

    const nctRatio1A = Math.ceil(If / 1)
    const nctRatio5A = Math.ceil(If / 5)
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

        <GenCardBtn onClick={() => showCard({
          calculator: 'NER Sizing',
          standard: 'SANS 10198 / IEC 60364',
          inputs: [
            { label: 'System', value: result.voltLabel },
            { label: 'Earth Fault Current Limit', value: `${result.If} A` },
            { label: 'Fault Duration', value: result.durLabel },
          ],
          sections: [{
            title: 'RESULTS',
            rows: [
              { label: 'NER Resistance', value: `${result.R} Ω`, accent: true },
              { label: 'NER Voltage Rating', value: `${result.nerVoltage} V` },
              { label: 'Continuous Power Dissipation', value: `${result.powerKW} kW` },
              { label: `Thermal Energy (${result.durLabel})`, value: `${result.energy} kJ` },
              { label: 'NCRT Ratio (1A secondary)', value: `${result.nctRatio1A}/1 A` },
              { label: 'NCRT Ratio (5A secondary)', value: `${result.nctRatio5A}/5 A` },
            ],
          }],
          notes: 'R = Vln ÷ If. NER voltage rating must be ≥ Vln. Confirm resistor thermal class against actual fault-clearing time.',
        })} />
      </>}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

// ── NCRT Monitoring ───────────────────────────────────────────────────────────
function NcrtMonitoring() {
  const [nerR, setNerR] = useState('')
  const [voltIdx, setVoltIdx] = useState(2)
  const [ctRatio, setCtRatio] = useState('')
  const [relayPickup, setRelayPickup] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const { cardData, showCard, hideCard } = useResultCard()

  const calculate = () => {
    setError('')
    setResult(null)
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

      {result && <>
        <ResultBox title="NCRT MONITORING" rows={[
          { label: 'System', value: result.voltLabel, unit: '' },
          { label: 'Phase-to-Neutral Voltage', value: result.Vln, unit: 'V' },
          { label: 'Max Earth Fault Current (primary)', value: result.maxFaultCurrent, unit: 'A' },
          ...(result.ctSecCurrent ? [{ label: 'CT Secondary Current at Max Fault', value: result.ctSecCurrent, unit: 'A', accent: true }] : []),
          ...(result.sensitivity ? [{ label: 'Minimum Primary Fault for Relay Trip', value: result.sensitivity, unit: 'A' }] : []),
        ]} />
        <GenCardBtn onClick={() => showCard({
          calculator: 'NCRT Monitoring',
          standard: 'SANS 10198 / IEC 60364',
          inputs: [
            { label: 'System', value: result.voltLabel },
            { label: 'NER Resistance', value: `${nerR} Ω` },
            { label: 'NCRT Ratio (primary)', value: `${ctRatio} A` },
            { label: 'Relay Pickup (secondary)', value: `${relayPickup} A` },
          ],
          sections: [{
            title: 'RESULTS',
            rows: [
              { label: 'Max Earth Fault Current', value: `${result.maxFaultCurrent} A`, accent: true },
              ...(result.ctSecCurrent ? [{ label: 'CT Secondary Current at Max Fault', value: `${result.ctSecCurrent} A` }] : []),
              ...(result.sensitivity ? [{ label: 'Minimum Primary Fault for Relay Trip', value: `${result.sensitivity} A` }] : []),
            ],
          }],
          notes: 'Confirm relay pickup gives adequate sensitivity margin below the NER-limited maximum fault current.',
        })} />
      </>}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

// ── IDMT Relay Coordination (IEC 60255-151) ──────────────────────────────────
const IDMT_CURVES = [
  { id: 'si', label: 'Standard Inverse (SI)',    k: 0.14, a: 0.02 },
  { id: 'vi', label: 'Very Inverse (VI)',        k: 13.5, a: 1.0  },
  { id: 'ei', label: 'Extremely Inverse (EI)',   k: 80,   a: 2.0  },
  { id: 'lti',label: 'Long Time Inverse (LTI)',  k: 120,  a: 1.0  },
]

function IdmtCoordination({ addHistory }) {
  const [curveIdx, setCurveIdx] = useState(0)
  const [pickup, setPickup] = useState('')
  const [fault, setFault] = useState('')
  const [tms, setTms] = useState('0.1')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const { cardData, showCard, hideCard } = useResultCard()

  const calculate = () => {
    setError('')
    setResult(null)
    const curve = IDMT_CURVES[curveIdx]
    const Is = pf(pickup), If = pf(fault), TMS = pf(tms)
    if (!Is || !If || !TMS) { setError('Enter pickup current, fault current, and TMS'); return }
    const ratio = If / Is
    if (ratio <= 1) { setError('Fault current must exceed pickup current for the relay to operate'); return }
    const t = (TMS * curve.k) / (Math.pow(ratio, curve.a) - 1)

    setResult({
      ratio: ratio.toFixed(2),
      t: t.toFixed(3),
      curveLabel: curve.label,
    })
    addHistory({ tab: 'IDMT', expr: `${curve.label} PSM=${ratio.toFixed(1)}`, result: `${t.toFixed(3)}s` })
  }

  return (
    <div className="px-4 py-3">
      <div className="bg-[#0a1a2e] border border-[#1a3a5a] rounded-xl px-4 py-3 mb-4">
        <div className="text-blue-400 text-xs font-bold mb-1">IDMT Relay Operating Time</div>
        <div className="text-gray-500 text-xs">t = TMS × K ÷ ((I/Is)^α − 1) — IEC 60255-151</div>
      </div>

      <div className="mb-4">
        <label className="text-gray-400 text-xs mb-2 block">Curve Type</label>
        <div className="flex flex-wrap gap-2">
          {IDMT_CURVES.map((c, i) => (
            <button key={c.id} onClick={() => setCurveIdx(i)}
              className={`px-3 py-2 rounded-xl text-xs font-medium ${curveIdx===i?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <NumInput label="Relay Pickup Setting (Is)" value={pickup} onChange={setPickup} unit="A" placeholder="e.g. 100" />
      <NumInput label="Fault Current (I)" value={fault} onChange={setFault} unit="A" placeholder="e.g. 800" />
      <NumInput label="Time Multiplier Setting (TMS)" value={tms} onChange={setTms} placeholder="e.g. 0.1" note="typically 0.05–1.0" />

      <button onClick={calculate} className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">CALCULATE</button>
      <ErrBox msg={error} />

      {result && <>
        <ResultBox title="IDMT OPERATING TIME" rows={[
          { label: 'Curve', value: result.curveLabel, unit: '' },
          { label: 'Plug Setting Multiple (I/Is)', value: result.ratio, unit: '×' },
          { label: '➤ Operating Time', value: result.t, unit: 's', accent: true },
        ]} />
        <div className="bg-[#0f1520] border border-[#1e2a3a] rounded-xl px-4 py-3 text-xs text-gray-500 mb-4">
          <div className="text-blue-400 font-bold mb-2">Grading Notes</div>
          <div>• Standard IEC 60255-151 grading margin between relay tiers: typically 0.3–0.4s at maximum through-fault current</div>
          <div>• Margin must allow for CB interrupting time, relay overshoot, and a safety allowance</div>
          <div>• Always verify against a full discrimination study — this gives a single relay's operating time, not a coordination check</div>
        </div>
        <GenCardBtn onClick={() => showCard({
          calculator: 'IDMT Relay Coordination',
          standard: 'IEC 60255-151',
          inputs: [
            { label: 'Curve', value: result.curveLabel },
            { label: 'Relay Pickup Setting', value: `${pickup} A` },
            { label: 'Fault Current', value: `${fault} A` },
            { label: 'TMS', value: tms },
          ],
          sections: [{
            title: 'RESULTS',
            rows: [
              { label: 'Plug Setting Multiple', value: `${result.ratio} ×` },
              { label: 'Operating Time', value: `${result.t} s`, accent: true },
            ],
          }],
          notes: 'This is single-relay operating time, not a full discrimination/grading study. Typical IEC grading margin between tiers is 0.3–0.4s at maximum through-fault current — verify against your protection philosophy.',
        })} />
      </>}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

// ── CT Burden ─────────────────────────────────────────────────────────────────
const RHO_CU = 0.01724 // Ω·mm²/m, IEC 60228 measured value at 20°C, consistent with Formula Reference

function CtBurden({ addHistory }) {
  const [secondary, setSecondary] = useState(5)
  const [length, setLength] = useState('')
  const [csa, setCsa] = useState('')
  const [relayBurden, setRelayBurden] = useState('')
  const [ctRatedBurden, setCtRatedBurden] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const { cardData, showCard, hideCard } = useResultCard()

  const calculate = () => {
    setError('')
    setResult(null)
    const L = pf(length), A = pf(csa), relayVA = pf(relayBurden), ratedVA = pf(ctRatedBurden)
    if (!L || !A || !relayVA || !ratedVA) { setError('Fill in all fields'); return }
    const Rcable = (RHO_CU * 2 * L) / A // round trip
    const cableBurdenVA = secondary * secondary * Rcable
    const totalVA = cableBurdenVA + relayVA
    const pass = totalVA <= ratedVA
    const marginPct = ((ratedVA - totalVA) / ratedVA) * 100

    setResult({
      Rcable: Rcable.toFixed(3),
      cableBurdenVA: cableBurdenVA.toFixed(2),
      totalVA: totalVA.toFixed(2),
      pass,
      marginPct: marginPct.toFixed(1),
    })
    addHistory({ tab: 'CT Burden', expr: `${secondary}A ${L}m ${A}mm²`, result: `${totalVA.toFixed(1)}VA` })
  }

  return (
    <div className="px-4 py-3">
      <div className="bg-[#0a1a2e] border border-[#1a3a5a] rounded-xl px-4 py-3 mb-4">
        <div className="text-blue-400 text-xs font-bold mb-1">CT Burden Check</div>
        <div className="text-gray-500 text-xs">Confirms wiring + relay burden stays within the CT's rated burden</div>
      </div>

      <div className="mb-4">
        <label className="text-gray-400 text-xs mb-2 block">CT Secondary Rating</label>
        <div className="flex gap-2">
          {[1, 5].map(s => (
            <button key={s} onClick={() => setSecondary(s)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold ${secondary===s?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>{s}A</button>
          ))}
        </div>
      </div>

      <NumInput label="Cable Run Length (one-way)" value={length} onChange={setLength} unit="m" placeholder="e.g. 30" />
      <NumInput label="Cable CSA" value={csa} onChange={setCsa} unit="mm²" placeholder="e.g. 2.5" />
      <NumInput label="Relay Burden" value={relayBurden} onChange={setRelayBurden} unit="VA" placeholder="e.g. 0.5" />
      <NumInput label="CT Rated Burden" value={ctRatedBurden} onChange={setCtRatedBurden} unit="VA" placeholder="e.g. 15" />

      <button onClick={calculate} className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">CALCULATE</button>
      <ErrBox msg={error} />

      {result && <>
        <ResultBox title="CT BURDEN" rows={[
          { label: 'Cable Loop Resistance', value: result.Rcable, unit: 'Ω' },
          { label: 'Cable Burden', value: result.cableBurdenVA, unit: 'VA' },
          { label: '➤ Total Burden', value: result.totalVA, unit: 'VA', accent: true },
          { label: result.pass ? '✓ Within CT Rated Burden' : '✗ Exceeds CT Rated Burden', value: `${result.marginPct}%`, unit: 'margin', warn: !result.pass, accent: result.pass },
        ]} />
        <GenCardBtn onClick={() => showCard({
          calculator: 'CT Burden Check',
          standard: 'IEC 61869-2',
          inputs: [
            { label: 'CT Secondary', value: `${secondary} A` },
            { label: 'Cable Run', value: `${length} m one-way, ${csa} mm²` },
            { label: 'Relay Burden', value: `${relayBurden} VA` },
            { label: 'CT Rated Burden', value: `${ctRatedBurden} VA` },
          ],
          sections: [{
            title: 'RESULTS',
            rows: [
              { label: 'Cable Burden', value: `${result.cableBurdenVA} VA` },
              { label: 'Total Burden', value: `${result.totalVA} VA`, accent: true },
              { label: result.pass ? 'Within rated burden' : 'Exceeds rated burden', value: `${result.marginPct}% margin` },
            ],
          }],
          notes: 'Burden exceeding the CT rating causes saturation and inaccurate secondary current — undersized protection wiring is a common cause of nuisance mal-operation or failure to trip.',
        })} />
      </>}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

// ── Insulation Resistance — PI & DAR (IEEE 43) ───────────────────────────────
function InsulationResistance({ addHistory }) {
  const [r30s, setR30s] = useState('')
  const [r1min, setR1min] = useState('')
  const [r10min, setR10min] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const { cardData, showCard, hideCard } = useResultCard()

  const calculate = () => {
    setError('')
    setResult(null)
    const R30 = pf(r30s), R1 = pf(r1min), R10 = pf(r10min)
    if (!R30 || !R1) { setError('Enter at least the 30s and 1 minute readings'); return }
    const dar = R1 / R30
    const pi = R10 ? (R10 / R1) : null

    const darRating = dar < 1.25 ? 'Poor' : dar < 1.6 ? 'Fair/Good' : 'Good'
    const piRating = pi === null ? null : (pi < 1.0 ? 'Dangerous — investigate before energising' : pi < 2.0 ? 'Questionable' : pi <= 4.0 ? 'Good' : 'Check for over-dried/brittle insulation');

    setResult({
      dar: dar.toFixed(2), darRating,
      pi: pi !== null ? pi.toFixed(2) : null, piRating,
    })
    addHistory({ tab: 'Insulation R', expr: `DAR test`, result: `DAR=${dar.toFixed(2)}${pi?`, PI=${pi.toFixed(2)}`:''}` })
  }

  return (
    <div className="px-4 py-3">
      <div className="bg-[#0a1a2e] border border-[#1a3a5a] rounded-xl px-4 py-3 mb-4">
        <div className="text-blue-400 text-xs font-bold mb-1">Insulation Resistance — PI &amp; DAR</div>
        <div className="text-gray-500 text-xs">DAR = R(1min)/R(30s) · PI = R(10min)/R(1min) — IEEE 43</div>
      </div>

      <NumInput label="Resistance at 30 seconds" value={r30s} onChange={setR30s} unit="MΩ" placeholder="e.g. 800" />
      <NumInput label="Resistance at 1 minute" value={r1min} onChange={setR1min} unit="MΩ" placeholder="e.g. 1000" />
      <NumInput label="Resistance at 10 minutes" value={r10min} onChange={setR10min} unit="MΩ" placeholder="optional — for PI" note="optional" />

      <button onClick={calculate} className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">CALCULATE</button>
      <ErrBox msg={error} />

      {result && <>
        <ResultBox title="INSULATION TEST RESULTS" rows={[
          { label: '➤ DAR (1min/30s)', value: result.dar, unit: `— ${result.darRating}`, accent: true },
          ...(result.pi ? [{ label: '➤ PI (10min/1min)', value: result.pi, unit: `— ${result.piRating}`, accent: true, warn: result.piRating === 'Dangerous — investigate before energising' }] : []),
        ]} />
        <div className="bg-[#0f1520] border border-[#1e2a3a] rounded-xl px-4 py-3 text-xs text-gray-500 mb-4">
          <div className="text-blue-400 font-bold mb-2">IEEE 43 General Guidance</div>
          <div>• DAR: &lt;1.25 poor · 1.25–1.6 fair/good · &gt;1.6 good</div>
          <div>• PI: &lt;1.0 dangerous · 1.0–2.0 questionable · 2.0–4.0 good · &gt;4.0 check for brittleness</div>
          <div>• These are general IEEE 43 guideline bands — check acceptance criteria for the specific machine's insulation class before making a run/no-run decision</div>
        </div>
        <GenCardBtn onClick={() => showCard({
          calculator: 'Insulation Resistance — PI/DAR',
          standard: 'IEEE 43',
          inputs: [
            { label: 'R at 30s', value: `${r30s} MΩ` },
            { label: 'R at 1 min', value: `${r1min} MΩ` },
            ...(r10min ? [{ label: 'R at 10 min', value: `${r10min} MΩ` }] : []),
          ],
          sections: [{
            title: 'RESULTS',
            rows: [
              { label: 'DAR', value: `${result.dar} — ${result.darRating}`, accent: true },
              ...(result.pi ? [{ label: 'PI', value: `${result.pi} — ${result.piRating}`, accent: true }] : []),
            ],
          }],
          notes: 'General IEEE 43 guidance bands. Check acceptance criteria for the specific machine\u2019s insulation class and manufacturer before making a run/no-run decision.',
        })} />
      </>}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

// ── Arc Flash — simplified LV estimate (IEEE 1584) ───────────────────────────
function ArcFlash({ addHistory }) {
  const [bolted, setBolted] = useState('')
  const [gap, setGap] = useState('25')
  const [grounded, setGrounded] = useState(true)
  const [enclosure, setEnclosure] = useState('box')
  const [distance, setDistance] = useState('610')
  const [duration, setDuration] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const { cardData, showCard, hideCard } = useResultCard()

  const calculate = () => {
    setError('')
    setResult(null)
    const Ibf = pf(bolted), G = pf(gap), D = pf(distance), t = pf(duration)
    if (!Ibf || !D || !t) { setError('Enter bolted fault current, working distance, and arc duration'); return }

    // Simplified LV (<1kV) empirical method, IEEE 1584-2002 —
    // still the commonly used first-pass/order-of-magnitude estimate for
    // straightforward LV panels. See notes/disclaimer below.
    const lgIa = 0.00402 + 0.983 * Math.log10(Ibf)
    const Ia = Math.pow(10, lgIa)

    const K1 = enclosure === 'box' ? -0.555 : -0.792
    const K2 = grounded ? -0.113 : 0
    const lgEn = K1 + K2 + 1.081 * Math.log10(Ia) + 0.0011 * G
    const En = Math.pow(10, lgEn) // normalized incident energy, J/cm² at 610mm, 0.2s

    const Cf = 1.5 // <1kV
    const x = 1.473 // LV distance exponent
    const E_Jcm2 = 4.184 * Cf * En * (t / 0.2) * Math.pow(610 / D, x)
    const E_calcm2 = E_Jcm2 / 4.184

    let category
    if (E_calcm2 < 1.2) category = 'Below PPE Category 1 threshold'
    else if (E_calcm2 < 4) category = 'Category 1'
    else if (E_calcm2 < 8) category = 'Category 2'
    else if (E_calcm2 < 25) category = 'Category 3'
    else if (E_calcm2 < 40) category = 'Category 4'
    else category = 'Exceeds Category 4 — dangerous'

    setResult({
      Ia: Ia.toFixed(2),
      E_calcm2: E_calcm2.toFixed(2),
      category,
    })
    addHistory({ tab: 'Arc Flash', expr: `Ibf=${Ibf}kA t=${t}s`, result: `${E_calcm2.toFixed(1)} cal/cm² (est.)` })
  }

  return (
    <div className="px-4 py-3">
      <div className="bg-[#2a1000] border border-[#5a2a00] rounded-xl px-4 py-3 mb-4">
        <div className="text-orange-400 text-xs font-bold mb-1">⚠ Arc Flash — Estimate Only</div>
        <div className="text-gray-400 text-xs">
          This is a simplified LV (&lt;1kV) screening estimate using the widely-published IEEE 1584 empirical
          equations for box/open-air configurations. It is <span className="text-orange-300 font-semibold">not</span> a
          substitute for a full arc-flash study. There is no distinct IEC arc-flash energy calculation standard —
          IEEE 1584 is the method used internationally, including in IEC-based markets, for this purpose. Do not use
          this figure as the sole basis for PPE selection — have a qualified person perform a full study per
          IEEE 1584-2018 or NFPA 70E before making PPE or safety decisions.
        </div>
      </div>

      <NumInput label="Bolted Fault Current" value={bolted} onChange={setBolted} unit="kA" placeholder="e.g. 25" />
      <NumInput label="Conductor Gap" value={gap} onChange={setGap} unit="mm" note="typ. 25mm LV switchgear, 32mm MCC" placeholder="e.g. 25" />

      <div className="mb-3">
        <label className="text-gray-400 text-xs mb-2 block">Grounding</label>
        <div className="flex gap-2">
          <button onClick={() => setGrounded(true)} className={`flex-1 py-2 rounded-xl text-xs font-semibold ${grounded?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>Grounded</button>
          <button onClick={() => setGrounded(false)} className={`flex-1 py-2 rounded-xl text-xs font-semibold ${!grounded?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>Ungrounded/HRG</button>
        </div>
      </div>

      <div className="mb-3">
        <label className="text-gray-400 text-xs mb-2 block">Enclosure</label>
        <div className="flex gap-2">
          <button onClick={() => setEnclosure('box')} className={`flex-1 py-2 rounded-xl text-xs font-semibold ${enclosure==='box'?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>Switchgear/Box</button>
          <button onClick={() => setEnclosure('open')} className={`flex-1 py-2 rounded-xl text-xs font-semibold ${enclosure==='open'?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>Open Air</button>
        </div>
      </div>

      <NumInput label="Working Distance" value={distance} onChange={setDistance} unit="mm" note="typ. 610mm (24in) LV" placeholder="e.g. 610" />
      <NumInput label="Arc Duration" value={duration} onChange={setDuration} unit="s" note="from upstream protection clearing time" placeholder="e.g. 0.2" />

      <button onClick={calculate} className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">CALCULATE ESTIMATE</button>
      <ErrBox msg={error} />

      {result && <>
        <ResultBox title="ARC FLASH ESTIMATE" rows={[
          { label: 'Estimated Arcing Current', value: result.Ia, unit: 'kA' },
          { label: '➤ Estimated Incident Energy', value: result.E_calcm2, unit: 'cal/cm²', accent: true },
          { label: 'Approx. PPE Category', value: result.category, unit: '' },
        ]} />
        <GenCardBtn onClick={() => showCard({
          calculator: 'Arc Flash — Simplified LV Estimate',
          standard: 'IEEE 1584 (simplified LV method) — ESTIMATE ONLY',
          inputs: [
            { label: 'Bolted Fault Current', value: `${bolted} kA` },
            { label: 'Gap', value: `${gap} mm` },
            { label: 'Grounding', value: grounded ? 'Grounded' : 'Ungrounded/HRG' },
            { label: 'Enclosure', value: enclosure === 'box' ? 'Switchgear/Box' : 'Open Air' },
            { label: 'Working Distance', value: `${distance} mm` },
            { label: 'Arc Duration', value: `${duration} s` },
          ],
          sections: [{
            title: 'ESTIMATED RESULTS',
            rows: [
              { label: 'Estimated Arcing Current', value: `${result.Ia} kA` },
              { label: 'Estimated Incident Energy', value: `${result.E_calcm2} cal/cm²`, accent: true },
              { label: 'Approx. PPE Category', value: result.category },
            ],
          }],
          notes: 'ESTIMATE ONLY — simplified LV screening calculation, not a substitute for a full arc-flash study. Do not use as the sole basis for PPE selection. Have a qualified person perform a full study per IEEE 1584-2018 or NFPA 70E.',
        })} />
      </>}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

// ── Transformer Differential Protection ──────────────────────────────────────
function TransformerDifferential({ addHistory }) {
  const [kva, setKva] = useState('')
  const [v1, setV1] = useState('11000')
  const [v2, setV2] = useState('400')
  const [ct1, setCt1] = useState('')
  const [ct2, setCt2] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const { cardData, showCard, hideCard } = useResultCard()

  const calculate = () => {
    setError('')
    setResult(null)
    const KVA = pf(kva), V1 = pf(v1), V2 = pf(v2), CT1 = pf(ct1), CT2 = pf(ct2)
    if (!KVA || !V1 || !V2 || !CT1 || !CT2) { setError('Fill in all fields'); return }

    const I1rated = (KVA * 1000) / (SQRT3 * V1)
    const I2rated = (KVA * 1000) / (SQRT3 * V2)
    const ct1SecAtRated = I1rated / CT1
    const ct2SecAtRated = I2rated / CT2
    const mismatchPct = Math.abs(ct1SecAtRated - ct2SecAtRated) / Math.max(ct1SecAtRated, ct2SecAtRated) * 100

    setResult({
      I1rated: I1rated.toFixed(2), I2rated: I2rated.toFixed(2),
      ct1SecAtRated: ct1SecAtRated.toFixed(3), ct2SecAtRated: ct2SecAtRated.toFixed(3),
      mismatchPct: mismatchPct.toFixed(1),
    })
    addHistory({ tab: 'Transf. Diff', expr: `${KVA}kVA ${V1}/${V2}V`, result: `mismatch ${mismatchPct.toFixed(1)}%` })
  }

  return (
    <div className="px-4 py-3">
      <div className="bg-[#0a1a2e] border border-[#1a3a5a] rounded-xl px-4 py-3 mb-4">
        <div className="text-blue-400 text-xs font-bold mb-1">Transformer Differential Protection</div>
        <div className="text-gray-500 text-xs">CT ratio matching and recommended relay settings</div>
      </div>

      <NumInput label="Transformer Rating" value={kva} onChange={setKva} unit="kVA" placeholder="e.g. 2000" />
      <NumInput label="Primary Voltage" value={v1} onChange={setV1} unit="V" placeholder="e.g. 11000" />
      <NumInput label="Secondary Voltage" value={v2} onChange={setV2} unit="V" placeholder="e.g. 400" />
      <NumInput label="Primary CT Ratio (primary amps)" value={ct1} onChange={setCt1} unit="A" placeholder="e.g. 150" />
      <NumInput label="Secondary CT Ratio (primary amps)" value={ct2} onChange={setCt2} unit="A" placeholder="e.g. 3000" />

      <button onClick={calculate} className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">CALCULATE</button>
      <ErrBox msg={error} />

      {result && <>
        <ResultBox title="RATED CURRENTS" rows={[
          { label: 'Primary Rated Current', value: result.I1rated, unit: 'A' },
          { label: 'Secondary Rated Current', value: result.I2rated, unit: 'A' },
        ]} />
        <ResultBox title="CT SECONDARY CURRENTS AT RATED LOAD" rows={[
          { label: 'Primary-side CT secondary', value: result.ct1SecAtRated, unit: 'A' },
          { label: 'Secondary-side CT secondary', value: result.ct2SecAtRated, unit: 'A' },
          { label: result.mismatchPct <= 10 ? '✓ CT Mismatch' : '⚠ CT Mismatch — high', value: result.mismatchPct, unit: '%', accent: result.mismatchPct <= 10, warn: result.mismatchPct > 10 },
        ]} />
        <div className="bg-[#0f1520] border border-[#1e2a3a] rounded-xl px-4 py-3 text-xs text-gray-500 mb-4">
          <div className="text-blue-400 font-bold mb-2">Typical Setting Starting Points</div>
          <div>• Minimum pickup: 20–30% of rated current (rides through normal CT mismatch, tap-changer range, magnetising inrush)</div>
          <div>• Slope 1: ~25% (low-current region)</div>
          <div>• Slope 2: 60–100% (above knee point, accommodates CT saturation on heavy through-faults)</div>
          <div>• Vector group phase shift (e.g. Dyn11) must be compensated — either internally by the relay or via CT connections</div>
          <div>• These are industry-typical starting points, not a substitute for a relay-specific setting calculation</div>
        </div>
        <GenCardBtn onClick={() => showCard({
          calculator: 'Transformer Differential Protection',
          standard: 'IEC 60076-5 / general differential protection practice',
          inputs: [
            { label: 'Transformer Rating', value: `${kva} kVA` },
            { label: 'Voltages', value: `${v1}/${v2} V` },
            { label: 'Primary CT Ratio', value: `${ct1}/1 A (or /5)` },
            { label: 'Secondary CT Ratio', value: `${ct2}/1 A (or /5)` },
          ],
          sections: [{
            title: 'RESULTS',
            rows: [
              { label: 'Primary Rated Current', value: `${result.I1rated} A` },
              { label: 'Secondary Rated Current', value: `${result.I2rated} A` },
              { label: 'CT Mismatch', value: `${result.mismatchPct}%`, accent: true },
            ],
          }],
          notes: 'Recommended starting points: minimum pickup 20–30% of rated current, Slope 1 ~25%, Slope 2 60–100%. Vector group phase shift must be compensated. Verify final settings against the specific relay\u2019s setting calculation.',
        })} />
      </>}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

// ── Protection Grading Reference Table ───────────────────────────────────────
function ProtectionGrading() {
  const rows = [
    ['Fuse — Fuse', '2:1 minimum current ratio between series fuses for time-based selectivity'],
    ['Relay — Relay (IDMT)', '0.3–0.4s margin at maximum through-fault current (IEC 60255 practice)'],
    ['Relay — Fuse (downstream fuse)', 'Fuse total clearing curve must sit below relay characteristic with margin'],
    ['CB — CB (LV MCCB/ACB)', 'Manufacturer-published selectivity tables preferred over calculation where available'],
    ['Margin components', 'CB interrupting time + relay overshoot (~0.05–0.1s) + safety allowance'],
  ]
  return (
    <div className="px-4 py-3">
      <div className="bg-[#0a1a2e] border border-[#1a3a5a] rounded-xl px-4 py-3 mb-4">
        <div className="text-blue-400 text-xs font-bold mb-1">Protection Grading — Typical Margins</div>
        <div className="text-gray-500 text-xs">General industry starting points — always verify with a full discrimination/coordination study</div>
      </div>
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
        {rows.map(([a, b], i) => (
          <div key={i} className="px-4 py-3 border-b border-[#1a1a1a] last:border-0">
            <div className="text-amber-400 text-xs font-bold mb-1">{a}</div>
            <div className="text-gray-400 text-xs">{b}</div>
          </div>
        ))}
      </div>
      <div className="bg-[#0f1520] border border-[#1e2a3a] rounded-xl px-4 py-3 text-xs text-gray-500 mb-4">
        <div className="text-blue-400 font-bold mb-2">Reference only</div>
        <div>These are commonly cited industry starting points, not fixed rules. A proper protection coordination study accounts for the specific devices, curves, and fault levels on your system.</div>
      </div>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
const SUB_TABS = [
  { id: 'ner',      label: 'NER Size',  icon: '⏚' },
  { id: 'ncrt',     label: 'NCRT',      icon: '◎' },
  { id: 'idmt',     label: 'IDMT',      icon: '⏱' },
  { id: 'ctburden', label: 'CT Burden', icon: '⊙' },
  { id: 'insul',    label: 'PI/DAR',    icon: '𝛀' },
  { id: 'arcflash', label: 'Arc Flash', icon: '⚡' },
  { id: 'diff',     label: 'Transf. Diff', icon: '⇄' },
  { id: 'grading',  label: 'Grading',   icon: '📊' },
  { id: 'coord',    label: 'Coord. Study', icon: '📈' },
]

export default function Protection({ addHistory }) {
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
        {sub === 'ner'      && <NerSizing addHistory={addHistory} />}
        {sub === 'ncrt'     && <NcrtMonitoring />}
        {sub === 'idmt'     && <IdmtCoordination addHistory={addHistory} />}
        {sub === 'ctburden' && <CtBurden addHistory={addHistory} />}
        {sub === 'insul'    && <InsulationResistance addHistory={addHistory} />}
        {sub === 'arcflash' && <ArcFlash addHistory={addHistory} />}
        {sub === 'diff'     && <TransformerDifferential addHistory={addHistory} />}
        {sub === 'grading'  && <ProtectionGrading />}
        {sub === 'coord'    && <ProtectionCoordination addHistory={addHistory} />}
      </div>
    </div>
  )
}
