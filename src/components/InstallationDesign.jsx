import React, { useState } from 'react'
import { NumInput, ToggleInput, InfoBox, ErrBox, CalcButton, ResultCard, useResultCard, SubTabBar } from './shared'
import { useSite } from './SiteContext'
import { useWorkspace } from './WorkspaceContext'
import { loadAssessment, LOAD_CATEGORIES, dbSizing, SPARE_WAYS_DEFAULT_PCT } from './installationDesignEngine'

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

const INSTALL_TABS = [
  { id: 'load', label: 'Load Assessment', icon: '📊' },
  { id: 'db',   label: 'DB Sizing', icon: '🗄' },
]

export default function InstallationDesign({ addHistory }) {
  // Circuit Design and Area Lighting are scoped in roadmap.md §5.6.1 but not yet built.
  const [sub, setSub] = useState('load')
  const map = {
    load: <LoadAssessment addHistory={addHistory} />,
    db:   <DBSizing addHistory={addHistory} />,
  }
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SubTabBar tabs={INSTALL_TABS} active={sub} onChange={setSub} />
      <div className="flex-1 overflow-y-auto">{map[sub]}</div>
    </div>
  )
}
