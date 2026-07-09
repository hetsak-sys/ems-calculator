import React, { useState, useEffect, useCallback } from 'react'
import { Preferences } from '@capacitor/preferences'
import {
  evaluateExpression,
  formatResult,
  runSteps,
  analyzeWorksheetVariables,
  compareValues,
  COMPARISON_LABELS,
} from '../lib/calcEngine'

const STORAGE_KEY = 'hetsa_quickmath_programs'

// ── Default saved worksheets (seeded on first run only) ───────────────────
// The first three are single-step formulas (unchanged from before). The
// fourth is a demo multi-step worksheet with a Pass/Fail check, built only
// from formulas already vetted in Formula Reference (Vd = √3×ρ×L×I/A,
// %Vd = Vd/V×100) — not a new formula invented for this feature.
const DEFAULT_PROGRAMS = [
  {
    id: 'p1',
    name: 'kVA→A',
    desc: '3Ø kVA to Amps',
    steps: [{ id: 'p1s1', label: '', expression: 'kVA×1000 / (√3×V)', resultVar: 'Result' }],
    variableLabels: { kVA: 'kVA', V: 'V' },
    passFail: null,
  },
  {
    id: 'p2',
    name: 'Volt Drop',
    desc: 'Single phase V drop (mV)',
    steps: [{ id: 'p2s1', label: '', expression: '2×I×L×R / 1000', resultVar: 'Result' }],
    variableLabels: { I: 'I', L: 'L', R: 'R' },
    passFail: null,
  },
  {
    id: 'p3',
    name: 'PF Correct',
    desc: 'Capacitor kVAr needed',
    steps: [{ id: 'p3s1', label: '', expression: 'P×(tan(acos(pf1))−tan(acos(pf2)))', resultVar: 'Result' }],
    variableLabels: { P: 'P', pf1: 'pf1', pf2: 'pf2' },
    passFail: null,
  },
  {
    id: 'p4',
    name: '3Ø Feeder Check',
    desc: 'FLA + %Vd, checked against a limit you set',
    steps: [
      { id: 'p4s1', label: 'Full-Load Current', expression: 'kVA×1000 / (√3×V)', resultVar: 'FLA' },
      { id: 'p4s2', label: '% Voltage Drop', expression: '(√3×rho×L×FLA/A)/V×100', resultVar: 'VdPct' },
    ],
    variableLabels: {
      kVA: 'Load (kVA)',
      V: 'Line Voltage (V)',
      rho: 'Resistivity ρ (Ω·mm²/m)',
      L: 'Cable Length (m)',
      A: 'Conductor CSA (mm²)',
    },
    passFail: {
      sourceVar: 'VdPct', operator: 'lte', thresholdMode: 'fixed',
      thresholdValue: 5, thresholdVar: '', passLabel: 'Pass', failLabel: 'Fail',
    },
  },
]

// Old (pre-worksheet) saved data had { expression, variables: [{name,label}] }
// with no `steps` array. Convert on load so nothing on-device gets lost.
function migrateProgram(p) {
  if (p.steps) return p
  return {
    id: p.id,
    name: p.name,
    desc: p.desc || '',
    steps: [{ id: p.id + '_s1', label: '', expression: p.expression, resultVar: 'Result' }],
    variableLabels: Object.fromEntries((p.variables || []).map(v => [v.name, v.label])),
    passFail: null,
    createdAt: p.createdAt || Date.now(),
  }
}

// ── Standard calculator keypad (4 columns) ────────────────────────────────
const BTN_ROWS = [
  [
    { label: 'AC', action: 'clear', color: 'danger' },
    { label: '(', action: 'raw:(', color: 'dark' },
    { label: ')', action: 'raw:)', color: 'dark' },
    { label: '⌫', action: 'back', color: 'dark' },
  ],
  [
    { label: '7', action: 'raw:7', color: 'num' },
    { label: '8', action: 'raw:8', color: 'num' },
    { label: '9', action: 'raw:9', color: 'num' },
    { label: '÷', action: 'raw:÷', color: 'op' },
  ],
  [
    { label: '4', action: 'raw:4', color: 'num' },
    { label: '5', action: 'raw:5', color: 'num' },
    { label: '6', action: 'raw:6', color: 'num' },
    { label: '×', action: 'raw:×', color: 'op' },
  ],
  [
    { label: '1', action: 'raw:1', color: 'num' },
    { label: '2', action: 'raw:2', color: 'num' },
    { label: '3', action: 'raw:3', color: 'num' },
    { label: '−', action: 'raw:−', color: 'op' },
  ],
  [
    { label: '+/−', action: 'negate', color: 'dark' },
    { label: '0', action: 'raw:0', color: 'num' },
    { label: '.', action: 'dot', color: 'num' },
    { label: '+', action: 'raw:+', color: 'op' },
  ],
  [
    { label: '%', action: 'raw:%', color: 'dark' },
    { label: 'ANS', action: 'ans', color: 'red' },
    { label: '=', action: 'equals', color: 'equals', span: 2 },
  ],
]

const COLOR = {
  danger: { bg: '#2d0000', text: '#ef4444', border: '#5a0000' },
  dark:   { bg: '#111111', text: '#9ca3af', border: '#1f1f1f' },
  op:     { bg: '#180e00', text: '#f59e0b', border: '#3d2800' },
  num:    { bg: '#141414', text: '#e5e7eb', border: '#222222' },
  red:    { bg: '#1a0008', text: '#f87171', border: '#3d0010' },
  equals: { bg: '#f59e0b', text: '#000000', border: '#f59e0b' },
}

const OPERATORS = [
  { value: 'lt',  label: `< less than` },
  { value: 'lte', label: `≤ less than or equal` },
  { value: 'gt',  label: `> greater than` },
  { value: 'gte', label: `≥ greater than or equal` },
  { value: 'eq',  label: `= equal` },
  { value: 'neq', label: `≠ not equal` },
]

function trailingNumberSegment(s) {
  const m = s.match(/[0-9.]*$/)
  return m ? m[0] : ''
}

function emptyStep() {
  return { id: 'step' + Date.now() + Math.random().toString(36).slice(2, 6), label: '', expression: '', resultVar: '' }
}

const emptyPassFail = () => ({
  sourceVar: '', operator: 'lte', thresholdMode: 'fixed',
  thresholdValue: '', thresholdVar: '', passLabel: 'Pass', failLabel: 'Fail',
})

export default function QuickMath({ onClose, addHistory }) {
  const [tab, setTab] = useState('calc') // 'calc' | 'prog'
  const [degMode, setDegMode] = useState(true)

  // ── Calculator state ─────────────────────────────────────────────────
  const [exprInput, setExprInput] = useState('')
  const [resultStr, setResultStr] = useState(null)
  const [ans, setAns] = useState(0)
  const [errorMsg, setErrorMsg] = useState(null)
  const [showingResult, setShowingResult] = useState(false)

  const runCalculation = useCallback((source) => {
    try {
      const value = evaluateExpression(source, {}, { degMode })
      const str = formatResult(value)
      setResultStr(str)
      setErrorMsg(null)
      setAns(value)
      setShowingResult(true)
      if (addHistory) {
        addHistory({ tool: 'Quick Math', inputs: { expression: source }, result: str })
      }
      return str
    } catch (e) {
      setResultStr(null)
      setErrorMsg(e.message)
      setShowingResult(true)
      return null
    }
  }, [degMode, addHistory])

  const handleButton = useCallback((action) => {
    if (action.startsWith('raw:')) {
      const ch = action.slice(4)
      setExprInput(cur => {
        if (showingResult) {
          const isDigit = /^[0-9]$/.test(ch)
          setShowingResult(false)
          setResultStr(null)
          setErrorMsg(null)
          return isDigit ? ch : (resultStr || '0') + ch
        }
        return cur + ch
      })
      return
    }

    switch (action) {
      case 'dot': {
        setExprInput(cur => {
          if (showingResult) {
            setShowingResult(false)
            setResultStr(null)
            setErrorMsg(null)
            return '0.'
          }
          const seg = trailingNumberSegment(cur)
          if (seg.includes('.')) return cur
          return (cur === '' ? '0' : cur) + '.'
        })
        break
      }
      case 'clear':
        setExprInput('')
        setResultStr(null)
        setErrorMsg(null)
        setShowingResult(false)
        break
      case 'back':
        if (showingResult) {
          setExprInput('')
          setResultStr(null)
          setErrorMsg(null)
          setShowingResult(false)
        } else {
          setExprInput(cur => cur.slice(0, -1))
        }
        break
      case 'negate': {
        setExprInput(cur => {
          if (showingResult) return cur
          const seg = trailingNumberSegment(cur)
          if (!seg) return cur
          const beforeSeg = cur.slice(0, cur.length - seg.length)
          if (beforeSeg.endsWith('-')) {
            const charBeforeDash = beforeSeg.slice(0, -1)
            const dashIsUnary = charBeforeDash === '' || /[-+×÷(%]$/.test(charBeforeDash)
            if (dashIsUnary) return charBeforeDash + seg
          }
          return beforeSeg + '-' + seg
        })
        break
      }
      case 'ans':
        setExprInput(cur => {
          const ansStr = formatResult(ans)
          if (showingResult) {
            setShowingResult(false)
            setResultStr(null)
            setErrorMsg(null)
            return ansStr
          }
          return cur + ansStr
        })
        break
      case 'equals': {
        const source = exprInput.trim()
        if (!source) break
        runCalculation(source)
        break
      }
      default:
        break
    }
  }, [showingResult, resultStr, exprInput, ans, runCalculation])

  const formatDisplay = (val) => (val === '' ? '0' : val)

  // ── Programs (user-saved worksheets) state ──────────────────────────
  const [programs, setPrograms] = useState(null) // null = not loaded yet
  const [showAddProg, setShowAddProg] = useState(false)
  const [newWs, setNewWs] = useState({ name: '', desc: '', steps: [emptyStep()] })
  const [passFailEnabled, setPassFailEnabled] = useState(false)
  const [passFailCfg, setPassFailCfg] = useState(emptyPassFail())
  const [detected, setDetected] = useState(null) // { inputVars: [...], labels: {var:label} }
  const [createErrors, setCreateErrors] = useState([])

  const [runningProgId, setRunningProgId] = useState(null)
  const [runInputs, setRunInputs] = useState({})
  const [runResults, setRunResults] = useState(null)
  const [runError, setRunError] = useState(null)
  const [runPassFail, setRunPassFail] = useState(null)

  useEffect(() => {
    let cancelled = false
    Preferences.get({ key: STORAGE_KEY }).then(({ value }) => {
      if (cancelled) return
      if (value) {
        try {
          const parsed = JSON.parse(value)
          setPrograms(parsed.map(migrateProgram))
          return
        } catch {
          // fall through to default seed on corrupt data
        }
      }
      setPrograms(DEFAULT_PROGRAMS)
    }).catch(() => setPrograms(DEFAULT_PROGRAMS))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (programs === null) return
    Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(programs) }).catch(() => {})
  }, [programs])

  const resetCreateForm = () => {
    setNewWs({ name: '', desc: '', steps: [emptyStep()] })
    setPassFailEnabled(false)
    setPassFailCfg(emptyPassFail())
    setDetected(null)
    setCreateErrors([])
  }

  const addStep = () => setNewWs(w => ({ ...w, steps: [...w.steps, emptyStep()] }))
  const removeStep = (id) => setNewWs(w => ({ ...w, steps: w.steps.length > 1 ? w.steps.filter(s => s.id !== id) : w.steps }))
  const updateStep = (id, field, value) => setNewWs(w => ({ ...w, steps: w.steps.map(s => s.id === id ? { ...s, [field]: value } : s) }))

  const startDetectVariables = () => {
    setCreateErrors([])
    if (!newWs.name.trim()) { setCreateErrors(['Give the worksheet a name.']); return }
    const { inputVars, errors } = analyzeWorksheetVariables(newWs.steps)
    if (errors.length) { setCreateErrors(errors); return }
    if (inputVars.length === 0) { setCreateErrors(['No input variables found — check the expression(s).']); return }
    const labels = {}
    inputVars.forEach(v => { labels[v] = v })
    setDetected({ inputVars, labels })
    const resultVars = newWs.steps.map(s => s.resultVar).filter(Boolean)
    setPassFailCfg(cfg => ({ ...cfg, sourceVar: resultVars[resultVars.length - 1] || '' }))
  }

  const saveWorksheet = () => {
    if (passFailEnabled) {
      if (!passFailCfg.sourceVar) { setCreateErrors(['Pass/Fail: choose which result to check.']); return }
      if (passFailCfg.thresholdMode === 'fixed' && passFailCfg.thresholdValue === '') {
        setCreateErrors(['Pass/Fail: enter a threshold value.']); return
      }
      if (passFailCfg.thresholdMode === 'var' && !passFailCfg.thresholdVar) {
        setCreateErrors(['Pass/Fail: choose what to compare against.']); return
      }
    }
    const ws = {
      id: 'p' + Date.now(),
      name: newWs.name.trim(),
      desc: newWs.desc.trim(),
      steps: newWs.steps.map(s => ({ id: s.id, label: s.label.trim(), expression: s.expression.trim(), resultVar: s.resultVar.trim() })),
      variableLabels: detected.labels,
      passFail: passFailEnabled ? {
        sourceVar: passFailCfg.sourceVar,
        operator: passFailCfg.operator,
        thresholdMode: passFailCfg.thresholdMode,
        thresholdValue: parseFloat(passFailCfg.thresholdValue) || 0,
        thresholdVar: passFailCfg.thresholdVar,
        passLabel: passFailCfg.passLabel.trim() || 'Pass',
        failLabel: passFailCfg.failLabel.trim() || 'Fail',
      } : null,
      createdAt: Date.now(),
    }
    setPrograms(p => [...(p || []), ws])
    resetCreateForm()
    setShowAddProg(false)
  }

  const deleteProgram = (id) => {
    setPrograms(p => (p || []).filter(prog => prog.id !== id))
    if (runningProgId === id) { setRunningProgId(null); setRunResults(null); setRunError(null); setRunPassFail(null) }
  }

  const openRunPanel = (prog) => {
    setRunningProgId(prog.id)
    const inputs = {}
    Object.keys(prog.variableLabels || {}).forEach(v => { inputs[v] = '' })
    setRunInputs(inputs)
    setRunResults(null)
    setRunError(null)
    setRunPassFail(null)
  }

  const runProgram = (prog) => {
    try {
      const { results, scope } = runSteps(prog.steps, runInputs, { degMode })
      setRunResults(results)
      setRunError(null)
      const finalValue = results[results.length - 1].value
      setAns(finalValue)

      let pf = null
      if (prog.passFail) {
        const threshold = prog.passFail.thresholdMode === 'fixed'
          ? prog.passFail.thresholdValue
          : Number(scope[prog.passFail.thresholdVar])
        const ok = compareValues(scope[prog.passFail.sourceVar], prog.passFail.operator, threshold)
        pf = { pass: ok, label: ok ? prog.passFail.passLabel : prog.passFail.failLabel }
      }
      setRunPassFail(pf)

      if (addHistory) {
        addHistory({
          tool: 'Quick Math',
          inputs: { expression: prog.name, values: runInputs },
          result: formatResult(finalValue) + (pf ? ` (${pf.label})` : ''),
        })
      }
    } catch (e) {
      setRunResults(null)
      setRunError(e.message)
      setRunPassFail(null)
    }
  }

  const useResultInCalculator = (value) => {
    const str = formatResult(value)
    setExprInput(str)
    setShowingResult(true)
    setResultStr(str)
    setTab('calc')
  }

  const resultVarOptions = newWs.steps.map(s => s.resultVar).filter(Boolean)
  const thresholdVarOptions = [...resultVarOptions, ...((detected && detected.inputVars) || [])]

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: '#000000' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{ height: '52px', paddingTop: 'env(safe-area-inset-top)', backgroundColor: '#080808', borderBottom: '1px solid #1c1c1c' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-bold text-base">⚡ Quick Math</span>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #2a2a2a' }} title="Affects trig functions used inside saved formulas">
            {['DEG', 'RAD'].map(m => (
              <button
                key={m}
                onClick={() => setDegMode(m === 'DEG')}
                className="px-3 py-1 text-xs font-bold"
                style={{ backgroundColor: (m === 'DEG') === degMode ? '#f59e0b' : '#111', color: (m === 'DEG') === degMode ? '#000' : '#666' }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <button onClick={onClose} className="text-gray-500 text-2xl leading-none px-1">✕</button>
      </div>

      {/* Sub-tabs */}
      <div className="flex shrink-0" style={{ backgroundColor: '#090909', borderBottom: '1px solid #1a1a1a' }}>
        {[{ id: 'calc', label: 'Calculator' }, { id: 'prog', label: 'Programs' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 py-2.5 text-xs font-bold tracking-wide"
            style={{ color: tab === t.id ? '#f59e0b' : '#4b5563', borderBottom: tab === t.id ? '2px solid #f59e0b' : '2px solid transparent' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CALCULATOR TAB ─── */}
      {tab === 'calc' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-4 py-3 shrink-0" style={{ backgroundColor: '#050505', borderBottom: '1px solid #111' }}>
            <div className="text-gray-600 text-xs h-4 overflow-hidden text-right truncate">
              {showingResult ? exprInput : '\u00A0'}
            </div>
            <div
              className="text-right font-mono font-bold mt-1 overflow-hidden text-ellipsis"
              style={{
                fontSize: (showingResult ? (resultStr || '').length : exprInput.length) > 14 ? '20px' : '34px',
                color: errorMsg ? '#f87171' : (showingResult ? '#f59e0b' : '#ffffff'),
                letterSpacing: '-0.5px',
              }}
            >
              {errorMsg ? errorMsg : formatDisplay(showingResult ? (resultStr ?? '') : exprInput)}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs" style={{ color: '#4b5563' }}>&nbsp;</span>
              <span className="text-xs" style={{ color: '#4b5563' }}>ANS: {ans !== 0 ? formatResult(ans) : '—'}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            {BTN_ROWS.map((row, ri) => (
              <div key={ri} className="flex gap-1.5 mb-1.5">
                {row.map((btn, bi) => {
                  const c = COLOR[btn.color] || COLOR.num
                  if (btn.action === 'equals') {
                    return (
                      <button
                        key={bi}
                        onClick={() => handleButton(btn.action)}
                        className="flex-1 rounded-xl font-bold text-base py-4 active:opacity-70"
                        style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}`, gridColumn: 'span 2', flexGrow: 2 }}
                      >
                        {btn.label}
                      </button>
                    )
                  }
                  return (
                    <button
                      key={bi}
                      onClick={() => handleButton(btn.action)}
                      className="flex-1 rounded-xl font-bold text-base py-4 active:opacity-60"
                      style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}`, minWidth: 0 }}
                    >
                      {btn.label}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PROGRAMS TAB ─── */}
      {tab === 'prog' && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="flex items-center justify-between mb-4">
            <div className="text-gray-400 text-sm font-bold">Saved Formulas &amp; Worksheets</div>
            <button
              onClick={() => { const next = !showAddProg; setShowAddProg(next); if (!next) resetCreateForm() }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ backgroundColor: '#1a0f00', color: '#f59e0b', border: '1px solid #3d2800' }}
            >
              {showAddProg ? 'Cancel' : '+ New'}
            </button>
          </div>

          {showAddProg && (
            <div className="mb-4 p-3 rounded-xl" style={{ backgroundColor: '#0f0f0f', border: '1px solid #222' }}>
              <div className="text-amber-400 text-xs font-bold mb-2">
                {detected ? 'Configure' : 'Add Formula / Worksheet'}
              </div>

              {!detected ? (
                <>
                  <input
                    type="text" placeholder="Name (e.g. Motor kW→A)"
                    value={newWs.name}
                    onChange={e => setNewWs(w => ({ ...w, name: e.target.value }))}
                    className="block w-full mb-2 px-3 py-2 rounded-lg text-xs text-white bg-black border"
                    style={{ borderColor: '#2a2a2a' }}
                  />
                  <input
                    type="text" placeholder="Description"
                    value={newWs.desc}
                    onChange={e => setNewWs(w => ({ ...w, desc: e.target.value }))}
                    className="block w-full mb-3 px-3 py-2 rounded-lg text-xs text-white bg-black border"
                    style={{ borderColor: '#2a2a2a' }}
                  />

                  <div className="text-gray-500 text-xs font-bold mb-1">
                    Steps {newWs.steps.length > 1 && <span className="text-gray-600 font-normal">— each step's result name can be used in later steps</span>}
                  </div>
                  {newWs.steps.map((step, i) => (
                    <div key={step.id} className="mb-2 p-2 rounded-lg" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-gray-600 text-xs">Step {i + 1}</span>
                        {newWs.steps.length > 1 && (
                          <button onClick={() => removeStep(step.id)} className="text-red-400 text-xs">Remove</button>
                        )}
                      </div>
                      {newWs.steps.length > 1 && (
                        <input
                          type="text" placeholder="Step label (e.g. Full-Load Current)"
                          value={step.label}
                          onChange={e => updateStep(step.id, 'label', e.target.value)}
                          className="block w-full mb-1.5 px-3 py-2 rounded-lg text-xs text-white bg-black border"
                          style={{ borderColor: '#2a2a2a' }}
                        />
                      )}
                      <input
                        type="text" placeholder="Formula (e.g. kW*1000/(√3*V*PF))"
                        value={step.expression}
                        onChange={e => updateStep(step.id, 'expression', e.target.value)}
                        className="block w-full mb-1.5 px-3 py-2 rounded-lg text-xs text-white bg-black border font-mono"
                        style={{ borderColor: '#2a2a2a' }}
                      />
                      <input
                        type="text" placeholder="Result name (e.g. FLA)"
                        value={step.resultVar}
                        onChange={e => updateStep(step.id, 'resultVar', e.target.value)}
                        className="block w-full px-3 py-2 rounded-lg text-xs text-white bg-black border font-mono"
                        style={{ borderColor: '#2a2a2a' }}
                      />
                    </div>
                  ))}
                  <button
                    onClick={addStep}
                    className="w-full py-1.5 rounded-lg text-xs font-bold mb-3"
                    style={{ backgroundColor: '#111', color: '#9ca3af', border: '1px dashed #2a2a2a' }}
                  >
                    + Add Step
                  </button>

                  {createErrors.length > 0 && (
                    <div className="mb-2">
                      {createErrors.map((e, i) => <div key={i} className="text-red-400 text-xs">{e}</div>)}
                    </div>
                  )}
                  <button
                    onClick={startDetectVariables}
                    className="w-full py-2 rounded-lg text-sm font-bold"
                    style={{ backgroundColor: '#f59e0b', color: '#000' }}
                  >
                    Detect Variables →
                  </button>
                </>
              ) : (
                <>
                  <div className="text-gray-400 text-xs mb-2">
                    Found {detected.inputVars.length} input{detected.inputVars.length !== 1 ? 's' : ''} — optionally give them friendlier names for the fill-in prompt:
                  </div>
                  {detected.inputVars.map(v => (
                    <div key={v} className="flex items-center gap-2 mb-2">
                      <span className="text-blue-400 font-mono text-xs w-16 shrink-0">{v}</span>
                      <input
                        type="text"
                        value={detected.labels[v]}
                        onChange={e => setDetected(d => ({ ...d, labels: { ...d.labels, [v]: e.target.value } }))}
                        className="flex-1 px-3 py-2 rounded-lg text-xs text-white bg-black border"
                        style={{ borderColor: '#2a2a2a' }}
                      />
                    </div>
                  ))}

                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid #1a1a1a' }}>
                    <label className="flex items-center gap-2 mb-2 cursor-pointer">
                      <input type="checkbox" checked={passFailEnabled} onChange={e => setPassFailEnabled(e.target.checked)} />
                      <span className="text-amber-400 text-xs font-bold">Add Pass/Fail check</span>
                    </label>

                    {passFailEnabled && (
                      <div className="pl-1">
                        <div className="text-gray-600 text-xs mb-2">
                          Set your own limit here — this isn't a fixed rule, confirm it against your project spec (e.g. SANS 10142) before relying on it.
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-gray-500 text-xs shrink-0">Check</span>
                          <select
                            value={passFailCfg.sourceVar}
                            onChange={e => setPassFailCfg(c => ({ ...c, sourceVar: e.target.value }))}
                            className="flex-1 px-2 py-2 rounded-lg text-xs text-white bg-black border"
                            style={{ borderColor: '#2a2a2a' }}
                          >
                            <option value="">— choose result —</option>
                            {resultVarOptions.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <select
                            value={passFailCfg.operator}
                            onChange={e => setPassFailCfg(c => ({ ...c, operator: e.target.value }))}
                            className="flex-1 px-2 py-2 rounded-lg text-xs text-white bg-black border"
                            style={{ borderColor: '#2a2a2a' }}
                          >
                            {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <select
                            value={passFailCfg.thresholdMode}
                            onChange={e => setPassFailCfg(c => ({ ...c, thresholdMode: e.target.value }))}
                            className="px-2 py-2 rounded-lg text-xs text-white bg-black border shrink-0"
                            style={{ borderColor: '#2a2a2a' }}
                          >
                            <option value="fixed">Fixed value</option>
                            <option value="var">Another value</option>
                          </select>
                          {passFailCfg.thresholdMode === 'fixed' ? (
                            <input
                              type="text" inputMode="decimal" placeholder="e.g. 5"
                              value={passFailCfg.thresholdValue}
                              onChange={e => setPassFailCfg(c => ({ ...c, thresholdValue: e.target.value.replace(',', '.') }))}
                              className="flex-1 px-3 py-2 rounded-lg text-xs text-white bg-black border"
                              style={{ borderColor: '#2a2a2a' }}
                            />
                          ) : (
                            <select
                              value={passFailCfg.thresholdVar}
                              onChange={e => setPassFailCfg(c => ({ ...c, thresholdVar: e.target.value }))}
                              className="flex-1 px-2 py-2 rounded-lg text-xs text-white bg-black border"
                              style={{ borderColor: '#2a2a2a' }}
                            >
                              <option value="">— choose —</option>
                              {thresholdVarOptions.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="text" placeholder="Pass label" value={passFailCfg.passLabel}
                            onChange={e => setPassFailCfg(c => ({ ...c, passLabel: e.target.value }))}
                            className="flex-1 px-3 py-2 rounded-lg text-xs text-white bg-black border"
                            style={{ borderColor: '#2a2a2a' }}
                          />
                          <input
                            type="text" placeholder="Fail label" value={passFailCfg.failLabel}
                            onChange={e => setPassFailCfg(c => ({ ...c, failLabel: e.target.value }))}
                            className="flex-1 px-3 py-2 rounded-lg text-xs text-white bg-black border"
                            style={{ borderColor: '#2a2a2a' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {createErrors.length > 0 && (
                    <div className="mt-2 mb-1">
                      {createErrors.map((e, i) => <div key={i} className="text-red-400 text-xs">{e}</div>)}
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setDetected(null)}
                      className="flex-1 py-2 rounded-lg text-sm font-bold"
                      style={{ backgroundColor: '#111', color: '#9ca3af', border: '1px solid #2a2a2a' }}
                    >
                      Back
                    </button>
                    <button
                      onClick={saveWorksheet}
                      className="flex-1 py-2 rounded-lg text-sm font-bold"
                      style={{ backgroundColor: '#f59e0b', color: '#000' }}
                    >
                      Save
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {programs === null && <div className="text-gray-600 text-xs text-center py-6">Loading saved formulas…</div>}

          {programs && programs.map(prog => (
            <div key={prog.id} className="mb-3 rounded-xl p-3" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}>
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="text-amber-400 text-sm font-bold">{prog.name}</div>
                  <div className="text-gray-600 text-xs mt-0.5">{prog.desc}</div>
                  {prog.steps.map(s => (
                    <div key={s.id} className="mt-2 px-2 py-1 rounded text-xs font-mono break-all" style={{ backgroundColor: '#111', color: '#60a5fa' }}>
                      {s.label && <span className="text-gray-500">{s.label}: </span>}
                      {s.expression} <span className="text-gray-600">→ {s.resultVar}</span>
                    </div>
                  ))}
                  {prog.passFail && (
                    <div className="mt-1 text-xs" style={{ color: '#9ca3af' }}>
                      Pass if {prog.passFail.sourceVar} {COMPARISON_LABELS[prog.passFail.operator]}{' '}
                      {prog.passFail.thresholdMode === 'fixed' ? prog.passFail.thresholdValue : prog.passFail.thresholdVar}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 ml-2 shrink-0">
                  <button
                    onClick={() => openRunPanel(prog)}
                    className="px-2 py-1 rounded text-xs font-bold"
                    style={{ backgroundColor: '#1a0f00', color: '#f59e0b', border: '1px solid #3d2800' }}
                  >
                    Use
                  </button>
                  <button
                    onClick={() => deleteProgram(prog.id)}
                    className="px-2 py-1 rounded text-xs font-bold"
                    style={{ backgroundColor: '#1a0000', color: '#f87171', border: '1px solid #3d0000' }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {runningProgId === prog.id && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid #1a1a1a' }}>
                  {Object.entries(prog.variableLabels || {}).map(([name, label]) => (
                    <div key={name} className="flex items-center gap-2 mb-2">
                      <span className="text-gray-400 text-xs w-28 shrink-0 truncate">{label}</span>
                      <input
                        type="text" inputMode="decimal" placeholder="0"
                        value={runInputs[name] ?? ''}
                        onChange={e => {
                          const val = e.target.value.replace(',', '.')
                          setRunInputs(ri => ({ ...ri, [name]: val }))
                        }}
                        className="flex-1 px-3 py-2 rounded-lg text-xs text-white bg-black border"
                        style={{ borderColor: '#2a2a2a' }}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => runProgram(prog)}
                    className="w-full py-2 rounded-lg text-sm font-bold mt-1"
                    style={{ backgroundColor: '#f59e0b', color: '#000' }}
                  >
                    Calculate
                  </button>
                  {runError && <div className="text-red-400 text-xs mt-2">{runError}</div>}

                  {runResults && (
                    <div className="mt-2">
                      {runResults.length > 1 && runResults.map(r => (
                        <div key={r.id} className="flex justify-between text-xs mb-1" style={{ color: '#9ca3af' }}>
                          <span>{r.label || r.resultVar}</span>
                          <span className="font-mono">{formatResult(r.value)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-amber-400 text-lg font-mono font-bold">
                          = {formatResult(runResults[runResults.length - 1].value)}
                        </div>
                        <button
                          onClick={() => useResultInCalculator(runResults[runResults.length - 1].value)}
                          className="px-2 py-1 rounded text-xs font-bold"
                          style={{ backgroundColor: '#111', color: '#9ca3af', border: '1px solid #2a2a2a' }}
                        >
                          Send to Calculator
                        </button>
                      </div>
                      {runPassFail && (
                        <div
                          className="mt-2 text-center py-1.5 rounded-lg text-sm font-bold"
                          style={{
                            backgroundColor: runPassFail.pass ? '#001408' : '#1a0000',
                            color: runPassFail.pass ? '#34d399' : '#f87171',
                            border: `1px solid ${runPassFail.pass ? '#003d20' : '#3d0000'}`,
                          }}
                        >
                          {runPassFail.label}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
