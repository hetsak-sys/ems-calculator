// Shared UI components and utilities for PowerSuite
import { useState } from 'react'
import { defaultFilename, exportAndSharePdf } from '../lib/pdfExport'
import { Preferences } from '@capacitor/preferences'

export const SQRT3 = Math.sqrt(3)
export const pf = (v) => parseFloat(String(v).replace(',', '.')) || 0

export function NumInput({ label, value, onChange, unit, placeholder = '0', note }) {
  return (
    <div className="mb-3">
      {label && (
        <label className="text-gray-400 text-xs mb-1 block">
          {label}{note && <span className="text-gray-600 ml-1 italic">— {note}</span>}
        </label>
      )}
      <div className="flex items-center bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value.replace(',', '.'))}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-white text-lg px-4 py-3 outline-none"
        />
        {unit && <span className="text-gray-500 text-sm px-3 flex-shrink-0">{unit}</span>}
      </div>
    </div>
  )
}

// Unit-aware number input — tap unit label to cycle through options
// units: e.g. [['W',1],['kW',1000],['MW',1000000]]  (label, multiplier to base)
export function UnitNumInput({ label, value, onChange, units, note }) {
  const [unitIdx, setUnitIdx] = useState(0)
  const unit = units[unitIdx]
  const cycleUnit = () => {
    const next = (unitIdx + 1) % units.length
    // Convert current displayed value to new unit
    if (value) {
      const baseVal = parseFloat(String(value).replace(',','.')) * unit[1]
      const newDisplayVal = baseVal / units[next][1]
      // Format cleanly
      const formatted = newDisplayVal >= 1000 ? newDisplayVal.toFixed(0)
        : newDisplayVal >= 1 ? parseFloat(newDisplayVal.toFixed(4)).toString()
        : parseFloat(newDisplayVal.toPrecision(4)).toString()
      onChange(formatted, baseVal)
    }
    setUnitIdx(next)
  }
  const handleChange = (v) => {
    const cleaned = v.replace(',','.')
    const baseVal = (parseFloat(cleaned) || 0) * unit[1]
    onChange(cleaned, baseVal)
  }
  return (
    <div className="mb-3">
      {label && <label className="text-gray-400 text-xs mb-1 block">{label}{note && <span className="text-gray-600 ml-1 italic">— {note}</span>}</label>}
      <div className="flex items-center bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <input
          type="text" inputMode="decimal" value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder="0"
          className="flex-1 bg-transparent text-white text-lg px-4 py-3 outline-none"
        />
        <button onClick={cycleUnit}
          className="flex items-center gap-1 bg-[#2a2a2a] border-l border-[#3a3a3a] px-4 py-3 text-amber-400 font-bold text-sm flex-shrink-0 active:bg-[#3a3a3a]">
          {unit[0]}
          <span className="text-gray-600 text-xs">▾</span>
        </button>
      </div>
      {units.length > 1 && (
        <div className="flex gap-1.5 mt-1.5 px-1">
          {units.map((u, i) => (
            <button key={u[0]} onClick={() => {
              if (i !== unitIdx) {
                const baseVal = (parseFloat(String(value).replace(',','.')) || 0) * unit[1]
                const newVal = baseVal / u[1]
                const fmt = newVal >= 1000 ? newVal.toFixed(0) : parseFloat(newVal.toPrecision(4)).toString()
                onChange(fmt, baseVal)
                setUnitIdx(i)
              }
            }}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${i===unitIdx?'bg-amber-500 text-black':'bg-[#1a1a1a] text-gray-500'}`}>
              {u[0]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export const POWER_UNITS   = [['kW',1000],['W',1],['MW',1000000]]
export const VOLTAGE_UNITS = [['V',1],['kV',1000]]
export const CURRENT_UNITS = [['A',1],['mA',0.001],['kA',1000]]

export function SelectInput({ label, value, onChange, options }) {
  return (
    <div className="mb-3">
      {label && <label className="text-gray-400 text-xs mb-1 block">{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm outline-none">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

export function ToggleInput({ label, options, value, onChange }) {
  return (
    <div className="mb-3">
      {label && <label className="text-gray-400 text-xs mb-2 block">{label}</label>}
      <div className="flex gap-2">
        {options.map(([id, lbl]) => (
          <button key={id} onClick={() => onChange(id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${value===id ? 'bg-amber-500 text-black' : 'bg-[#1c1c1c] text-gray-400'}`}>
            {lbl}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ResultRow({ label, value, unit, accent, warn, sub }) {
  return (
    <div className={`flex justify-between items-start px-4 py-3 border-b border-[#1a1a1a] last:border-0 ${accent?'bg-[#1a1500]':''} ${warn?'bg-[#1a0000]':''}`}>
      <span className={`text-sm flex-1 pr-2 ${sub?'text-gray-500 text-xs pl-2':'text-gray-400'}`}>{label}</span>
      <span className={`font-bold text-right flex-shrink-0 ${accent?'text-amber-400 text-lg':warn?'text-red-400 text-base':'text-white'}`}>
        {value}{unit ? <span className="text-xs font-normal text-gray-500 ml-1">{unit}</span> : null}
      </span>
    </div>
  )
}

export function ResultBox({ title = 'RESULTS', rows }) {
  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
      <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
        <span className="text-amber-400 text-xs font-bold">{title}</span>
      </div>
      {rows.map((r, i) => <ResultRow key={i} {...r} />)}
    </div>
  )
}

export function InfoBox({ title, color = 'blue', lines }) {
  const c = {
    blue:  'bg-[#0a1a2e] border-[#1a3a5a] text-blue-400',
    amber: 'bg-[#1a1400] border-[#3a2e00] text-amber-400',
    green: 'bg-[#0a1a0a] border-[#1a3a1a] text-green-400',
    red:   'bg-[#1a0a0a] border-[#3a1a1a] text-red-400',
  }[color] || 'bg-[#0a1a2e] border-[#1a3a5a] text-blue-400'
  return (
    <div className={`${c} border rounded-xl px-4 py-3 mb-4`}>
      {title && <div className="text-xs font-bold mb-1">{title}</div>}
      {lines.map((l, i) => <div key={i} className="text-gray-500 text-xs leading-relaxed">{l}</div>)}
    </div>
  )
}

export function ErrBox({ msg }) {
  return msg ? (
    <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">{msg}</div>
  ) : null
}

export function CalcButton({ onClick, label = 'CALCULATE' }) {
  return (
    <button onClick={onClick} className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">
      {label}
    </button>
  )
}

export function SubTabBar({ tabs, active, onChange }) {
  return (
    <div className="flex-shrink-0 flex overflow-x-auto scrollbar-none bg-[#0a0a0a] border-b border-[#2a2a2a] px-1 py-1 gap-1">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-lg min-w-[56px] transition-colors ${active===t.id?'bg-amber-500 text-black':'text-gray-500'}`}>
          <span className="text-sm leading-none">{t.icon}</span>
          <span className="text-[9px] mt-1 font-medium leading-none text-center">{t.label}</span>
        </button>
      ))}
    </div>
  )
}

// ── Result Card — professional output for field use ────────────────────────
export function ResultCard({ data, onClose }) {
  const [copied, setCopied] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [filename, setFilename] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)
  const [exported, setExported] = useState(false)

  const formatAsText = () => {
    const line = '─'.repeat(38)
    const dline = '═'.repeat(38)
    let out = []
    out.push(dline)
    out.push('   POWERSUITE — RESULT RECORD')
    out.push(dline)
    out.push(`Site:     ${data.site || '—'}`)
    out.push(`Date:     ${new Date().toLocaleDateString('en-ZA')}  ${new Date().toLocaleTimeString('en-ZA', {hour:'2-digit',minute:'2-digit'})}`)
    out.push(`Calc:     ${data.calculator}`)
    out.push(`Standard: ${data.standard || 'IEC / SANS'}`)
    out.push(line)
    if (data.inputs?.length) {
      out.push('INPUTS')
      data.inputs.forEach(i => out.push(`  ${i.label.padEnd(22)} ${i.value}`))
      out.push(line)
    }
    data.sections?.forEach(s => {
      out.push(s.title)
      s.rows?.forEach(r => out.push(`  ${r.label.padEnd(22)} ${r.value}`))
      out.push(line)
    })
    if (data.notes) {
      out.push('NOTE')
      out.push(`  ${data.notes}`)
      out.push(line)
    }
    out.push('PowerSuite — field calculation, not a substitute for professional sign-off')
    out.push(dline)
    return out.join('\n')
  }

  const handleShare = async () => {
    const text = formatAsText()
    try {
      if (navigator.share) {
        await navigator.share({ title: 'PowerSuite Result', text })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch { /* silent */ }
    }
  }

  const openExportPanel = () => {
    setFilename(defaultFilename(data))
    setExportError(null)
    setExported(false)
    setShowExport(true)
  }

  const confirmExport = async () => {
    setExporting(true)
    setExportError(null)
    try {
      await exportAndSharePdf(data, filename)
      setExported(true)
      setShowExport(false)
    } catch (e) {
      setExportError(e?.message || 'Could not create the PDF. Try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      {/* Dimmed backdrop */}
      <div className="flex-1 bg-black/70" />

      {/* Card */}
      <div className="bg-[#111] border-t border-[#2a2a2a] rounded-t-3xl pb-6 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 bg-[#333] rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-[#2a2a2a]">
          <div>
            <div className="text-amber-400 font-black text-base">{data.calculator}</div>
            <div className="text-gray-500 text-xs">{data.site} · {new Date().toLocaleDateString('en-ZA')}</div>
          </div>
          <button onClick={onClose} className="text-gray-600 text-xl px-2">✕</button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">

          {/* Standard badge */}
          {data.standard && (
            <div className="bg-[#0a1a2e] border border-[#1a3a5a] rounded-xl px-3 py-2 mb-3">
              <span className="text-blue-400 text-xs font-bold">Standard: </span>
              <span className="text-blue-300 text-xs">{data.standard}</span>
            </div>
          )}

          {/* Inputs */}
          {data.inputs?.length > 0 && (
            <div className="mb-3">
              <div className="text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-1.5">Inputs</div>
              <div className="bg-[#0a0a0a] rounded-xl overflow-hidden border border-[#1a1a1a]">
                {data.inputs.map((inp, i) => (
                  <div key={i} className="flex justify-between px-4 py-2 border-b border-[#1a1a1a] last:border-0 text-sm">
                    <span className="text-gray-500">{inp.label}</span>
                    <span className="text-white font-medium">{inp.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result sections */}
          {data.sections?.map((section, si) => (
            <div key={si} className="mb-3">
              <div className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-1.5">{section.title}</div>
              <div className="bg-[#0a0a0a] rounded-xl overflow-hidden border border-[#2a2a1a]">
                {section.rows?.map((row, ri) => (
                  <div key={ri}
                    className={`flex justify-between items-start px-4 py-2.5 border-b border-[#1a1a1a] last:border-0 ${row.accent ? 'bg-[#1a1500]' : ''}`}>
                    <span className={`text-sm flex-1 pr-2 ${row.sub ? 'text-gray-600 text-xs pl-2' : 'text-gray-400'}`}>{row.label}</span>
                    <span className={`text-sm font-bold text-right flex-shrink-0 ${row.accent ? 'text-amber-400' : row.warn ? 'text-red-400' : 'text-white'}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Notes */}
          {data.notes && (
            <div className="bg-[#1a1000] border border-[#3a2000] rounded-xl px-4 py-3 mb-3">
              <div className="text-orange-400 text-xs font-bold mb-1">⚠ Note</div>
              <div className="text-gray-400 text-xs leading-relaxed">{data.notes}</div>
            </div>
          )}

          {/* Legend — always shown */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-3 mb-3">
            <div className="text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-2">Legend</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                ['Q',      'Main power contactor (AC-3)'],
                ['F',      'Overload / protective relay'],
                ['K',      'Control / contactor relay'],
                ['FLA',    'Full Load Amperes'],
                ['AC-3',   'IEC motor switching duty'],
                ['OLR',    'Overload Relay'],
                ['DOL',    'Direct On-Line starting'],
                ['MPM',    'Motor Protection Monitor'],
                ['CBR',    'Core Balance Relay'],
                ['NER',    'Neutral Earthing Resistor'],
                ['NCRT',   'Neutral CT / ratio transformer'],
                ['IDMT',   'Inverse Definite Min. Time relay'],
                ['TMS',    'Time Multiplier Setting'],
                ['PF',     'Power Factor'],
                ['VD',     'Voltage Drop'],
                ['THD',    'Total Harmonic Distortion'],
                ['GPR',    'Ground Potential Rise'],
                ['IE3/IE4','Motor efficiency class (IEC)'],
              ].map(([abbr, desc]) => (
                <div key={abbr} className="flex gap-1.5 text-[10px]">
                  <span className="text-amber-500 font-bold flex-shrink-0 w-10">{abbr}</span>
                  <span className="text-gray-500">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Export PDF — filename confirm panel */}
        {showExport && (
          <div className="px-5 pt-3 border-t border-[#2a2a2a]">
            <label className="text-gray-500 text-xs mb-1 block">Filename</label>
            <input
              type="text"
              value={filename}
              onChange={e => setFilename(e.target.value)}
              className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white text-sm rounded-xl px-3 py-2.5 mb-2 outline-none"
            />
            {exportError && <div className="text-red-400 text-xs mb-2">{exportError}</div>}
            <div className="flex gap-3 mb-3">
              <button
                onClick={() => setShowExport(false)}
                className="flex-1 py-3 bg-[#1c1c1c] text-gray-400 rounded-xl text-sm font-medium"
                disabled={exporting}
              >
                Cancel
              </button>
              <button
                onClick={confirmExport}
                className="flex-1 py-3 bg-amber-500 text-black rounded-xl text-sm font-bold disabled:opacity-60"
                disabled={exporting || !filename.trim()}
              >
                {exporting ? 'Generating…' : 'Export PDF'}
              </button>
            </div>
          </div>
        )}

        {/* Action buttons — padded above phone navigation bar */}
        <div className="flex gap-3 px-5 pt-3 border-t border-[#2a2a2a]"
          style={{paddingBottom:'max(env(safe-area-inset-bottom,0px),12px)'}}>
          <button onClick={handleShare}
            className={`flex-1 py-4 rounded-2xl font-bold text-sm ${copied ? 'bg-green-600 text-white' : 'bg-[#1c1c1c] text-gray-300'}`}>
            {copied ? '✓ Copied!' : (typeof navigator !== 'undefined' && navigator.share ? '📤 Share Text' : '📋 Copy Text')}
          </button>
          <button onClick={openExportPanel}
            className={`flex-1 py-4 rounded-2xl font-bold text-sm ${exported ? 'bg-green-600 text-white' : 'bg-amber-500 text-black'}`}>
            {exported ? '✓ Exported' : '📄 Export PDF'}
          </button>
          <button onClick={onClose}
            className="px-5 py-4 bg-[#1c1c1c] text-gray-400 rounded-2xl text-sm font-medium">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// PENDING RESULT RECOVERY (Option A):
//
// Problem: if a user calculates a result and closes the app (by accident,
// or the OS kills it) before tapping Export PDF / Share, that result was
// only ever in React state — gone the instant the app process ends.
//
// Fix: every showCard() call also durably persists the exact same `data`
// object via @capacitor/preferences (same storage LicenseManager.js and
// SiteContext.jsx already use). On next launch, App.jsx checks for a
// pending result and — if one exists — offers a small recovery banner
// ("You have an unexported result — tap to view") that reopens the exact
// same ResultCard, fully able to export/share, without needing to
// reconstruct which calculator screen it came from: ResultCard only ever
// needed the `data` object itself (see its props above), never anything
// from its originating component.
//
// This is deliberately a SINGLE global "last result" slot, not one per
// calculator tab — the recovery banner is app-level, so only the single
// most recent unexported result is ever offered back. Clearing happens on:
//   - hideCard() — explicit dismissal (in normal use, or via the recovery
//     banner) means "I'm done with this," pending or not.
//   - a fresh showCard() — a new calculation naturally supersedes the old
//     pending one.
//   - Settings saving a site-config change (see clearPendingResult(),
//     called from Settings.jsx) — an old result calculated under
//     different site parameters shouldn't be silently resurfaced as if
//     still valid.
const PENDING_RESULT_KEY = 'hetsa_pending_result'

export function useResultCard() {
  const [cardData, setCardData] = useState(null)

  const showCard = (data) => {
    setCardData(data)
    Preferences.set({ key: PENDING_RESULT_KEY, value: JSON.stringify(data) }).catch(() => {})
  }

  const hideCard = () => {
    setCardData(null)
    Preferences.remove({ key: PENDING_RESULT_KEY }).catch(() => {})
  }

  return { cardData, showCard, hideCard }
}

/**
 * Reads any result left pending from before the app was last closed.
 * Used once, on startup, by App.jsx to decide whether to offer the
 * recovery banner. Returns null if there's nothing pending or the cache
 * is corrupt — never throws, never blocks startup.
 */
export async function getPendingResult() {
  try {
    const { value } = await Preferences.get({ key: PENDING_RESULT_KEY })
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

/**
 * Clears any pending result. Called from App.jsx when the recovery
 * banner/card is dismissed, and from Settings.jsx's Save handler (a site
 * config change invalidates the assumptions any old pending result was
 * calculated under).
 */
export function clearPendingResult() {
  Preferences.remove({ key: PENDING_RESULT_KEY }).catch(() => {})
}
