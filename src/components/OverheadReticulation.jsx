import React, { useState } from 'react'
import { NumInput, SelectInput, InfoBox, ErrBox, CalcButton, ResultCard, useResultCard, SubTabBar } from './shared'
import { useSite } from './SiteContext'
import {
  conductorLookup, CONDUCTORS,
  clearanceLookup, structureClearance,
  phaseSpacing,
  fittingSelection, FITTING_TYPES, STRUCTURE_TYPES, STRUCTURE_MATERIALS,
  polePlanting, POLE_PLANTING,
  lightningExposure,
  STRINGING_RULES, CONSTRUCTION_SEQUENCE,
  PRE_ENERGIZATION_CHECKLIST, PRE_ENERGIZATION_STANDARD,
  FAULT_FINDING, STRINGING_GLOSSARY,
  voltageClass, VOLTAGE_CLASS_CONVENTION, TRANSMISSION_VOLTAGE_PRESETS,
  ESKASABG3_HV_EHV,
} from './overheadReticulationEngine'

const SOURCE_NOTE = 'SANS 10280-1 itself is a paywalled SABS publication and could not be accessed directly for this module. Clearance/spacing figures come from two independent, publicly accessible Eskom/NRS documents that implement it — DST_34-1191 and NRS 033:1996 — cross-verified against each other. This is a generic/secondary-sourced planning reference, not a primary SANS 10280-1 citation.'

const CONDUCTOR_SOURCE_NOTE = 'Conductor data is sourced from "Phase Conductor Standard for Eskom Overhead Lines" (240-152844641 Rev 2, 2021) — a single current, internally-consistent document. Current rating genuinely depends on assumed conductor operating temperature, which is why you choose a temperature band rather than seeing one flat number.'

const TEMP_OPTIONS = [['50', '50°C'], ['60', '60°C'], ['70', '70°C'], ['80', '80°C']]
const RATE_OPTIONS = [['normal', 'Rate A — Normal/Continuous'], ['emergency', 'Rate B — Emergency']]

const CONDUCTOR_OPTIONS = Object.entries(CONDUCTORS)
  .sort((a, b) => a[1].areaMM2 - b[1].areaMM2)
  .map(([key, c]) => {
    const label = key.charAt(0).toUpperCase() + key.slice(1)
    return [key, `${label} (${c.type}, ${c.areaMM2}mm²)`]
  })

// ── Conductor Sizing ─────────────────────────────────────────────────────────
// §5.6.3 roadmap.md — first sub-tab of Overhead Reticulation. Standard bare
// ACSR/AAAC/AAC conductor lookup — distinct from Cable's insulated-conductor
// derating, since bare overhead conductors carry no insulation and no
// derating factors apply. Source: 240-152844641 Rev 2 (2021), Annex C.
// Covers Squirrel through IEC 800 (835mm²) — comfortably past 66kV
// sub-transmission conductor sizes.
function ConductorSizing({ addHistory }) {
  const { site } = useSite()
  const [code, setCode] = useState('hare')
  const [tempC, setTempC] = useState('70')
  const [rateClass, setRateClass] = useState('normal')
  const [result, setResult] = useState(null)
  const { cardData, showCard, hideCard } = useResultCard()

  const calculate = () => {
    const r = conductorLookup(code, tempC, rateClass)
    setResult(r)
    if (r && r.verified) addHistory({ tab: 'Overhead — Conductor Sizing', expr: `${r.name} @ ${r.tempC}°C`, result: `${r.ratingA} A` })
  }

  const exportPdf = () => {
    if (!result || !result.verified) return
    showCard({
      calculator: 'Overhead Reticulation — Conductor Sizing',
      site: site.name,
      standard: result.standard,
      inputs: [
        { label: 'Conductor', value: result.name },
        { label: 'Operating Temperature', value: `${result.tempC}°C` },
        { label: 'Rate Class', value: result.rateClass === 'emergency' ? 'Rate B — Emergency' : 'Rate A — Normal/Continuous' },
      ],
      sections: [{
        title: 'Conductor Properties',
        rows: [
          { label: 'IEC Code', value: result.iecCode },
          { label: 'Cross-Sectional Area', value: `${result.areaMM2} mm²` },
          { label: 'Overall Diameter', value: `${result.diaMM} mm` },
          { label: 'Mass', value: `${result.massKgKm} kg/km` },
          { label: 'Ultimate Tensile Strength', value: `${result.utsKN} kN` },
          { label: 'DC Resistance @ 20°C', value: `${result.resistanceOhmKm} Ω/km` },
          { label: `Current Rating @ ${result.tempC}°C (Rate A / Rate B)`, value: `${result.ratingNormalA} A / ${result.ratingEmergencyA} A` },
          { label: 'Selected Rating', value: `${result.ratingA} A`, accent: true },
        ],
      }],
      notes: CONDUCTOR_SOURCE_NOTE,
    })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Bare Overhead Conductors" color="blue" lines={[
        'ACSR, AAAC, and AAC conductors for overhead reticulation — Squirrel through IEC 800 (835mm²), comfortably past 66kV sub-transmission sizes.',
        'Bare conductors carry no insulation — none of the Cable module\'s derating factors (grouping, ambient, installation method) apply here.',
        CONDUCTOR_SOURCE_NOTE,
      ]} />

      <SelectInput label="Conductor" value={code} onChange={setCode} options={CONDUCTOR_OPTIONS} />
      <SelectInput label="Assumed Max Operating Temperature" value={tempC} onChange={setTempC} options={TEMP_OPTIONS} note="Current rating is temperature-dependent — this is the four verified bands, not an arbitrary choice" />
      <SelectInput label="Rate Class" value={rateClass} onChange={setRateClass} options={RATE_OPTIONS} />

      <CalcButton onClick={calculate} label="LOOK UP" />

      {result && !result.verified && (
        <InfoBox title="Not Verified For This Input" color="amber" lines={[result.message]} />
      )}

      {result && result.verified && result.ratingsAvailable === false && (
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
          <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
            <span className="text-amber-400 text-xs font-bold">{result.name.toUpperCase()} — {result.type} (DIMENSIONAL DATA ONLY)</span>
          </div>
          <div className="px-4 py-3">
            <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
              <span className="text-gray-400 text-xs">Construction</span>
              <span className="text-white text-xs font-mono text-right">{result.iecCode}</span>
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
              <span className="text-gray-400 text-xs">Ultimate Tensile Strength</span>
              <span className="text-white text-sm font-mono">{result.utsKN} kN</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
              <span className="text-gray-400 text-xs">DC Resistance @ 20°C</span>
              <span className="text-white text-sm font-mono">{result.resistanceOhmKm} Ω/km</span>
            </div>
            <div className="text-amber-400 text-xs pt-2">⚠ {result.ratingsMessage}</div>
          </div>
        </div>
      )}

      {result && result.verified && result.ratingsAvailable !== false && (
        <>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
            <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
              <span className="text-amber-400 text-xs font-bold">{result.name.toUpperCase()} — {result.type}</span>
            </div>
            <div className="px-4 py-3">
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">IEC Code</span>
                <span className="text-white text-xs font-mono text-right">{result.iecCode}</span>
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
                <span className="text-gray-400 text-xs">Ultimate Tensile Strength</span>
                <span className="text-white text-sm font-mono">{result.utsKN} kN</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">DC Resistance @ 20°C</span>
                <span className="text-white text-sm font-mono">{result.resistanceOhmKm} Ω/km</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">Rate A / Rate B @ {result.tempC}°C</span>
                <span className="text-white text-sm font-mono">{result.ratingNormalA} A / {result.ratingEmergencyA} A</span>
              </div>
              <div className="flex justify-between py-2 mt-1">
                <span className="text-gray-300 text-sm font-bold">Selected Rating</span>
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
    if (result.partialScope) {
      showCard({
        calculator: 'Overhead Reticulation — Clearances (HV/EHV)',
        site: site.name,
        standard: result.standard,
        inputs: [
          { label: 'Nominal Voltage', value: `${result.nominalVoltageKV} kV ${result.dc ? '(DC)' : '(AC)'}` },
          { label: 'Voltage Class', value: result.voltageClass },
        ],
        sections: [{
          title: 'Verified from ESKASABG3 Annex C (citing OHS Act)',
          rows: [
            { label: 'Minimum Safety Clearance', value: `${result.safetyClearanceM} m`, accent: true },
            { label: 'Servitude Width (from centre line)', value: result.servitudeWidthM },
          ],
        }],
        notes: 'Ground clearance (above roads, townships), clearance to communication lines, and clearance to buildings are NOT verified from an accessible primary source for HV/EHV voltages. Consult IEC 61936-1 (AC electrical installations exceeding 1 kV) and your utility\'s (Eskom Transmission / NTCSA) own internal transmission-line design standards for those figures.',
      })
      return
    }
    showCard({
      calculator: 'Overhead Reticulation — Clearances',
      site: site.name,
      standard: result.standard,
      inputs: [{ label: 'Nominal Voltage', value: `${voltageKV} kV (band: up to ${result.voltageBandKV} kV, class: ${result.voltageClass})` }],
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
        'Ground, road/rail, communication-line, and building clearances by voltage band (OHS Act Reg 15), covering LV/MV distribution and sub-transmission up to the 100kV band.',
        'HV (132kV) and EHV (275/400/765kV) Eskom standard transmission voltages now show verified minimum safety clearances and servitude widths from Eskom ESKASABG3 Annex C (normative), which cites the OHS Act as its source — cross-validated at 11/22/88kV against the independently verified Reg 15 data. Ground and road clearances at HV/EHV remain unverified.',
        '220kV is not a standard Eskom AC network voltage (Eskom uses 275kV for sub-transmission) and is honestly flagged as such.',
      ]} />

      <NumInput label="Nominal Voltage" value={voltageKV} onChange={setVoltageKV} unit="kV" placeholder="e.g. 11, 22, 33, 132, 400" />

      <div className="mb-3">
        <label className="text-gray-400 text-xs mb-1.5 block">HV / EHV Transmission Presets</label>
        <div className="flex flex-wrap gap-2">
          {TRANSMISSION_VOLTAGE_PRESETS.map(v => (
            <button key={v} onClick={() => setVoltageKV(String(v))}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border ${voltageKV === String(v) ? 'bg-sky-500 border-sky-500 text-black font-bold' : 'bg-[#1c1c1c] border-[#2a2a2a] text-gray-300'}`}>
              {v} kV
            </button>
          ))}
        </div>
      </div>

      <CalcButton onClick={calculate} />
      <ErrBox msg={error} />

      {result && result.outOfScope && (
        <>
          <div className="bg-[#111] border border-amber-900 rounded-xl overflow-hidden mb-4">
            <div className="bg-[#1a1a0a] px-4 py-2 border-b border-amber-900 flex justify-between items-center">
              <span className="text-amber-400 text-xs font-bold">{result.voltageClass} — PARTIAL DATA ONLY</span>
              <span className="text-amber-400 text-xs font-mono">{voltageKV} kV</span>
            </div>
            <div className="px-4 py-3">
              <div className="text-gray-300 text-xs">{result.message}</div>
            </div>
          </div>
        </>
      )}

      {result && result.partialScope && (
        <>
          <div className="bg-[#111] border border-sky-900 rounded-xl overflow-hidden mb-4">
            <div className="bg-[#0a1a2a] px-4 py-2 border-b border-sky-900 flex justify-between items-center">
              <span className="text-sky-400 text-xs font-bold">{result.voltageClass} — {result.nominalVoltageKV} kV{result.dc ? ' DC' : ''}</span>
              <span className="text-sky-400 text-xs font-mono border border-sky-800 rounded px-2 py-0.5">{result.voltageClass}</span>
            </div>
            <div className="px-4 py-3">
              <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
                <span className="text-gray-300 text-sm font-bold">Min Safety Clearance</span>
                <span className="text-2xl font-bold text-sky-400">{result.safetyClearanceM} m</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">Servitude Width (from centre)</span>
                <span className="text-white text-sm font-mono">{result.servitudeWidthM}</span>
              </div>
              <div className="text-amber-400 text-xs pt-2">⚠ Ground clearance (above roads, townships) and clearance to buildings are NOT verified from an accessible primary source for this voltage class — consult IEC 61936-1 and your utility's transmission-line design standards for those figures.</div>
              <div className="text-gray-600 text-[10px] pt-2 italic">{result.standard}</div>
            </div>
          </div>
          <button onClick={exportPdf}
            className="w-full py-3 rounded-xl font-bold text-sm mb-4"
            style={{ background: 'transparent', border: '1px solid #38bdf8', color: '#38bdf8' }}>
            📄 Export PDF
          </button>
        </>
      )}

      {result && !result.outOfScope && (
        <>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
            <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a] flex justify-between items-center">
              <span className="text-amber-400 text-xs font-bold">CLEARANCES — VOLTAGE BAND UP TO {result.voltageBandKV} kV</span>
              {result.voltageClass && <span className="text-sky-400 text-xs font-mono border border-sky-800 rounded px-2 py-0.5">{result.voltageClass}</span>}
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
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">To Buildings/Structures</span>
                <span className="text-white text-sm font-mono">{result.toBuildingsM} m</span>
              </div>
              {result.safetyClearanceM !== null && (
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-400 text-xs">Min Safety Clearance (phase)</span>
                  <span className="text-white text-sm font-mono">{result.safetyClearanceM} m</span>
                </div>
              )}
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

// ── Fittings & Structures ────────────────────────────────────────────────────
// Fourth sub-tab, added 2026-07-27. Preformed fitting selection keys on
// CONDUCTOR DIAMETER — the actual cross-manufacturer selection criterion —
// with an explicit warning that colour codes are manufacturer-specific and
// contradictory between suppliers (documented: same conductor, different
// colours at different manufacturers). A colour lookup table presented as
// authoritative would be dangerous; this is the honest version.
// Structure typology is a qualitative reference — structural strength
// design stays out of scope, same boundary as sag-tension mechanics.
function FittingsStructures({ addHistory }) {
  const [code, setCode] = useState('hare')
  const [fittingType, setFittingType] = useState('deadend')
  const [result, setResult] = useState(null)
  const [showStructures, setShowStructures] = useState(false)

  const FITTING_OPTIONS = FITTING_TYPES.map(f => [f.id, f.label])

  const calculate = () => {
    const r = fittingSelection(code, fittingType)
    setResult(r)
    if (r && r.applicable) addHistory({ tab: 'Overhead — Fitting Selection', expr: `${r.conductorName} / ${r.fitting}`, result: `match ${r.matchDiameterMM} mm` })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Preformed Fitting Selection" color="blue" lines={[
        'Dead-ends, splices, and armor rods are selected by matching the CONDUCTOR DIAMETER against the fitting\'s tagged diameter range — that is the criterion every manufacturer catalogue actually uses.',
        'Colour codes on fittings are manufacturer-specific and NOT standardized: the same conductor can carry different colours at different manufacturers, and colours repeat across size groups. Never select by colour alone.',
      ]} />

      <SelectInput label="Conductor" value={code} onChange={setCode} options={CONDUCTOR_OPTIONS} />
      <SelectInput label="Fitting Type" value={fittingType} onChange={setFittingType} options={FITTING_OPTIONS} />

      <CalcButton onClick={calculate} label="SELECT FITTING" />

      {result && !result.applicable && (
        <InfoBox title="Sized Differently" color="amber" lines={[result.message, result.colourWarning]} />
      )}

      {result && result.applicable && (
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
          <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
            <span className="text-amber-400 text-xs font-bold">{result.conductorName.toUpperCase()} — {result.fitting.toUpperCase()}</span>
          </div>
          <div className="px-4 py-3">
            <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
              <span className="text-gray-300 text-sm font-bold">Match Diameter</span>
              <span className="text-2xl font-bold text-sky-400">{result.matchDiameterMM} mm</span>
            </div>
            <div className="text-gray-300 text-xs pt-2 pb-1">{result.guidance}</div>
            <div className="text-amber-400 text-xs pt-2">⚠ {result.colourWarning}</div>
          </div>
        </div>
      )}

      <button onClick={() => setShowStructures(s => !s)}
        className="w-full py-3 rounded-xl font-bold text-sm mb-3"
        style={{ background: 'transparent', border: '1px solid #94a3b8', color: '#94a3b8' }}>
        {showStructures ? 'HIDE' : 'SHOW'} SUPPORT STRUCTURE REFERENCE
      </button>

      {showStructures && (
        <>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-3">
            <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
              <span className="text-amber-400 text-xs font-bold">STRUCTURE TYPES</span>
            </div>
            <div className="px-4 py-2">
              {STRUCTURE_TYPES.map(s => (
                <div key={s.id} className="py-2 border-b border-[#1a1a1a] last:border-b-0">
                  <div className="text-white text-sm font-bold">{s.label}</div>
                  <div className="text-gray-400 text-xs pt-0.5">{s.role}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-3">
            <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
              <span className="text-amber-400 text-xs font-bold">STRUCTURE MATERIALS</span>
            </div>
            <div className="px-4 py-2">
              {STRUCTURE_MATERIALS.map(m => (
                <div key={m.id} className="py-2 border-b border-[#1a1a1a] last:border-b-0">
                  <div className="text-white text-sm font-bold">{m.label}</div>
                  <div className="text-gray-400 text-xs pt-0.5">{m.notes}</div>
                </div>
              ))}
            </div>
          </div>
          <InfoBox title="Scope Note" color="amber" lines={[
            'This is a typology reference only. Structural strength design — wind/ice loading, foundation design, tower member sizing (SANS 60826) — remains out of this module\'s field-quick scope, same boundary as sag-tension mechanics.',
          ]} />
        </>
      )}
    </div>
  )
}

// ── Pole Planting ────────────────────────────────────────────────────────────
// Fifth sub-tab, added 2026-07-28. DST_34-1191 §4.5.9 Table 6, re-fetched
// from the primary accessible text this session. Discrete table rows only —
// pole selection is a picker of real table rows, so unlisted lengths can't
// even be entered (no interpolation, no fabricated depths). A regression
// test locks out a fabricated "8m → 1.5m" row from an AI-generated
// wishlist table (Table 6 has no 8m pole at all).
function PolePlanting({ addHistory }) {
  const { site } = useSite()
  const [material, setMaterial] = useState('wood')
  const [rowId, setRowId] = useState('w9')
  const [result, setResult] = useState(null)
  const { cardData, showCard, hideCard } = useResultCard()

  const rowOptions = POLE_PLANTING[material].map(r => [
    r.id,
    `${r.lengthM} m — ${material === 'wood' ? `tip Ø${r.tipDiaMM} mm` : r.classLabel}${r.transformerPole ? ' (Transformer pole)' : ''}`,
  ])

  const changeMaterial = (m) => {
    setMaterial(m)
    setRowId(POLE_PLANTING[m][0].id)
    setResult(null)
  }

  const calculate = () => {
    const r = polePlanting(material, rowId)
    setResult(r)
    if (r && r.verified) addHistory({ tab: 'Overhead — Pole Planting', expr: `${r.lengthM}m ${material}${r.transformerPole ? ' (Tx)' : ''}`, result: `${r.plantingDepthMM} mm deep` })
  }

  const exportPdf = () => {
    if (!result || !result.verified) return
    showCard({
      calculator: 'Overhead Reticulation — Pole Planting',
      site: site.name,
      standard: result.standard,
      inputs: [
        { label: 'Material', value: result.material === 'wood' ? 'Wood pole' : 'Concrete pole' },
        { label: 'Pole Length', value: `${result.lengthM} m` },
        { label: result.material === 'wood' ? 'Tip Diameter' : 'Class', value: result.material === 'wood' ? `${result.tipDiaMM} mm` : result.classLabel },
        { label: 'Transformer Pole', value: result.transformerPole ? 'Yes' : 'No' },
      ],
      sections: [{
        title: 'Planting',
        rows: [
          { label: 'Planting Depth (Table 6)', value: `${result.plantingDepthMM} mm`, accent: true },
          { label: 'Height Above Ground (derived)', value: `${result.aboveGroundM} m` },
        ],
      }],
      notes: 'Planting depth is the DST_34-1191 Table 6 value for this exact pole; height above ground is simple arithmetic (length minus depth), not a table figure. The planting and backfilling procedure itself is per DISSCAAO1 Rev 2, which is referenced by the clause but was not accessible — confirm the backfilling/compaction method against it or local utility practice.',
    })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Pole Planting Depths" color="blue" lines={[
        'Standard planting depths for the wood and concrete poles listed in DST_34-1191 §4.5.9, Table 6. The picker only offers real table rows — depths for unlisted lengths are deliberately not interpolated, because the table is a discrete list of stocked pole sizes, not a formula.',
        'Poles must end up plumb and correctly compacted — this is an explicit pre-energization inspection item (see the Construction sub-tab checklist).',
      ]} />

      <SelectInput label="Pole Material" value={material} onChange={changeMaterial}
        options={[['wood', 'Wood pole'], ['concrete', 'Concrete pole']]} />
      <SelectInput label="Pole (Table 6 rows)" value={rowId} onChange={setRowId} options={rowOptions} />

      <CalcButton onClick={calculate} label="LOOK UP" />

      {result && !result.verified && (
        <InfoBox title="Not In Table 6" color="amber" lines={[result.message]} />
      )}

      {result && result.verified && (
        <>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
            <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
              <span className="text-amber-400 text-xs font-bold">
                {result.lengthM} m {result.material.toUpperCase()} POLE{result.transformerPole ? ' — TRANSFORMER' : ''}
              </span>
            </div>
            <div className="px-4 py-3">
              <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
                <span className="text-gray-300 text-sm font-bold">Planting Depth</span>
                <span className="text-2xl font-bold text-sky-400">{result.plantingDepthMM} mm</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">Height Above Ground (derived)</span>
                <span className="text-white text-sm font-mono">{result.aboveGroundM} m</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">{result.material === 'wood' ? 'Tip Diameter' : 'Class'}</span>
                <span className="text-white text-sm font-mono">{result.material === 'wood' ? `${result.tipDiaMM} mm` : result.classLabel}</span>
              </div>
              <div className="text-gray-500 text-xs pt-2">Backfilling/compaction procedure per DISSCAAO1 Rev 2 (referenced, not accessible) — confirm the method against it or local utility practice.</div>
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

// ── Construction ─────────────────────────────────────────────────────────────
// Sixth sub-tab, added 2026-07-28. Three parts: (1) the 11-phase build
// sequence, clause-anchored per phase; (2) the clause-cited stringing/
// construction numeric rules; (3) the DST_34-1191 §4.10.2 pre-energization
// inspection checklist as an interactive tick-off list with PDF export —
// same UI precedent as the Grid-Tie compliance checklist, but here the
// ticked/unticked state exports into the PDF as a hand-over record.
function Construction({ addHistory }) {
  const { site } = useSite()
  const [openPhase, setOpenPhase] = useState(null)
  const [showRules, setShowRules] = useState(false)
  const [checked, setChecked] = useState({})
  const { cardData, showCard, hideCard } = useResultCard()

  const allItems = PRE_ENERGIZATION_CHECKLIST.flatMap(g => g.items)
  const doneCount = allItems.filter(i => checked[i.id]).length
  const allDone = doneCount === allItems.length

  const toggle = (id) => setChecked(c => ({ ...c, [id]: !c[id] }))

  const exportChecklist = () => {
    showCard({
      calculator: 'Overhead Reticulation — Pre-Energization Inspection',
      site: site.name,
      standard: PRE_ENERGIZATION_STANDARD,
      inputs: [
        { label: 'Items Checked', value: `${doneCount} of ${allItems.length}` },
        { label: 'Status', value: allDone ? 'ALL ITEMS AFFIRMATIVE — may be energized per §4.10.2' : 'INCOMPLETE — the line may NOT be energized until every answer is affirmative' },
      ],
      sections: PRE_ENERGIZATION_CHECKLIST.map(g => ({
        title: g.group,
        rows: g.items.map(i => ({
          label: i.text,
          value: checked[i.id] ? 'YES' : '—',
          accent: !checked[i.id],
        })),
      })),
      notes: 'DST_34-1191 §4.10.2 requires every answer to be in the affirmative before the line may be energized. Unticked items export as "—" so an incomplete record is visibly incomplete. Earth resistance test results per §4.10.3 / DST_34-1985 must be attached separately.',
    })
    addHistory({ tab: 'Overhead — Pre-Energization', expr: `${doneCount}/${allItems.length} checked`, result: allDone ? 'complete' : 'incomplete' })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Line Construction Reference" color="blue" lines={[
        'The build sequence and its numeric rules per DST_34-1191, plus the standard\'s own §4.10.2 pre-energization inspection as a tick-off checklist you can export as a hand-over record.',
        'Sequence phases are anchored to the governing clause where one exists; sag-tension mechanical design itself remains out of this module\'s scope.',
      ]} />

      {/* ── Construction sequence ── */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-3">
        <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
          <span className="text-amber-400 text-xs font-bold">CONSTRUCTION SEQUENCE — 11 PHASES</span>
        </div>
        <div className="px-4 py-2">
          {CONSTRUCTION_SEQUENCE.map(p => (
            <div key={p.id} className="py-2 border-b border-[#1a1a1a] last:border-b-0">
              <button onClick={() => setOpenPhase(openPhase === p.id ? null : p.id)} className="w-full text-left">
                <div className="flex justify-between items-center">
                  <span className="text-white text-sm font-bold">{p.phase}. {p.title}</span>
                  <span className="text-gray-500 text-xs">{openPhase === p.id ? '▲' : '▼'}</span>
                </div>
              </button>
              {openPhase === p.id && (
                <div className="pt-1.5">
                  <div className="text-gray-300 text-xs">{p.detail}</div>
                  <div className="text-gray-500 text-xs pt-1 italic">{p.clause}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Stringing rules ── */}
      <button onClick={() => setShowRules(s => !s)}
        className="w-full py-3 rounded-xl font-bold text-sm mb-3"
        style={{ background: 'transparent', border: '1px solid #94a3b8', color: '#94a3b8' }}>
        {showRules ? 'HIDE' : 'SHOW'} STRINGING & CONSTRUCTION RULES
      </button>
      {showRules && (
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-3">
          <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
            <span className="text-amber-400 text-xs font-bold">NUMERIC RULES — CLAUSE-CITED</span>
          </div>
          <div className="px-4 py-2">
            {STRINGING_RULES.map(r => (
              <div key={r.id} className="py-2 border-b border-[#1a1a1a] last:border-b-0">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-300 text-xs">{r.label}</span>
                  <span className="text-white text-xs font-mono text-right flex-shrink-0">{r.value}</span>
                </div>
                <div className="text-gray-600 text-[10px] pt-0.5 italic">{r.clause}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pre-energization checklist ── */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-3">
        <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a] flex justify-between items-center">
          <span className="text-amber-400 text-xs font-bold">PRE-ENERGIZATION INSPECTION</span>
          <span className={`text-xs font-bold ${allDone ? 'text-green-400' : 'text-gray-400'}`}>{doneCount}/{allItems.length}</span>
        </div>
        <div className="px-4 py-2">
          <div className="text-gray-400 text-xs pb-2">§4.10.2: every answer must be affirmative before the line may be energized.</div>
          {PRE_ENERGIZATION_CHECKLIST.map(g => (
            <div key={g.group} className="pb-2">
              <div className="text-sky-400 text-xs font-bold pt-1 pb-1">{g.group}</div>
              {g.items.map(i => (
                <button key={i.id} onClick={() => toggle(i.id)}
                  className="w-full flex items-start gap-2 py-1.5 text-left border-b border-[#1a1a1a] last:border-b-0">
                  <span className={`flex-shrink-0 w-5 h-5 rounded border text-xs flex items-center justify-center mt-0.5 ${checked[i.id] ? 'bg-green-500 border-green-500 text-black font-bold' : 'border-[#3a3a3a] text-transparent'}`}>✓</span>
                  <span className={`text-xs ${checked[i.id] ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{i.text}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {!allDone && doneCount > 0 && (
        <InfoBox title="Checklist Incomplete" color="amber" lines={[
          `${allItems.length - doneCount} item(s) unticked — per §4.10.2 the line may not be energized until every answer is affirmative. The PDF export marks unticked items visibly.`,
        ]} />
      )}

      <button onClick={exportChecklist}
        className="w-full py-3 rounded-xl font-bold text-sm mb-4"
        style={{ background: 'transparent', border: '1px solid #38bdf8', color: '#38bdf8' }}>
        📄 Export Checklist PDF
      </button>
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

// ── Faults & Maintenance ─────────────────────────────────────────────────────
// Seventh sub-tab, added 2026-07-28. Qualitative fault-finding reference
// (each mechanism anchored to DST_34-1191's own failure discussion), the
// §4.4.9 lightning-exposure calculation (Ng entered by the user — the
// standard's per-town Ng table is deliberately not reproduced, per the
// no-place-names rule), and the stringing-equipment glossary.
function FaultsMaintenance({ addHistory }) {
  const { site } = useSite()
  const [ng, setNg] = useState('')
  const [td, setTd] = useState('')
  const [heightM, setHeightM] = useState('')
  const [widthM, setWidthM] = useState('')
  const [lengthKm, setLengthKm] = useState('')
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const [openFault, setOpenFault] = useState(null)
  const [showGlossary, setShowGlossary] = useState(false)
  const { cardData, showCard, hideCard } = useResultCard()

  const calculate = () => {
    setErr('')
    setResult(null)
    const r = lightningExposure({ ngPerKm2Yr: ng, thunderDays: td, avgHeightM: heightM, lineWidthM: widthM, lengthKm })
    if (!r) {
      setErr('Enter a positive structure height and line length, a line width (0 allowed for single-conductor width), and either a ground flash density (Ng) or annual thunder days (Td).')
      return
    }
    setResult(r)
    addHistory({ tab: 'Overhead — Lightning Exposure', expr: `Ng ${r.ngPerKm2Yr}, ${lengthKm} km`, result: `${r.strikesPerYear} strikes/yr` })
  }

  const exportPdf = () => {
    if (!result) return
    showCard({
      calculator: 'Overhead Reticulation — Lightning Exposure',
      site: site.name,
      standard: result.standard,
      inputs: [
        { label: 'Ground Flash Density Ng', value: `${result.ngPerKm2Yr} strikes/km²/yr${result.ngDerivedFromTd ? ' (derived from thunder days)' : ''}` },
        { label: 'Average Structure Height', value: `${heightM} m` },
        { label: 'Line Width', value: `${widthM} m` },
        { label: 'Line Length', value: `${lengthKm} km` },
      ],
      sections: [{
        title: 'Expected Strikes To The Line',
        rows: [
          { label: 'Strikes Per Year', value: `${result.strikesPerYear}`, accent: true },
          { label: 'Strikes Per 100 km Per Year', value: `${result.strikesPer100kmYear}` },
        ],
      }],
      notes: 'Planning-level estimate for line-performance assessment (is this line\'s trip rate consistent with its lightning exposure?). Ng must be a real local figure from utility isokeraunic data or the Weather Bureau — it varies by more than two orders of magnitude across the region, which is why no default is offered.',
    })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Fault Finding & Maintenance" color="blue" lines={[
        'Common MV overhead fault mechanisms with what to look for on patrol — each anchored to DST_34-1191\'s own failure-mechanism discussion — plus the §4.4.9 lightning-exposure estimate for judging whether a line\'s trip rate matches its environment.',
      ]} />

      {/* ── Lightning exposure calc ── */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-3">
        <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
          <span className="text-amber-400 text-xs font-bold">LIGHTNING EXPOSURE — Ns = Ng(28H^0.6 + W)·L·10⁻³</span>
        </div>
        <div className="px-4 py-3">
          <NumInput label="Ground flash density Ng" value={ng} onChange={setNg} unit="strikes/km²/yr" note="from utility/Weather Bureau data for YOUR area — leave blank to derive from thunder days" />
          <NumInput label="Annual thunder days Td" value={td} onChange={setTd} unit="days/yr" note="used only if Ng is blank; Ng = 0.04·Td^1.25" />
          <NumInput label="Average structure height" value={heightM} onChange={setHeightM} unit="m" />
          <NumInput label="Line width" value={widthM} onChange={setWidthM} unit="m" note="outer conductor to outer conductor" />
          <NumInput label="Line length" value={lengthKm} onChange={setLengthKm} unit="km" />
          <CalcButton onClick={calculate} label="ESTIMATE" />
          {err && <ErrBox msg={err} />}
          {result && (
            <>
              <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
                <span className="text-gray-300 text-sm font-bold">Expected Strikes</span>
                <span className="text-2xl font-bold text-sky-400">{result.strikesPerYear} /yr</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
                <span className="text-gray-400 text-xs">Per 100 km</span>
                <span className="text-white text-sm font-mono">{result.strikesPer100kmYear} /100km/yr</span>
              </div>
              {result.ngDerivedFromTd && (
                <div className="text-gray-500 text-xs pt-1.5">Ng derived from thunder days: {result.ngPerKm2Yr} strikes/km²/yr</div>
              )}
              <button onClick={exportPdf}
                className="w-full py-3 rounded-xl font-bold text-sm mt-3"
                style={{ background: 'transparent', border: '1px solid #38bdf8', color: '#38bdf8' }}>
                📄 Export PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Fault-finding reference ── */}
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-3">
        <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
          <span className="text-amber-400 text-xs font-bold">FAULT-FINDING REFERENCE</span>
        </div>
        <div className="px-4 py-2">
          {FAULT_FINDING.map(f => (
            <div key={f.id} className="py-2 border-b border-[#1a1a1a] last:border-b-0">
              <button onClick={() => setOpenFault(openFault === f.id ? null : f.id)} className="w-full text-left">
                <div className="flex justify-between items-center">
                  <span className="text-white text-sm font-bold">{f.fault}</span>
                  <span className="text-gray-500 text-xs">{openFault === f.id ? '▲' : '▼'}</span>
                </div>
              </button>
              {openFault === f.id && (
                <div className="pt-1.5">
                  <div className="text-gray-300 text-xs">{f.mechanism}</div>
                  <div className="text-sky-400 text-xs pt-1.5 font-bold">Look for:</div>
                  <div className="text-gray-300 text-xs">{f.lookFor}</div>
                  <div className="text-gray-500 text-xs pt-1 italic">{f.clause}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Stringing glossary ── */}
      <button onClick={() => setShowGlossary(s => !s)}
        className="w-full py-3 rounded-xl font-bold text-sm mb-3"
        style={{ background: 'transparent', border: '1px solid #94a3b8', color: '#94a3b8' }}>
        {showGlossary ? 'HIDE' : 'SHOW'} STRINGING EQUIPMENT GLOSSARY
      </button>
      {showGlossary && (
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-3">
          <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
            <span className="text-amber-400 text-xs font-bold">STRINGING EQUIPMENT — TRADE REFERENCE</span>
          </div>
          <div className="px-4 py-2">
            {STRINGING_GLOSSARY.map(g => (
              <div key={g.id} className="py-2 border-b border-[#1a1a1a] last:border-b-0">
                <div className="text-white text-sm font-bold">{g.term}</div>
                <div className="text-gray-400 text-xs pt-0.5">{g.meaning}</div>
                {g.clause && <div className="text-gray-600 text-[10px] pt-0.5 italic">{g.clause}</div>}
              </div>
            ))}
            <div className="text-gray-500 text-xs py-2">General trade-terminology reference — clause citations shown where a DST_34-1191 rule attaches to the item; the rest is standard line-construction usage, not a standards citation.</div>
          </div>
        </div>
      )}
      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

const OVERHEAD_TABS = [
  { id: 'conductor', label: 'Conductor Sizing', icon: '〰' },
  { id: 'spacing',   label: 'Pole Spacing', icon: '📏' },
  { id: 'planting',  label: 'Pole Planting', icon: '🕳' },
  { id: 'clearance', label: 'Clearances', icon: '⛔' },
  { id: 'fittings',  label: 'Fittings & Structures', icon: '🔩' },
  { id: 'construction', label: 'Construction', icon: '🏗' },
  { id: 'maintenance',  label: 'Faults & Maintenance', icon: '🔧' },
]

export default function OverheadReticulation({ addHistory }) {
  const [sub, setSub] = useState('conductor')
  const map = {
    conductor: <ConductorSizing addHistory={addHistory} />,
    spacing:   <PoleSpacing addHistory={addHistory} />,
    planting:  <PolePlanting addHistory={addHistory} />,
    clearance: <Clearances addHistory={addHistory} />,
    fittings:  <FittingsStructures addHistory={addHistory} />,
    construction: <Construction addHistory={addHistory} />,
    maintenance:  <FaultsMaintenance addHistory={addHistory} />,
  }
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SubTabBar tabs={OVERHEAD_TABS} active={sub} onChange={setSub} />
      <div className="flex-1 overflow-y-auto">{map[sub]}</div>
    </div>
  )
}
