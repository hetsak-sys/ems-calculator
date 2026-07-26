import React, { useState } from 'react'
import { NumInput, ToggleInput, InfoBox, ErrBox, CalcButton, ResultCard, useResultCard } from './shared'
import { useSite } from './SiteContext'
import { loadAssessment, LOAD_CATEGORIES } from './installationDesignEngine'

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

export default function InstallationDesign({ addHistory }) {
  // Only one sub-tab exists so far (Load Assessment). DB Sizing, Circuit Design, and Area
  // Lighting are scoped in roadmap.md §5.6.1 but not yet built — a SubTabBar will be added when
  // the second sub-tab lands, rather than built speculatively ahead of need ([DES-7] YAGNI).
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <LoadAssessment addHistory={addHistory} />
      </div>
    </div>
  )
}
