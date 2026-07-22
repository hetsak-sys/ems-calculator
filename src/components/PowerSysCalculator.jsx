import GeneratorSizingPro from './GeneratorSizing'
import React, { useState } from 'react'
import { useSite } from './SiteContext'

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

// ── Transformer ─────────────────────────────────────────────────────────────
function TransformerCalc() {
  const { site } = useSite()
  const [kva, setKva]   = useState('1000')
  const [vpri, setVpri] = useState('11000')
  const [vsec, setVsec] = useState(String(site.defaultLV || '400'))
  const [zpc, setZpc]   = useState('6')      // impedance %
  const [pf, setPf]     = useState('0.85')
  const [eff, setEff]   = useState('98')
  const [res, setRes]   = useState(null)

  const calc = () => {
    const S = parseFloat(kva) * 1000
    const Vp = parseFloat(vpri), Vs = parseFloat(vsec)
    const Z = parseFloat(zpc) / 100
    const p = parseFloat(pf), e = parseFloat(eff) / 100
    if ([S, Vp, Vs, Z, p, e].some(isNaN)) return

    const Ipri = S / (Math.sqrt(3) * Vp)
    const Isec = S / (Math.sqrt(3) * Vs)
    const ratio = Vp / Vs
    // Fault current at secondary: If = Irated / Z%
    const Isc_sec = Isec / Z
    const Isc_3ph = Isc_sec        // bolted 3-phase
    const Isc_1ph = Isc_3ph * 0.866 // approx 1-phase
    const Pinput = (S * p) / e
    const Ploss  = Pinput - S * p

    setRes({
      ratio: ratio.toFixed(2),
      Ipri:  Ipri.toFixed(1),
      Isec:  Isec.toFixed(1),
      Isc3:  (Isc_3ph / 1000).toFixed(2),
      Isc1:  (Isc_1ph / 1000).toFixed(2),
      Ploss: (Ploss / 1000).toFixed(2),
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

  const calc = () => {
    const P = parseFloat(kw), p1 = parseFloat(pf1), p2 = parseFloat(pf2)
    const V = parseFloat(vv)
    if ([P, p1, p2, V].some(isNaN) || p1 >= 1 || p2 > 1) return

    const Qc = P * (Math.tan(Math.acos(p1)) - Math.tan(Math.acos(p2)))
    const I_before = (P * 1000) / (Math.sqrt(3) * V * p1)
    const I_after  = (P * 1000) / (Math.sqrt(3) * V * p2)
    const Ic       = Qc * 1000 / (Math.sqrt(3) * V)

    // Standard capacitor bank steps
    const steps = [5, 10, 12.5, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 250, 300]
    const bank  = steps.find(s => s >= Qc) || '>300'

    setRes({
      Qc:     Qc.toFixed(1),
      bank,
      Ic:     Ic.toFixed(1),
      Ibefore: I_before.toFixed(1),
      Iafter:  I_after.toFixed(1),
      saving: ((I_before - I_after) / I_before * 100).toFixed(1),
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

  const calc = () => {
    const W = parseFloat(w), T = parseFloat(thick)
    const n = parseInt(bars), ta = parseFloat(temp)
    if ([W, T, n, ta].some(isNaN)) return

    // Empirical formula: I ≈ k × A^0.5 × P^0.5 (simplified)
    // Better: I = J × A, where J is current density
    // Copper: ~1.5–2.5 A/mm², Aluminium: ~1.0–1.6 A/mm²
    const A   = W * T  // cross-section mm²
    const J   = mat === 'cu' ? 2.0 : 1.3  // A/mm² (conservative)
    // Temperature correction (reduces rating above 35°C)
    const tempCorr = Math.sqrt((90 - ta) / (90 - 35)) // assume 90°C max conductor temp

    const I_single = J * A * tempCorr
    const I_total  = I_single * n
    const Isc_1s   = mat === 'cu'
      ? A * n * 143        // k=143 for Cu PVC
      : A * n * 95         // k=95 for Al
    const R_per_m  = (mat === 'cu' ? 0.0175 : 0.0282) / (A * n) * 1000  // mΩ/m

    setRes({
      area:   (A * n).toFixed(0),
      I:      I_total.toFixed(0),
      Isc:    (Isc_1s / 1000).toFixed(1),
      R:      R_per_m.toFixed(3),
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
    </div>
  )
}

// ── Motor Starting ─────────────────────────────────────────────────────────────
function MotorStarting() {
  const { site } = useSite()
  const [kw, setKw]     = useState('75')
  const [vv, setVv]     = useState(String(site.defaultLV || '400'))
  const [eff, setEff]   = useState('92')
  const [pf, setPf]     = useState('0.88')
  const [method, setMethod] = useState('dol')
  const [res, setRes]   = useState(null)

  const calc = () => {
    const P = parseFloat(kw) * 1000, V = parseFloat(vv)
    const e = parseFloat(eff) / 100, p = parseFloat(pf)
    if ([P, V, e, p].some(isNaN)) return

    const Ifull = P / (Math.sqrt(3) * V * p * e)
    const factors = {
      dol:       { start: 6.5, torque: 1.5 },
      star_delta: { start: 2.2, torque: 0.5 },
      autotrans:  { start: 3.0, torque: 0.64 },
      vfd:        { start: 1.2, torque: 1.0 },
      softstarter:{ start: 2.5, torque: 0.8 },
    }
    const f = factors[method]
    const Istart = Ifull * f.start
    const kVA_start = (Math.sqrt(3) * V * Istart) / 1000
    const voltDip_approx = (kVA_start * 0.05) * 100  // rough 5% Zs estimate

    setRes({
      Ifull: Ifull.toFixed(1),
      Istart: Istart.toFixed(1),
      kVA: kVA_start.toFixed(1),
      dip: voltDip_approx.toFixed(1),
      torque: f.torque,
    })
  }

  const methods = [
    ['dol','DOL'],['star_delta','Y/Δ'],['autotrans','Auto-T'],
    ['vfd','VFD'],['softstarter','Soft Start'],
  ]

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
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
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
  
