import React, { useState, useCallback, useRef, useEffect } from 'react'

// ── Math engine ─────────────────────────────────────────────────────────────
// Uses window.math if mathjs is loaded, else falls back to Function eval
const safeEval = (expr) => {
  try {
    if (window.math) return window.math.evaluate(expr)
    // Safe fallback: allow only math chars
    if (!/^[0-9+\-*/.()%^epsqrtloincatdegradPIE\s,]+$/.test(expr.replace(/[a-z]+/gi, 'x'))) return 'Error'
    return Function('"use strict"; return (' + expr + ')')()
  } catch {
    return 'Error'
  }
}

const DEG_TO_RAD = Math.PI / 180

// ── Engineering constants ─────────────────────────────────────────────────
const CONSTANTS = {
  '√2':     { value: '1.41421356',  label: '√2' },
  '√3':     { value: '1.73205081',  label: '√3' },
  'π':      { value: '3.14159265',  label: 'π'  },
  'e':      { value: '2.71828183',  label: 'e'  },
  'ε₀':    { value: '8.854e-12',   label: 'ε₀' },
  'μ₀':    { value: '1.2566e-6',   label: 'μ₀' },
}

// ── Custom formula store (programmable) ──────────────────────────────────
const DEFAULT_PROGRAMS = [
  { id: 'p1', name: 'kVA→A', formula: 'kVA×1000 / (√3×V)', desc: '3Ø kVA to Amps' },
  { id: 'p2', name: 'Volt Drop', formula: '2×I×L×R / 1000', desc: 'Single phase V drop (mV)' },
  { id: 'p3', name: 'PF Correct', formula: 'P×(tan(acos(pf1))−tan(acos(pf2)))', desc: 'Capacitor kVAr needed' },
]

// ── Button definitions ────────────────────────────────────────────────────
const BTN_ROWS = [
  // Row 0 – trig
  [
    { label: 'sin',   action: 'fn:sin',   color: 'blue'   },
    { label: 'cos',   action: 'fn:cos',   color: 'blue'   },
    { label: 'tan',   action: 'fn:tan',   color: 'blue'   },
    { label: 'log',   action: 'fn:log',   color: 'blue'   },
    { label: 'ln',    action: 'fn:ln',    color: 'blue'   },
  ],
  // Row 1 – inverse trig
  [
    { label: 'sin⁻¹', action: 'fn:asin',  color: 'blue'   },
    { label: 'cos⁻¹', action: 'fn:acos',  color: 'blue'   },
    { label: 'tan⁻¹', action: 'fn:atan',  color: 'blue'   },
    { label: '10ˣ',   action: 'fn:10x',   color: 'blue'   },
    { label: 'eˣ',    action: 'fn:ex',    color: 'blue'   },
  ],
  // Row 2 – powers / roots
  [
    { label: 'x²',    action: 'fn:sq',    color: 'gold'   },
    { label: 'x³',    action: 'fn:cube',  color: 'gold'   },
    { label: 'xʸ',    action: 'fn:pow',   color: 'gold'   },
    { label: '√',     action: 'fn:sqrt',  color: 'gold'   },
    { label: '∛',     action: 'fn:cbrt',  color: 'gold'   },
  ],
  // Row 3 – constants / brackets / factorial
  [
    { label: 'π',     action: 'const:3.14159265', color: 'green' },
    { label: 'e',     action: 'const:2.71828183', color: 'green' },
    { label: '(',     action: 'raw:(',    color: 'green'  },
    { label: ')',     action: 'raw:)',    color: 'green'  },
    { label: 'n!',    action: 'fn:fact',  color: 'green'  },
  ],
  // Row 4 – memory
  [
    { label: 'MC',    action: 'mem:clear', color: 'red'   },
    { label: 'MR',    action: 'mem:recall',color: 'red'   },
    { label: 'M+',    action: 'mem:add',   color: 'red'   },
    { label: 'M−',    action: 'mem:sub',   color: 'red'   },
    { label: 'ANS',   action: 'ans',       color: 'red'   },
  ],
  // Row 5 – AC / misc / EXP
  [
    { label: 'AC',    action: 'clear',    color: 'danger' },
    { label: '%',     action: 'raw:%',    color: 'dark'   },
    { label: '⌫',    action: 'back',     color: 'dark'   },
    { label: 'EXP',   action: 'raw:e',    color: 'dark'   },
    { label: '÷',     action: 'raw:/',    color: 'op'     },
  ],
  // Row 6 – digits
  [
    { label: '7',     action: 'raw:7',    color: 'num'    },
    { label: '8',     action: 'raw:8',    color: 'num'    },
    { label: '9',     action: 'raw:9',    color: 'num'    },
    { label: '×',     action: 'raw:*',    color: 'op'     },
    { label: '|x|',   action: 'fn:abs',   color: 'dark'   },
  ],
  [
    { label: '4',     action: 'raw:4',    color: 'num'    },
    { label: '5',     action: 'raw:5',    color: 'num'    },
    { label: '6',     action: 'raw:6',    color: 'num'    },
    { label: '−',     action: 'raw:-',    color: 'op'     },
    { label: 'mod',   action: 'raw:%',    color: 'dark'   },
  ],
  [
    { label: '1',     action: 'raw:1',    color: 'num'    },
    { label: '2',     action: 'raw:2',    color: 'num'    },
    { label: '3',     action: 'raw:3',    color: 'num'    },
    { label: '+',     action: 'raw:+',    color: 'op'     },
    { label: '1/x',   action: 'fn:inv',   color: 'dark'   },
  ],
  [
    { label: '+/−',   action: 'negate',   color: 'dark'   },
    { label: '0',     action: 'raw:0',    color: 'num'    },
    { label: '.',     action: 'raw:.',    color: 'num'    },
    { label: '=',     action: 'equals',   color: 'equals', span: 2 },
  ],
]

// Color map
const COLOR = {
  blue:   { bg: '#0a1628', text: '#60a5fa', border: '#1e3a5f' },
  gold:   { bg: '#180e00', text: '#f59e0b', border: '#3d2800' },
  green:  { bg: '#001408', text: '#34d399', border: '#003d20' },
  red:    { bg: '#1a0008', text: '#f87171', border: '#3d0010' },
  danger: { bg: '#2d0000', text: '#ef4444', border: '#5a0000' },
  dark:   { bg: '#111111', text: '#9ca3af', border: '#1f1f1f' },
  op:     { bg: '#180e00', text: '#f59e0b', border: '#3d2800' },
  num:    { bg: '#141414', text: '#e5e7eb', border: '#222222' },
  equals: { bg: '#f59e0b', text: '#000000', border: '#f59e0b' },
}

function factorial(n) {
  if (n < 0 || n > 170) return NaN
  if (n === 0 || n === 1) return 1
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r
}

export default function QuickMath({ onClose, addHistory }) {
  const [display, setDisplay]       = useState('0')
  const [expr, setExpr]             = useState('')
  const [mem, setMem]               = useState(0)
  const [ans, setAns]               = useState(0)
  const [degMode, setDegMode]       = useState(true)
  const [result, setResult]         = useState(null)
  const [tab, setTab]               = useState('calc')   // 'calc' | 'prog' | 'const'
  const [programs, setPrograms]     = useState(DEFAULT_PROGRAMS)
  const [showAddProg, setShowAddProg] = useState(false)
  const [newProg, setNewProg]       = useState({ name: '', formula: '', desc: '' })
  const [progResult, setProgResult] = useState({})

  const toRad = useCallback((v) => degMode ? v * DEG_TO_RAD : v, [degMode])
  const fromRad = useCallback((v) => degMode ? v / DEG_TO_RAD : v, [degMode])

  const applyFn = useCallback((fn, val) => {
    const n = parseFloat(val)
    if (isNaN(n)) return 'Error'
    switch (fn) {
      case 'sin':  return Math.sin(toRad(n)).toPrecision(10)
      case 'cos':  return Math.cos(toRad(n)).toPrecision(10)
      case 'tan':  return Math.tan(toRad(n)).toPrecision(10)
      case 'asin': return fromRad(Math.asin(n)).toPrecision(10)
      case 'acos': return fromRad(Math.acos(n)).toPrecision(10)
      case 'atan': return fromRad(Math.atan(n)).toPrecision(10)
      case 'log':  return Math.log10(n).toPrecision(10)
      case 'ln':   return Math.log(n).toPrecision(10)
      case '10x':  return Math.pow(10, n).toPrecision(10)
      case 'ex':   return Math.exp(n).toPrecision(10)
      case 'sq':   return (n * n).toPrecision(10)
      case 'cube': return (n * n * n).toPrecision(10)
      case 'sqrt': return Math.sqrt(n).toPrecision(10)
      case 'cbrt': return Math.cbrt(n).toPrecision(10)
      case 'fact': return factorial(Math.round(n)).toString()
      case 'inv':  return (1 / n).toPrecision(10)
      case 'abs':  return Math.abs(n).toPrecision(10)
      case 'pow':  return display + '^'
      default: return 'Error'
    }
  }, [toRad, fromRad, display])

  const handleButton = useCallback((action) => {
    if (action.startsWith('raw:')) {
      const ch = action.slice(4)
      setDisplay(d => {
        if (d === '0' && ch !== '.') return ch
        return d + ch
      })
      setExpr(e => e + ch)
      setResult(null)
      return
    }

    if (action.startsWith('fn:')) {
      const fn = action.slice(3)
      if (fn === 'pow') {
        setDisplay(d => d + '^')
        setExpr(e => e + '^')
        return
      }
      const r = applyFn(fn, display)
      setDisplay(String(r))
      setExpr(String(r))
      setResult(null)
      return
    }

    if (action.startsWith('const:')) {
      const v = action.slice(6)
      setDisplay(d => d === '0' ? v : d + v)
      setExpr(e => e + v)
      return
    }

    switch (action) {
      case 'clear':
        setDisplay('0'); setExpr(''); setResult(null)
        break
      case 'back':
        setDisplay(d => d.length > 1 ? d.slice(0, -1) : '0')
        setExpr(e => e.slice(0, -1))
        break
      case 'negate':
        setDisplay(d => d.startsWith('-') ? d.slice(1) : '-' + d)
        break
      case 'equals': {
        try {
          let evalExpr = expr || display
          // Handle ^ for power
          evalExpr = evalExpr.replace(/\^/g, '**')
          const res = Function('"use strict"; return (' + evalExpr + ')')()
          const resStr = Number.isInteger(res) ? String(res) : parseFloat(res.toPrecision(10)).toString()
          setResult(resStr)
          setDisplay(resStr)
          setExpr(resStr)
          setAns(parseFloat(resStr))
          if (addHistory) addHistory({ tool: 'Quick Math', inputs: { expression: expr }, result: resStr })
        } catch {
          setDisplay('Error'); setExpr('')
        }
        break
      }
      case 'ans':
        setDisplay(d => d === '0' ? String(ans) : d + String(ans))
        setExpr(e => e + String(ans))
        break
      case 'mem:clear':  setMem(0); break
      case 'mem:recall': setDisplay(String(mem)); setExpr(String(mem)); break
      case 'mem:add':    setMem(m => m + (parseFloat(display) || 0)); break
      case 'mem:sub':    setMem(m => m - (parseFloat(display) || 0)); break
    }
  }, [display, expr, ans, mem, applyFn, addHistory])

  // Format display
  const formatDisplay = (val) => {
    if (val === 'Error') return val
    const n = parseFloat(val)
    if (!isNaN(n) && Math.abs(n) >= 1e12) return n.toExponential(6)
    return val
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: '#000000' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          height: '52px',
          paddingTop: 'env(safe-area-inset-top)',
          backgroundColor: '#080808',
          borderBottom: '1px solid #1c1c1c',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-bold text-base">⚡ Quick Math</span>
          {/* DEG / RAD toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #2a2a2a' }}>
            {['DEG','RAD'].map(m => (
              <button
                key={m}
                onClick={() => setDegMode(m === 'DEG')}
                className="px-3 py-1 text-xs font-bold"
                style={{
                  backgroundColor: (m === 'DEG') === degMode ? '#f59e0b' : '#111',
                  color: (m === 'DEG') === degMode ? '#000' : '#666',
                }}
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
        {[
          { id: 'calc',  label: 'Calculator' },
          { id: 'prog',  label: 'Programs'   },
          { id: 'const', label: 'Constants'  },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 py-2.5 text-xs font-bold tracking-wide"
            style={{
              color: tab === t.id ? '#f59e0b' : '#4b5563',
              borderBottom: tab === t.id ? '2px solid #f59e0b' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CALCULATOR TAB ─── */}
      {tab === 'calc' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Display */}
          <div
            className="px-4 py-3 shrink-0"
            style={{ backgroundColor: '#050505', borderBottom: '1px solid #111' }}
          >
            <div className="text-gray-600 text-xs h-4 overflow-hidden text-right truncate">
              {expr && expr !== display ? expr : '\u00A0'}
            </div>
            <div
              className="text-right font-mono font-bold mt-1"
              style={{
                fontSize: display.length > 14 ? '20px' : display.length > 10 ? '26px' : '34px',
                color: result !== null ? '#f59e0b' : '#ffffff',
                letterSpacing: '-0.5px',
              }}
            >
              {formatDisplay(display)}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs" style={{ color: '#4b5563' }}>
                MEM: {mem !== 0 ? mem : '—'}
              </span>
              <span className="text-xs" style={{ color: '#4b5563' }}>
                ANS: {ans !== 0 ? ans : '—'}
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {BTN_ROWS.map((row, ri) => (
              <div key={ri} className="flex gap-1.5 mb-1.5">
                {row.map((btn, bi) => {
  const c = COLOR[btn.color] || COLOR.num
  // Equals MUST be checked before span — it uses span:2 for width
  if (btn.action === 'equals') {
                    return (
                      <button
                        key={bi}
                        onClick={() => handleButton(btn.action)}
                        className="flex-1 rounded-xl font-bold text-base py-3 active:opacity-70"
                        style={{
                          backgroundColor: c.bg,
                          color: c.text,
                          border: `1px solid ${c.border}`,
                          gridColumn: 'span 2',
                          flexGrow: 2,
                        }}
                      >
                        {btn.label}
                      </button>
                    )
                  }
                  return (
                    <button
                      key={bi}
                      onClick={() => handleButton(btn.action)}
                      className="flex-1 rounded-xl font-bold text-sm py-3 active:opacity-60"
                      style={{
                        backgroundColor: c.bg,
                        color: c.text,
                        border: `1px solid ${c.border}`,
                        minWidth: 0,
                      }}
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
            <div className="text-gray-400 text-sm font-bold">Saved Formulas</div>
            <button
              onClick={() => setShowAddProg(p => !p)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ backgroundColor: '#1a0f00', color: '#f59e0b', border: '1px solid #3d2800' }}
            >
              + New
            </button>
          </div>

          {showAddProg && (
            <div className="mb-4 p-3 rounded-xl" style={{ backgroundColor: '#0f0f0f', border: '1px solid #222' }}>
              <div className="text-amber-400 text-xs font-bold mb-2">Add Program</div>
              {[
                { key: 'name',    placeholder: 'Name (e.g. Motor kW→A)' },
                { key: 'formula', placeholder: 'Formula (e.g. kW*1000/(√3*V*PF))' },
                { key: 'desc',    placeholder: 'Description' },
              ].map(f => (
                <input
                  key={f.key}
                  type="text"
                  placeholder={f.placeholder}
                  value={newProg[f.key]}
                  onChange={e => setNewProg(p => ({ ...p, [f.key]: e.target.value }))}
                  className="block w-full mb-2 px-3 py-2 rounded-lg text-xs text-white bg-black border"
                  style={{ borderColor: '#2a2a2a' }}
                />
              ))}
              <button
                onClick={() => {
                  if (!newProg.name || !newProg.formula) return
                  setPrograms(p => [...p, { ...newProg, id: 'p' + Date.now() }])
                  setNewProg({ name: '', formula: '', desc: '' })
                  setShowAddProg(false)
                }}
                className="w-full py-2 rounded-lg text-sm font-bold"
                style={{ backgroundColor: '#f59e0b', color: '#000' }}
              >
                Save Program
              </button>
            </div>
          )}

          {programs.map(prog => (
            <div
              key={prog.id}
              className="mb-3 rounded-xl p-3"
              style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-amber-400 text-sm font-bold">{prog.name}</div>
                  <div className="text-gray-600 text-xs mt-0.5">{prog.desc}</div>
                  <div
                    className="mt-2 px-2 py-1 rounded text-xs font-mono"
                    style={{ backgroundColor: '#111', color: '#60a5fa' }}
                  >
                    {prog.formula}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setDisplay(prog.formula)
                    setExpr(prog.formula)
                    setTab('calc')
                  }}
                  className="ml-2 px-2 py-1 rounded text-xs font-bold shrink-0"
                  style={{ backgroundColor: '#1a0f00', color: '#f59e0b', border: '1px solid #3d2800' }}
                >
                  Use
                </button>
              </div>

              {progResult[prog.id] && (
                <div className="mt-2 text-right text-amber-400 text-sm font-mono font-bold">
                  = {progResult[prog.id]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── CONSTANTS TAB ─── */}
      {tab === 'const' && (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="text-gray-400 text-sm font-bold mb-4">Engineering Constants</div>

          {[
            { section: 'Mathematical', items: [
              { sym: '√2',  val: '1.41421356', desc: 'Square root of 2' },
              { sym: '√3',  val: '1.73205081', desc: 'Square root of 3 (3Ø factor)' },
              { sym: 'π',   val: '3.14159265', desc: 'Pi' },
              { sym: 'e',   val: '2.71828183', desc: "Euler's number" },
            ]},
            { section: 'Physical', items: [
              { sym: 'ε₀',  val: '8.854e-12',  desc: 'Permittivity of free space' },
              { sym: 'μ₀',  val: '1.2566e-6',  desc: 'Permeability of free space' },
              { sym: 'c',   val: '2.998e8',     desc: 'Speed of light (m/s)' },
            ]},
            { section: 'Electrical', items: [
              { sym: 'ρCu', val: '1.724e-8',   desc: 'Copper resistivity (Ω·m)' },
              { sym: 'ρAl', val: '2.65e-8',    desc: 'Aluminium resistivity (Ω·m)' },
              { sym: 'αCu', val: '0.00393',    desc: 'Cu temp coefficient (/°C)' },
            ]},
          ].map(group => (
            <div key={group.section} className="mb-4">
              <div
                className="text-xs font-bold tracking-widest mb-2"
                style={{ color: '#f59e0b' }}
              >
                {group.section.toUpperCase()}
              </div>
              {group.items.map(item => (
                <button
                  key={item.sym}
                  onClick={() => {
                    setDisplay(d => d === '0' ? item.val : d + item.val)
                    setExpr(e => e + item.val)
                    setTab('calc')
                  }}
                  className="flex items-center justify-between w-full rounded-xl px-4 py-3 mb-2 text-left active:opacity-70"
                  style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}
                >
                  <div>
                    <span className="text-amber-400 font-mono font-bold text-sm">{item.sym}</span>
                    <span className="text-gray-500 text-xs ml-3">{item.desc}</span>
                  </div>
                  <span className="text-blue-400 font-mono text-xs">{item.val}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
