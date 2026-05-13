import { useState } from 'react'
import { SubTabBar, SelectInput, CalcButton, ResultCard, useResultCard, UnitNumInput, POWER_UNITS, VOLTAGE_UNITS } from './shared'
import { useSite } from './SiteContext'
import ContactorOLR from './ContactorOLR'

const SQRT3 = Math.sqrt(3)
const pf = (v) => parseFloat(String(v).replace(',', '.')) || 0

function NumInput({ label, value, onChange, unit, placeholder = '0' }) {
  return (
    <div className="mb-3">
      {label && <label className="text-gray-400 text-xs mb-1 block">{label}</label>}
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

function ResultRow({ label, value, unit, accent }) {
  return (
    <div className={`flex justify-between items-center px-4 py-3 border-b border-[#1a1a1a] last:border-0 ${accent ? 'bg-[#1a1500]' : ''}`}>
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`font-bold ${accent ? 'text-amber-400 text-lg' : 'text-white'}`}>
        {value} <span className="text-xs font-normal text-gray-500">{unit}</span>
      </span>
    </div>
  )
}

function ResultBox({ title = 'RESULTS', rows }) {
  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
      <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
        <span className="text-amber-400 text-xs font-bold">{title}</span>
      </div>
      {rows.map((r, i) => <ResultRow key={i} {...r} />)}
    </div>
  )
}

function ErrBox({ msg }) {
  return msg ? <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">{msg}</div> : null
}

function InfoBox({ title, color = 'blue', lines }) {
  const colors = { blue: 'bg-[#0a1a2e] border-[#1a3a5a] text-blue-400', amber: 'bg-[#1a1400] border-[#3a2e00] text-amber-400' }
  return (
    <div className={`${colors[color]} border rounded-xl px-4 py-3 mb-4`}>
      <div className="text-xs font-bold mb-1">{title}</div>
      {lines.map((l, i) => <div key={i} className="text-gray-500 text-xs">{l}</div>)}
    </div>
  )
}

// ── FLA ────────────────────────────────────────────────────────────────────
function FlaCalc({ addHistory, onFlaCalculated }) {
  const { site } = useSite()
  const { cardData, showCard, hideCard } = useResultCard()
  const [phase, setPhase] = useState(site.phase || '3ph')
  const [inputType, setInputType] = useState('kw')
  const [kw, setKw] = useState('')
  const [hp, setHp] = useState('')
  const [voltage, setVoltage] = useState(site.defaultLV || '400')
  const [pfVal, setPf] = useState(site.pf || '0.85')
  const [eff, setEff] = useState(site.efficiency || '90')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const calculate = () => {
    setError('')
    const V = pf(voltage), PF = pf(pfVal), EFF = pf(eff) / 100
    const powerW = inputType === 'kw' ? pf(kw) * 1000 : pf(hp) * 745.7
    if (!powerW || !V || !PF || !EFF) { setError('Fill in all fields'); return }
    const inputPower = powerW / EFF
    const fla = phase === '3ph' ? inputPower / (SQRT3 * V * PF) : inputPower / (V * PF)
    const kva = (phase === '3ph' ? SQRT3 * V * fla : V * fla) / 1000
    const kvar = kva * Math.sqrt(1 - PF * PF)
    const ctRatio = Math.ceil(fla * 1.25 / 5) * 5
    const res = { fla: fla.toFixed(2), kva: kva.toFixed(3), kvar: kvar.toFixed(3), inputkW: (inputPower/1000).toFixed(3), startCurrent: (fla*6).toFixed(1), ctRatio }
    setResult(res)
    addHistory({ tab: 'Motor-FLA', expr: `${phase} ${inputType==='kw'?kw+'kW':hp+'HP'} @${V}V`, result: `${res.fla}A` })
    if (onFlaCalculated) onFlaCalculated({ kw: inputType==='kw'?kw:String(pf(hp)*0.7457), voltage: String(V), phase, pfVal: String(PF), eff: String(EFF*100), fla: res.fla })
  }

  return (
    <div className="px-4 py-3">
      <div className="mb-3">
        <label className="text-gray-400 text-xs mb-1 block">Phase</label>
        <div className="flex gap-2">
          {[['1ph','1φ Single'],['3ph','3φ Three']].map(([id,l]) => (
            <button key={id} onClick={() => setPhase(id)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${phase===id?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="mb-3">
        <label className="text-gray-400 text-xs mb-1 block">Power Unit</label>
        <div className="flex gap-2">
          {[['kw','kW'],['hp','HP']].map(([id,l]) => (
            <button key={id} onClick={() => setInputType(id)} className={`flex-1 py-2 rounded-xl text-sm ${inputType===id?'bg-blue-600 text-white':'bg-[#1c1c1c] text-gray-400'}`}>{l}</button>
          ))}
        </div>
      </div>
      {inputType==='kw'
        ? <UnitNumInput label="Motor Output Power" value={kw} onChange={(v, base) => { setKw(v); }} units={POWER_UNITS} />
        : <NumInput label="Motor Output Power" value={hp} onChange={setHp} unit="HP" />}
      <NumInput label={`Supply Voltage ${phase==='3ph'?'(L-L)':'(L-N)'}`} value={voltage} onChange={setVoltage} unit="V" />
      <NumInput label="Power Factor" value={pfVal} onChange={setPf} unit="PF" />
      <NumInput label="Motor Efficiency" value={eff} onChange={setEff} unit="%" />
      <button onClick={calculate} className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">CALCULATE</button>
      <ErrBox msg={error} />
      {result && <>
        <ResultBox rows={[
          { label: 'Full Load Current (FLA)', value: result.fla, unit: 'A', accent: true },
          { label: 'Apparent Power', value: result.kva, unit: 'kVA' },
          { label: 'Reactive Power', value: result.kvar, unit: 'kVAr' },
          { label: 'Input Power (drawn)', value: result.inputkW, unit: 'kW' },
          { label: 'DOL Start Current (×6)', value: result.startCurrent, unit: 'A' },
          { label: 'Suggested CT Ratio', value: `${result.ctRatio}/5`, unit: 'A' },
        ]} />
        <button onClick={() => showCard({
          calculator: 'Motor FLA Calculation',
          standard: 'IEC 60034 / SANS 10142-1',
          site: site.name,
          inputs: [
            { label: 'Motor Power', value: `${inputType==='kw'?kw+' kW':hp+' HP'}` },
            { label: 'Supply Voltage', value: `${voltage} V (${phase})` },
            { label: 'Power Factor', value: pfVal },
            { label: 'Efficiency', value: `${eff}%` },
          ],
          sections: [{
            title: 'RESULTS',
            rows: [
              { label: 'Full Load Current (FLA)', value: `${result.fla} A`, accent: true },
              { label: 'Apparent Power', value: `${result.kva} kVA` },
              { label: 'Reactive Power', value: `${result.kvar} kVAr` },
              { label: 'Input Power', value: `${result.inputkW} kW` },
              { label: 'DOL Starting Current', value: `${result.startCurrent} A` },
              { label: 'Suggested CT Ratio', value: `${result.ctRatio}/5 A` },
            ]
          }],
          notes: 'FLA is the continuous rated current. Use for cable sizing, contactor selection (Q), and overload relay setting (F).'
        })}
          className="w-full bg-[#1a1a2e] border border-[#2a2a5a] text-blue-300 font-bold py-3 rounded-xl text-sm mb-4">
          📄 Generate Result Card
        </button>
      </>}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

// ── NewElec 327M ───────────────────────────────────────────────────────────
function NewElec327M() {
  const [fla, setFla] = useState('')
  const [ctP, setCtP] = useState('')
  const [starts, setStarts] = useState('4')
  const [startTime, setStartTime] = useState('10')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const calculate = () => {
    setError('')
    const FLA = pf(fla), CT = pf(ctP)
    if (!FLA || !CT) { setError('Enter FLA and CT primary'); return }
    if (FLA > CT) { setError('FLA cannot exceed CT primary rating'); return }
    const loadRatio = (FLA / CT) * 100
    const maxLoadSetting = Math.min(loadRatio * 1.10, 100)
    const ST = pf(startTime)
    let mult, dial
    if (ST <= 20) { mult = '×1'; dial = ST }
    else { mult = '×4'; dial = (ST / 4).toFixed(1) }
    setResult({ loadRatio: loadRatio.toFixed(1), maxLoadSetting: maxLoadSetting.toFixed(1), maxStarts: Math.min(Math.max(pf(starts),1),20), dial, mult, ct: `${CT}/5` })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="NewElec 327M — Motor Protection Monitor" lines={['4 dial settings: Max Load, Max Unbalance, Max Starts/hr, Start Time', 'CT ratio label on top-right of relay must match installed CT']} />
      <NumInput label="Motor FLA" value={fla} onChange={setFla} unit="A" />
      <NumInput label="CT Primary Rating" value={ctP} onChange={setCtP} unit="A" placeholder="e.g. 100" />
      <NumInput label="Max Starts Per Hour" value={starts} onChange={setStarts} unit="starts" placeholder="4" />
      <NumInput label="Motor Start Time (DOL)" value={startTime} onChange={setStartTime} unit="s" placeholder="10" />
      <button onClick={calculate} className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">CALCULATE SETTINGS</button>
      <ErrBox msg={error} />
      {result && <>
        <ResultBox rows={[
          { label: 'CT Ratio', value: result.ct, unit: '' },
          { label: 'FLA as % of CT', value: result.loadRatio, unit: '%' },
          { label: '➤ MAX LOAD dial', value: result.maxLoadSetting, unit: '%', accent: true },
          { label: '➤ MAX UNBALANCE dial', value: '15', unit: '%', accent: true },
          { label: '➤ MAX STARTS/HOUR dial', value: result.maxStarts, unit: 'starts', accent: true },
          { label: `➤ START TIME dial (${result.mult})`, value: result.dial, unit: `s ${result.mult}`, accent: true },
        ]} />
        <InfoBox title="Setting Notes" color="amber" lines={[
          '• Max Load = FLA ÷ CT × 100 + 10% margin',
          '• Unbalance 15% standard — reduce to 10% for sensitive loads',
          '• Start time: ×1 range for <20s, ×4 for longer',
          '• Overload trips when motor runs above Max Load setting',
        ]} />
      </>}
    </div>
  )
}

// ── EPC MS1 ────────────────────────────────────────────────────────────────
function EpcMs1() {
  const [voltage, setVoltage] = useState('400')
  const [earthRes, setEarthRes] = useState('')
  const [cableLen, setCableLen] = useState('')
  const [sensitivity, setSensitivity] = useState('250')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const MS1_SETTINGS = [30, 50, 100, 150, 200, 250, 300, 400, 500]

  const calculate = () => {
    setError('')
    const V = pf(voltage)
    if (!V) { setError('Enter system voltage'); return }
    const Vln = V / SQRT3
    const RE = pf(earthRes)
    const L = pf(cableLen)
    const minFault = RE > 0 ? (Vln / RE * 1000).toFixed(0) : null
    const C = L > 0 ? 0.4e-6 * (L / 1000) : 0
    const capLeakage = L > 0 ? (V * 2 * Math.PI * 50 * C * 1000).toFixed(1) : null
    const settingMa = pf(sensitivity)
    const recommended = MS1_SETTINGS.find(s => s >= settingMa) || 500
    setResult({ Vln: Vln.toFixed(1), minFault, capLeakage, settingMa: recommended, instantaneous: Math.min(recommended * 4, 500) })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="EPC MS1 — Sensitive Core Balance Relay" lines={['Setting range: 30mA – 500mA', 'Left dial = I∆n sensitivity | Right dial = Instantaneous trip']} />
      <NumInput label="System Voltage (L-L)" value={voltage} onChange={setVoltage} unit="V" />
      <NumInput label="Earth Fault Path Resistance (optional)" value={earthRes} onChange={setEarthRes} unit="Ω" placeholder="leave blank if unknown" />
      <NumInput label="Protected Cable Length (optional)" value={cableLen} onChange={setCableLen} unit="m" placeholder="for leakage estimate" />
      <div className="mb-4">
        <label className="text-gray-400 text-xs mb-2 block">Desired Sensitivity (mA)</label>
        <div className="flex flex-wrap gap-2">
          {MS1_SETTINGS.map(s => (
            <button key={s} onClick={() => setSensitivity(String(s))}
              className={`px-3 py-2 rounded-xl text-sm font-medium ${sensitivity===String(s)?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>
              {s}mA
            </button>
          ))}
        </div>
      </div>
      <button onClick={calculate} className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">CALCULATE</button>
      <ErrBox msg={error} />
      {result && <>
        <ResultBox rows={[
          { label: 'Phase-to-Neutral Voltage', value: result.Vln, unit: 'V' },
          ...(result.minFault ? [{ label: 'Min Earth Fault Current', value: result.minFault, unit: 'mA' }] : []),
          ...(result.capLeakage ? [{ label: 'Capacitive Leakage (est.)', value: result.capLeakage, unit: 'mA' }] : []),
          { label: '➤ I∆n Setting (left dial)', value: result.settingMa, unit: 'mA', accent: true },
          { label: '➤ Instantaneous (right dial)', value: result.instantaneous, unit: 'mA', accent: true },
        ]} />
        <InfoBox title="Core Balance Relay Setting Notes" color="amber" lines={[
          '• Setting must be above normal leakage to avoid nuisance trips',
          '• Instantaneous = 2–4× the I∆n setting',
          '• LV typical: 250–500mA | Sensitive circuits: 30–100mA',
          '• SANS 10142 requires earth fault protection on all circuits',
        ]} />
      </>}
    </div>
  )
}

// ── Contactor ──────────────────────────────────────────────────────────────
const CONTACTOR_TABLE = [
  [0.37,'A9',9],[0.75,'A9',9],[1.5,'A9',9],[2.2,'A12',12],[3,'A16',16],
  [4,'A16',16],[5.5,'A26',26],[7.5,'A30',30],[11,'A40',40],[15,'A50',50],
  [18.5,'A63',63],[22,'A75',75],[30,'A95',95],[37,'A110',110],[45,'A145',145],
  [55,'A145',145],[75,'A185',185],[90,'A210',210],[110,'A260',260],[132,'A300',300],
  [160,'A370',370],[200,'A400',400],[250,'A500',500],[315,'A630',630],
]

function ContactorCalc({ addHistory }) {
  const [kw, setKw] = useState('')
  const [voltage, setVoltage] = useState('400')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const calculate = () => {
    setError('')
    const KW = pf(kw), V = pf(voltage)
    if (!KW) { setError('Enter motor power'); return }
    const scaledKw = KW * (400 / (V || 400))
    const row = CONTACTOR_TABLE.find(r => r[0] >= scaledKw) || CONTACTOR_TABLE[CONTACTOR_TABLE.length-1]
    const fla = (KW * 1000) / (SQRT3 * V * 0.85)
    setResult({ size: row[1], current: row[2], fla: fla.toFixed(1) })
    addHistory({ tab: 'Contactor', expr: `${KW}kW @${V}V`, result: row[1] })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="AC3 Contactor Sizing — IEC 60947-4" lines={['For direct-online (DOL) squirrel cage motor starting', 'ABB A-series reference sizing']} />
      <NumInput label="Motor Power" value={kw} onChange={setKw} unit="kW" />
      <NumInput label="Supply Voltage (L-L)" value={voltage} onChange={setVoltage} unit="V" />
      <button onClick={calculate} className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">SELECT CONTACTOR</button>
      <ErrBox msg={error} />
      {result && <ResultBox rows={[
        { label: 'Contactor Frame (AC3)', value: result.size, unit: '', accent: true },
        { label: 'Rated Current', value: result.current, unit: 'A' },
        { label: 'Est. Motor FLA (PF=0.85)', value: result.fla, unit: 'A' },
      ]} />}
    </div>
  )
}

// ── Overload ───────────────────────────────────────────────────────────────
function OverloadCalc({ addHistory }) {
  const [fla, setFla] = useState('')
  const [relayClass, setRelayClass] = useState('10')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const calculate = () => {
    setError('')
    const FLA = pf(fla)
    if (!FLA) { setError('Enter FLA'); return }
    const setting = (FLA * 1.05).toFixed(2)
    setResult({ min: (FLA*0.95).toFixed(2), max: (FLA*1.15).toFixed(2), setting, fla: FLA.toFixed(2) })
    addHistory({ tab: 'Overload', expr: `FLA=${FLA}A Class${relayClass}`, result: `Set ${setting}A` })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Thermal Overload Relay Setting" lines={['Class 10 = standard | Class 20 = high inertia | Class 30 = very high inertia']} />
      <NumInput label="Motor FLA" value={fla} onChange={setFla} unit="A" />
      <div className="mb-4">
        <label className="text-gray-400 text-xs mb-2 block">Trip Class</label>
        <div className="flex gap-2">
          {[['10','Class 10'],['20','Class 20'],['30','Class 30']].map(([id,l]) => (
            <button key={id} onClick={() => setRelayClass(id)} className={`flex-1 py-2 rounded-xl text-sm ${relayClass===id?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>{l}</button>
          ))}
        </div>
      </div>
      <button onClick={calculate} className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">CALCULATE</button>
      <ErrBox msg={error} />
      {result && <>
        <ResultBox rows={[
          { label: 'Min Setting (95% FLA)', value: result.min, unit: 'A' },
          { label: '➤ Recommended Setting', value: result.setting, unit: 'A', accent: true },
          { label: 'Max Setting (115% FLA)', value: result.max, unit: 'A' },
        ]} />
        <InfoBox title={`Class ${relayClass} Trip Time`} color="amber" lines={[
          relayClass==='10' ? 'Trips <10s at 7.2× | Standard motors' : relayClass==='20' ? 'Trips <20s at 7.2× | Fans, conveyors' : 'Trips <30s at 7.2× | Large pumps, compressors',
          'Set 100–105% of FLA. Never exceed 115%.',
        ]} />
      </>}
    </div>
  )
}

// ── Breaker ────────────────────────────────────────────────────────────────
const MCCB_TRIPS = [6,10,16,20,25,32,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600]

function BreakerCalc({ addHistory, flaSnapshot }) {
  const snap = flaSnapshot || {}
  const [fla, setFla] = useState(snap.fla || '')
  const [startFactor, setStartFactor] = useState('6')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const calculate = () => {
    setError('')
    const FLA = pf(fla)
    if (!FLA) { setError('Enter FLA'); return }
    const minRating = FLA * 1.25
    const tripRating = MCCB_TRIPS.find(t => t >= minRating) || 1600
    const SF = pf(startFactor) || 6
    setResult({ tripRating, minRating: minRating.toFixed(1), magMin: (FLA*SF*1.2).toFixed(0), magMax: (FLA*SF*1.5).toFixed(0) })
    addHistory({ tab: 'Breaker', expr: `FLA=${FLA}A`, result: `${tripRating}A` })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="MCCB / MCB Sizing — Motor Branch Circuit" lines={['Per IEC 60947-2 / NRS 097', 'Rating ≥ FLA × 1.25 for motor circuits']} />
      <NumInput label="Motor FLA" value={fla} onChange={setFla} unit="A" />
      <NumInput label="Start Factor (DOL=6, Star-Delta=2, Softstarter=3)" value={startFactor} onChange={setStartFactor} unit="×" placeholder="6" />
      <button onClick={calculate} className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">SELECT BREAKER</button>
      <ErrBox msg={error} />
      {result && <>
        <ResultBox rows={[
          { label: 'Minimum Rating', value: result.minRating, unit: 'A' },
          { label: '➤ MCCB Trip Rating', value: result.tripRating, unit: 'A', accent: true },
          { label: 'Magnetic Setting Range', value: `${result.magMin}–${result.magMax}`, unit: 'A' },
        ]} />
        <InfoBox title="Notes" color="amber" lines={[
          '• Magnetic setting must not trip during normal starting',
          '• For DOL: magnetic ≥ start current × 1.2',
          '• Verify breaking capacity against site fault level',
        ]} />
      </>}
    </div>
  )
}

// ── MAIN ───────────────────────────────────────────────────────────────────
const MOTOR_TABS = [
  { id: 'fla',       label: 'FLA',      icon: '⚡' },
  { id: 'qf',        label: 'Q+F+K',    icon: '⊕' },
  { id: 'breaker',   label: 'Breaker',  icon: '⊞' },
  { id: 'newelec',   label: 'MPM Relay',icon: '🔧' },
  { id: 'epc',       label: 'CBR Relay',icon: '🛡' },
  { id: 'reaccel',   label: 'V-Dip',    icon: '📉' },
  { id: 'ie',        label: 'IE Class', icon: '♻' },
]

export default function MotorCalculator({ addHistory }) {
  const [sub, setSub] = useState('fla')
  const [flaSnapshot, setFlaSnapshot] = useState(null)

  const onFlaCalculated = (snapshot) => setFlaSnapshot(snapshot)

  const map = {
    fla:     <FlaCalc addHistory={addHistory} onFlaCalculated={onFlaCalculated} />,
    qf:      <ContactorOLR addHistory={addHistory} flaSnapshot={flaSnapshot} />,
    breaker: <BreakerCalc addHistory={addHistory} flaSnapshot={flaSnapshot} />,
    newelec: <NewElec327M />,
    epc:     <EpcMs1 />,
    reaccel: <Reacceleration addHistory={addHistory} />,
    ie:      <IeComparison addHistory={addHistory} />,
  }
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SubTabBar tabs={MOTOR_TABS} active={sub} onChange={setSub} />
      <div className="flex-1 overflow-y-auto">{map[sub]}</div>
    </div>
  )
}

// ── Motor Reacceleration / Voltage Dip ────────────────────────────────────
function Reacceleration({ addHistory }) {
  const [motorKW,setMotorKW]=useState(''),[voltage,setVoltage]=useState('400')
  const [xfmrKVA,setXfmrKVA]=useState(''),[pfVal,setPf]=useState('0.85')
  const [eff,setEff]=useState('90'),[result,setResult]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    const KW=pf(motorKW),V=pf(voltage),KVA=pf(xfmrKVA),PF=pf(pfVal),EFF=pf(eff)/100
    if(!KW||!V||!KVA){setError('Enter motor kW, voltage, and transformer kVA');return}
    const inputPower=KW/EFF
    const fla=inputPower*1000/(SQRT3*V*PF)
    const startI=fla*6  // DOL starting current
    const startKVA=(SQRT3*V*startI)/1000
    // Transformer impedance (typical 5–6% for distribution transformers)
    const Zt=0.055  // 5.5% typical
    const Zs=V*V/(KVA*1000)  // source impedance
    const Zxfmr=Zt*V*V/(KVA*1000)
    // Voltage dip = (starting kVA) / (transformer kVA) × Zt × 100%
    const voltageDip=(startKVA/KVA)*Zt*100
    const voltageAtStart=V*(1-voltageDip/100)
    // Available torque reduces as V²
    const torqueReduction=(voltageAtStart/V)**2*100
    // Check if motor will start (needs >60% torque for typical loads)
    const willStart=torqueReduction>=60
    setResult({fla:fla.toFixed(1),startI:startI.toFixed(1),startKVA:startKVA.toFixed(1),voltageDip:voltageDip.toFixed(1),voltageAtStart:voltageAtStart.toFixed(1),torqueReduction:torqueReduction.toFixed(1),willStart})
    addHistory({tab:'Reaccel',expr:`${KW}kW @ ${KVA}kVA xfmr`,result:`Dip=${voltageDip.toFixed(1)}%`})
  }

  return(
    <div className="px-4 py-3">
      <InfoBox title="Motor Starting Voltage Dip" lines={['Calculates voltage depression during DOL motor starting','Critical for large motors on weak transformers or at Letseng altitude']}/>
      <NumInput label="Motor Power" value={motorKW} onChange={setMotorKW} unit="kW"/>
      <NumInput label="Supply Voltage (L-L)" value={voltage} onChange={setVoltage} unit="V"/>
      <NumInput label="Transformer Rating" value={xfmrKVA} onChange={setXfmrKVA} unit="kVA"/>
      <NumInput label="Motor Power Factor" value={pfVal} onChange={setPf} unit="PF"/>
      <NumInput label="Motor Efficiency" value={eff} onChange={setEff} unit="%"/>
      <CalcButton onClick={calculate} label="CALCULATE VOLTAGE DIP"/>
      <ErrBox msg={error}/>
      {result&&<>
        <ResultBox rows={[
          {label:'Motor FLA',value:result.fla,unit:'A'},
          {label:'DOL Starting Current',value:result.startI,unit:'A'},
          {label:'Starting kVA Demand',value:result.startKVA,unit:'kVA'},
          {label:'Voltage Dip',value:`${result.voltageDip}%`,unit:'',accent:true,warn:pf(result.voltageDip)>15},
          {label:'Voltage During Start',value:result.voltageAtStart,unit:'V'},
          {label:'Available Torque at Start',value:`${result.torqueReduction}%`,unit:'(of rated)',accent:result.willStart,warn:!result.willStart},
          {label:'Motor Will Start',value:result.willStart?'✓ YES (torque >60%)':'✗ MARGINAL — consider soft-starter or VFD',unit:'',accent:result.willStart,warn:!result.willStart},
        ]}/>
        <InfoBox color={pf(result.voltageDip)>15?'red':'amber'} title="Voltage Dip Guidelines" lines={[
          '• <5% : Excellent — no issues expected',
          '• 5–15% : Acceptable for most installations',
          '• 15–25% : May cause other equipment to trip or dim lights',
          '• >25% : Likely to cause problems — use soft starter or VFD',
          '• At Letseng altitude, derated transformers worsen this effect',
        ]}/>
      </>}
    </div>
  )
}

// ── IE Motor Efficiency Comparison ────────────────────────────────────────
function IeComparison({ addHistory }) {
  const [kw,setKw]=useState(''),[hoursPerYear,setHours]=useState('4000'),[tariff,setTariff]=useState('2.50')
  const [currency,setCurrency]=useState('ZAR'),[result,setResult]=useState(null),[error,setError]=useState('')

  // IE efficiency levels (IEC 60034-30-1) — approximate for 3ph 50Hz at rated load
  const IE_EFF = {
    'IE1': {0.75:72.1,1.1:75.0,1.5:77.2,2.2:79.7,3:81.5,4:83.1,5.5:84.7,7.5:86.0,11:87.6,15:88.7,18.5:89.3,22:89.9,30:90.7,37:91.2,45:91.7,55:92.1,75:92.8,90:93.1,110:93.5,132:93.8,160:94.0,200:94.2},
    'IE2': {0.75:77.4,1.1:79.6,1.5:81.3,2.2:83.2,3:84.6,4:85.8,5.5:87.0,7.5:88.1,11:89.4,15:90.3,18.5:90.9,22:91.3,30:92.0,37:92.5,45:92.9,55:93.2,75:93.8,90:94.1,110:94.4,132:94.7,160:94.9,200:95.1},
    'IE3': {0.75:80.7,1.1:82.7,1.5:84.2,2.2:85.9,3:87.1,4:88.1,5.5:89.2,7.5:90.1,11:91.2,15:91.9,18.5:92.4,22:92.7,30:93.3,37:93.7,45:94.0,55:94.3,75:94.7,90:95.0,110:95.2,132:95.4,160:95.6,200:95.8},
    'IE4': {0.75:82.5,1.1:84.5,1.5:85.9,2.2:87.4,3:88.5,4:89.4,5.5:90.3,7.5:91.0,11:92.0,15:92.7,18.5:93.1,22:93.4,30:94.0,37:94.4,45:94.7,55:95.0,75:95.4,90:95.6,110:95.8,132:96.0,160:96.2,200:96.4},
  }

  const findEff=(level,kw)=>{
    const sizes=Object.keys(IE_EFF[level]).map(Number).sort((a,b)=>a-b)
    const closest=sizes.reduce((prev,curr)=>Math.abs(curr-kw)<Math.abs(prev-kw)?curr:prev)
    return IE_EFF[level][closest]
  }

  const calculate=()=>{
    setError('')
    const KW=pf(kw),H=pf(hoursPerYear),T=pf(tariff)
    if(!KW||!H||!T){setError('Enter motor kW, operating hours, and tariff');return}
    const levels=['IE1','IE2','IE3','IE4']
    const results=levels.map(level=>{
      const eff=findEff(level,KW)/100
      const inputKW=KW/eff
      const annualKWh=inputKW*H
      const annualCost=annualKWh*T
      return{level,eff:(eff*100).toFixed(1),inputKW:inputKW.toFixed(2),annualKWh:annualKWh.toFixed(0),annualCost:annualCost.toFixed(2)}
    })
    const ie1Cost=pf(results[0].annualCost)
    const savings=results.map(r=>({...r,saving:(ie1Cost-pf(r.annualCost)).toFixed(2)}))
    setResult(savings)
    addHistory({tab:'IE Compare',expr:`${KW}kW ${H}h/yr`,result:`IE3 saves ${savings[2].saving} ${currency}/yr`})
  }

  return(
    <div className="px-4 py-3">
      <InfoBox title="Motor Efficiency Class Comparison — IEC 60034-30-1" lines={['Compare annual energy cost for IE1 to IE4 motors','Useful for procurement decisions and motor replacement justification']}/>
      <NumInput label="Motor Power" value={kw} onChange={setKw} unit="kW"/>
      <NumInput label="Annual Operating Hours" value={hoursPerYear} onChange={setHours} unit="h/yr" placeholder="4000"/>
      <NumInput label="Electricity Tariff" value={tariff} onChange={setTariff} unit="/kWh" placeholder="2.50"/>
      <SelectInput label="Currency" value={currency} onChange={setCurrency} options={[['ZAR','ZAR'],['LSL','LSL'],['USD','USD'],['EUR','EUR']]}/>
      <CalcButton onClick={calculate} label="COMPARE EFFICIENCY CLASSES"/>
      <ErrBox msg={error}/>
      {result&&<>
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
          <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]"><span className="text-amber-400 text-xs font-bold">ANNUAL ENERGY COMPARISON</span></div>
          <div className="grid grid-cols-4 text-[10px] text-gray-500 font-bold px-4 py-2 border-b border-[#1a1a1a]"><span>CLASS</span><span>EFF%</span><span>kWh/yr</span><span>SAVING/yr</span></div>
          {result.map((r,i)=>(
            <div key={r.level} className={`grid grid-cols-4 px-4 py-2.5 border-b border-[#1a1a1a] last:border-0 text-sm ${i===2?'bg-[#001a00]':''}`}>
              <span className={`font-bold ${i===0?'text-red-400':i===1?'text-orange-400':i===2?'text-green-400':'text-blue-400'}`}>{r.level}</span>
              <span className="text-white">{r.eff}%</span>
              <span className="text-gray-300">{parseInt(r.annualKWh).toLocaleString()}</span>
              <span className={`font-bold ${pf(r.saving)>0?'text-green-400':i===0?'text-gray-500':'text-red-400'}`}>{i===0?'—':`+${currency}${pf(r.saving).toLocaleString()}`}</span>
            </div>
          ))}
        </div>
        <InfoBox color="green" title="Recommendation" lines={[`IE3 is minimum standard for new motors (EU regulation, increasingly adopted in SA)`,`IE4 worth considering for motors running >4000h/yr or >30kW`,`Payback period = extra capital cost ÷ annual saving`]}/>
      </>}
    </div>
  )
}
