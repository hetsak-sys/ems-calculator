import React, { useState } from 'react'

const TABS = [
  { id: 'harmonics', label: 'Harmonics' },
  { id: 'battery',   label: 'Battery/UPS' },
  { id: 'lighting',  label: 'Lighting' },
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
    <span className="text-sm font-bold font-mono" style={{ color: highlight ? '#a3e635' : '#e5e7eb' }}>
      {value} {unit}
    </span>
  </div>
)

const CalcBtn = ({ onCalc }) => (
  <button onClick={onCalc}
    className="w-full py-3 rounded-xl font-bold text-sm mt-2 mb-4"
    style={{ background: 'linear-gradient(135deg, #84cc16, #65a30d)', color: '#000' }}>
    Calculate
  </button>
)

// ── 1. Harmonics / THD ─────────────────────────────────────────────────────
function HarmonicsCalc() {
  const [I1, setI1]   = useState('100')   // fundamental A
  const [I3, setI3]   = useState('5')
  const [I5, setI5]   = useState('20')
  const [I7, setI7]   = useState('14')
  const [I11, setI11] = useState('9')
  const [I13, setI13] = useState('7')
  const [res, setRes] = useState(null)

  const calc = () => {
    const i1 = parseFloat(I1), i3 = parseFloat(I3)
    const i5 = parseFloat(I5), i7 = parseFloat(I7)
    const i11 = parseFloat(I11), i13 = parseFloat(I13)
    if ([i1,i3,i5,i7,i11,i13].some(isNaN)) return

    // THD = √(I3²+I5²+I7²+...) / I1 × 100
    const harmonicSum = Math.sqrt(i3**2 + i5**2 + i7**2 + i11**2 + i13**2)
    const THD_I = (harmonicSum / i1) * 100
    const Irms  = Math.sqrt(i1**2 + harmonicSum**2)

    // K-factor (for transformer derating): K = Σ(Ih²×h²) / Σ(Ih²)
    const num = i1**2*1 + i3**2*9 + i5**2*25 + i7**2*49 + i11**2*121 + i13**2*169
    const den = i1**2 + i3**2 + i5**2 + i7**2 + i11**2 + i13**2
    const Kfactor = num / den

    // Transformer derating (simplified): Prated_derated = Prated / √K
    const derate = (1 / Math.sqrt(Kfactor)) * 100

    setRes({
      THD:     THD_I.toFixed(1),
      Irms:    Irms.toFixed(1),
      K:       Kfactor.toFixed(2),
      derate:  derate.toFixed(1),
      passIEC: THD_I < 8,    // IEC 61000-3-2 Class A limit ~8%
    })
  }

  return (
    <div>
      <div className="text-xs mb-3 px-1" style={{ color: '#6b7280' }}>
        Enter harmonic currents. THD and K-Factor calculated per IEC 61000 / IEEE 519.
      </div>
      <Field label="Fundamental (1st)" unit="A" value={I1} onChange={setI1} />
      <Field label="3rd Harmonic" unit="A" value={I3} onChange={setI3} />
      <Field label="5th Harmonic" unit="A" value={I5} onChange={setI5} />
      <Field label="7th Harmonic" unit="A" value={I7} onChange={setI7} />
      <Field label="11th Harmonic" unit="A" value={I11} onChange={setI11} />
      <Field label="13th Harmonic" unit="A" value={I13} onChange={setI13} />
      <CalcBtn onCalc={calc} />
      {res && (
        <div className="rounded-xl p-3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}>
          <ResultRow label="Current THD"             value={`${res.THD}`}    unit="%" highlight />
          <ResultRow label="True RMS Current"        value={res.Irms}        unit="A" />
          <ResultRow label="K-Factor"                value={res.K}           unit="" highlight />
          <ResultRow label="Transformer Derating"    value={res.derate}      unit="% of rated" />
          <div className={`mt-3 text-center text-xs font-bold py-2 rounded-xl ${res.passIEC ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>
            {res.passIEC ? '✓ Within IEC 61000-3-2 Class A limits' : '⚠ THD exceeds 8% — mitigation may be required'}
          </div>
          {parseFloat(res.K) > 4 && (
            <div className="mt-2 text-center text-xs py-2 rounded-xl bg-orange-900 text-orange-400">
              K-Factor {'>'} 4 — use K-rated transformer or derate by {(100 - parseFloat(res.derate)).toFixed(1)}%
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 2. Battery / UPS Sizing ──────────────────────────────────────────────────
function BatterySizing({ siteConfig }) {
  const [load_kw, setLoadKw]   = useState('10')
  const [pf, setPf]            = useState('0.9')
  const [runtime, setRuntime]  = useState('30')    // minutes
  const [vdc, setVdc]          = useState('48')    // battery voltage
  const [dod, setDod]          = useState('80')    // depth of discharge %
  const [eta, setEta]          = useState('85')    // inverter efficiency %
  const [res, setRes]          = useState(null)

  const calc = () => {
    const P = parseFloat(load_kw) * 1000
    const p = parseFloat(pf), t = parseFloat(runtime) / 60  // hours
    const V = parseFloat(vdc)
    const d = parseFloat(dod) / 100, e = parseFloat(eta) / 100
    if ([P, p, t, V, d, e].some(isNaN)) return

    const kVA     = P / p
    const Wh_load = (P / e) * t          // energy needed at DC side
    const Ah_req  = (Wh_load / V) / d   // accounting for DoD

    // Standard battery sizes (Ah at 48V)
    const cells = Math.ceil(V / 2)       // 2V cells
    const strings_hint = V === 48 ? '4 × 12V or 24 × 2V cells' :
                         V === 24 ? '2 × 12V or 12 × 2V cells' : `${cells} × 2V cells`

    setRes({
      kVA:      kVA.toFixed(1),
      Wh:       (Wh_load / 1000).toFixed(2),
      Ah:       Ah_req.toFixed(0),
      cells:    strings_hint,
      inv_A:    (kVA * 1000 / V).toFixed(0),
    })
  }

  return (
    <div>
      <Field label="Load Power" unit="kW" value={load_kw} onChange={setLoadKw} />
      <Field label="Load Power Factor" value={pf} onChange={setPf} />
      <Field label="Required Runtime" unit="min" value={runtime} onChange={setRuntime} />
      <Field label="Battery Voltage" unit="Vdc" value={vdc} onChange={setVdc} hint="Common: 12, 24, 48, 96, 110 V" />
      <Field label="Max Depth of Discharge" unit="%" value={dod} onChange={setDod} hint="VRLA/AGM: 50–80 %, Li-Ion: 80–90 %" />
      <Field label="Inverter Efficiency" unit="%" value={eta} onChange={setEta} />
      <CalcBtn onCalc={calc} />
      {res && (
        <div className="rounded-xl p-3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}>
          <ResultRow label="UPS/Inverter Rating" value={res.kVA}   unit="kVA" highlight />
          <ResultRow label="Energy Required"     value={res.Wh}    unit="kWh" />
          <ResultRow label="Battery Bank (Ah)"   value={res.Ah}    unit="Ah" highlight />
          <ResultRow label="Max Inverter DC"     value={res.inv_A} unit="A" />
          <ResultRow label="Battery Config"      value={res.cells} unit="" />
        </div>
      )}
    </div>
  )
}

// ── 3. Lighting Design ──────────────────────────────────────────────────────
function LightingCalc() {
  const [area, setArea]   = useState('100')    // m²
  const [lux, setLux]     = useState('300')    // required lux
  const [CU, setCU]       = useState('0.65')   // coefficient of utilization
  const [MF, setMF]       = useState('0.80')   // maintenance factor
  const [lumens, setLumens] = useState('4000') // lumens per fitting
  const [watts, setWatts] = useState('36')     // watts per fitting
  const [res, setRes]     = useState(null)

  const LUX_GUIDE = [
    { area: 'Corridor / walkway', lux: 100 },
    { area: 'Workshop / assembly', lux: 300 },
    { area: 'Office / control room', lux: 500 },
    { area: 'Fine assembly / lab', lux: 750 },
    { area: 'Drawing board / surgery', lux: 1000 },
  ]

  const calc = () => {
    const A = parseFloat(area), E = parseFloat(lux)
    const cu = parseFloat(CU), mf = parseFloat(MF)
    const Φ = parseFloat(lumens), W = parseFloat(watts)
    if ([A, E, cu, mf, Φ, W].some(isNaN)) return

    // Lumen method: N = (E × A) / (Φ × CU × MF)
    const N = (E * A) / (Φ * cu * mf)
    const N_ceil = Math.ceil(N)
    const totalW = N_ceil * W
    const W_per_m2 = totalW / A
    const actual_lux = (N_ceil * Φ * cu * mf) / A

    setRes({
      N:       N.toFixed(1),
      N_ceil,
      W:       totalW.toFixed(0),
      Wm2:     W_per_m2.toFixed(1),
      lux_act: actual_lux.toFixed(0),
    })
  }

  return (
    <div>
      <div className="text-xs mb-3 px-1" style={{ color: '#6b7280' }}>
        Lumen method (SANS 10114 / IES) — average maintained illuminance
      </div>

      {/* Lux guide */}
      <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
        <div className="px-3 py-2 text-xs font-bold" style={{ backgroundColor: '#0f0f0f', color: '#6b7280' }}>TYPICAL LUX LEVELS</div>
        {LUX_GUIDE.map(g => (
          <button key={g.area} onClick={() => setLux(String(g.lux))}
            className="flex justify-between w-full px-3 py-2 text-xs"
            style={{
              backgroundColor: lux === String(g.lux) ? '#0f1a00' : '#0a0a0a',
              color: lux === String(g.lux) ? '#a3e635' : '#9ca3af',
              borderTop: '1px solid #111',
            }}>
            <span>{g.area}</span>
            <span className="font-mono">{g.lux} lx</span>
          </button>
        ))}
      </div>

      <Field label="Room Area" unit="m²" value={area} onChange={setArea} />
      <Field label="Required Illuminance" unit="lux" value={lux} onChange={setLux} />
      <Field label="Coefficient of Utilization (CU)" value={CU} onChange={setCU} hint="0.5–0.8 depending on room surfaces and fitting type" />
      <Field label="Maintenance Factor (MF)" value={MF} onChange={setMF} hint="0.7–0.9 depending on cleaning frequency" />
      <Field label="Fitting Output" unit="lm" value={lumens} onChange={setLumens} hint="From manufacturer datasheet" />
      <Field label="Fitting Wattage" unit="W" value={watts} onChange={setWatts} />
      <CalcBtn onCalc={calc} />
      {res && (
        <div className="rounded-xl p-3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}>
          <ResultRow label="Fittings Required"    value={`${res.N} → ${res.N_ceil}`} unit="fittings" highlight />
          <ResultRow label="Actual Illuminance"   value={res.lux_act} unit="lux" highlight />
          <ResultRow label="Total Load"           value={res.W}       unit="W" />
          <ResultRow label="Power Density"        value={res.Wm2}     unit="W/m²" />
          <div className="mt-2 text-xs text-center py-2 rounded-xl"
            style={{ backgroundColor: '#111', color: '#6b7280' }}>
            SANS 204 max power density: offices 15 W/m², industrial 20 W/m²
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function PQCalculator({ addHistory, siteConfig }) {
  const [tab, setTab] = useState('harmonics')

  return (
    <div className="flex flex-col h-full">
      <div className="flex shrink-0 overflow-x-auto px-2 pt-3 pb-0 gap-1"
        style={{ borderBottom: '1px solid #1a1a1a' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-3 py-2 rounded-t-lg text-xs font-bold whitespace-nowrap shrink-0"
            style={{
              backgroundColor: tab === t.id ? '#080f00' : 'transparent',
              color: tab === t.id ? '#a3e635' : '#6b7280',
              borderBottom: tab === t.id ? '2px solid #a3e635' : '2px solid transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        {tab === 'harmonics' && <HarmonicsCalc />}
        {tab === 'battery'   && <BatterySizing siteConfig={siteConfig} />}
        {tab === 'lighting'  && <LightingCalc />}
      </div>
    </div>
  )
}
