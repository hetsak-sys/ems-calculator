/**
 * GeneratorSizing.jsx
 * PowerSuite — Power Systems Tab › Generator (merged component)
 *
 * Drop into: src/components/GeneratorSizing.jsx
 *
 * ── Merge note (this session) ──────────────────────────────────────────────
 * Previously two separate top-level tabs existed: a basic single-number
 * calculator ("Generator", defined locally in PowerSysCalculator.jsx) and
 * this file's four-stage load-schedule chain ("Gen Sizing"). Both were
 * genuine, non-duplicate workflows, but the near-identical names caused
 * real confusion about what fed what and which to use. Resolved by merging
 * into one component behind a single "Generator" tab, offering an explicit
 * labeled choice up front:
 *
 *   ┌─────────────────────┬───────────────────────┐
 *   │  Known Load Sizing  │  Load Schedule Sizing  │   ← mode, segmented control
 *   └─────────────────────┴───────────────────────┘
 *
 *   Known Load Sizing   — single total kW/kVA in, genset size out.
 *                          Migrated from PowerSysCalculator.jsx's old local
 *                          GeneratorSizing() function; now reuses the shared
 *                          GEN_SIZES standard-sizes list (previously a second
 *                          hardcoded copy — consolidated per [DEC-3]).
 *   Load Schedule Sizing — build a load-by-load schedule, chained through
 *                          Loads → Generator ("Gen") → Transformer →
 *                          Fault Level (renamed from "Impedance" — states
 *                          the output the user is solving for, not the
 *                          calculation method). Navigated via a persistent
 *                          flow-strip (replaces the old plain tab-bar) that
 *                          shows every stage's live output at once, so the
 *                          dependency chain is always visible instead of
 *                          implied.
 *
 * Integration in PowerSystems.jsx / PowerSysCalculator.jsx:
 *   1. Add to imports:
 *        import GeneratorSizingPro from './GeneratorSizing'
 *   2. Add to TABS array:
 *        { id: 'generator', label: 'Generator' }
 *   3. Add to tab map:
 *        generator: <GeneratorSizingPro addHistory={addHistory} />
 *
 * Props:
 *   addHistory(obj) — same shape as all other sub-tabs:
 *     { tab: string, expr: string, result: string }
 *   (No siteConfig prop — site name for PDF exports comes from useSite()/
 *   SiteContext directly, same verified pattern as MotorCalculator.jsx's
 *   FlaCalc.)
 *
 * History logging:
 *   Both modes now log to history on explicit user action ("Save to
 *   history"), tagged distinctly so the History list stays legible:
 *     - Known Load Sizing  → tab: 'Generator › Known Load'
 *     - Load Schedule Sizing → tab: 'Generator › Load Schedule'
 *   (Previously, Known Load Sizing's predecessor had no history logging at
 *   all — this closes that gap. PDF export for Known Load Sizing was
 *   deliberately NOT added in this pass — flagged as an open follow-up,
 *   not bundled into this structural change.)
 *
 * PDF export:
 *   Generator, Transformer and Fault Level stages (within Load Schedule
 *   Sizing) each get a "📄 Export PDF" button below their result card,
 *   wired to shared.jsx's ResultCard / useResultCard — same plumbing as
 *   PQCalculator.jsx and MotorCalculator.jsx. Loads stage has no export of
 *   its own: its inputs are captured as context inside the Generator export
 *   instead, since Loads has no single "governing result" of its own.
 *
 * Engineering references:
 *   - ISO 8528-1  : Generator set ratings and altitude/temp de-rating
 *   - IEC 60076   : Transformer standard kVA sizes
 *   - IEC 60909   : Short-circuit current calculations (simplified model)
 *   - SANS 10142  : SA wiring code (load demand factors)
 */

import { useState, useMemo, Fragment } from 'react'
import { calculateGeneratorDerating, GEN_SIZES } from '../lib/generatorDerating.js'
import { useWorkspace } from './WorkspaceContext'
import { ResultCard, useResultCard } from './shared'
import { useSite } from './SiteContext'

// ─── Constants ─────────────────────────────────────────────────────────────

const SQRT3 = Math.sqrt(3)

/** Standard distribution transformer kVA (IEC 60076) */
const TRAFO_SIZES = [
  5, 10, 15, 25, 50, 75, 100, 150, 200, 250,
  315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150,
]

/**
 * Vector group options relevant to SA/Lesotho distribution practice.
 * Dyn11 is the ESKOM and LEC standard for 11kV/400V step-down.
 */
const CONN_TYPES = [
  {
    v: 'Dyn11',
    short: 'Dyn11',
    desc: 'Delta primary · Star+N secondary · 30° shift',
    note: 'SA/Lesotho distribution standard (11kV→400V). HV delta = no primary neutral; LV star neutral for single-phase loads.',
  },
  {
    v: 'YNd11',
    short: 'YNd11',
    desc: 'Star+N primary · Delta secondary · 30° shift',
    note: 'Used where primary neutral earthing is required (MV feeders). Secondary has no neutral — 3-wire load only.',
  },
  {
    v: 'YNyn0',
    short: 'YNyn0',
    desc: 'Star+N both sides · 0° shift',
    note: 'Common in MV reticulation. Both neutrals available; suitable for unbalanced single-phase distribution at MV.',
  },
  {
    v: 'Yy0',
    short: 'Yy0',
    desc: 'Star-Star · 0° shift · No neutrals',
    note: 'Balanced 3-phase loads only. No neutral on either side. Rarely used for LV distribution.',
  },
  {
    v: 'Dd0',
    short: 'Dd0',
    desc: 'Delta-Delta · 0° shift · No neutrals',
    note: 'Industrial only. Good for high harmonic loads (3rd harmonic circulates in delta). No neutral available.',
  },
  {
    v: 'Dz0',
    short: 'Dz0',
    desc: 'Delta primary · Zigzag secondary · 0° shift',
    note: 'Earthing/grounding transformers. Excellent for unbalanced single-phase loads. Higher cost due to zigzag winding.',
  },
]

const LOAD_TYPES = ['Motor', 'Resistive', 'Fluorescent/LED', 'Capacitive/VFD', 'Mixed']

const START_METHODS = ['DOL', 'Star-Delta', 'Soft-Start', 'VFD', 'N/A']

/**
 * Starting current multipliers relative to full-load kVA.
 * These are peak inrush multipliers used to size generator
 * transient response (not steady-state).
 *
 * DOL       : 6–7× (locked rotor current). Use 6.5× typical.
 * Star-Delta: 2–2.5× (1/3 voltage start reduces torque and current).
 * Soft-Start: 2.5–3.5× (depends on ramp time setting).
 * VFD       : ≤1× (inverter controls inrush; no transient).
 * N/A       : 0 (non-motor load).
 */
const START_MULT = {
  DOL: 6.5,
  'Star-Delta': 2.3,
  'Soft-Start': 3.0,
  VFD: 1.0,
  'N/A': 0,
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Round up to next standard size in a sorted array */
const nextStd = (arr, val) => arr.find(s => s >= val) || arr[arr.length - 1]

/** Safe parse float with fallback */
const pf = (v, fallback = 0) => parseFloat(v) || fallback

/**
 * Comma-to-period normalization for Android decimal keyboards.
 * Required per project convention: all numeric inputs use
 * type="text" inputMode="decimal", never type="number" — Android's
 * native number keyboard is locale-dependent and can emit a comma as
 * the decimal separator (confirmed on-device this session: "0,8" typed
 * into a type="number" field). parseFloat("0,8") silently returns 0,
 * which — depending on which fallback a given field happens to use —
 * can produce a wrong result with no visible error. Every numeric input
 * in this file routes through this on the way into state.
 */
const toDecimal = v => v.replace(/,/g, '.')

// ─── Sub-components ────────────────────────────────────────────────────────

const ACCENT = '#22d3ee'   // cyan  — power systems colour
const AMBER  = '#f59e0b'   // amber — generator result
const GREEN  = '#4ade80'   // green — transformer result
const PURPLE = '#c084fc'   // purple — impedance result
const RED    = '#f87171'   // red   — fault/warning values

const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '0.5px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '12px 14px',
    marginBottom: '10px',
  },
  lbl: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: '3px',
    display: 'block',
  },
  inp: {
    width: '100%',
    boxSizing: 'border-box',
    fontSize: '13px',
    fontFamily: 'monospace',
    background: 'rgba(0,0,0,0.3)',
    border: '0.5px solid rgba(255,255,255,0.15)',
    borderRadius: '6px',
    color: '#fff',
    padding: '5px 8px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 0',
    borderBottom: '0.5px solid rgba(255,255,255,0.07)',
  },
  rowLbl: { fontSize: '12px', color: 'rgba(255,255,255,0.55)' },
  rowVal: { fontSize: '12px', fontFamily: 'monospace', fontWeight: '500', color: '#fff' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' },
  result: {
    padding: '12px',
    borderRadius: '10px',
    textAlign: 'center',
    marginTop: '10px',
  },
  warn: {
    background: 'rgba(248,113,113,0.1)',
    border: '0.5px solid rgba(248,113,113,0.3)',
    borderRadius: '8px',
    padding: '8px 10px',
    fontSize: '10px',
    color: '#fca5a5',
    marginTop: '8px',
    lineHeight: '1.5',
  },
  subHead: {
    fontSize: '12px',
    fontWeight: '500',
    marginBottom: '8px',
  },
}

function Inp({ label, sub, ...rest }) {
  return (
    <div>
      {label && <span style={S.lbl}>{label}</span>}
      <input style={S.inp} {...rest} />
      {sub && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>{sub}</div>}
    </div>
  )
}

function Sel({ label, value, onChange, options }) {
  return (
    <div>
      {label && <span style={S.lbl}>{label}</span>}
      <select style={{ ...S.inp, cursor: 'pointer' }} value={value} onChange={onChange}>
        {options.map(o => {
          const val = typeof o === 'string' ? o : o.v
          const lbl = typeof o === 'string' ? o : (o.short || o.v)
          return <option key={val} value={val}>{lbl}</option>
        })}
      </select>
    </div>
  )
}

function RowVal({ label, value, accent }) {
  return (
    <div style={S.row}>
      <span style={S.rowLbl}>{label}</span>
      <span style={{ ...S.rowVal, color: accent || '#fff' }}>{value}</span>
    </div>
  )
}

// ─── Known Load Sizing (migrated from PowerSysCalculator.jsx) ─────────────
//
// Single total kW/kVA in, genset size out. No load schedule — for when the
// user already has a site's total demand figure from elsewhere (an existing
// panel schedule, a prior installation's known demand).
//
// Note on consolidation: the pre-migration version of this calc used its
// own motor-starting multipliers (DOL 6×, Star-Delta 2×, VFD 1.1×) and its
// own hardcoded standard-sizes list — both silently different from the
// values already used by the Load Schedule Sizing chain in this same file
// (START_MULT: DOL 6.5×, Star-Delta 2.3×, VFD 1.0×; GEN_SIZES for standard
// sizes). Per [DEC-3] (a better pattern earns adoption everywhere the old
// one occurs, not piecemeal), this migration converges both onto the one
// shared source — so the two modes now agree on the same site's numbers by
// construction, the same fix already applied to the derating formula.
function KnownLoadSizing({ addHistory }) {
  const { site } = useSite()
  const [kw, setKw]         = useState('200')
  const [kwPf, setKwPf]     = useState('0.8')
  const [eff, setEff]       = useState('90')
  const [altitude, setAlt]  = useState(String(site.altitude || '1000'))
  const [temp, setTemp]     = useState(String(site.ambient || '30'))
  const [largestMotorKw, setLmKw] = useState('37')
  const [startMethod, setStart]   = useState('DOL')
  const [res, setRes]       = useState(null)

  const KNOWN_START_METHODS = ['DOL', 'Star-Delta', 'VFD']

  const calc = () => {
    const P = pf(kw), p = pf(kwPf, 0.8)
    const e = pf(eff, 90) / 100, alt = pf(altitude)
    const T = pf(temp, 25), Pm = pf(largestMotorKw)
    if ([P, p, e, alt, T, Pm].some(v => isNaN(v))) return

    const { netFactor: derate } = calculateGeneratorDerating({ altitudeM: alt, ambientTempC: T })

    const kVA_load  = (P / p) / e
    const kVA_start = Pm * (START_MULT[startMethod] || 0) / p

    const kVA_required = Math.max(kVA_load, kVA_start)
    const kVA_derated  = kVA_required / derate
    const recommended  = nextStd(GEN_SIZES, kVA_derated)

    setRes({
      kVA_load:  kVA_load.toFixed(0),
      kVA_start: kVA_start.toFixed(0),
      derate:    (derate * 100).toFixed(1),
      kVA_req:   kVA_derated.toFixed(0),
      gen:       recommended,
      altitudeM: alt,
      ambientTempC: T,
    })
  }

  const pushKnownHistory = () => {
    if (!addHistory || !res) return
    addHistory({
      tab:    'Generator › Known Load',
      expr:   `${kw} kW · ${altitude}m · ${temp}°C`,
      result: `Gen ${res.gen}kVA`,
    })
  }

  return (
    <div>
      <Inp label="Total Connected Load (kW)" type="text" inputMode="decimal" value={kw} onChange={e => setKw(toDecimal(e.target.value))} />
      <Inp label="Overall Power Factor" type="text" inputMode="decimal" value={kwPf} onChange={e => setKwPf(toDecimal(e.target.value))} />
      <Inp label="Load Efficiency (%)" type="text" inputMode="decimal" value={eff} onChange={e => setEff(toDecimal(e.target.value))} />
      <Inp
        label="Site Altitude (m)" type="text" inputMode="decimal" value={altitude}
        onChange={e => setAlt(toDecimal(e.target.value))}
        sub="Affects air cooling and combustion"
      />
      <Inp label="Ambient Temperature (°C)" type="text" inputMode="decimal" value={temp} onChange={e => setTemp(toDecimal(e.target.value))} />
      <Inp label="Largest Motor (kW)" type="text" inputMode="decimal" value={largestMotorKw} onChange={e => setLmKw(toDecimal(e.target.value))} />

      <div style={{ marginBottom: '12px' }}>
        <span style={S.lbl}>Motor Start Method</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {KNOWN_START_METHODS.map(m => (
            <button
              key={m}
              onClick={() => setStart(m)}
              style={{
                flex: 1, padding: '9px 4px', borderRadius: '10px', fontSize: '12px', fontWeight: '700',
                cursor: 'pointer',
                background: startMethod === m ? 'rgba(245,158,11,0.1)' : '#111',
                border: `1px solid ${startMethod === m ? AMBER : '#2a2a2a'}`,
                color: startMethod === m ? AMBER : 'rgba(255,255,255,0.55)',
              }}
            >
              {m === 'Star-Delta' ? 'Y/Δ' : m}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={calc}
        style={{
          width: '100%', padding: '11px', borderRadius: '10px', fontWeight: '700', fontSize: '13.5px',
          marginBottom: '14px', cursor: 'pointer', border: 'none', color: '#000',
          background: `linear-gradient(135deg, ${AMBER}, #d97706)`,
        }}
      >
        Calculate
      </button>

      {res && (
        <div>
          <div style={{ ...S.card, borderColor: `${AMBER}44` }}>
            <RowVal label="Load kVA"           value={`${res.kVA_load} kVA`} />
            <RowVal label="Motor Starting kVA" value={`${res.kVA_start} kVA`} accent={AMBER} />
            <RowVal label="Derating Factor"    value={`${res.derate}%`} />
            <RowVal label="Required (derated)" value={`${res.kVA_req} kVA`} accent={RED} />

            <div style={{ ...S.result, background: 'rgba(245,158,11,0.10)', border: '0.5px solid rgba(245,158,11,0.25)' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Recommended Generator</div>
              <div style={{ fontSize: '28px', fontWeight: '500', color: AMBER, fontFamily: 'monospace' }}>
                {res.gen} kVA
              </div>
            </div>

            <button
              onClick={pushKnownHistory}
              style={{
                marginTop: '10px', width: '100%', padding: '7px',
                borderRadius: '8px', border: `0.5px solid ${AMBER}`,
                background: 'transparent', color: AMBER, cursor: 'pointer', fontSize: '12px',
              }}
            >
              Save to history
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export default function GeneratorSizing({ addHistory }) {
  const { site } = useSite()

  // ── PDF export (ResultCard/useResultCard, shared.jsx) ──────────────────
  const { cardData, showCard, hideCard } = useResultCard()

  // ── Load list state ────────────────────────────────────────────────────
  const [loads, setLoads] = useState([
    { id: 1, name: 'Air compressor',    type: 'Motor',          kw: '15',  pf: '0.85', df: '80',  start: 'Star-Delta' },
    { id: 2, name: 'Lighting panel',    type: 'Fluorescent/LED',kw: '8',   pf: '0.92', df: '100', start: 'N/A' },
    { id: 3, name: 'Workshop sockets',  type: 'Mixed',          kw: '12',  pf: '0.80', df: '60',  start: 'N/A' },
  ])
  const [nextId, setNextId] = useState(4)
  const [editId, setEditId] = useState(null)

  // ── Generator de-rating state ──────────────────────────────────────────
  // Seeded from the real configured site (Settings), not a hardcoded
  // location. Previously defaulted to '1600'/'30' — Maseru/central Lesotho
  // values baked in regardless of where the user actually is.
  const [altitude,  setAltitude]  = useState(String(site.altitude || '1000'))
  const [ambTemp,   setAmbTemp]   = useState(String(site.ambient || '30'))
  const [margin,    setMargin]    = useState('25')
  const [genPF,     setGenPF]     = useState('0.8')

  // ── Transformer state ──────────────────────────────────────────────────
  const [vPri,  setVPri]  = useState('11000')
  const [vSec,  setVSec]  = useState('400')
  const [conn,  setConn]  = useState('Dyn11')
  const [pctZ,  setPctZ]  = useState('5')

  // ── Impedance state ────────────────────────────────────────────────────
  const [xdPct, setXdPct] = useState('15')

  // ── Active tab ─────────────────────────────────────────────────────────
  const [tab, setTab] = useState('loads')

  // ── Mode: Known Load Sizing vs Load Schedule Sizing ────────────────────
  // Default 'known' — matches the pre-merge default entry point (the old
  // standalone "Generator" tab), so nothing changes for the common quick
  // case; this is the lower-regret default if usage patterns turn out to
  // favor the other mode more often (cheap, reversible per [DEC-1]).
  const [mode, setMode] = useState('known')

  // ── Cross-module prefill (WorkspaceContext) ───────────────────────────
  // Publishes this tab's sizing result so RenewableEnergyCalculator's
  // Hybrid tab can prefill from it — same pattern as MotorCalculator's
  // flaSnapshot -> Cable Calculator. Per MotorCalculator.jsx's actual
  // implementation, the publish happens on an explicit user action
  // (there: the CALCULATE button; here: "Save to history"), NOT
  // automatically on every recalculation — opening this tab with its
  // default placeholder loads should not silently prefill Hybrid with
  // data nobody actually chose.
  const { setGeneratorSnapshot } = useWorkspace()

  // ─── Derived calculations ──────────────────────────────────────────────

  /**
   * LOAD TOTALS
   *
   * For each load:
   *   Demand kW   = kW_rated × (demand_factor / 100)
   *   Demand kVA  = Demand kW / PF
   *   Demand kVAR = kVA × √(1 − PF²)        [reactive component]
   *
   * System totals use vector addition, NOT arithmetic addition of kVAs:
   *   Total kVA = √(ΣkW² + ΣkVAR²)
   *   System PF = ΣkW / Total kVA
   *
   * Motor starting kVA = FLA kVA × starting multiplier
   * Generator must handle the LARGEST single motor start (not sum of all).
   */
  const totals = useMemo(() => {
    let sumKW = 0, sumKVAR = 0, maxStartKVA = 0

    const rows = loads.map(l => {
      const kw  = pf(l.kw)
      const lpf = Math.max(0.01, pf(l.pf, 0.85))
      const df  = pf(l.df, 100) / 100

      const dKW   = kw * df
      const dKVA  = dKW / lpf
      const dKVAR = dKVA * Math.sqrt(Math.max(0, 1 - lpf * lpf))
      const sKVA  = l.type === 'Motor' ? dKVA * (START_MULT[l.start] || 0) : 0

      sumKW   += dKW
      sumKVAR += dKVAR
      if (sKVA > maxStartKVA) maxStartKVA = sKVA

      return { ...l, dKW, dKVA, dKVAR, sKVA }
    })

    const totKVA = Math.sqrt(sumKW * sumKW + sumKVAR * sumKVAR)
    const sysPF  = totKVA > 0 ? sumKW / totKVA : 1

    return { rows, sumKW, sumKVAR, totKVA, sysPF, maxStartKVA }
  }, [loads])

  /**
   * GENERATOR SIZING  (ISO 8528-1)
   *
   * De-rating:
   *   Altitude: −3% output per 500m above 1000m AMSL
   *   Temp    : −1% per °C above 40°C ambient
   *   Combined: altFactor × tempFactor
   *
   * Sizing logic:
   *   1. governingKVA = max(system total kVA, largest motor start kVA)
   *   2. withMargin   = governingKVA × (1 + margin%)
   *   3. required     = withMargin / de-rate factor   (nameplate must cover this)
   *   4. stdSize      = next standard size above 'required'
   */
  const genRes = useMemo(() => {
    const alt = pf(altitude)
    const tmp = pf(ambTemp, 25)
    const mar = pf(margin, 25) / 100
    const gpf = pf(genPF, 0.8)

    // Migrated to shared lib function — was inline here, also duplicated
    // in RenewableEnergyCalculator.jsx's Hybrid tab, now a single source.
    // Verified behavior-identical before migrating; see
    // generatorDeratingMigration.verify.mjs.
    const { altFactor, tempFactor, netFactor } = calculateGeneratorDerating({
      altitudeM: alt,
      ambientTempC: tmp,
    })

    const governing  = Math.max(totals.totKVA, totals.maxStartKVA)
    const withMargin = governing * (1 + mar)
    const required   = withMargin / netFactor
    const stdSize    = nextStd(GEN_SIZES, required)

    // Push to history on calculation
    return { altFactor, tempFactor, netFactor, governing, withMargin, required, stdSize, gpf, altitudeM: alt, ambientTempC: tmp }
  }, [totals, altitude, ambTemp, margin, genPF])

  /**
   * TRANSFORMER SIZING
   *
   * Sized to match generator output kVA (gen is the source).
   *
   *   Turns ratio n  = Vp / Vs
   *   Ip (3φ)        = kVA × 1000 / (√3 × Vp)
   *   Is (3φ)        = kVA × 1000 / (√3 × Vs)
   *
   * Impedance:
   *   Base Z (sec)   = Vs² / (kVA × 1000)   [in ohms]
   *   Z_ohms         = (%Z / 100) × BaseZ
   */
  const trafoRes = useMemo(() => {
    const vp  = pf(vPri, 11000)
    const vs  = pf(vSec, 400)
    const kva = genRes.stdSize
    const z   = pf(pctZ, 5)

    const ratio  = vp / vs
    const ip     = (kva * 1000) / (SQRT3 * vp)
    const is_    = (kva * 1000) / (SQRT3 * vs)
    const stdKVA = nextStd(TRAFO_SIZES, kva)
    const zBase  = (vs * vs)   / (stdKVA * 1000)
    const zOhm   = (z / 100)   * zBase

    return { vp, vs, kva, ratio, ip, is_, z, zBase, zOhm, stdKVA }
  }, [genRes, vPri, vSec, pctZ])

  /**
   * IMPEDANCE & FAULT LEVEL  (simplified series model, IEC 60909)
   *
   * Per-unit system based on transformer secondary:
   *   Zbase  = Vs² / kVA_base
   *   Ibase  = kVA_base / (√3 × Vs)
   *
   * Generator Xd'' converted to system base (assumes gen kVA ≈ trafo kVA):
   *   Xd_pu  = Xd'' % / 100
   *
   * Total impedance (gen + transformer in series):
   *   Ztotal = Xd_pu + Ztrafo_pu
   *
   * 3φ fault current:
   *   Isc(3φ) = Ibase / Ztotal
   *
   * SHORT-CIRCUIT MVA:
   *   MVAsc = √3 × Vs × Isc(3φ) / 1,000,000
   *
   * ⚠ This is a simplified model (no R, no grid infeed, no cable impedance).
   *   Use dedicated power systems simulation software for final protection coordination.
   */
  const impedRes = useMemo(() => {
    const vs     = pf(vSec, 400)
    const baseVA = trafoRes.stdKVA * 1000
    const zBase  = (vs * vs) / baseVA
    const iBase  = baseVA / (SQRT3 * vs)

    const xdPu   = pf(xdPct, 15) / 100
    const zTraPu = pf(pctZ,  5)  / 100
    const zTot   = xdPu + zTraPu

    const isc3   = iBase / zTot
    const kAsc   = isc3  / 1000
    const mvasc  = (SQRT3 * vs * isc3) / 1e6

    return { baseVA, zBase, iBase, xdPu, zTraPu, zTot, isc3, kAsc, mvasc }
  }, [trafoRes, vSec, pctZ, xdPct])

  // ─── Load CRUD ──────────────────────────────────────────────────────────

  const addLoad = () => {
    const id = nextId
    setLoads(prev => [
      ...prev,
      { id, name: `Load ${id}`, type: 'Motor', kw: '5', pf: '0.85', df: '80', start: 'DOL' },
    ])
    setNextId(n => n + 1)
    setEditId(id)
  }

  const removeLoad = id => setLoads(prev => prev.filter(l => l.id !== id))

  const update = (id, field, val) =>
    setLoads(prev => prev.map(l => (l.id === id ? { ...l, [field]: val } : l)))

  // ─── History push ───────────────────────────────────────────────────────

  const pushHistory = () => {
    if (!addHistory) return
    addHistory({
      tab:    'Generator › Load Schedule',
      expr:   `${loads.length} loads · ${altitude}m · ${ambTemp}°C`,
      result: `Gen ${genRes.stdSize}kVA / Trafo ${trafoRes.stdKVA}kVA`,
    })
    setGeneratorSnapshot({
      stdSize: genRes.stdSize,
      netFactor: genRes.netFactor,
      altFactor: genRes.altFactor,
      tempFactor: genRes.tempFactor,
      gpf: genRes.gpf,
      altitudeM: genRes.altitudeM,
      ambientTempC: genRes.ambientTempC,
      timestamp: Date.now(),
    })
  }

  // ─── Report data builders ───────────────────────────────────────────────
  // Each mirrors the calculation actually shown on its tab — same source
  // values as the on-screen RowVal rows, not re-derived. These return plain
  // data objects (ResultCard/buildResultPdf shape) rather than calling
  // showCard directly, so the same per-stage content can be reused standalone
  // or folded into the combined report below without duplicating any of the
  // actual row-building logic.

  const buildGeneratorData = () => ({
    calculator: 'Power Systems — Generator Sizing',
    site: site.name,
    standard: 'ISO 8528-1 (de-rating) · SANS 10142 (demand factors)',
    inputs: [
      { label: 'Connected loads',    value: `${loads.length}` },
      { label: 'Altitude',           value: `${altitude} m AMSL` },
      { label: 'Ambient temp',       value: `${ambTemp} °C` },
      { label: 'Safety margin',      value: `${margin} %` },
      { label: 'Generator rated PF', value: genPF },
    ],
    sections: [
      {
        title: 'Load summary',
        rows: [
          { label: 'System load (vector sum)', value: `${totals.totKVA.toFixed(2)} kVA` },
          { label: 'Largest motor start kVA',   value: `${totals.maxStartKVA.toFixed(0)} kVA` },
          { label: 'System PF',                  value: `${totals.sysPF.toFixed(3)} lag`, warn: totals.sysPF < 0.8 },
        ],
      },
      {
        title: 'Sizing calculation',
        rows: [
          { label: 'Governing value',            value: `${genRes.governing.toFixed(2)} kVA` },
          { label: `+ ${margin}% margin`,         value: `${genRes.withMargin.toFixed(2)} kVA` },
          { label: 'Altitude de-rate factor',     value: `${(genRes.altFactor * 100).toFixed(1)} %` },
          { label: 'Temperature de-rate factor',  value: `${(genRes.tempFactor * 100).toFixed(1)} %` },
          { label: 'Combined de-rate',            value: `${(genRes.netFactor * 100).toFixed(1)} %` },
          { label: 'Required nameplate kVA',      value: `${genRes.required.toFixed(1)} kVA`, warn: true },
          { label: 'Recommended standard size',   value: `${genRes.stdSize} kVA`, accent: true },
          { label: 'Shaft output @ rated PF',      value: `${(genRes.stdSize * pf(genPF, 0.8)).toFixed(0)} kW` },
        ],
      },
    ],
    notes: totals.sysPF < 0.8
      ? `System PF ${totals.sysPF.toFixed(2)} is below 0.8 — consider capacitor correction to reduce kVAR burden and generator sizing penalty.`
      : undefined,
  })

  const buildTransformerData = () => ({
    calculator: 'Power Systems — Transformer Sizing',
    site: site.name,
    standard: 'IEC 60076',
    inputs: [
      { label: 'Primary voltage',   value: `${vPri} V` },
      { label: 'Secondary voltage', value: `${vSec} V` },
      { label: 'Vector group',      value: conn },
      { label: 'Transformer %Z',   value: `${pctZ} %` },
      { label: 'Input (generator std size)', value: `${trafoRes.kva.toFixed(1)} kVA` },
    ],
    sections: [{
      title: 'Calculated values',
      rows: [
        { label: 'Turns ratio n = Vp / Vs',          value: `${trafoRes.ratio.toFixed(3)} : 1` },
        { label: 'Primary current Ip (3φ)',           value: `${trafoRes.ip.toFixed(2)} A` },
        { label: 'Secondary current Is (3φ)',         value: `${trafoRes.is_.toFixed(2)} A` },
        { label: 'Base impedance (secondary)',        value: `${trafoRes.zBase.toFixed(4)} Ω` },
        { label: '%Z ohmic equivalent (Vs base)',     value: `${trafoRes.zOhm.toFixed(4)} Ω` },
        { label: 'Standard transformer size',         value: `${trafoRes.stdKVA} kVA`, accent: true },
      ],
    }],
  })

  const buildImpedanceData = () => ({
    calculator: 'Power Systems — Fault Level',
    site: site.name,
    standard: 'IEC 60909 (simplified series model)',
    inputs: [
      { label: "Generator Xd'' ",   value: `${xdPct} %` },
      { label: 'Transformer %Z',    value: `${pctZ} %` },
      { label: 'Secondary voltage', value: `${pf(vSec, 400)} V` },
    ],
    sections: [
      {
        title: 'Per-unit system base (secondary)',
        rows: [
          { label: 'Base kVA',           value: `${impedRes.baseVA.toFixed(0)} VA` },
          { label: 'Base impedance Zbase', value: `${impedRes.zBase.toFixed(4)} Ω` },
          { label: 'Base current Ibase',  value: `${impedRes.iBase.toFixed(2)} A` },
        ],
      },
      {
        title: '3φ fault current — generator + transformer',
        rows: [
          { label: "Gen Xd'' (p.u.)",   value: impedRes.xdPu.toFixed(4) },
          { label: 'Trafo Z (p.u.)',     value: impedRes.zTraPu.toFixed(4) },
          { label: 'Total Z (p.u.)',     value: `${impedRes.zTot.toFixed(4)} p.u.` },
          { label: 'Isc 3φ — secondary bus', value: `${impedRes.isc3.toFixed(0)} A`, warn: true },
          { label: 'Fault level',         value: `${impedRes.kAsc.toFixed(3)} kA`, warn: true },
          { label: 'Short-circuit MVA',   value: `${impedRes.mvasc.toFixed(3)} MVA` },
        ],
      },
    ],
    notes: 'Simplified model — series impedance only. No R component, no grid infeed, no cable impedance, no 1.05 voltage factor (IEC 60909 Clause 8). Use for initial breaker/fuse kA rating only; final protection coordination requires dedicated power systems simulation software or manual IEC 60909 calculation.',
  })

  /**
   * COMBINED REPORT — Gen Sizing → Transformer → Fault Level
   *
   * Per the parked decision (2026-07-22 handoff): one PDF spanning all
   * three stages, retrievable from any of them via the flow-strip, replacing
   * the three separate per-stage exports rather than sitting alongside them.
   *
   * Reuses the existing ResultCard/buildResultPdf shape as-is — sections
   * from all three stages are concatenated with stage-prefixed titles so
   * each block is traceable back to its source calculation, and each
   * stage's own inputs are folded in as a leading section rather than
   * dropped, so the report is self-contained without needing all three
   * screens open at once. No new PDF-rendering code needed.
   */
  const buildCombinedReportData = () => {
    const gen = buildGeneratorData()
    const trafo = buildTransformerData()
    const imped = buildImpedanceData()

    const prefixed = (stageLabel, data) => [
      { title: `${stageLabel} — Inputs`, rows: data.inputs.map(r => ({ ...r })) },
      ...data.sections.map(s => ({ ...s, title: `${stageLabel} — ${s.title}` })),
    ]

    const notes = [gen.notes, imped.notes].filter(Boolean).join('\n\n')

    return {
      calculator: 'Power Systems — Full Report (Generator → Transformer → Fault Level)',
      site: site.name,
      standard: 'ISO 8528-1 · SANS 10142 · IEC 60076 · IEC 60909 (simplified)',
      sections: [
        ...prefixed('Generator', gen),
        ...prefixed('Transformer', trafo),
        ...prefixed('Fault Level', imped),
      ],
      notes: notes || undefined,
    }
  }

  const exportCombinedReport = () => showCard(buildCombinedReportData())

  // ─── Tab definitions ────────────────────────────────────────────────────

  // Stage tabs for Load Schedule Sizing. Labels deliberately avoid repeating
  // "Generator" (the parent tab's own name) — the 'gen' stage displays as
  // "Gen", short for Generator, to prevent the exact naming collision this
  // whole restructure was meant to fix. 'imped' displays as "Fault Level" —
  // states the output being solved for, not the calculation method used to
  // get there (an impedance calc). IDs are unchanged from before to avoid
  // touching every tab===... check below; only the user-facing label moved.
  const STAGE_TABS = [
    { id: 'loads', label: 'Loads',        icon: '⚡' },
    { id: 'gen',   label: 'Gen',          icon: '🔌' },
    { id: 'trafo', label: 'Transformer',  icon: '⚙'  },
    { id: 'imped', label: 'Fault Level',  icon: 'Ω'  },
  ]

  const stageValue = {
    loads: `${totals.totKVA.toFixed(1)}`,
    gen:   `${genRes.stdSize}`,
    trafo: `${trafoRes.stdKVA}`,
    imped: `${impedRes.kAsc.toFixed(1)}kA`,
  }
  const stageColor = { loads: ACCENT, gen: AMBER, trafo: GREEN, imped: PURPLE }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '12px', fontFamily: 'sans-serif' }}>

      {/* ── Mode choice: Known Load Sizing vs Load Schedule Sizing ─────── */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
          Choose your starting point
        </div>
        <div style={{ display: 'flex', background: '#111', borderRadius: '12px', padding: '4px',
          border: '1px solid #2a2a2a', marginBottom: '14px' }}>
          {[
            { id: 'known',    t1: 'Known Load Sizing',    t2: 'I have one total kW/kVA' },
            { id: 'schedule', t1: 'Load Schedule Sizing', t2: 'Build up load by load' },
          ].map(m => (
            <div
              key={m.id}
              onClick={() => setMode(m.id)}
              style={{
                flex: 1, textAlign: 'center', padding: '11px 6px', borderRadius: '9px', cursor: 'pointer',
                background: mode === m.id ? 'rgba(34,211,238,0.12)' : 'transparent',
                border: mode === m.id ? `1px solid ${ACCENT}` : '1px solid transparent',
              }}
            >
              <div style={{ fontSize: '12.5px', fontWeight: '800', color: mode === m.id ? ACCENT : 'rgba(255,255,255,0.55)' }}>
                {m.t1}
              </div>
              <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                {m.t2}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Known Load Sizing ───────────────────────────────────────────── */}
      {mode === 'known' && <KnownLoadSizing addHistory={addHistory} />}

      {/* ── Load Schedule Sizing ─────────────────────────────────────────
          Flow-strip replaces both the old 3-stat summary banner and the
          old plain tab bar: it shows every stage's live output at once
          (including Fault Level, which the old banner omitted) and doubles
          as stage navigation, so the Loads→Gen→Transformer→Fault Level
          dependency chain is always visible instead of implied by four
          equal-looking tabs. */}
      {mode === 'schedule' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', overflowX: 'auto',
            padding: '10px 2px', marginBottom: '4px', background: 'rgba(255,255,255,0.02)',
            borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {STAGE_TABS.map((t, i) => (
              <Fragment key={t.id}>
                <div
                  onClick={() => setTab(t.id)}
                  style={{
                    flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                    padding: '6px 10px', borderRadius: '10px', cursor: 'pointer', minWidth: '62px',
                    background: tab === t.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stageColor[t.id] }} />
                  <span style={{ fontSize: '9.5px', fontWeight: '700', color: 'rgba(255,255,255,0.55)',
                    textTransform: 'uppercase', letterSpacing: '0.3px' }}>{t.label}</span>
                  <span style={{ fontSize: '12.5px', fontWeight: '800', fontFamily: 'monospace', color: stageColor[t.id] }}>
                    {stageValue[t.id]}
                  </span>
                </div>
                {i < STAGE_TABS.length - 1 && (
                  <span style={{ color: '#444', fontSize: '12px', flex: 'none', paddingBottom: '12px' }}>→</span>
                )}
              </Fragment>
            ))}
          </div>

      {/* ════════════════════════════════════════════════════════════════
          TAB: LOADS
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'loads' && (
        <div>
          {totals.rows.map(l => (
            <div key={l.id} style={S.card}>
              {/* Load card header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                {editId === l.id ? (
                  <input
                    value={l.name}
                    onChange={e => update(l.id, 'name', e.target.value)}
                    style={{ ...S.inp, width: '150px', fontSize: '13px', fontWeight: '500' }}
                  />
                ) : (
                  <span style={{ fontWeight: '500', fontSize: '13px', color: '#fff' }}>{l.name}</span>
                )}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => setEditId(editId === l.id ? null : l.id)}
                    style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                      border: `0.5px solid ${ACCENT}`, background: 'transparent', color: ACCENT, cursor: 'pointer',
                    }}
                  >
                    {editId === l.id ? 'done' : 'edit'}
                  </button>
                  <button
                    onClick={() => removeLoad(l.id)}
                    style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                      border: '0.5px solid rgba(248,113,113,0.5)', background: 'transparent',
                      color: '#f87171', cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Expanded edit form */}
              {editId === l.id ? (
                <div>
                  <div style={S.grid2}>
                    <Sel
                      label="Load type"
                      value={l.type}
                      onChange={e => update(l.id, 'type', e.target.value)}
                      options={LOAD_TYPES}
                    />
                    <Sel
                      label="Starting method"
                      value={l.start}
                      onChange={e => update(l.id, 'start', e.target.value)}
                      options={START_METHODS}
                    />
                  </div>
                  <div style={S.grid2}>
                    <Inp
                      label="Rated power (kW)"
                      type="text" inputMode="decimal"
                      value={l.kw}
                      onChange={e => update(l.id, 'kw', toDecimal(e.target.value))}
                    />
                    <Inp
                      label="Power factor"
                      type="text" inputMode="decimal"
                      value={l.pf}
                      onChange={e => update(l.id, 'pf', toDecimal(e.target.value))}
                    />
                  </div>
                  <Inp
                    label="Demand factor (%)"
                    sub="100% = fully loaded at all times · 80% = typical running motor · 60% = diversified"
                    type="text" inputMode="decimal"
                    value={l.df}
                    onChange={e => update(l.id, 'df', toDecimal(e.target.value))}
                  />
                </div>
              ) : (
                /* Collapsed summary row */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '6px' }}>
                  {[
                    { lbl: 'kW demand', v: l.dKW.toFixed(1) },
                    { lbl: 'kVA',       v: l.dKVA.toFixed(1) },
                    { lbl: 'kVAR',      v: l.dKVAR.toFixed(1) },
                  ].map(s => (
                    <div
                      key={s.lbl}
                      style={{
                        background: 'rgba(0,0,0,0.25)', borderRadius: '6px',
                        padding: '5px', textAlign: 'center',
                        border: '0.5px solid rgba(255,255,255,0.07)',
                      }}
                    >
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{s.lbl}</div>
                      <div style={{ fontSize: '13px', fontWeight: '500', fontFamily: 'monospace', color: '#fff' }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Starting kVA badge for motors */}
              {l.type === 'Motor' && l.sKVA > 0 && (
                <div style={{
                  padding: '4px 8px', borderRadius: '6px',
                  background: 'rgba(245,158,11,0.12)',
                  border: '0.5px solid rgba(245,158,11,0.25)',
                  fontSize: '11px', color: AMBER,
                }}>
                  Starting kVA: {l.sKVA.toFixed(0)} kVA  ({l.start} — {START_MULT[l.start] || '—'}× FLA)
                </div>
              )}
            </div>
          ))}

          {/* Add load button */}
          <button
            onClick={addLoad}
            style={{
              width: '100%', padding: '8px', borderRadius: '8px', marginBottom: '12px',
              border: `0.5px dashed ${ACCENT}`, background: 'transparent',
              color: ACCENT, cursor: 'pointer', fontSize: '13px',
            }}
          >
            + Add load
          </button>

          {/* System totals card */}
          <div style={{ ...S.card, borderColor: `${ACCENT}44` }}>
            <div style={{ ...S.subHead, color: ACCENT }}>System totals</div>
            <RowVal label="Total demand (active)"     value={`${totals.sumKW.toFixed(2)} kW`} />
            <RowVal label="Total reactive"            value={`${totals.sumKVAR.toFixed(2)} kVAR`} />
            <RowVal label="Total apparent (vector)"   value={`${totals.totKVA.toFixed(2)} kVA`} accent={ACCENT} />
            <RowVal
              label="System (composite) PF"
              value={`${totals.sysPF.toFixed(3)} lag`}
              accent={totals.sysPF < 0.8 ? RED : GREEN}
            />
            <RowVal label="Largest motor start kVA"   value={`${totals.maxStartKVA.toFixed(0)} kVA`} accent={AMBER} />
            {totals.sysPF < 0.8 && (
              <div style={S.warn}>
                ⚠  System PF {totals.sysPF.toFixed(2)} — below 0.8. Consider capacitor correction to reduce kVAR burden and generator sizing penalty.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: GENERATOR
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'gen' && (
        <div>
          <div style={S.card}>
            <div style={{ ...S.subHead, color: AMBER }}>De-rating parameters (ISO 8528-1)</div>
            <div style={S.grid2}>
              <Inp
                label="Altitude (m AMSL)"
                sub="Uses your configured site altitude by default — override for a different site"
                type="text" inputMode="decimal" value={altitude} onChange={e => setAltitude(toDecimal(e.target.value))}
              />
              <Inp
                label="Ambient temp (°C)"
                sub="De-rate kicks in above 40°C"
                type="text" inputMode="decimal" value={ambTemp} onChange={e => setAmbTemp(toDecimal(e.target.value))}
              />
            </div>
            <div style={S.grid2}>
              <Inp
                label="Safety margin (%)"
                sub="20–30% recommended"
                type="text" inputMode="decimal" value={margin} onChange={e => setMargin(toDecimal(e.target.value))}
              />
              <Inp
                label="Generator rated PF"
                sub="Most diesel sets stamped 0.8"
                type="text" inputMode="decimal" value={genPF} onChange={e => setGenPF(toDecimal(e.target.value))}
              />
            </div>
          </div>

          <div style={{ ...S.card, borderColor: `${AMBER}44` }}>
            <div style={{ ...S.subHead, color: AMBER }}>Sizing calculation steps</div>
            <RowVal label="1 · System load (vector sum)"             value={`${totals.totKVA.toFixed(2)} kVA`} />
            <RowVal label="2 · Largest motor start kVA"              value={`${totals.maxStartKVA.toFixed(0)} kVA`} accent={AMBER} />
            <RowVal label="3 · Governing value (max of 1 & 2)"       value={`${genRes.governing.toFixed(2)} kVA`} />
            <RowVal label={`4 · + ${margin}% margin`}                value={`${genRes.withMargin.toFixed(2)} kVA`} />
            <RowVal label="5 · Altitude de-rate factor"              value={`${(genRes.altFactor * 100).toFixed(1)}%   (ISO: −3% per 500m above 1000m)`} />
            <RowVal label="6 · Temperature de-rate factor"           value={`${(genRes.tempFactor * 100).toFixed(1)}%   (−1%/°C above 40°C)`} />
            <RowVal label="7 · Combined de-rate"                     value={`${(genRes.netFactor * 100).toFixed(1)}%`} />
            <RowVal label="8 · Required nameplate kVA"               value={`${genRes.required.toFixed(1)} kVA`} accent={RED} />

            <div style={{ ...S.result, background: 'rgba(245,158,11,0.10)', border: '0.5px solid rgba(245,158,11,0.25)' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Recommended standard size</div>
              <div style={{ fontSize: '28px', fontWeight: '500', color: AMBER, fontFamily: 'monospace' }}>
                {genRes.stdSize} kVA
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                @ {genPF} p.f. = {(genRes.stdSize * pf(genPF, 0.8)).toFixed(0)} kW shaft output
              </div>
            </div>

            <button
              onClick={pushHistory}
              style={{
                marginTop: '10px', width: '100%', padding: '7px',
                borderRadius: '8px', border: `0.5px solid ${AMBER}`,
                background: 'transparent', color: AMBER, cursor: 'pointer', fontSize: '12px',
              }}
            >
              Save to history
            </button>

            <button
              onClick={exportCombinedReport}
              style={{
                marginTop: '8px', width: '100%', padding: '7px',
                borderRadius: '8px', border: '0.5px solid rgba(255,255,255,0.15)',
                background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '12px',
              }}
            >
              📄 Generate Full Report (Gen + Transformer + Fault Level)
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: TRANSFORMER
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'trafo' && (
        <div>
          <div style={S.card}>
            <div style={{ ...S.subHead, color: GREEN }}>Transformer parameters</div>
            <div style={S.grid2}>
              <Inp
                label="Primary voltage (V)"
                sub="e.g. 11000 · 6600 · 3300 · 22000"
                type="text" inputMode="decimal" value={vPri} onChange={e => setVPri(toDecimal(e.target.value))}
              />
              <Inp
                label="Secondary voltage (V)"
                sub="e.g. 400 · 230 · 690"
                type="text" inputMode="decimal" value={vSec} onChange={e => setVSec(toDecimal(e.target.value))}
              />
            </div>

            <div style={{ marginBottom: '8px' }}>
              <span style={S.lbl}>Vector group / connection type</span>
              <select
                style={{ ...S.inp, cursor: 'pointer' }}
                value={conn}
                onChange={e => setConn(e.target.value)}
              >
                {CONN_TYPES.map(c => (
                  <option key={c.v} value={c.v}>{c.v}</option>
                ))}
              </select>
              {/* Inline description of selected vector group */}
              {(() => {
                const selected = CONN_TYPES.find(c => c.v === conn)
                return selected ? (
                  <div style={{
                    marginTop: '6px', padding: '6px 8px',
                    background: 'rgba(74,222,128,0.06)',
                    border: '0.5px solid rgba(74,222,128,0.2)',
                    borderRadius: '6px',
                  }}>
                    <div style={{ fontSize: '11px', color: GREEN, marginBottom: '2px' }}>{selected.desc}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', lineHeight: '1.4' }}>{selected.note}</div>
                  </div>
                ) : null
              })()}
            </div>

            <Inp
              label="Transformer %Z (impedance)"
              sub="4–5%: small distribution · 5–7%: medium · 7–10%: large power transformers"
              type="text" inputMode="decimal" value={pctZ} onChange={e => setPctZ(toDecimal(e.target.value))}
            />
          </div>

          <div style={{ ...S.card, borderColor: `${GREEN}44` }}>
            <div style={{ ...S.subHead, color: GREEN }}>Calculated values</div>
            <RowVal label="Input (generator std size)"     value={`${trafoRes.kva.toFixed(1)} kVA`} />
            <RowVal label="Turns ratio  n = Vp / Vs"       value={`${trafoRes.ratio.toFixed(3)} : 1`} />
            <RowVal label="Primary current  Ip (3φ)"       value={`${trafoRes.ip.toFixed(2)} A`} />
            <RowVal label="Secondary current  Is (3φ)"     value={`${trafoRes.is_.toFixed(2)} A`} />
            <RowVal label="Base impedance (secondary)"      value={`${trafoRes.zBase.toFixed(4)} Ω`} />
            <RowVal label={`%Z ohmic equiv (Vs base)`}      value={`${trafoRes.zOhm.toFixed(4)} Ω`} />
            <RowVal label="Vector group"                    value={conn} accent={GREEN} />

            <div style={{ ...S.result, background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.2)' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Standard transformer size</div>
              <div style={{ fontSize: '28px', fontWeight: '500', color: GREEN, fontFamily: 'monospace' }}>
                {trafoRes.stdKVA} kVA
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                {(pf(vPri) / 1000).toFixed(pf(vPri) >= 1000 ? 0 : 1)} kV / {vSec} V  ·  {conn}  ·  {pctZ}% Z
              </div>
            </div>

            <button
              onClick={exportCombinedReport}
              style={{
                marginTop: '10px', width: '100%', padding: '7px',
                borderRadius: '8px', border: '0.5px solid rgba(255,255,255,0.15)',
                background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '12px',
              }}
            >
              📄 Generate Full Report (Gen + Transformer + Fault Level)
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB: IMPEDANCE
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'imped' && (
        <div>
          <div style={S.card}>
            <div style={{ ...S.subHead, color: PURPLE }}>Source impedances</div>
            <div style={S.grid2}>
              <Inp
                label="Generator Xd'' (%)"
                sub='Subtransient reactance. Typical: 10–20%'
                type="text" inputMode="decimal" value={xdPct} onChange={e => setXdPct(toDecimal(e.target.value))}
              />
              <Inp
                label="Transformer %Z"
                sub="Synced with Transformer tab"
                type="text" inputMode="decimal" value={pctZ} onChange={e => setPctZ(toDecimal(e.target.value))}
              />
            </div>
            <div style={{
  ...S.warn,
  background: 'rgba(192,132,252,0.08)',
  border: '0.5px solid rgba(192,132,252,0.2)',
  borderRadius: '8px', padding: '8px', fontSize: '10px',
  color: 'rgba(192,132,252,0.9)', marginTop: '4px', lineHeight: '1.5',
}}>
              Xd'' governs fault current during the first 3–5 cycles (subtransient period) — this is what determines breaker and fuse requirements. Generator Xd'' nameplate is usually 10–20%; always use the manufacturer datasheet value.
            </div>
          </div>

          <div style={{ ...S.card, borderColor: `${PURPLE}44` }}>
            <div style={{ ...S.subHead, color: PURPLE }}>Per-unit system base  (secondary)</div>
            <RowVal label="Base kVA"              value={`${impedRes.baseVA.toFixed(0)} VA`} />
            <RowVal label="Base voltage"           value={`${pf(vSec, 400)} V`} />
            <RowVal label="Base impedance Zbase"   value={`${impedRes.zBase.toFixed(4)} Ω`} />
            <RowVal label="Base current Ibase"     value={`${impedRes.iBase.toFixed(2)} A`} />
          </div>

          <div style={{ ...S.card, borderColor: `${PURPLE}44` }}>
            <div style={{ ...S.subHead, color: PURPLE }}>3φ fault current — generator + transformer (IEC 60909 simplified)</div>
            <RowVal label="Gen Xd''   (p.u.)"          value={impedRes.xdPu.toFixed(4)} />
            <RowVal label="Trafo Z    (p.u.)"           value={impedRes.zTraPu.toFixed(4)} />
            <RowVal label="Total Z    (p.u.)"           value={`${impedRes.zTot.toFixed(4)} p.u.`} accent={PURPLE} />
            <RowVal label="Isc  3φ — secondary bus"    value={`${impedRes.isc3.toFixed(0)} A`} accent={RED} />
            <RowVal label="Fault level"                 value={`${impedRes.kAsc.toFixed(3)} kA`} accent={RED} />
            <RowVal label="Short-circuit MVA"           value={`${impedRes.mvasc.toFixed(3)} MVA`} />

            <div style={S.warn}>
              ⚠  SIMPLIFIED MODEL — series impedance only. No R component, no grid infeed, no cable impedance, no 1.05 voltage factor (IEC 60909 Clause 8). Use this for initial breaker/fuse kA rating only. Final protection coordination requires dedicated power systems simulation software or manual IEC 60909 calculation.
            </div>

            <button
              onClick={exportCombinedReport}
              style={{
                marginTop: '10px', width: '100%', padding: '7px',
                borderRadius: '8px', border: '0.5px solid rgba(255,255,255,0.15)',
                background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '12px',
              }}
            >
              📄 Generate Full Report (Gen + Transformer + Fault Level)
            </button>
          </div>
        </div>
      )}

        </div>
      )}

      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}
