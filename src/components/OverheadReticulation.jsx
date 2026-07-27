import React, { useState } from 'react'
import { NumInput, SelectInput, InfoBox, ErrBox, CalcButton, ResultCard, useResultCard, SubTabBar } from './shared'
import { useSite } from './SiteContext'
import {
  conductorLookup, CONDUCTORS,
  clearanceLookup, structureClearance,
  phaseSpacing,
} from './overheadReticulationEngine'

const SOURCE_NOTE = 'SANS 10280-1 itself is a paywalled SABS publication and could not be accessed directly for this module. Figures here come from two independent, publicly accessible Eskom/NRS documents that implement it — DST_34-1191 and NRS 033:1996 — cross-verified against each other. This is a generic/secondary-sourced planning reference, not a primary SANS 10280-1 citation.'

const CONDUCTOR_OPTIONS = Object.keys(CONDUCTORS).map(key => {
  const c = CONDUCTORS[key]
  const label = key.charAt(0).toUpperCase() + key.slice(1)
  return [key, `${label} (${c.type}, ${c.ratingA}A)`]
})

// ── Conductor Sizing ─────────────────────────────────────────────────────────
// §5.6.3 roadmap.md — first sub-tab of Overhead Reticulation. Standard bare
// ACSR/AAAC conductor lookup — distinct from Cable's insulated-conductor
// derating, since bare overhead conductors carry no insulation and no
// derating factors apply. Source: DST_34-1191 Table 7.
function ConductorSizing({ addHistory }) {
  const { site } = useSite()
  const [code, setCode] = useState('hare')
  const [result, setResult] = useState(null)
  const { cardData, showCard, hideCard } = useResultCard()

  const calculate = () => {
    const r = conductorLookup(code)
    setResult(r)
    if (r) addHistory({ tab: 'Overhead — Conductor Sizing', expr: r.name, result: `${r.ratingA} A` })
  }

  const exportPdf = () => {
    if (!result) return
    showCard({
      calculator: 'Overhead Reticulation — Conductor Sizing',
      site: site.name,
      standard: result.standard,
      inputs: [{ label: 'Conductor', value: result.name }],
      sections: [{
        title: 'Conductor Properties',
        rows: [
          { label: 'Type', value: result.type },
          { label: 'Stranding', value: result.stranding },
          { label: 'Cross-Sectional Area', value: `${result.areaMM2} mm²` },
          { label: 'Overall Diameter', value: `${result.diaMM} mm` },
          { label: 'Mass', value: `${result.massKgKm} kg/km` },
          { label: 'Breaking Load', value: `${result.breakingLoadKg} kg` },
          { label: 'Current Rating', value: `${result.ratingA} A`, accent: true },
        ],
      }],
      notes: SOURCE_NOTE,
    })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Bare Overhead Conductors" color="blue" lines={[
        'Standard ACSR/AAAC conductors for MV/LV overhead reticulation, up to 33kV wood-pole construction only.',
        'Bare conductors carry no insulation — none of the Cable module\'s derating factors (grouping, ambient, installation method) apply here.',
        SOURCE_NOTE,
      ]} />

      <SelectInput label="Conductor" value={code} onChange={setCode} options={CONDUCTOR_OPTIONS} />

      <CalcButton onClick={calculate} label="LOOK UP" />

      {result && (
        <>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
            <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
              <span className="text-amber-400 text-xs font-bold">{result.name.toUpperCase()} — {result.type}</span>
            </div>
            <div className="px-4 py-3">
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">Stranding</span>
                <span className="text-white text-sm font-mono">{result.stranding}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">Cross-Sectional Area</span>
                <span className="text-white text-sm font-mono">{result.areaMM2} mm²</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">Overall Diameter</span>
                <span className="text-white text-sm font-mono">{result.diaMM} mm</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">Mass</span>
                <span className="text-white text-sm font-mono">{result.massKgKm} kg/km</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">Breaking Load</span>
                <span className="text-white text-sm font-mono">{result.breakingLoadKg} kg</span>
              </div>
              <div className="flex justify-between py-2 mt-1">
                <span className="text-gray-300 text-sm font-bold">Current Rating</span>
                <span className="text-2xl font-bold text-sky-400">{result.ratingA} A</span>
              </div>
            </div>
          </div>
          <button onClick={exportPdf}
            className="w-full py-3 rounded-xl font-bold text-sm mb-4"
            style={{ background: 'transparent', border: '1px solid #38bdf8', color: '#38bdf8' }}>
            📄 Export PDF
          </button>
        </>
      )}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

// ── Pole Spacing ─────────────────────────────────────────────────────────────
// §5.6.3 roadmap.md — second sub-tab. Electrical span/phase-spacing formula
// only (DST_34-1191 §4.5.11) — NOT a sag-tension/structural span calculation,
// which is explicitly deferred per the §5.1 scope decision (2026-07-27).
// The formula's clearance constant (C) is only verified for 22kV in
// accessible source text — other voltages are honestly flagged, not
// extrapolated, matching the engine's own [AI-18] treatment.
function PoleSpacing({ addHistory }) {
  const { site } = useSite()
  const [spanM, setSpanM] = useState('100')
  const [angleDeg, setAngleDeg] = useState('0')
  const [voltageKV, setVoltageKV] = useState('22')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const { cardData, showCard, hideCard } = useResultCard()

  const calculate = () => {
    setError('')
    setResult(null)
    const r = phaseSpacing({ spanM, angleDeg, voltageKV })
    if (!r) { setError('Enter a valid span and conductor angle.'); return }
    setResult(r)
    if (r.verified) {
      addHistory({ tab: 'Overhead — Pole Spacing', expr: `${spanM}m span @ ${voltageKV}kV`, result: `${r.requiredSpacingM} m` })
    }
  }

  const exportPdf = () => {
    if (!result || !result.verified) return
    showCard({
      calculator: 'Overhead Reticulation — Pole Spacing (Electrical Span)',
      site: site.name,
      standard: result.standard,
      inputs: [
        { label: 'Span Length', value: `${spanM} m` },
        { label: 'Conductor Swing Angle', value: `${angleDeg}°` },
        { label: 'Voltage', value: `${voltageKV} kV` },
      ],
      sections: [{
        title: 'Results',
        rows: [
          { label: 'Required Phase Spacing', value: `${result.requiredSpacingM} m`, accent: true },
          { label: 'Below 50m Design Floor', value: result.belowMinSpanFloor ? 'YES — flagged' : 'No' },
        ],
      }],
      notes: SOURCE_NOTE + ' This is the electrical span/swing-clearance formula only, not a sag-tension structural span calculation — that remains out of scope for this module.',
    })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Electrical Span / Phase Spacing" color="blue" lines={[
        'Relates conductor swing under wind to the phase-to-phase spacing needed at the pole top for a given span — not a sag-tension structural design calculation (that stays out of scope).',
        'The formula\'s clearance constant is only verified for 22kV in accessible source text. Other voltages return an honest "not verified" note rather than a guessed number.',
        SOURCE_NOTE,
      ]} />

      <NumInput label="Span Length" value={spanM} onChange={setSpanM} unit="m" placeholder="e.g. 100" />
      <NumInput label="Conductor Swing Angle" value={angleDeg} onChange={setAngleDeg} unit="° from horizontal" placeholder="e.g. 0 (worst case) or 90" note="0° = fully deflected sideways (worst case for phase spacing), 90° = at rest" />
      <NumInput label="Nominal Voltage" value={voltageKV} onChange={setVoltageKV} unit="kV" placeholder="22" />

      <CalcButton onClick={calculate} />
      <ErrBox msg={error} />

      {result && !result.verified && (
        <InfoBox title="Not Verified For This Voltage" color="amber" lines={[result.message]} />
      )}

      {result && result.verified && (
        <>
          <div className="bg-[#0a0f14] border border-[#003147] rounded-xl px-4 py-3 mb-4">
            <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
              <span className="text-gray-300 text-sm font-bold">Required Phase Spacing</span>
              <span className="text-2xl font-bold text-sky-400">{result.requiredSpacingM} m</span>
            </div>
            {result.belowMinSpanFloor && (
              <div className="text-amber-400 text-xs pt-2">⚠ Span is below the 50m minimum design floor (DST_34-1191 §4.5.10.2)</div>
            )}
          </div>
          <button onClick={exportPdf}
            className="w-full py-3 rounded-xl font-bold text-sm mb-4"
            style={{ background: 'transparent', border: '1px solid #38bdf8', color: '#38bdf8' }}>
            📄 Export PDF
          </button>
        </>
      )}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

// ── Clearances ───────────────────────────────────────────────────────────────
// §5.6.3 roadmap.md — third sub-tab. Table 8 (DST_34-1191 / NRS 033),
// cross-verified against the same OHS Act Electrical Machinery Regulations
// table in both documents. Voltages above 33kV are explicitly out of scope
// (transmission-class, steel lattice/tower structures under SANS 60826).
function Clearances({ addHistory }) {
  const { site } = useSite()
  const [voltageKV, setVoltageKV] = useState('11')
  const [result, setResult] = useState(null)
  const [structure, setStructure] = useState(null)
  const [error, setError] = useState('')
  const { cardData, showCard, hideCard } = useResultCard()

  const calculate = () => {
    setError('')
    setResult(null)
    setStructure(null)
    const r = clearanceLookup(voltageKV)
    if (!r) { setError('Enter a valid voltage.'); return }
    setResult(r)
    setStructure(structureClearance(voltageKV))
    if (!r.outOfScope) {
      addHistory({ tab: 'Overhead — Clearances', expr: `${voltageKV}kV`, result: `${r.groundOutsideTownshipM} m to ground` })
    }
  }

  const exportPdf = () => {
    if (!result || result.outOfScope) return
    showCard({
      calculator: 'Overhead Reticulation — Clearances',
      site: site.name,
      standard: result.standard,
      inputs: [{ label: 'Nominal Voltage', value: `${voltageKV} kV (band: up to ${result.voltageBandKV} kV)` }],
      sections: [
        {
          title: 'Minimum Clearances',
          rows: [
            { label: 'To Ground (outside townships)', value: `${result.groundOutsideTownshipM} m` },
            { label: 'To Ground (inside townships)', value: `${result.groundInsideTownshipM} m` },
            { label: 'Above Roads / Railway Lines', value: `${result.aboveRoadsRailM} m`, accent: true },
            { label: 'To Communication/Other Power Lines', value: `${result.toCommsOtherLinesM} m` },
            { label: 'To Buildings/Structures', value: `${result.toBuildingsM} m` },
          ],
        },
        ...(structure && structure.verified ? [{
          title: 'Structure (At-Pole) Clearances',
          rows: [
            { label: 'Phase-to-Earth', value: `${structure.phaseToEarthMM} mm` },
            { label: 'Phase-to-Phase', value: `${structure.phaseToPhaseMM} mm` },
          ],
        }] : []),
      ],
      notes: SOURCE_NOTE + (structure && !structure.verified ? ` Structure (at-pole) clearances: ${structure.message}` : ''),
    })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Minimum Overhead Line Clearances" color="blue" lines={[
        'Ground, road/rail, communication-line, and building clearances by voltage band, up to 33kV wood-pole distribution only.',
        'Above 33kV is transmission-class (steel lattice/tower structures under SANS 60826) — a different design standard, out of scope here.',
        SOURCE_NOTE,
      ]} />

      <NumInput label="Nominal Voltage" value={voltageKV} onChange={setVoltageKV} unit="kV" placeholder="e.g. 11, 22, 33" />

      <CalcButton onClick={calculate} />
      <ErrBox msg={error} />

      {result && result.outOfScope && (
        <InfoBox title="Out of Scope" color="amber" lines={[result.message]} />
      )}

      {result && !result.outOfScope && (
        <>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
            <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
              <span className="text-amber-400 text-xs font-bold">CLEARANCES — VOLTAGE BAND UP TO {result.voltageBandKV} kV</span>
            </div>
            <div className="px-4 py-3">
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">To Ground (outside townships)</span>
                <span className="text-white text-sm font-mono">{result.groundOutsideTownshipM} m</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">To Ground (inside townships)</span>
                <span className="text-white text-sm font-mono">{result.groundInsideTownshipM} m</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">Above Roads/Railway Lines</span>
                <span className="text-sky-400 text-sm font-mono font-bold">{result.aboveRoadsRailM} m</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">To Comms/Other Power Lines</span>
                <span className="text-white text-sm font-mono">{result.toCommsOtherLinesM} m</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-400 text-xs">To Buildings/Structures</span>
                <span className="text-white text-sm font-mono">{result.toBuildingsM} m</span>
              </div>
            </div>
          </div>

          {structure && structure.verified && (
            <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
              <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
                <span className="text-amber-400 text-xs font-bold">STRUCTURE (AT-POLE) CLEARANCES</span>
              </div>
              <div className="px-4 py-3">
                <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                  <span className="text-gray-400 text-xs">Phase-to-Earth</span>
                  <span className="text-white text-sm font-mono">{structure.phaseToEarthMM} mm</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-400 text-xs">Phase-to-Phase</span>
                  <span className="text-white text-sm font-mono">{structure.phaseToPhaseMM} mm</span>
                </div>
              </div>
            </div>
          )}
          {structure && !structure.verified && (
            <InfoBox title="Structure Clearances — Not Verified" color="amber" lines={[structure.message]} />
          )}

          <button onClick={exportPdf}
            className="w-full py-3 rounded-xl font-bold text-sm mb-4"
            style={{ background: 'transparent', border: '1px solid #38bdf8', color: '#38bdf8' }}>
            📄 Export PDF
          </button>
        </>
      )}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

const OVERHEAD_TABS = [
  { id: 'conductor', label: 'Conductor Sizing', icon: '〰' },
  { id: 'spacing',   label: 'Pole Spacing', icon: '📏' },
  { id: 'clearance', label: 'Clearances', icon: '⛔' },
]

export default function OverheadReticulation({ addHistory }) {
  const [sub, setSub] = useState('conductor')
  const map = {
    conductor: <ConductorSizing addHistory={addHistory} />,
    spacing:   <PoleSpacing addHistory={addHistory} />,
    clearance: <Clearances addHistory={addHistory} />,
  }
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SubTabBar tabs={OVERHEAD_TABS} active={sub} onChange={setSub} />
      <div className="flex-1 overflow-y-auto">{map[sub]}</div>
    </div>
  )
}
