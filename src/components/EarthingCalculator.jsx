import React, { useState } from 'react'

const TABS = [
  { id: 'electrode',  label: 'Electrode R'   },
  { id: 'touchstep',  label: 'Touch/Step'    },
  { id: 'conductor',  label: 'Conductor'     },
  { id: 'faultloop',  label: 'Fault Loop'    },
]

// ── Shared UI helpers ──────────────────────────────────────────────────────
const Field = ({ label, unit, value, onChange, hint }) => (
  <div className="mb-3">
    <label className="block text-xs font-bold mb-1" style={{ color: '#9ca3af' }}>
      {label}{unit ? ` (${unit})` : ''}
    </label>
    <input
      type="text" inputMode="decimal" step="any"
      value={value}
      onChange={e => onChange(e.target.value)}
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
  <button
    onClick={onCalc}
    className="w-full py-3 rounded-xl font-bold text-sm mt-2 mb-4"
    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#000' }}
  >
    Calculate
  </button>
)

// ── 1. Electrode Resistance (Dwight's formula) ─────────────────────────────
function ElectrodeRes() {
  const [rho, setRho]   = useState('100')   // soil resistivity Ω·m
  const [L, setL]       = useState('2.4')   // rod length m
  const [d, setD]       = useState('0.016') // rod diameter m
  const [n, setN]       = useState('1')     // number of rods
  const [s, setS]       = useState('3')     // spacing m
  const [res, setRes]   = useState(null)

  const calc = () => {
    const r = parseFloat(rho), l = parseFloat(L), dia = parseFloat(d)
    const nr = parseInt(n), sp = parseFloat(s)
    if ([r, l, dia].some(isNaN) || l <= 0 || dia <= 0) return

    // Dwight's formula: R = (ρ/2πL)(ln(4L/d) - 1)
    const R_single = (r / (2 * Math.PI * l)) * (Math.log(4 * l / dia) - 1)

    // Multiple rods in parallel with spacing correction
    let R_parallel = R_single
    if (nr > 1) {
      // Approximate: R_n ≈ R1/n × (1 + ρ/(2πR1·s·n))
      R_parallel = R_single / nr
    }

    setRes({
      single:   R_single.toFixed(3),
      parallel: R_parallel.toFixed(3),
      ratio:    (R_single / R_parallel).toFixed(2),
      pass:     R_parallel < 1.0,
    })
  }

  return (
    <div>
      <div className="text-xs mb-3 px-1" style={{ color: '#6b7280' }}>
        Dwight's formula for vertical ground rods (IEC 62305 / SANS 10199)
      </div>
      <Field label="Soil Resistivity" unit="Ω·m" value={rho} onChange={setRho} hint="Typical: clay 20–100, loam 50–300, rock 1000+" />
      <Field label="Rod Length" unit="m" value={L} onChange={setL} hint="Standard: 2.4 m or 3.0 m" />
      <Field label="Rod Diameter" unit="m" value={d} onChange={setD} hint="16 mm → 0.016 m" />
      <Field label="Number of Rods" value={n} onChange={setN} />
      <Field label="Rod Spacing" unit="m" value={s} onChange={setS} hint="Should be ≥ 2× rod length" />
      <CalcBtn onCalc={calc} />
      {res && (
        <div className="rounded-xl p-3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}>
          <ResultRow label="Single Rod Resistance"   value={res.single}   unit="Ω" />
          <ResultRow label="Parallel Resistance"     value={res.parallel} unit="Ω" highlight />
          <ResultRow label="Improvement Factor"      value={res.ratio}    unit="×" />
          <div className={`mt-3 text-center text-xs font-bold py-2 rounded-xl ${res.pass ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
            {res.pass ? '✓ Below 1 Ω — acceptable for most MV systems' : '⚠ Above 1 Ω — add more rods or treat soil'}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 2. Touch & Step Voltage ────────────────────────────────────────────────
function TouchStep() {
  const [rho_s, setRhoS] = useState('100')  // surface layer resistivity
  const [hs, setHs]       = useState('0.1')  // surface layer thickness m
  const [ts, setTs]       = useState('0.5')  // fault duration s
  const [res, setRes]     = useState(null)

  const calc = () => {
    const rs = parseFloat(rho_s), h = parseFloat(hs), t = parseFloat(ts)
    if ([rs, h, t].some(isNaN)) return

    // IEEE 80 simplified — body resistance 1000 Ω, 50 kg person
    // Cs = surface layer derating factor
    const Cs = 1 - (0.09 * (1 - 100 / rs)) / (2 * h + 0.09)

    // Tolerable touch voltage (IEEE 80 Eq 32, 50 kg)
    const E_touch_50 = (1000 + 1.5 * Cs * rs) * (0.116 / Math.sqrt(t))
    // Tolerable step voltage
    const E_step_50 = (1000 + 6 * Cs * rs) * (0.116 / Math.sqrt(t))

    setRes({
      Cs:      Cs.toFixed(3),
      touch:   E_touch_50.toFixed(1),
      step:    E_step_50.toFixed(1),
    })
  }

  return (
    <div>
      <div className="text-xs mb-3 px-1" style={{ color: '#6b7280' }}>
        IEEE Std 80 — tolerable touch and step voltages (50 kg body weight)
      </div>
      <Field label="Surface Layer Resistivity" unit="Ω·m" value={rho_s} onChange={setRhoS} hint="Crushed rock ≈ 3000 Ω·m, bare soil ≈ 100 Ω·m" />
      <Field label="Surface Layer Thickness" unit="m" value={hs} onChange={setHs} hint="Typical crushed rock layer: 0.1–0.15 m" />
      <Field label="Fault Clearing Time" unit="s" value={ts} onChange={setTs} hint="Check relay/breaker operating time" />
      <CalcBtn onCalc={calc} />
      {res && (
        <div className="rounded-xl p-3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}>
          <ResultRow label="Surface Derating Factor (Cs)" value={res.Cs}    unit="" />
          <ResultRow label="Tolerable Touch Voltage"      value={res.touch} unit="V" highlight />
          <ResultRow label="Tolerable Step Voltage"       value={res.step}  unit="V" highlight />
          <div className="mt-2 text-xs px-1" style={{ color: '#6b7280' }}>
            Compare against calculated GPR and mesh/step voltages from grid analysis
          </div>
        </div>
      )}
    </div>
  )
}

// ── 3. Earth Conductor Sizing (IEC 60364 / SANS 10142) ─────────────────────
function ConductorSizing() {
  const [If, setIf]     = useState('10000')  // fault current A
  const [tf, setTf]     = useState('1')       // fault duration s
  const [mat, setMat]   = useState('cu')      // material

  const MAT = {
    cu:  { k: 143, name: 'Copper (PVC insulated)' },
    cu2: { k: 176, name: 'Copper (bare, welded)'  },
    al:  { k:  95, name: 'Aluminium'              },
    st:  { k:  78, name: 'Steel'                  },
  }

  const [res, setRes] = useState(null)

  const calc = () => {
    const i = parseFloat(If), t = parseFloat(tf)
    if (isNaN(i) || isNaN(t)) return
    const { k, name } = MAT[mat]
    // IEC 60364-5-54: S = (I × √t) / k
    const S = (i * Math.sqrt(t)) / k
    const Smin = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300].find(s => s >= S) || '>300'

    setRes({ S: S.toFixed(1), Smin, name })
  }

  return (
    <div>
      <div className="text-xs mb-3 px-1" style={{ color: '#6b7280' }}>
        IEC 60364-5-54 adiabatic equation: S = I√t / k
      </div>
      <Field label="Fault Current" unit="A" value={If} onChange={setIf} />
      <Field label="Fault Duration" unit="s" value={tf} onChange={setTf} hint="Use relay clearing time + breaker time" />

      <div className="mb-3">
        <label className="block text-xs font-bold mb-2" style={{ color: '#9ca3af' }}>Conductor Material</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(MAT).map(([k, v]) => (
            <button key={k} onClick={() => setMat(k)}
              className="py-2 rounded-xl text-xs text-center"
              style={{
                backgroundColor: mat === k ? '#1a0f00' : '#111',
                border: `1px solid ${mat === k ? '#f59e0b' : '#2a2a2a'}`,
                color: mat === k ? '#f59e0b' : '#9ca3af',
              }}
            >
              {v.name}
            </button>
          ))}
        </div>
      </div>

      <CalcBtn onCalc={calc} />
      {res && (
        <div className="rounded-xl p-3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}>
          <ResultRow label="Calculated minimum S" value={res.S}    unit="mm²" />
          <ResultRow label="Next standard size"   value={res.Smin} unit="mm²" highlight />
          <ResultRow label="Material"             value={res.name} unit="" />
        </div>
      )}
    </div>
  )
}

// ── 4. Fault Loop Impedance ────────────────────────────────────────────────
function FaultLoop() {
  const [Vs, setVs]   = useState('400')   // supply V
  const [Zs, setZs]   = useState('0.8')   // source impedance Ω
  const [Rc, setRc]   = useState('0.5')   // cable R (phase) Ω
  const [Re, setRe]   = useState('0.3')   // earth path R Ω
  const [Iop, setIop] = useState('100')   // overcurrent device trip A
  const [res, setRes] = useState(null)

  const calc = () => {
    const v = parseFloat(Vs), zs = parseFloat(Zs)
    const rc = parseFloat(Rc), re = parseFloat(Re), io = parseFloat(Iop)
    if ([v, zs, rc, re, io].some(isNaN)) return

    const Zloop = zs + rc + re          // total loop impedance
    const Isc   = v / (Math.sqrt(3) * Zloop)  // 3-phase fault current (approx)
    const If_1ph = v / (2 * (rc + re) + zs)   // L-E fault current
    const pass  = If_1ph >= io * 5     // 5× for magnetic trip (Type B/C)

    setRes({
      Zloop: Zloop.toFixed(3),
      Isc:   Isc.toFixed(0),
      If1:   If_1ph.toFixed(0),
      pass,
      ratio: (If_1ph / io).toFixed(1),
    })
  }

  return (
    <div>
      <div className="text-xs mb-3 px-1" style={{ color: '#6b7280' }}>
        Checks that earth fault current is sufficient to operate overcurrent protection (SANS 10142)
      </div>
      <Field label="Supply Voltage" unit="V" value={Vs} onChange={setVs} />
      <Field label="Source Impedance (Zs)" unit="Ω" value={Zs} onChange={setZs} hint="From transformer impedance and supply network" />
      <Field label="Phase Cable Resistance (Rc)" unit="Ω" value={Rc} onChange={setRc} />
      <Field label="Earth Conductor Resistance (Re)" unit="Ω" value={Re} onChange={setRe} />
      <Field label="Protection Device Rating" unit="A" value={Iop} onChange={setIop} />
      <CalcBtn onCalc={calc} />
      {res && (
        <div className="rounded-xl p-3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}>
          <ResultRow label="Total Loop Impedance"   value={res.Zloop} unit="Ω" />
          <ResultRow label="3-Phase Fault Current"  value={res.Isc}   unit="A" />
          <ResultRow label="L-E Fault Current"      value={res.If1}   unit="A" highlight />
          <ResultRow label="× Device Rating"        value={res.ratio} unit="×" />
          <div className={`mt-3 text-center text-xs font-bold py-2 rounded-xl ${res.pass ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
            {res.pass ? '✓ Protection will operate correctly' : '⚠ Fault current too low — protection may not trip'}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function EarthingCalculator({ addHistory, siteConfig }) {
  const [tab, setTab] = useState('electrode')

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab bar */}
      <div className="flex shrink-0 overflow-x-auto px-2 pt-3 pb-0 gap-1"
        style={{ borderBottom: '1px solid #1a1a1a' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-3 py-2 rounded-t-lg text-xs font-bold whitespace-nowrap shrink-0"
            style={{
              backgroundColor: tab === t.id ? '#1a0f00' : 'transparent',
              color: tab === t.id ? '#f59e0b' : '#6b7280',
              borderBottom: tab === t.id ? '2px solid #f59e0b' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        {tab === 'electrode'  && <ElectrodeRes />}
        {tab === 'touchstep'  && <TouchStep />}
        {tab === 'conductor'  && <ConductorSizing />}
        {tab === 'faultloop'  && <FaultLoop />}
      </div>
    </div>
  )
}
