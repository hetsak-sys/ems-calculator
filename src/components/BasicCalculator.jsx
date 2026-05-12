import { useState } from 'react'
import { evaluate } from 'mathjs'

const BTN_CLASSES = {
  number:   'bg-[#1c1c1c] text-white text-xl',
  op:       'bg-[#2a2a2a] text-amber-400 text-xl',
  eq:       'bg-amber-500 text-black text-xl font-black',
  fn:       'bg-[#222] text-gray-300 text-sm',
  clear:    'bg-[#3a1a1a] text-red-400 text-sm',
  zero:     'bg-[#1c1c1c] text-white text-xl col-span-2',
}

export default function BasicCalculator({ addHistory }) {
  const [expr, setExpr] = useState('')
  const [result, setResult] = useState('0')
  const [justEvaled, setJustEvaled] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [localHistory, setLocalHistory] = useState([])

  const press = (val) => {
    if (justEvaled) {
      // after = , if they press number start fresh; if operator continue from result
      if ('0123456789.'.includes(val)) {
        setExpr(val)
        setResult('0')
        setJustEvaled(false)
        return
      } else {
        setExpr(result + val)
        setJustEvaled(false)
        return
      }
    }
    setExpr(e => e + val)
  }

  const calc = () => {
    if (!expr) return
    try {
      // Replace display symbols with mathjs tokens
      const sanitized = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
      const res = evaluate(sanitized)
      const resStr = Number.isFinite(res)
        ? parseFloat(res.toPrecision(12)).toString()
        : String(res)
      const entry = { tab: 'Basic', expr, result: resStr }
      addHistory(entry)
      setLocalHistory(h => [entry, ...h].slice(0, 30))
      setResult(resStr)
      setExpr(expr + ' = ' + resStr)
      setJustEvaled(true)
    } catch {
      setResult('Error')
      setJustEvaled(true)
    }
  }

  const clear = () => { setExpr(''); setResult('0'); setJustEvaled(false) }
  const del   = () => {
    if (justEvaled) { setExpr(''); setResult('0'); setJustEvaled(false); return }
    setExpr(e => e.slice(0, -1))
  }
  const pct   = () => {
    try {
      const v = evaluate(expr.replace(/×/g,'*').replace(/÷/g,'/'))
      setExpr(String(v / 100))
      setResult(String(v / 100))
    } catch { /* ignore */ }
  }
  const sign  = () => {
    if (!expr) return
    setExpr(e => e.startsWith('-') ? e.slice(1) : '-' + e)
  }

  const displayExpr = justEvaled ? expr : (expr || '0')
  const displayResult = justEvaled ? result : (expr ? (() => { try { return parseFloat(evaluate(expr.replace(/×/g,'*').replace(/÷/g,'/')).toPrecision(10)).toString() } catch { return '' } })() : '0')

  return (
    <div className="flex flex-col h-full">

      {/* Display */}
      <div className="flex-shrink-0 bg-[#0a0a0a] px-4 pt-3 pb-2 relative">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="text-gray-500 text-sm min-h-[20px] break-all leading-tight">{displayExpr}</div>
            <div className="text-white text-4xl font-light mt-1 break-all leading-tight">
              {displayResult || '0'}
            </div>
          </div>
          <button
            onClick={() => setShowHistory(s => !s)}
            className="text-[#444] text-xs mt-1 ml-2 p-1"
          >📋</button>
        </div>

        {/* History dropdown */}
        {showHistory && (
          <div className="absolute top-full left-0 right-0 bg-[#111] border border-[#2a2a2a] z-10 max-h-48 overflow-y-auto">
            {localHistory.length === 0
              ? <div className="text-gray-600 text-xs p-3 text-center">No history yet</div>
              : localHistory.map((h, i) => (
                <div key={i} className="flex justify-between px-3 py-2 border-b border-[#1a1a1a] text-xs"
                  onClick={() => { setExpr(h.result); setResult(h.result); setShowHistory(false); setJustEvaled(false) }}>
                  <span className="text-gray-500">{h.expr.split('=')[0]}</span>
                  <span className="text-amber-400">{h.result}</span>
                </div>
              ))
            }
          </div>
        )}
      </div>

      <div className="h-px bg-[#1a1a1a]" />

      {/* Spacer pushes keyboard to bottom */}
      <div className="flex-1" />

      {/* Keypad - fixed at bottom, no stretching */}
      <div className="flex-shrink-0 p-2 grid grid-cols-4 gap-2">
        {/* Row 1 */}
        <Btn label="AC"  cls={BTN_CLASSES.clear}  onPress={clear} />
        <Btn label="+/−" cls={BTN_CLASSES.fn}     onPress={sign} />
        <Btn label="%"   cls={BTN_CLASSES.fn}     onPress={pct} />
        <Btn label="÷"   cls={BTN_CLASSES.op}     onPress={() => press('÷')} />
        {/* Row 2 */}
        <Btn label="7"   cls={BTN_CLASSES.number} onPress={() => press('7')} />
        <Btn label="8"   cls={BTN_CLASSES.number} onPress={() => press('8')} />
        <Btn label="9"   cls={BTN_CLASSES.number} onPress={() => press('9')} />
        <Btn label="×"   cls={BTN_CLASSES.op}     onPress={() => press('×')} />
        {/* Row 3 */}
        <Btn label="4"   cls={BTN_CLASSES.number} onPress={() => press('4')} />
        <Btn label="5"   cls={BTN_CLASSES.number} onPress={() => press('5')} />
        <Btn label="6"   cls={BTN_CLASSES.number} onPress={() => press('6')} />
        <Btn label="−"   cls={BTN_CLASSES.op}     onPress={() => press('-')} />
        {/* Row 4 */}
        <Btn label="1"   cls={BTN_CLASSES.number} onPress={() => press('1')} />
        <Btn label="2"   cls={BTN_CLASSES.number} onPress={() => press('2')} />
        <Btn label="3"   cls={BTN_CLASSES.number} onPress={() => press('3')} />
        <Btn label="+"   cls={BTN_CLASSES.op}     onPress={() => press('+')} />
        {/* Row 5 */}
        <Btn label="0"   cls="bg-[#1c1c1c] text-white text-xl col-span-2" onPress={() => press('0')} />
        <Btn label="."   cls={BTN_CLASSES.number} onPress={() => press('.')} />
        <Btn label="⌫"   cls={BTN_CLASSES.fn}     onPress={del} />
        {/* Row 6 - full width = */}
        <Btn label="="   cls="bg-amber-500 text-black text-2xl font-black col-span-4" onPress={calc} />
      </div>
    </div>
  )
}

function Btn({ label, cls, onPress }) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onPress() }}
      className={`calc-btn ${cls}`}
    >
      {label}
    </button>
  )
}
