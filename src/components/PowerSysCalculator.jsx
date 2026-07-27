import GeneratorSizingPro from './GeneratorSizing'
import React, { useState } from 'react'
import { useSite } from './SiteContext'
import { transformerParameters, pfCorrection, busbarRating, motorStartingComparison } from './powerSysEngine'
import { ResultCard, useResultCard } from './shared'

// ── Tab merge note (this session) ──────────────────────────────────────────
// Previously two separate tabs: 'generator' (a basic single-number calc,
// defined locally below as GeneratorSizing()) and 'gensize'/'Gen Sizing'
// (GeneratorSizingPro, imported from ./GeneratorSizing — a full load-schedule
// → generator → transformer → fault-level chain). Both were confirmed as
// genuinely different workflows, not duplicates, but sharing near-identical
// names ("Generator" vs "Gen Sizing") caused real confusion about what fed
// what and which one to use. Resolved by merging into one 'generator' tab
// whose component internally offers a labeled choice — "Known Load Sizing"
// vs "Load Schedule Sizing" — so the distinction is explicit on-screen
// rather than implied by two similarly-named tabs. See GeneratorSizing.jsx
// for the merged implementation. The local GeneratorSizing() function below
// is now dead code and has been removed per [DES-6] (design for deletion) —
// its logic was migrated into GeneratorSizing.jsx's "Known Load Sizing" pane,
// now reusing the shared GEN_SIZES standard-sizes list instead of a second
// hardcoded copy (previously duplicated per [DEC-3] — now consolidated).
const TABS = [
  { id: 'transformer', label: 'Transformer' },
  { id: 'pf',          label: 'PF Correct'  },
  { id: 'generator',   label: 'Generator'   },
  { id: 'busbar',      label: 'Busbar'      },
  { id: 'starting',    label: 'Starting'    },
]

const Field = ({ label, unit, value, onChange, hint }) => (
  <div className="mb-3">
    <label className="block text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>
      {label}{unit ? ` (${unit})` : ''}
    </label>
    <input
      type="text" inputMode="decimal" step="any"
      value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2.5 rounded-xl text-white text-sm"
      style={{ backgroundColor: '#111', border: '1px solid #2a2a2a' }}
    />
    {hint && <div className="text-xs mt-1" style={{ color: '#4b5563' }}>{hint}</div>}
  </div>
)

const ResultRow = ({ label, value, unit, highlight }) => (
  <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid #1a1a1a' }}>
    <span className="text-xs" style={{ color: '#9ca3af' }}>{label}</span>
    <span className="text-sm font-bold font-mono" style={{ color: highlight ? '#f59e0b' : '#e5e7eb' }}>
      {value} {unit}
    </span>
  </div>
)

const CalcBtn = ({ onCalc }) => (
  <button onClick={onCalc}
    className="w-full py-3 rounded-xl font-bold text-sm mt-2 mb-4"
    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000' }}>
    Calculate
  </button>
)

// ── Transformer ──────────────────────────────────────────────────────────────
function TransformerCalc() {
  const { site } = useSite()
  const [kva, setKva]   = useState('1000')
  const [vpri, setVpri] = useState('11000')
  const [vsec, setVsec] = useState(String(site.defaultLV || '400'))
  const [zpc, setZpc]   = useState('6')      // impedance %
  const [pf, setPf]     = useState('0.85')
  const [eff, setEff]   = useState('98')
  const [res, setRes]   = useState(null)
  const { cardData, showCard, hideCard } = useResultCard()

  const calc = () => {
    setRes(null)
    const r = transformerParameters({ kva, vpri, vsec, zpc, pf, eff })
    if (!r) return
    setRes({
      ratio: r.ratio.toFixed(2),
      Ipri:  r.Ipri.toFixed(1),
      Isec:  r.Isec.toFixed(1),
      Isc3:  r.Isc3.toFixed(2),
      Isc1:  r.Isc1.toFixed(2),
      Ploss: r.Ploss.toFixed(2),
    })
  }

  const handleResultCard = () => {
    if (!res) return
    showCard({
      calculator: 'Power Systems — Transformer Parameters',
      standard: 'IEC 60076',
      site: site.name,
      inputs: [
        { label: 'Transformer Rating', value: `${kva} kVA` }, { label: 'Primary Voltage', value: `${vpri} V` },
        { label: 'Secondary Voltage', value: `${vsec} V` }, { label: 'Impedance', value: `${zpc}%` },
        { label: 'Load Power Factor', value: pf }, { label: 'Efficiency', value: `${eff}%` },
      ],
      sections: [{
        title: 'RESULTS',
        rows: [
          { label: 'Turns Ratio', value: `${res.ratio}:1` },
          { label: 'Primary FLC', value: `${res.Ipri} A` },
          { label: 'Secondary FLC', value: `${res.Isec} A`, accent: true },
          { label: '3-Phase Fault (LV side)', value: `${res.Isc3} kA`, accent: true },
          { label: '1-Phase Fault (LV side)', value: `${res.Isc1} kA` },
          { label: 'Transformer Losses', value: `${res.Ploss} kW` },
        ]
      }],
      notes: 'Simplified model — fault current derived from nameplate %Z only, no grid infeed or 1.05 voltage factor (IEC 60909 Clause 8). Use for initial breaker/fuse kA rating only.',
    })
  }

  return (
    <div>
      <Field label="Transformer Rating" unit="kVA" value={kva} onChange={setKva} />
      <Field label="Primary Voltage" unit="V" value={vpri} onChange={setVpri} />
      <Field label="Secondary Voltage" unit="V" value={vsec} onChange={setVsec} />
      <Field label="Impedance" unit="%" value={zpc} onChange={setZpc} hint="Typical distribution: 4–6 %" />
      <Field label="Load Power Factor" value={pf} onChange={setPf} />
      <Field label="Efficiency" unit="%" value={eff} onChange={setEff} hint="Modern distribution: 97–99 %" />
      <CalcBtn onCalc={calc} />
      {res && (
        <div className="rounded-xl p-3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}>
          <ResultRow label="Turns Ratio"             value={res.ratio} unit=":1" />
          <ResultRow label="Primary FLC"             value={res.Ipri}  unit="A" />
          <ResultRow label="Secondary FLC"           value={res.Isec}  unit="A" highlight />
          <ResultRow label="3-Phase Fault (LV side)" value={res.Isc3}  unit="kA" highlight />
          <ResultRow label="1-Phase Fault (LV side)" value={res.Isc1}  unit="kA" />
          <ResultRow label="Transformer Losses"      value={res.Ploss} unit="kW" />
        </div>
      )}
      {res && (
        <button onClick={handleResultCard} className="w-full py-3 rounded-xl font-bold text-sm mt-3" style={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a5a', color: '#93c5fd' }}>
          📄 Generate Result Card
        </button>
      )}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

// ── Power Factor Correction ──────────────────────────────────────────────────
function PFCorrection() {
  const { site } = useSite()
  const [kw, setKw]     = useState('500')
  const [pf1, setPf1]   = useState('0.75')
  const [pf2, setPf2]   = useState('0.95')
  const [vv, setVv]     = useState(String(site.defaultLV || '400'))
  const [res, setRes]   = useState(null)
  const { cardData, showCard, hideCard } = useResultCard()

  const calc = () => {
    setRes(null)
    const r = pfCorrection({ kw, pf1, pf2, vv })
    if (!r) return
    setRes({
      Qc:     r.Qc.toFixed(1),
      bank:   r.bank,
      Ic:     r.Ic.toFixed(1),
      Ibefore: r.Ibefore.toFixed(1),
      Iafter:  r.Iafter.toFixed(1),
      saving: r.saving.toFixed(1),
    })
  }

  const handleResultCard = () => {
    if (!res) return
    showCard({
      calculator: 'Power Systems — Power Factor Correction',
      standard: 'IEEE 519 (harmonics-neutral, fundamental PF only)',
      site: site.name,
      inputs: [
        { label: 'Active Power Load', value: `${kw} kW` }, { label: 'Existing Power Factor', value: pf1 },
        { label: 'Target Power Factor', value: pf2 }, { label: 'System Voltage', value: `${vv} V` },
      ],
      sections: [{
        title: 'RESULTS',
        rows: [
          { label: 'Reactive Power Required', value: `${res.Qc} kVAr`, accent: true },
          { label: 'Standard Bank Size', value: `${res.bank} kVAr`, accent: true },
          { label: 'Capacitor Current', value: `${res.Ic} A` },
          { label: 'Current Before', value: `${res.Ibefore} A` },
          { label: 'Current After', value: `${res.Iafter} A` },
          { label: 'Current Reduction', value: `${res.saving}%` },
        ]
      }],
      notes: 'Sizing based on fundamental power factor only — if significant harmonic distortion is present, confirm capacitor bank resonance risk against IEEE 519 before installation (capacitor banks can amplify harmonic currents at resonant frequencies).',
    })
  }

  return (
    <div>
      <Field label="Active Power Load" unit="kW" value={kw} onChange={setKw} />
      <Field label="Existing Power Factor" value={pf1} onChange={setPf1} hint="e.g. 0.75" />
      <Field label="Target Power Factor" value={pf2} onChange={setPf2} hint="Typical target: 0.95–0.98" />
      <Field label="System Voltage" unit="V" value={vv} onChange={setVv} />
      <CalcBtn onCalc={calc} />
      {res && (
        <div className="rounded-xl p-3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}>
          <ResultRow label="Reactive Power Required" value={res.Qc}     unit="kVAr" highlight />
          <ResultRow label="Standard Bank Size"      value={res.bank}   unit="kVAr" highlight />
          <ResultRow label="Capacitor Current"       value={res.Ic}     unit="A" />
          <ResultRow label="Current Before"          value={res.Ibefore} unit="A" />
          <ResultRow label="Current After"           value={res.Iafter}  unit="A" />
          <ResultRow label="Current Reduction"       value={res.saving}  unit="%" />
        </div>
      )}
      {res && (
        <button onClick={handleResultCard} className="w-full py-3 rounded-xl font-bold text-sm mt-3" style={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a5a', color: '#93c5fd' }}>
          📄 Generate Result Card
        </button>
      )}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

// ── Busbar Rating ─────────────────────────────────────────────────────────────
function BusbarRating() {
  const { site } = useSite()
  const [mat, setMat]   = useState('cu')
  const [w, setW]       = useState('50')      // width mm
  const [thick, setThick] = useState('5')     // thickness mm
  const [bars, setBars] = useState('1')       // bars per phase
  const [temp, setTemp] = useState(String(site.ambient || '30'))      // ambient °C
  const [res, setRes]   = useState(null)
  const { cardData, showCard, hideCard } = useResultCard()

  const calc = () => {
    setRes(null)
    const r = busbarRating({ mat, w, thick, bars, temp })
    if (!r) return
    setRes({
      area: r.area.toFixed(0),
      I:    r.I.toFixed(0),
      Isc:  r.Isc.toFixed(1),
      R:    r.R.toFixed(3),
    })
  }

  const handleResultCard = () => {
    if (!res) return
    showCard({
      calculator: 'Power Systems — Busbar Rating',
      standard: 'Current density method (Cu ≈2.0 A/mm², Al ≈1.3 A/mm², conservative)',
      site: site.name,
      inputs: [
        { label: 'Material', value: mat === 'cu' ? 'Copper' : 'Aluminium' }, { label: 'Busbar Width', value: `${w} mm` },
        { label: 'Busbar Thickness', value: `${thick} mm` }, { label: 'Bars per Phase', value: bars },
        { label: 'Ambient Temperature', value: `${temp}°C` },
      ],
      sections: [{
        title: 'RESULTS',
        rows: [
          { label: 'Total Cross Section', value: `${res.area} mm²` },
          { label: 'Continuous Current', value: `${res.I} A`, accent: true },
          { label: 'Fault Rating (1 s)', value: `${res.Isc} kA`, accent: true },
          { label: 'DC Resistance', value: `${res.R} mΩ/m` },
        ]
      }],
      notes: 'Current density method is a conservative planning-level estimate, not a substitute for manufacturer-tested temperature-rise ratings. Confirm against actual busbar system datasheets for the final installation, especially in enclosed switchgear.',
    })
  }

  return (
    <div>
      <div className="mb-3">
        <label className="block text-xs font-bold mb-2" style={{ color: '#9ca3af' }}>Material</label>
        <div className="flex gap-2">
          {[['cu','Copper'],['al','Aluminium']].map(([k,l]) => (
            <button key={k} onClick={() => setMat(k)}
              className="flex-1 py-2 rounded-xl text-xs font-bold"
              style={{
                backgroundColor: mat === k ? '#1a0f00' : '#111',
                border: `1px solid ${mat === k ? '#f59e0b' : '#2a2a2a'}`,
                color: mat === k ? '#f59e0b' : '#9ca3af',
              }}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <Field label="Busbar Width" unit="mm" value={w} onChange={setW} hint="Common: 25, 32, 40, 50, 63, 80, 100 mm" />
      <Field label="Busbar Thickness" unit="mm" value={thick} onChange={setThick} hint="Common: 3, 4, 5, 6, 8, 10 mm" />
      <Field label="Bars per Phase" value={bars} onChange={setBars} hint="Parallel bars for higher currents" />
      <Field label="Ambient Temperature" unit="°C" value={temp} onChange={setTemp} />
      <CalcBtn onCalc={calc} />
      {res && (
        <div className="rounded-xl p-3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}>
          <ResultRow label="Total Cross Section" value={res.area} unit="mm²" />
          <ResultRow label="Continuous Current"  value={res.I}    unit="A" highlight />
          <ResultRow label="Fault Rating (1 s)"  value={res.Isc}  unit="kA" highlight />
          <ResultRow label="DC Resistance"       value={res.R}    unit="mΩ/m" />
        </div>
      )}
      {res && (
        <button onClick={handleResultCard} className="w-full py-3 rounded-xl font-bold text-sm mt-3" style={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a5a', color: '#93c5fd' }}>
          📄 Generate Result Card
        </button>
      )}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

// ── Motor Starting ────────────────────────────────────────────────────────────
function MotorStarting() {
  const { site } = useSite()
  const [kw, setKw]     = useState('75')
  const [vv, setVv]     = useState(String(site.defaultLV || '400'))
  const [eff, setEff]   = useState('92')
  const [pf, setPf]     = useState('0.88')
  const [method, setMethod] = useState('dol')
  const [res, setRes]   = useState(null)
  const { cardData, showCard, hideCard } = useResultCard()

  const calc = () => {
    setRes(null)
    const r = motorStartingComparison({ kw, vv, eff, pf, method })
    if (!r) return
    setRes({
      Ifull: r.Ifull.toFixed(1),
      Istart: r.Istart.toFixed(1),
      kVA: r.kVA.toFixed(1),
      dip: r.dip.toFixed(1),
      torque: r.torque,
    })
  }

  const methods = [
    ['dol','DOL'],['star_delta','Y/Δ'],['autotrans','Auto-T'],
    ['vfd','VFD'],['softstarter','Soft Start'],
  ]

  const methodLabel = { dol: 'DOL', star_delta: 'Star-Delta', autotrans: 'Auto-Transformer', vfd: 'VFD', softstarter: 'Soft Starter' }

  const handleResultCard = () => {
    if (!res) return
    showCard({
      calculator: 'Power Systems — Motor Starting Method Comparison',
      standard: 'Standard starting-method torque/current factors',
      site: site.name,
      inputs: [
        { label: 'Motor Rating', value: `${kw} kW` }, { label: 'System Voltage', value: `${vv} V` },
        { label: 'Motor Efficiency', value: `${eff}%` }, { label: 'Motor Power Factor', value: pf },
        { label: 'Starting Method', value: methodLabel[method] },
      ],
      sections: [{
        title: 'RESULTS',
        rows: [
          { label: 'Full Load Current', value: `${res.Ifull} A` },
          { label: 'Starting Current', value: `${res.Istart} A`, accent: true },
          { label: 'Starting kVA', value: `${res.kVA} kVA`, accent: true },
          { label: 'Starting Torque', value: `${res.torque}× FLT` },
          { label: 'Approx Voltage Dip', value: `${res.dip}%` },
        ]
      }],
      notes: 'Voltage dip is a rough estimate assuming ~5% source impedance — confirm against actual supply fault level for accurate dip prediction, particularly on weak or long rural feeders.',
    })
  }

  return (
    <div>
      <Field label="Motor Rating" unit="kW" value={kw} onChange={setKw} />
      <Field label="System Voltage" unit="V" value={vv} onChange={setVv} />
      <Field label="Motor Efficiency" unit="%" value={eff} onChange={setEff} />
      <Field label="Motor Power Factor" value={pf} onChange={setPf} />
      <div className="mb-3">
        <label className="block text-xs font-bold mb-2" style={{ color: '#9ca3af' }}>Starting Method</label>
        <div className="grid grid-cols-3 gap-2">
          {methods.map(([k,l]) => (
            <button key={k} onClick={() => setMethod(k)}
              className="py-2 rounded-xl text-xs font-bold text-center"
              style={{
                backgroundColor: method === k ? '#1a0f00' : '#111',
                border: `1px solid ${method === k ? '#f59e0b' : '#2a2a2a'}`,
                color: method === k ? '#f59e0b' : '#9ca3af',
              }}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <CalcBtn onCalc={calc} />
      {res && (
        <div className="rounded-xl p-3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}>
          <ResultRow label="Full Load Current" value={res.Ifull}   unit="A" />
          <ResultRow label="Starting Current"  value={res.Istart}  unit="A" highlight />
          <ResultRow label="Starting kVA"      value={res.kVA}     unit="kVA" highlight />
          <ResultRow label="Starting Torque"   value={`${res.torque}× FLT`} unit="" />
          <ResultRow label="Approx Volt Dip"   value={res.dip}     unit="%" />
        </div>
      )}
      {res && (
        <button onClick={handleResultCard} className="w-full py-3 rounded-xl font-bold text-sm mt-3" style={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a5a', color: '#93c5fd' }}>
          📄 Generate Result Card
        </button>
      )}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PowerSysCalculator({ addHistory }) {
  const [tab, setTab] = useState('transformer')

  return (
    <div className="flex flex-col h-full">
      <div className="flex shrink-0 overflow-x-auto px-2 pt-3 pb-0 gap-1"
        style={{ borderBottom: '1px solid #1a1a1a' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-3 py-2 rounded-t-lg text-xs font-bold whitespace-nowrap shrink-0"
            style={{
              backgroundColor: tab === t.id ? '#001410' : 'transparent',
              color: tab === t.id ? '#22d3ee' : '#6b7280',
              borderBottom: tab === t.id ? '2px solid #22d3ee' : '2px solid transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-4">
  {tab === 'transformer' && <TransformerCalc />}
  {tab === 'pf'          && <PFCorrection />}
  {tab === 'generator'   && <GeneratorSizingPro addHistory={addHistory} />}
  {tab === 'busbar'      && <BusbarRating />}
  {tab === 'starting'    && <MotorStarting />}
</div> </div>
  )
}
