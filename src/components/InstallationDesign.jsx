import React, { useState } from 'react'
import { NumInput, ToggleInput, SelectInput, InfoBox, ErrBox, CalcButton, ResultCard, useResultCard, SubTabBar } from './shared'
import { useSite } from './SiteContext'
import { useWorkspace } from './WorkspaceContext'
import { loadAssessment, LOAD_CATEGORIES, dbSizing, SPARE_WAYS_DEFAULT_PCT, circuitDesign, areaLighting, AREA_LIGHTING_GUIDE, findAreaLightingGuideEntry } from './installationDesignEngine'
import { AMBIENT, GROUP, INSTALL } from './cableEngine'

// ── Load Assessment ──────────────────────────────────────────────────────────
// §5.6.1 roadmap.md — first sub-tab of the new "Installation Design" module.
// This is a tally + user-supplied-demand-factor calculator, not a table lookup — see the
// sourcing note at the top of installationDesignEngine.js for why: neither IEC 60364-1 (Clause
// 311, "guidance ... under consideration") nor SANS 10142-1 (Annex D/C, "not to be regarded as
// an exact method") publish a mandatory diversity table. The registered person/electrical
// consultant supplies the judgement call; this tool does the arithmetic and unit conversion.
function LoadAssessment({ addHistory }) {
  const { site } = useSite()
  const [voltage, setVoltage] = useState('400')
  const [phase, setPhase] = useState('3ph')
  const [powerFactor, setPowerFactor] = useState('0.9')
  const [rows, setRows] = useState(
    LOAD_CATEGORIES.map(cat => ({ id: cat.id, connected: '', demandFactor: String(cat.defaultDF) }))
  )
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const { cardData, showCard, hideCard } = useResultCard()
  const { setLoadAssessmentSnapshot } = useWorkspace()

  const updateRow = (id, field, val) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: val } : r))
  }

  const calculate = () => {
    setError('')
    setResult(null)
    const r = loadAssessment({ rows, voltage, phase, powerFactor })
    if (r.error) { setError(r.error); return }
    setResult(r)
    addHistory({ tab: 'Load Assessment', expr: `${r.totalConnected.toFixed(1)}kW connected`, result: `${r.recommendedMain}A main` })
    setLoadAssessmentSnapshot({ recommendedMain: String(r.recommendedMain), demandKVA: r.demandKVA.toFixed(2), current: r.current.toFixed(1), voltage, phase })
  }

  const exportPdf = () => {
    if (!result) return
    showCard({
      calculator: 'Installation Design — Load Assessment',
      site: site.name,
      standard: 'SANS 10142-1 / IEC 60364-1 (planning-level — see notes)',
      inputs: [
        { label: 'System Voltage', value: `${voltage} V` },
        { label: 'Phase', value: phase === '1ph' ? 'Single-phase' : 'Three-phase' },
        { label: 'Assumed Overall PF', value: powerFactor },
      ],
      sections: [
        {
          title: 'Load Tally',
          rows: result.rowResults.map(rr => {
            const cat = LOAD_CATEGORIES.find(c => c.id === rr.id)
            return { label: cat ? cat.label : rr.id, value: `${rr.connected.toFixed(2)} kW connected × ${rr.demandFactorPct}% DF = ${rr.demand.toFixed(2)} kW` }
          }),
        },
        {
          title: 'Results',
          rows: [
            { label: 'Total Connected Load', value: `${result.totalConnected.toFixed(2)} kW` },
            { label: 'Total Maximum Demand', value: `${result.totalDemand.toFixed(2)} kW`, accent: true },
            { label: 'Demand (kVA, at assumed PF)', value: `${result.demandKVA.toFixed(2)} kVA` },
            { label: 'Estimated Demand Current', value: `${result.current.toFixed(1)} A`, accent: true },
            { label: 'Recommended Main Switch/Breaker', value: `${result.recommendedMain} A`, accent: true },
            { label: 'Diversity Achieved', value: `${result.diversityAchieved.toFixed(1)} %` },
          ],
        },
      ],
      notes: 'Demand factors are user-supplied engineering judgement, not an IEC/SANS mandated table — see the in-app info box for why. Verify final supply/DB sizing against the supply authority\'s own requirements (SANS 10142-1, 5.2.1 NOTE 2).',
    })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Load Assessment" color="blue" lines={[
        'Neither IEC 60364-1 (Clause 311) nor SANS 10142-1 (Annex D/C) publish a mandatory diversity table — both explicitly leave this to engineering judgement',
        'Enter connected load per category, then set the demand factor you\'re applying — the reference ranges shown are industry practice, not a standard requirement',
        'Default demand factor is 100% (no diversity) until you change it — the safe assumption if left unedited',
      ]}/>
      <ToggleInput label="Phase" options={[['3ph','Three-phase'],['1ph','Single-phase']]} value={phase} onChange={setPhase}/>
      <NumInput label="System Voltage" value={voltage} onChange={setVoltage} unit="V"/>
      <NumInput label="Assumed Overall Power Factor" value={powerFactor} onChange={setPowerFactor} unit=""/>

      <div className="mt-4 mb-2 text-xs font-bold text-gray-400">LOAD CATEGORIES</div>
      {LOAD_CATEGORIES.map(cat => {
        const row = rows.find(r => r.id === cat.id)
        return (
          <div key={cat.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 mb-2">
            <div className="text-sm font-bold text-white mb-1">{cat.label}</div>
            <div className="text-[10px] text-gray-500 mb-2">{cat.hint}</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-500 text-[10px]">Connected Load (kW)</label>
                <input type="text" inputMode="decimal" value={row.connected}
                  onChange={e => updateRow(cat.id, 'connected', e.target.value.replace(',', '.'))}
                  className="w-full bg-[#111] border border-[#333] text-white text-sm rounded-lg px-2 py-1.5 outline-none mt-1"/>
              </div>
              <div>
                <label className="text-gray-500 text-[10px]">Demand Factor (%)</label>
                <input type="text" inputMode="decimal" value={row.demandFactor}
                  onChange={e => updateRow(cat.id, 'demandFactor', e.target.value.replace(',', '.'))}
                  className="w-full bg-[#111] border border-[#333] text-white text-sm rounded-lg px-2 py-1.5 outline-none mt-1"/>
              </div>
            </div>
          </div>
        )
      })}

      <CalcButton onClick={calculate}/>
      <ErrBox msg={error}/>

      {result && (
        <>
          {result.warnings.length > 0 && (
            <div className="bg-[#1a1200] border border-[#3d2800] rounded-xl px-4 py-2.5 mb-3">
              {result.warnings.map((w, i) => <div key={i} className="text-amber-400 text-xs mb-1 last:mb-0">⚠ {w}</div>)}
            </div>
          )}
          <div className="bg-[#0a0f14] border border-[#003147] rounded-xl px-4 py-3 mb-4">
            <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
              <span className="text-gray-400 text-xs">Total Connected Load</span>
              <span className="text-white text-sm font-mono font-bold">{result.totalConnected.toFixed(2)} kW</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
              <span className="text-gray-400 text-xs">Total Maximum Demand</span>
              <span className="text-sky-400 text-sm font-mono font-bold">{result.totalDemand.toFixed(2)} kW</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
              <span className="text-gray-400 text-xs">Demand (kVA)</span>
              <span className="text-white text-sm font-mono font-bold">{result.demandKVA.toFixed(2)} kVA</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
              <span className="text-gray-400 text-xs">Estimated Demand Current</span>
              <span className="text-sky-400 text-sm font-mono font-bold">{result.current.toFixed(1)} A</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
              <span className="text-gray-400 text-xs">Diversity Achieved</span>
              <span className="text-white text-sm font-mono font-bold">{result.diversityAchieved.toFixed(1)} %</span>
            </div>
            <div className="flex justify-between py-2 mt-1">
              <span className="text-gray-300 text-sm font-bold">Recommended Main Switch/Breaker</span>
              <span className="text-2xl font-bold text-sky-400">{result.recommendedMain} A</span>
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

// ── DB Sizing ─────────────────────────────────────────────────────────────
// §5.6.1 roadmap.md — second sub-tab. Built as an itemized circuit list (like the Cable
// module's Route Fault Level segments) rather than category totals, because a real DB schedule
// is a list of individual circuits, and the 5kW socket-outlet limit (SANS 10142-1, 6.15.2.2)
// only makes sense checked per circuit. See installationDesignEngine.js's sourcing note for
// what's a real standard clause here vs. common practice.
function DBSizing({ addHistory }) {
  const { site } = useSite()
  const { loadAssessmentSnapshot } = useWorkspace()
  const [circuits, setCircuits] = useState([{ id: 'c0', type: 'lighting', connected: '', label: '' }])
  const [sparePct, setSparePct] = useState(String(SPARE_WAYS_DEFAULT_PCT))
  const [mainSwitch, setMainSwitch] = useState(loadAssessmentSnapshot?.recommendedMain || '')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const { cardData, showCard, hideCard } = useResultCard()

  const addCircuit = () => setCircuits(cs => [...cs, { id: `c${cs.length}-${Date.now()}`, type: 'lighting', connected: '', label: '' }])
  const removeCircuit = (id) => setCircuits(cs => cs.filter(c => c.id !== id))
  const updateCircuit = (id, field, val) => setCircuits(cs => cs.map(c => c.id === id ? { ...c, [field]: val } : c))

  const calculate = () => {
    setError('')
    setResult(null)
    const r = dbSizing({ circuits, sparePct, mainSwitch })
    if (r.error) { setError(r.error); return }
    setResult(r)
    addHistory({ tab: 'DB Sizing', expr: `${r.circuitCount} circuits`, result: `${r.recommendedDB}-way DB` })
  }

  const exportPdf = () => {
    if (!result) return
    showCard({
      calculator: 'Installation Design — DB Sizing',
      site: site.name,
      standard: 'SANS 10142-1 6.15.2.2 (socket-outlet limit); DB way-count is a commercial reference, not a standard table',
      inputs: [
        { label: 'Spare Ways Allowance', value: `${sparePct} %` },
        { label: 'Main Switch (entered)', value: mainSwitch ? `${mainSwitch} A` : 'not specified' },
      ],
      sections: [
        {
          title: 'Circuit List',
          rows: result.rows.map((r, i) => ({
            label: r.label || `${LOAD_CATEGORIES.find(c => c.id === r.type)?.label || r.type} — circuit ${i + 1}`,
            value: `${r.connected} kW${r.overLimit ? ' — EXCEEDS 5kW LIMIT' : ''}`,
            warn: r.overLimit,
          })),
        },
        {
          title: 'Results',
          rows: [
            { label: 'Circuit Count', value: result.circuitCount },
            { label: 'Spare Ways', value: result.spareCount },
            { label: 'Required Ways', value: result.requiredWays, accent: true },
            { label: 'Recommended DB Size', value: `${result.recommendedDB}-way`, accent: true },
            { label: 'Recommended Main Switch', value: result.recommendedMain ? `${result.recommendedMain} A` : 'not specified', accent: true },
          ],
        },
      ],
      notes: 'DB way-count reference is a commercially common range, not an IEC/SANS mandated table. Spare-ways allowance is common practice, not a fixed standard percentage — SANS 10142-1 requires provision for likely extension but sets no specific figure.',
    })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="DB Sizing" color="blue" lines={[
        'Socket-outlet circuits are checked against the real SANS 10142-1 6.15.2.2 limit (5kW) — everything else here is field-quick reference, not a standard table',
        'DB way-counts shown are commercially common sizes, not an IEC/SANS list — confirm against your board supplier\'s actual range',
        'Spare-ways allowance defaults to a common practice figure — SANS 10142-1 requires provision for likely extension but sets no fixed percentage',
      ]}/>
      {loadAssessmentSnapshot && (
        <div className="bg-[#001a00] border border-[#1a3a1a] rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
          <span className="text-green-400 text-lg">✓</span>
          <div>
            <div className="text-green-400 text-xs font-bold">Main switch loaded from Load Assessment</div>
            <div className="text-gray-500 text-[10px]">{loadAssessmentSnapshot.recommendedMain} A · {loadAssessmentSnapshot.current} A demand · {loadAssessmentSnapshot.voltage}V</div>
          </div>
        </div>
      )}

      <div className="mt-2 mb-2 text-xs font-bold text-gray-400">CIRCUIT LIST</div>
      {circuits.map((c, i) => (
        <div key={c.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 mb-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sky-400 text-xs font-bold">Circuit {i + 1}</span>
            {circuits.length > 1 && <button onClick={() => removeCircuit(c.id)} className="text-red-500 text-xs">Remove</button>}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-gray-500 text-[10px]">Type</label>
              <select value={c.type} onChange={e => updateCircuit(c.id, 'type', e.target.value)}
                className="w-full bg-[#111] border border-[#333] text-white text-sm rounded-lg px-2 py-1.5 outline-none mt-1">
                {LOAD_CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-500 text-[10px]">Connected Load (kW)</label>
              <input type="text" inputMode="decimal" value={c.connected}
                onChange={e => updateCircuit(c.id, 'connected', e.target.value.replace(',', '.'))}
                className="w-full bg-[#111] border border-[#333] text-white text-sm rounded-lg px-2 py-1.5 outline-none mt-1"/>
            </div>
          </div>
          <label className="text-gray-500 text-[10px]">Label (optional, e.g. "Kitchen sockets")</label>
          <input type="text" value={c.label} onChange={e => updateCircuit(c.id, 'label', e.target.value)}
            className="w-full bg-[#111] border border-[#333] text-white text-sm rounded-lg px-2 py-1.5 outline-none mt-1"/>
        </div>
      ))}
      <button onClick={addCircuit} className="w-full bg-[#1c1c1c] text-gray-400 py-2 rounded-xl text-sm mb-3">+ Add Circuit</button>

      <NumInput label="Spare Ways Allowance" value={sparePct} onChange={setSparePct} unit="%"/>
      <NumInput label="Main Switch / Demand Current" value={mainSwitch} onChange={setMainSwitch} unit="A"/>

      <CalcButton onClick={calculate}/>
      <ErrBox msg={error}/>

      {result && (
        <>
          {result.warnings.length > 0 && (
            <div className="bg-[#1a1200] border border-[#3d2800] rounded-xl px-4 py-2.5 mb-3">
              {result.warnings.map((w, i) => <div key={i} className="text-amber-400 text-xs mb-1 last:mb-0">⚠ {w}</div>)}
            </div>
          )}
          <div className="bg-[#0a0f14] border border-[#003147] rounded-xl px-4 py-3 mb-4">
            <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
              <span className="text-gray-400 text-xs">Circuit Count</span>
              <span className="text-white text-sm font-mono font-bold">{result.circuitCount}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
              <span className="text-gray-400 text-xs">Spare Ways</span>
              <span className="text-white text-sm font-mono font-bold">{result.spareCount}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
              <span className="text-gray-400 text-xs">Required Ways</span>
              <span className="text-sky-400 text-sm font-mono font-bold">{result.requiredWays}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
              <span className="text-gray-300 text-sm font-bold">Recommended DB Size</span>
              <span className="text-2xl font-bold text-sky-400">{result.recommendedDB}-way</span>
            </div>
            {result.recommendedMain && (
              <div className="flex justify-between py-2 mt-1">
                <span className="text-gray-300 text-sm font-bold">Recommended Main Switch</span>
                <span className="text-2xl font-bold text-sky-400">{result.recommendedMain} A</span>
              </div>
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

// ── Circuit Design ────────────────────────────────────────────────────────
// §5.6.1 roadmap.md — third sub-tab. Reuses cableEngine.js's cableSizing() directly rather
// than reimplementing it (per [ARC-1]/[DEC-2]) — see installationDesignEngine.js's sourcing
// note for the IEC 60364-4-43 433.1 coordination rule (Ib ≤ In ≤ Iz) this is built around.
function CircuitDesign({ addHistory }) {
  const { site } = useSite()
  const [connectedLoad, setConnectedLoad] = useState('')
  const [voltage, setVoltage] = useState('230')
  const [phase, setPhase] = useState('1ph')
  const [powerFactor, setPowerFactor] = useState('1')
  const [length, setLength] = useState('')
  const [ambient, setAmbient] = useState('30')
  const [groups, setGroups] = useState('1')
  const [install, setInstall] = useState('Conduit in wall')
  const [insul, setInsul] = useState('PVC')
  const [material, setMaterial] = useState('Cu')
  const [maxVd, setMaxVd] = useState('5')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const { cardData, showCard, hideCard } = useResultCard()
  const pf_ = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n }

  const calculate = () => {
    setError('')
    setResult(null)
    const r = circuitDesign({ connectedLoad, voltage, phase, powerFactor, length, ambient, groups, install, insul, material, maxVd })
    if (r.error) { setError(r.error); return }
    if (!r.recommendedCable) { setError('No standard cable size meets both current-carrying and voltage-drop requirements for this run — try a shorter length, a larger max VD, or a bigger installation-method allowance'); return }
    setResult(r)
    addHistory({ tab: 'Circuit Design', expr: `${pf_(connectedLoad)}kW circuit`, result: `${r.recommendedCable}mm² / ${r.recommendedBreaker}A` })
  }

  const exportPdf = () => {
    if (!result) return
    const recRow = result.sizing.allResults.find(x => x.size === result.recommendedCable)
    showCard({
      calculator: 'Installation Design — Circuit Design',
      site: site.name,
      standard: 'IEC 60364-4-43 433.1 (Ib ≤ In ≤ Iz coordination); cable sizing per cableEngine.js',
      inputs: [
        { label: 'Connected Load', value: `${connectedLoad} kW` },
        { label: 'Voltage / Phase', value: `${voltage} V, ${phase === '1ph' ? 'single-phase' : 'three-phase'}` },
        { label: 'Circuit Length', value: `${length} m` },
        { label: 'Installation Method', value: install },
      ],
      sections: [{
        title: 'Results',
        rows: [
          { label: 'Design Current (Ib)', value: `${result.Ib.toFixed(2)} A` },
          { label: 'Recommended Breaker (In)', value: `${result.recommendedBreaker} A`, accent: true },
          { label: 'Recommended Cable', value: `${result.recommendedCable} mm²`, accent: true },
          { label: 'Cable Capacity (Iz)', value: `${recRow.derated.toFixed(2)} A` },
          { label: 'Voltage Drop', value: `${recRow.vdV.toFixed(2)} V (${recRow.vdPct.toFixed(2)}%)` },
        ],
      }],
      notes: 'Cable is sized and voltage-drop-checked against the breaker rating (In), not the raw design current (Ib) — a deliberately conservative choice. Confirm final selection against your board supplier\'s actual product range.',
    })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Circuit Design" color="blue" lines={[
        'Coordination rule (IEC 60364-4-43, 433.1): Ib ≤ In ≤ Iz — design current, breaker rating, and cable capacity, in that order',
        'Cable is sized against the breaker rating (In), not the raw connected-load current (Ib) — conservative by design',
        'Reuses the same cable-sizing engine as the Cable module\'s Sizing tab — nothing here duplicates that logic',
      ]}/>
      <ToggleInput label="Phase" options={[['1ph','Single-phase'],['3ph','Three-phase']]} value={phase} onChange={setPhase}/>
      <NumInput label="Connected Load" value={connectedLoad} onChange={setConnectedLoad} unit="kW"/>
      <NumInput label="System Voltage" value={voltage} onChange={setVoltage} unit="V"/>
      <NumInput label="Power Factor" value={powerFactor} onChange={setPowerFactor} unit=""/>
      <NumInput label="Circuit Length (one-way)" value={length} onChange={setLength} unit="m"/>
      <NumInput label="Max Voltage Drop" value={maxVd} onChange={setMaxVd} unit="%"/>
      <ToggleInput label="Insulation" options={[['PVC','PVC 70°C'],['XLPE','XLPE 90°C']]} value={insul} onChange={setInsul}/>
      <ToggleInput label="Conductor" options={[['Cu','Copper'],['Al','Aluminium']]} value={material} onChange={setMaterial}/>
      <SelectInput label="Ambient Temperature" value={ambient} onChange={setAmbient} options={Object.keys(AMBIENT).map(t=>[t,`${t}°C (×${AMBIENT[t]})`])}/>
      <SelectInput label="Grouped Circuits" value={groups} onChange={setGroups} options={Object.entries(GROUP).map(([g,f])=>[g,`${g} circuit${g>1?'s':''} (×${f})`])}/>
      <SelectInput label="Installation Method" value={install} onChange={setInstall} options={Object.entries(INSTALL).map(([k,v])=>[k,`${k} (×${v})`])}/>

      <CalcButton onClick={calculate}/>
      <ErrBox msg={error}/>

      {result && (
        <>
          <div className="bg-[#0a0f14] border border-[#003147] rounded-xl px-4 py-3 mb-4">
            <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
              <span className="text-gray-400 text-xs">Design Current (Ib)</span>
              <span className="text-white text-sm font-mono font-bold">{result.Ib.toFixed(2)} A</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
              <span className="text-gray-300 text-sm font-bold">Recommended Breaker (In)</span>
              <span className="text-2xl font-bold text-sky-400">{result.recommendedBreaker} A</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-300 text-sm font-bold">Recommended Cable</span>
              <span className="text-2xl font-bold text-sky-400">{result.recommendedCable} mm²</span>
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

// ── Area Lighting ──────────────────────────────────────────────────────────
// §5.6.1 roadmap.md — fourth and final sub-tab, closing out Installation Design.
// Scope changed from the original roadmap wording during sourcing (2026-07-26): SANS 10114-1
// (already used by Power Quality's interior Lighting tab) is exclusively an interior standard.
// The correct exterior/floodlighting standard is SANS 10389-1, which this project doesn't have
// access to — so this tab, confirmed with Hertz, is deliberately scoped down: no lux-guide
// table (required illuminance is a user judgement call), fitting-count math reuses
// src/lib/lumenMethod.js's lightingLumenMethod() directly (the same generic photometric formula
// Power Quality's interior tab uses, extracted there 2026-07-26 specifically so both tabs could
// share it without duplicating it), and mounting-height/pole-spacing use widely-published,
// non-SANS-specific industry rules of thumb — see installationDesignEngine.js's sourcing note
// for the full detail and the exact sources cross-checked during scoping. The result's `note`
// field carries the same disclaimer shown here so it travels with the calculation.
function AreaLighting({ addHistory }) {
  const { site } = useSite()
  const [areaWidth, setAreaWidth] = useState('')
  const [areaLength, setAreaLength] = useState('')
  const [guideCategory, setGuideCategory] = useState('')
  const [guideTier, setGuideTier] = useState('')
  const [lux, setLux] = useState('')
  const [CU, setCU] = useState('0.4')
  const [MF, setMF] = useState('0.8')
  const [lumens, setLumens] = useState('20000')
  const [watts, setWatts] = useState('200')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const { cardData, showCard, hideCard } = useResultCard()

  const guideEntry = guideCategory && guideTier ? findAreaLightingGuideEntry(guideCategory, guideTier) : null
  const selectedCategoryTiers = AREA_LIGHTING_GUIDE.find(c => c.id === guideCategory)?.tiers || []

  const applyGuideEntry = (categoryId, tierId) => {
    setGuideCategory(categoryId)
    setGuideTier(tierId)
    const entry = categoryId && tierId ? findAreaLightingGuideEntry(categoryId, tierId) : null
    if (entry) setLux(String(entry.lux))
  }

  const calculate = () => {
    setError('')
    setResult(null)
    const r = areaLighting({ areaWidth, areaLength, lux, CU, MF, lumens, watts })
    if (r.error) { setError(r.error); return }
    setResult(r)
    addHistory({ tab: 'Area Lighting', expr: `${areaWidth}×${areaLength}m yard`, result: `${r.N_ceil} fittings, ${r.poleSpacing.toFixed(1)}m spacing` })
  }

  const exportPdf = () => {
    if (!result) return
    showCard({
      calculator: 'Installation Design — Area Lighting',
      site: site.name,
      standard: guideEntry
        ? `Reference: ${guideEntry.category} — ${guideEntry.tier} (secondary-source cross-checked, see notes); lumen method shared with Power Quality's interior tab; mounting height/pole spacing are industry rule-of-thumb`
        : 'Generic photometric lumen method (shared with Power Quality\'s interior tab); mounting height/pole spacing are industry rule-of-thumb, NOT SANS 10389-1 (see notes)',
      inputs: [
        { label: 'Area Width (distance across)', value: `${areaWidth} m` },
        { label: 'Area Length', value: `${areaLength} m` },
        { label: 'Reference Category', value: guideEntry ? `${guideEntry.category} — ${guideEntry.tier}` : 'None — user-supplied' },
        { label: 'Required Illuminance', value: `${lux} lux` },
        { label: 'Coefficient of Utilization (CU)', value: CU },
        { label: 'Maintenance Factor (MF)', value: MF },
        { label: 'Fitting Output', value: `${lumens} lm / ${watts} W` },
      ],
      sections: [{
        title: 'Results',
        rows: [
          { label: 'Fittings Required', value: `${result.N.toFixed(1)} → ${result.N_ceil}`, accent: true },
          { label: 'Actual Illuminance', value: `${result.lux_act.toFixed(0)} lux`, accent: true },
          { label: 'Mounting Height', value: `${result.mountingHeight.toFixed(1)} m` },
          { label: 'Pole Spacing', value: `${result.poleSpacing.toFixed(1)} m`, accent: true },
          { label: 'Total Load', value: `${result.W} W` },
          { label: 'Power Density', value: `${result.Wm2.toFixed(2)} W/m²` },
          ...(guideEntry ? [
            { label: 'Reference Uniformity (min/avg)', value: guideEntry.uniformityAvg },
            { label: 'Reference Max Glare Rating', value: guideEntry.glareMax },
          ] : []),
        ],
      }],
      notes: guideEntry
        ? `${result.note} Reference figures (illuminance/uniformity/glare) are secondary-source data cross-checked against two independent published sources (an ISO/CIE 8995-3:2018 preview and an industry lighting guide attributing SANS 10389-1) — ${guideEntry.crossValidated ? 'this category matched exactly across both' : 'this category is sourced from the industry guide only, not independently cross-checked'}. Not a direct SANS 10389-1 citation — verify locally for anything safety-critical. Uniformity is a target for the achieved lighting layout, not something this single-point calculator computes; that needs a full photometric layout tool.`
        : result.note,
    })
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Area Lighting" color="blue" lines={[
        'No direct SANS 10389-1 citation — the reference categories below are secondary-source data, cross-checked against two independent published sources, not the standard\'s own text',
        'Fitting count uses the same generic lumen-method formula as Power Quality\'s interior tab — a shared calculation, not a reimplementation',
        'Mounting height and pole spacing are widely-published industry rules of thumb (not a SANS 10389-1 citation) — verify against manufacturer photometric data for anything safety-critical',
      ]}/>
      <div className="text-[10px] text-gray-500 px-1 mb-2">Area Width is the "distance across" the lit area, used for mounting height/pole spacing — Area Length is used only for total area/fitting count.</div>
      <NumInput label="Area Width (distance across)" value={areaWidth} onChange={setAreaWidth} unit="m"/>
      <NumInput label="Area Length" value={areaLength} onChange={setAreaLength} unit="m"/>

      <div className="mt-4 mb-2 text-xs font-bold text-gray-400">REFERENCE ILLUMINANCE (OPTIONAL)</div>
      <SelectInput label="Application Category" value={guideCategory}
        onChange={v => applyGuideEntry(v, '')}
        options={[['', '— None, enter your own lux —'], ...AREA_LIGHTING_GUIDE.map(c => [c.id, c.label])]}/>
      {guideCategory && (
        <SelectInput label="Risk / Task Tier" value={guideTier}
          onChange={v => applyGuideEntry(guideCategory, v)}
          options={[['', '— Select a tier —'], ...selectedCategoryTiers.map(t => [t.id, t.label])]}/>
      )}
      {guideEntry && (
        <div className={`rounded-xl px-3 py-2 mb-3 border ${guideEntry.crossValidated ? 'bg-[#001a00] border-[#1a3a1a]' : 'bg-[#1a1200] border-[#3d2800]'}`}>
          <div className={`text-xs font-bold ${guideEntry.crossValidated ? 'text-green-400' : 'text-amber-400'}`}>
            {guideEntry.crossValidated ? '✓ Cross-checked against two independent sources' : '⚠ Single-source reference (industry guide only)'}
          </div>
          <div className="text-gray-400 text-[10px] mt-1">
            Reference uniformity (min/avg): {guideEntry.uniformityAvg} · Max glare rating: {guideEntry.glareMax} · Not a direct SANS 10389-1 citation
          </div>
        </div>
      )}

      <NumInput label="Required Illuminance" value={lux} onChange={setLux} unit="lux"/>
      <NumInput label="Coefficient of Utilization (CU)" value={CU} onChange={setCU} unit=""/>
      <NumInput label="Maintenance Factor (MF)" value={MF} onChange={setMF} unit=""/>
      <NumInput label="Fitting Output" value={lumens} onChange={setLumens} unit="lm"/>
      <NumInput label="Fitting Wattage" value={watts} onChange={setWatts} unit="W"/>

      <CalcButton onClick={calculate}/>
      <ErrBox msg={error}/>

      {result && (
        <>
          <div className="bg-[#0a0f14] border border-[#003147] rounded-xl px-4 py-3 mb-4">
            <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
              <span className="text-gray-400 text-xs">Fittings Required</span>
              <span className="text-white text-sm font-mono font-bold">{result.N.toFixed(1)} → {result.N_ceil}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#1a1a1a]">
              <span className="text-gray-400 text-xs">Actual Illuminance</span>
              <span className="text-sky-400 text-sm font-mono font-bold">{result.lux_act.toFixed(0)} lux</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
              <span className="text-gray-300 text-sm font-bold">Mounting Height</span>
              <span className="text-2xl font-bold text-sky-400">{result.mountingHeight.toFixed(1)} m</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#1a1a1a]">
              <span className="text-gray-300 text-sm font-bold">Pole Spacing</span>
              <span className="text-2xl font-bold text-sky-400">{result.poleSpacing.toFixed(1)} m</span>
            </div>
            <div className="flex justify-between py-1.5 mt-1">
              <span className="text-gray-400 text-xs">Total Load / Power Density</span>
              <span className="text-white text-sm font-mono font-bold">{result.W} W · {result.Wm2.toFixed(2)} W/m²</span>
            </div>
          </div>
          <div className="mb-4 text-[10px] text-gray-500 px-1">{result.note}</div>
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

const INSTALL_TABS = [
  { id: 'load', label: 'Load Assessment', icon: '📊' },
  { id: 'db',   label: 'DB Sizing', icon: '🗄' },
  { id: 'circuit', label: 'Circuit Design', icon: '🔌' },
  { id: 'area', label: 'Area Lighting', icon: '💡' },
]

export default function InstallationDesign({ addHistory }) {
  const [sub, setSub] = useState('load')
  const map = {
    load: <LoadAssessment addHistory={addHistory} />,
    db:   <DBSizing addHistory={addHistory} />,
    circuit: <CircuitDesign addHistory={addHistory} />,
    area: <AreaLighting addHistory={addHistory} />,
  }
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SubTabBar tabs={INSTALL_TABS} active={sub} onChange={setSub} />
      <div className="flex-1 overflow-y-auto">{map[sub]}</div>
    </div>
  )
}
