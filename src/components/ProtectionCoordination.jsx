import { useState, useMemo } from 'react'
import { ResultCard, useResultCard } from './shared'
import {
  IDMT_CURVES,
  evaluateChain,
  checkChainMargins,
  genericAnsiFusePoints,
  validateChain,
  computeReferralFactors,
} from './protectionCoordinationEngine'

const pf = (v) => parseFloat(String(v).replace(',', '.')) || 0
const uid = () => Math.random().toString(36).slice(2, 9)

const ANSI_RATINGS = [6, 10, 15, 25, 40, 65, 100, 140, 200]
const DEVICE_COLORS = ['#f59e0b', '#22d3ee', '#a78bfa', '#34d399', '#f472b6', '#fb923c']

// ── Small styled primitives (visually consistent with Protection.jsx) ──────
function NumInput({ label, value, onChange, unit, placeholder = '0', note }) {
  return (
    <div className="mb-2">
      {label && <label className="text-gray-400 text-xs mb-1 block">{label}{note && <span className="text-gray-600 ml-1">({note})</span>}</label>}
      <div className="flex items-center bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value.replace(',', '.'))}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-white text-sm px-3 py-2 outline-none"
        />
        {unit && <span className="text-gray-500 text-xs px-2">{unit}</span>}
      </div>
    </div>
  )
}

function TextInput({ label, value, onChange, placeholder }) {
  return (
    <div className="mb-2">
      {label && <label className="text-gray-400 text-xs mb-1 block">{label}</label>}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-white text-sm px-3 py-2 outline-none"
      />
    </div>
  )
}

function ButtonGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${value === o.value ? 'bg-amber-500 text-black' : 'bg-[#1c1c1c] text-gray-400'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Card({ title, accent, children, onRemove, onMoveUp, onMoveDown }) {
  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-3">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a2a]" style={{ backgroundColor: `${accent}18` }}>
        <span className="text-xs font-bold" style={{ color: accent }}>{title}</span>
        <div className="flex items-center gap-1">
          {onMoveUp && <button onClick={onMoveUp} className="text-gray-500 text-xs px-1.5">▲</button>}
          {onMoveDown && <button onClick={onMoveDown} className="text-gray-500 text-xs px-1.5">▼</button>}
          {onRemove && <button onClick={onRemove} className="text-red-400 text-xs px-1.5">✕</button>}
        </div>
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  )
}

// ── Point editors ────────────────────────────────────────────────────────────
function RelayEditor({ point, onChange }) {
  return (
    <>
      <TextInput label="Label" value={point.label} onChange={v => onChange({ ...point, label: v })} placeholder="e.g. RMU feeder relay" />
      <label className="text-gray-400 text-xs mb-1 block">Curve Type</label>
      <ButtonGroup
        options={IDMT_CURVES.map(c => ({ value: c.id, label: c.label.split(' ')[0] }))}
        value={point.curveId}
        onChange={v => onChange({ ...point, curveId: v })}
      />
      <NumInput label="Pickup Setting (Is)" value={point.pickupA} onChange={v => onChange({ ...point, pickupA: v })} unit="A" />
      <NumInput label="TMS" value={point.tms} onChange={v => onChange({ ...point, tms: v })} note="typically 0.05–1.0" />
      <NumInput
        label="Fault Current Override (optional)"
        value={point.faultCurrentA || ''}
        onChange={v => onChange({ ...point, faultCurrentA: v })}
        unit="A"
        note="leave blank to inherit from upstream"
      />
    </>
  )
}

function FuseEditor({ point, onChange }) {
  const addCustomPoint = () => onChange({ ...point, customPoints: [...(point.customPoints || []), ['', '']] })
  const updateCustomPoint = (i, idx, v) => {
    const pts = [...(point.customPoints || [])]
    pts[i] = [...pts[i]]
    pts[i][idx] = v
    onChange({ ...point, customPoints: pts })
  }
  const removeCustomPoint = (i) => {
    const pts = (point.customPoints || []).filter((_, j) => j !== i)
    onChange({ ...point, customPoints: pts })
  }

  return (
    <>
      <TextInput label="Label" value={point.label} onChange={v => onChange({ ...point, label: v })} placeholder="e.g. Pole-top expulsion fuse" />
      <label className="text-gray-400 text-xs mb-1 block">Curve Source</label>
      <ButtonGroup
        options={[{ value: 'generic-ansi', label: 'Generic ANSI K/T' }, { value: 'custom', label: 'Custom (from datasheet)' }]}
        value={point.fuseSource}
        onChange={v => onChange({ ...point, fuseSource: v })}
      />

      {point.fuseSource === 'generic-ansi' && <>
        <div className="bg-[#0f1520] border border-[#1e2a3a] rounded-lg px-3 py-2 text-[11px] text-gray-500 mb-2">
          Representative ANSI reference curve, not a specific manufacturer's exact tested curve — confirm against the actual fuse's datasheet before final sign-off.
        </div>
        <label className="text-gray-400 text-xs mb-1 block">Fuse Class</label>
        <ButtonGroup
          options={[{ value: 'K', label: 'Type K (Fast)' }, { value: 'T', label: 'Type T (Slow)' }]}
          value={point.fuseClass}
          onChange={v => onChange({ ...point, fuseClass: v })}
        />
        <label className="text-gray-400 text-xs mb-1 block">Current Rating</label>
        <ButtonGroup
          options={ANSI_RATINGS.map(r => ({ value: r, label: `${r}A` }))}
          value={point.ratingA}
          onChange={v => onChange({ ...point, ratingA: v })}
        />
        <TextInput label="Manufacturer / part (for your records)" value={point.manufacturer || ''} onChange={v => onChange({ ...point, manufacturer: v })} placeholder="e.g. Eaton Cooper Power K-link" />
      </>}

      {point.fuseSource === 'custom' && <>
        <TextInput label="Manufacturer / part" value={point.manufacturer || ''} onChange={v => onChange({ ...point, manufacturer: v })} placeholder="e.g. Eaton, ABB, Siemens…" />
        <label className="text-gray-400 text-xs mb-1 block">Curve Points (from datasheet — current, time)</label>
        {(point.customPoints || []).map((p, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <input type="text" inputMode="decimal" value={p[0]} onChange={e => updateCustomPoint(i, 0, e.target.value.replace(',', '.'))}
              placeholder="A" className="flex-1 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-white text-sm px-3 py-2 outline-none" />
            <input type="text" inputMode="decimal" value={p[1]} onChange={e => updateCustomPoint(i, 1, e.target.value.replace(',', '.'))}
              placeholder="s" className="flex-1 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg text-white text-sm px-3 py-2 outline-none" />
            <button onClick={() => removeCustomPoint(i)} className="text-red-400 text-xs px-2">✕</button>
          </div>
        ))}
        <button onClick={addCustomPoint} className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-gray-400 text-xs py-2 rounded-lg mb-2">
          + Add curve point
        </button>
        <div className="text-[11px] text-gray-600 mb-2">Need at least 2 points, ordered by increasing current, from the fuse's minimum-melting (or total-clearing) curve.</div>
      </>}

      <NumInput
        label="Fault Current Override (optional)"
        value={point.faultCurrentA || ''}
        onChange={v => onChange({ ...point, faultCurrentA: v })}
        unit="A"
        note="leave blank to inherit from upstream"
      />
    </>
  )
}

function TransformerEditor({ point, onChange }) {
  return (
    <>
      <TextInput label="Label" value={point.label} onChange={v => onChange({ ...point, label: v })} placeholder="e.g. 11kV/400V 500kVA" />
      <NumInput label="Rating" value={point.kva} onChange={v => onChange({ ...point, kva: v })} unit="kVA" />
      <NumInput label="Primary Voltage" value={point.vPrimary} onChange={v => onChange({ ...point, vPrimary: v })} unit="V" />
      <NumInput label="Secondary Voltage" value={point.vSecondary} onChange={v => onChange({ ...point, vSecondary: v })} unit="V" />
      <div className="text-[11px] text-gray-600">Current is translated across this point by turns ratio. Cable/line impedance between points is NOT modeled — enter fault-current overrides on adjacent points where you have real network figures.</div>
    </>
  )
}

// ── TCC log-log plot ─────────────────────────────────────────────────────────
// Currents are REFERRED to the load-end (first point) voltage base across any
// transformer boundary in the chain — standard TCC-study practice — so a
// mixed-voltage chain plots on one physically comparable axis rather than
// jumping discontinuously at each transformer. See computeReferralFactors in
// the engine for the math; this component only consumes it for display.
function TccPlot({ chain, evaluated }) {
  const W = 640, H = 420, padL = 50, padR = 12, padT = 12, padB = 34
  const plotW = W - padL - padR, plotH = H - padT - padB

  const referralFactors = useMemo(() => computeReferralFactors(chain), [chain])

  // Gather every referred current and every finite time actually in play,
  // from both the sampled curves and the evaluated points, then derive the
  // axis range from that — rather than guessing bounds up front and hoping
  // the data fits inside them.
  const { curves, markers, currentMin, currentMax, timeMin, timeMax } = useMemo(() => {
    const allCurrents = []
    const allTimes = []
    const curveDefs = []

    chain.forEach((point, i) => {
      if (point.type === 'transformer') return
      const factor = referralFactors[i]
      const evalResult = evaluated[i]

      if (point.type === 'relay') {
        const pickupA = pf(point.pickupA), tms = pf(point.tms)
        const curve = IDMT_CURVES.find(c => c.id === point.curveId)
        if (pickupA > 0 && tms > 0 && curve) {
          curveDefs.push({ id: point.id, kind: 'relay', pickupA, tms, curve, factor })
          allCurrents.push(pickupA * factor)
        }
      } else if (point.type === 'fuse') {
        const rawPoints = point.fuseSource === 'custom'
          ? (point.customPoints || []).map(([c, t]) => [pf(c), pf(t)]).filter(([c, t]) => c > 0 && t > 0)
          : (pf(point.ratingA) > 0 ? genericAnsiFusePoints(pf(point.ratingA), point.fuseClass).points : [])
        if (rawPoints.length >= 2) {
          curveDefs.push({ id: point.id, kind: 'fuse', points: rawPoints, factor })
          rawPoints.forEach(([c, t]) => { allCurrents.push(c * factor); allTimes.push(t) })
        }
      }

      if (evalResult && evalResult.timeS != null && evalResult.currentA != null) {
        allCurrents.push(evalResult.currentA * factor)
        allTimes.push(evalResult.timeS)
      }
    })

    // Sensible fallback range if nothing usable is defined yet, so the plot
    // still renders (empty axes) rather than erroring or disappearing.
    if (allCurrents.length === 0) allCurrents.push(10, 1000)
    if (allTimes.length === 0) allTimes.push(0.1, 10)

    let iMin = Math.max(0.1, Math.pow(10, Math.floor(Math.log10(Math.min(...allCurrents)) - 0.3)))
    let iMax = Math.pow(10, Math.ceil(Math.log10(Math.max(...allCurrents)) + 0.3))
    let tMin = Math.max(0.001, Math.pow(10, Math.floor(Math.log10(Math.min(...allTimes)) - 0.3)))
    let tMax = Math.min(10000, Math.pow(10, Math.ceil(Math.log10(Math.max(...allTimes)) + 0.3)))

    // Guard against a degenerate (near-zero-span) range, which would divide
    // by ~zero in the log-log coordinate mapping below.
    if (Math.log10(iMax / iMin) < 1) { iMax = iMin * 10 }
    if (Math.log10(tMax / tMin) < 1) { tMax = tMin * 10 }

    return { curves: curveDefs, markers: null, currentMin: iMin, currentMax: iMax, timeMin: tMin, timeMax: tMax }
  }, [chain, evaluated, referralFactors])

  const xForCurrent = (i) => padL + ((Math.log10(i) - Math.log10(currentMin)) / (Math.log10(currentMax) - Math.log10(currentMin))) * plotW
  const yForTime = (t) => padT + plotH - ((Math.log10(t) - Math.log10(timeMin)) / (Math.log10(timeMax) - Math.log10(timeMin))) * plotH
  const inBounds = (x, y) => x >= padL && x <= padL + plotW && y >= padT && y <= padT + plotH

  const decadesX = []
  for (let d = Math.ceil(Math.log10(currentMin)); d <= Math.floor(Math.log10(currentMax)); d++) decadesX.push(Math.pow(10, d))
  const decadesY = []
  for (let d = Math.ceil(Math.log10(timeMin)); d <= Math.floor(Math.log10(timeMax)); d++) decadesY.push(Math.pow(10, d))

  // Builds an SVG path string for a curve, referred to the load-end axis.
  // Samples outside the visible plot box start a NEW subpath ('M') rather
  // than being connected to — avoids drawing a line through unrelated
  // parts of the chart when a curve runs off the edge of the visible range.
  const buildPath = (def) => {
    const raw = []
    if (def.kind === 'relay') {
      const steps = 80
      const startI = def.pickupA * 1.03
      const endI = Math.max(currentMax / def.factor, startI * 1.5) // always sample forward, even if narrower than the full axis
      for (let s = 0; s <= steps; s++) {
        const logI = Math.log10(startI) + (s / steps) * (Math.log10(endI) - Math.log10(startI))
        const I = Math.pow(10, logI)
        const ratio = I / def.pickupA
        if (ratio <= 1) continue
        const t = (def.tms * def.curve.k) / (Math.pow(ratio, def.curve.a) - 1)
        raw.push([I * def.factor, t])
      }
    } else if (def.kind === 'fuse') {
      raw.push(...def.points.map(([c, t]) => [c * def.factor, t]))
    }

    let d = ''
    let penDown = false
    for (const [I, t] of raw) {
      const x = xForCurrent(I), y = yForTime(t)
      if (!inBounds(x, y)) { penDown = false; continue }
      d += `${penDown ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)} `
      penDown = true
    }
    return d.trim() || null
  }

  return (
    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-2 mb-2 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 480 }}>
        {decadesX.map(d => (
          <line key={`gx${d}`} x1={xForCurrent(d)} y1={padT} x2={xForCurrent(d)} y2={padT + plotH} stroke="#1a1a1a" strokeWidth="1" />
        ))}
        {decadesY.map(d => (
          <line key={`gy${d}`} x1={padL} y1={yForTime(d)} x2={padL + plotW} y2={yForTime(d)} stroke="#1a1a1a" strokeWidth="1" />
        ))}
        {decadesX.map(d => (
          <text key={`lx${d}`} x={xForCurrent(d)} y={padT + plotH + 16} fill="#6b7280" fontSize="9" textAnchor="middle">{d >= 1000 ? `${(d / 1000).toFixed(d % 1000 === 0 ? 0 : 1)}k` : d}</text>
        ))}
        {decadesY.map(d => (
          <text key={`ly${d}`} x={padL - 6} y={yForTime(d) + 3} fill="#6b7280" fontSize="9" textAnchor="end">{d}</text>
        ))}
        <text x={padL + plotW / 2} y={H - 4} fill="#9ca3af" fontSize="10" textAnchor="middle">Current, referred to load end (A)</text>
        <text x={12} y={padT + plotH / 2} fill="#9ca3af" fontSize="10" textAnchor="middle" transform={`rotate(-90 12 ${padT + plotH / 2})`}>Time (s)</text>

        {curves.map((def, i) => {
          const d = buildPath(def)
          if (!d) return null
          return <path key={def.id} d={d} fill="none" stroke={DEVICE_COLORS[i % DEVICE_COLORS.length]} strokeWidth="2" />
        })}

        {chain.map((point, i) => {
          if (point.type === 'transformer') return null
          const evalResult = evaluated[i]
          if (!evalResult || evalResult.timeS == null || evalResult.currentA == null) return null
          const factor = referralFactors[i]
          const x = xForCurrent(evalResult.currentA * factor), y = yForTime(evalResult.timeS)
          if (!inBounds(x, y)) return null
          const colorIdx = curves.findIndex(c => c.id === point.id)
          return <circle key={`m${point.id}`} cx={x} cy={y} r="4" fill={DEVICE_COLORS[Math.max(0, colorIdx) % DEVICE_COLORS.length]} stroke="#000" strokeWidth="1" />
        })}
      </svg>
      <div className="flex flex-wrap gap-3 px-2 pt-1">
        {curves.map((def, i) => {
          const point = chain.find(p => p.id === def.id)
          return (
            <div key={def.id} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: DEVICE_COLORS[i % DEVICE_COLORS.length] }} />
              <span className="text-[10px] text-gray-400">{point?.label || point?.type}</span>
            </div>
          )
        })}
      </div>
      {chain.some(p => p.type === 'transformer') && (
        <div className="text-[10px] text-gray-600 px-2 pb-1">
          Currents referred across transformer boundaries to the load-end voltage base for a single comparable axis — device-side real amps are shown in the Operating Times table below.
        </div>
      )}
    </div>
  )
}

// ── MAIN ───────────────────────────────────────────────────────────────────
function newRelayPoint() { return { id: uid(), type: 'relay', label: '', curveId: 'si', pickupA: '', tms: '0.1', faultCurrentA: '' } }
function newFusePoint() { return { id: uid(), type: 'fuse', label: '', fuseSource: 'generic-ansi', fuseClass: 'K', ratingA: 40, manufacturer: '', customPoints: [['', ''], ['', '']], faultCurrentA: '' } }
function newTransformerPoint() { return { id: uid(), type: 'transformer', label: '', kva: '', vPrimary: '', vSecondary: '' } }

export default function ProtectionCoordination({ addHistory }) {
  const [chain, setChain] = useState([])
  const [initialFaultA, setInitialFaultA] = useState('')
  const [marginRequiredS, setMarginRequiredS] = useState('0.35')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const { cardData, showCard, hideCard } = useResultCard()

  const updatePoint = (id, updated) => setChain(c => c.map(p => p.id === id ? updated : p))
  const removePoint = (id) => setChain(c => c.filter(p => p.id !== id))
  const movePoint = (id, dir) => setChain(c => {
    const i = c.findIndex(p => p.id === id)
    const j = i + dir
    if (j < 0 || j >= c.length) return c
    const copy = [...c]
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
    return copy
  })
  const addPoint = (type) => {
    setChain(c => [...c, type === 'relay' ? newRelayPoint() : type === 'fuse' ? newFusePoint() : newTransformerPoint()])
    setShowAddMenu(false)
  }

  // Normalize string inputs to numbers for the engine, without mutating chain state
  const normalizedChain = useMemo(() => chain.map(p => {
    if (p.type === 'relay') return { ...p, pickupA: pf(p.pickupA), tms: pf(p.tms), faultCurrentA: p.faultCurrentA ? pf(p.faultCurrentA) : null }
    if (p.type === 'fuse') return {
      ...p,
      ratingA: pf(p.ratingA),
      customPoints: (p.customPoints || []).map(([c, t]) => [pf(c), pf(t)]).filter(([c, t]) => c > 0 && t > 0),
      faultCurrentA: p.faultCurrentA ? pf(p.faultCurrentA) : null,
    }
    if (p.type === 'transformer') return { ...p, kva: pf(p.kva), vPrimary: pf(p.vPrimary), vSecondary: pf(p.vSecondary) }
    return p
  }), [chain])

  const evaluated = useMemo(() => {
    if (!chain.length || !pf(initialFaultA)) return null
    try {
      return evaluateChain(normalizedChain, pf(initialFaultA))
    } catch (e) {
      return { error: e.message }
    }
  }, [normalizedChain, initialFaultA, chain.length])

  const margins = useMemo(() => {
    if (!evaluated || evaluated.error) return null
    return checkChainMargins(evaluated, pf(marginRequiredS) || 0.35)
  }, [evaluated, marginRequiredS])

  const validation = useMemo(() => {
    if (!chain.length) return []
    return validateChain(normalizedChain)
  }, [normalizedChain, chain.length])

  const validationById = useMemo(() => {
    const map = {}
    validation.forEach(v => { map[v.id] = v.errors })
    return map
  }, [validation])

  const totalIssues = validation.reduce((sum, v) => sum + v.errors.length, 0)

  return (
    <div className="px-4 py-3">
      <div className="bg-[#0a1a2e] border border-[#1a3a5a] rounded-xl px-4 py-3 mb-4">
        <div className="text-blue-400 text-xs font-bold mb-1">Protection Coordination — TCC Study</div>
        <div className="text-gray-500 text-xs">Build a chain of relays, fuses and transformer boundaries load-end to source-end. Checks discrimination margin at each adjacent pair. IEC 60255-151 (relays), ANSI C37.41/C37.42 (generic fuse reference).</div>
      </div>

      <NumInput label="Fault Current at Load End" value={initialFaultA} onChange={setInitialFaultA} unit="A" note="starting value; points inherit forward unless overridden" />
      <NumInput label="Required Discrimination Margin" value={marginRequiredS} onChange={setMarginRequiredS} unit="s" note="IEC 60255 practice: 0.3–0.4s typical" />

      <div className="text-gray-400 text-xs font-bold mt-4 mb-2">CHAIN — LOAD END TO SOURCE END</div>
      {totalIssues > 0 && (
        <div className="bg-[#1a1000] border border-amber-800 text-amber-400 rounded-xl px-4 py-2.5 text-xs mb-3">
          ⚠ {totalIssues} field{totalIssues > 1 ? 's need' : ' needs'} attention below before this study is complete — see the highlighted point{validation.filter(v => v.errors.length).length > 1 ? 's' : ''}.
        </div>
      )}
      {chain.map((point, i) => {
        const accent = DEVICE_COLORS[chain.filter(p => p.type !== 'transformer').indexOf(point) % DEVICE_COLORS.length]
        const titleAccent = point.type === 'transformer' ? '#6b7280' : accent
        const title = `${i + 1}. ${point.type === 'relay' ? 'Relay' : point.type === 'fuse' ? 'Fuse' : 'Transformer'}${point.label ? ' — ' + point.label : ''}`
        const errors = validationById[point.id] || []
        return (
          <Card key={point.id} title={title} accent={errors.length ? '#f59e0b' : titleAccent}
            onRemove={() => removePoint(point.id)}
            onMoveUp={i > 0 ? () => movePoint(point.id, -1) : null}
            onMoveDown={i < chain.length - 1 ? () => movePoint(point.id, 1) : null}>
            {point.type === 'relay' && <RelayEditor point={point} onChange={p => updatePoint(point.id, p)} />}
            {point.type === 'fuse' && <FuseEditor point={point} onChange={p => updatePoint(point.id, p)} />}
            {point.type === 'transformer' && <TransformerEditor point={point} onChange={p => updatePoint(point.id, p)} />}
            {errors.length > 0 && (
              <div className="mt-2 bg-[#1a0f00] border border-amber-900 rounded-lg px-3 py-2">
                {errors.map((e, ei) => (
                  <div key={ei} className="text-amber-400 text-[11px]">⚠ {e}</div>
                ))}
              </div>
            )}
          </Card>
        )
      })}

      {!showAddMenu && (
        <button onClick={() => setShowAddMenu(true)} className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-amber-400 font-bold py-3 rounded-xl text-sm mb-4">
          + Add Point to Chain
        </button>
      )}
      {showAddMenu && (
        <div className="flex gap-2 mb-4">
          <button onClick={() => addPoint('relay')} className="flex-1 bg-[#1a1a0a] border border-amber-800 text-amber-400 text-xs font-bold py-3 rounded-xl">⏱ Relay</button>
          <button onClick={() => addPoint('fuse')} className="flex-1 bg-[#1a1a0a] border border-amber-800 text-amber-400 text-xs font-bold py-3 rounded-xl">⚡ Fuse</button>
          <button onClick={() => addPoint('transformer')} className="flex-1 bg-[#1a1a0a] border border-amber-800 text-amber-400 text-xs font-bold py-3 rounded-xl">⇄ Transformer</button>
          <button onClick={() => setShowAddMenu(false)} className="px-3 bg-[#1c1c1c] border border-[#2a2a2a] text-gray-400 text-xs rounded-xl">✕</button>
        </div>
      )}

      {chain.length > 0 && pf(initialFaultA) === 0 && (
        <div className="bg-[#0f1520] border border-[#1e2a3a] rounded-xl px-4 py-3 text-xs text-gray-500 mb-4">
          Enter a fault current at the load end above to see the TCC plot and discrimination check.
        </div>
      )}

      {chain.length > 0 && pf(initialFaultA) > 0 && (
        <>
          <TccPlot chain={normalizedChain} evaluated={evaluated && !evaluated.error ? evaluated : []} />

          {evaluated && evaluated.error && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">{evaluated.error}</div>
          )}

          {evaluated && !evaluated.error && (
            <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
              <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
                <span className="text-amber-400 text-xs font-bold">OPERATING TIMES</span>
              </div>
              {evaluated.map(r => (
                <div key={r.id} className="flex justify-between items-center px-4 py-2.5 border-b border-[#1a1a1a] last:border-0">
                  <div>
                    <div className="text-gray-300 text-sm">{r.label || r.type}</div>
                    <div className="text-gray-600 text-[11px]">
                      {r.currentA?.toFixed(0)} A{r.inherited ? ' (inherited)' : ''}
                    </div>
                  </div>
                  <span className="text-white font-bold text-sm">
                    {r.type === 'transformer' ? '—' : r.timeS == null ? 'does not operate' : `${r.timeS.toFixed(3)} s`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {margins && (
            <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
              <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
                <span className="text-amber-400 text-xs font-bold">DISCRIMINATION MARGINS</span>
              </div>
              {margins.map((m, i) => (
                <div key={i} className={`flex justify-between items-center px-4 py-2.5 border-b border-[#1a1a1a] last:border-0 ${m.pass === false ? 'bg-[#1a0000]' : ''}`}>
                  <span className="text-gray-400 text-xs">Pair {i + 1}</span>
                  <span className={`font-bold text-sm ${m.pass === true ? 'text-green-400' : m.pass === false ? 'text-red-400' : 'text-gray-500'}`}>
                    {m.marginS == null ? 'n/a — device does not operate' : `${m.marginS.toFixed(3)}s ${m.pass ? '✓ pass' : '✗ fail'} (req. ${m.requiredMarginS}s)`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => showCard({
              calculator: 'Protection Coordination — TCC Study',
              standard: 'IEC 60255-151 (relays) / ANSI C37.41, C37.42 (generic fuse reference)',
              inputs: [
                { label: 'Fault Current at Load End', value: `${initialFaultA} A` },
                { label: 'Required Margin', value: `${marginRequiredS} s` },
                { label: 'Chain Length', value: `${chain.length} points` },
              ],
              sections: [
                {
                  title: 'OPERATING TIMES',
                  rows: (evaluated && !evaluated.error ? evaluated : []).map(r => ({
                    label: `${r.label || r.type} (${r.currentA?.toFixed(0)} A${r.inherited ? ', inherited' : ''})`,
                    value: r.type === 'transformer' ? '—' : r.timeS == null ? 'does not operate' : `${r.timeS.toFixed(3)} s`,
                  })),
                },
                {
                  title: 'DISCRIMINATION MARGINS',
                  rows: (margins || []).map((m, i) => ({
                    label: `Pair ${i + 1}`,
                    value: m.marginS == null ? 'n/a' : `${m.marginS.toFixed(3)}s ${m.pass ? 'PASS' : 'FAIL'}`,
                    accent: m.pass === true,
                    warn: m.pass === false,
                  })),
                },
              ],
              notes: 'Generic ANSI fuse curves are representative/planning-level, not manufacturer-exact — confirm against the actual datasheet. Fault current not overridden is inherited unchanged from upstream (does not model cable/line impedance) — flagged per point above.',
            })}
            className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">
            📄 Generate Result Card
          </button>
        </>
      )}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}
