import { useState } from 'react'
import * as math from 'mathjs'

const toRad = (v, deg) => deg ? (v * Math.PI / 180) : v
const fromRad = (v, deg) => deg ? (v * 180 / Math.PI) : v

export default function ScientificCalculator({ addHistory }) {
  const [expr, setExpr]         = useState('')
  const [result, setResult]     = useState('0')
  const [isDeg, setIsDeg]       = useState(true)
  const [mem, setMem]           = useState(0)
  const [ans, setAns]           = useState(0)
  const [justEvaled, setJustEvaled] = useState(false)

  const append = (s) => {
    if (justEvaled) {
      if ('0123456789.'.includes(s[0])) { setExpr(s); setJustEvaled(false); return }
      setExpr(result + s); setJustEvaled(false); return
    }
    setExpr(e => e + s)
  }

  const applyFn = (fn) => {
    if (justEvaled) { setExpr(fn + '(' + result + ')'); setJustEvaled(false); return }
    setExpr(e => fn + '(' + (e || '0') + ')')
  }

  const evaluate = () => {
    if (!expr) return
    try {
      // Pre-process expression for mathjs
      let e = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/ANS/g, String(ans))
        .replace(/π/g, String(Math.PI))
        .replace(/e(?![0-9])/g, String(Math.E))
      
      // Handle trig with degree conversion
      if (isDeg) {
        e = e
          .replace(/sin\(/g, 'sin((pi/180)*')
          .replace(/cos\(/g, 'cos((pi/180)*')
          .replace(/tan\(/g, 'tan((pi/180)*')
          .replace(/asin\(/g, '(180/pi)*asin(')
          .replace(/acos\(/g, '(180/pi)*acos(')
          .replace(/atan\(/g, '(180/pi)*atan(')
      }

      const res = math.evaluate(e)
      const resStr = Number.isFinite(res)
        ? parseFloat(res.toPrecision(12)).toString()
        : String(res)
      addHistory({ tab: 'Scientific', expr, result: resStr })
      setAns(parseFloat(resStr) || 0)
      setResult(resStr)
      setExpr(expr + ' = ' + resStr)
      setJustEvaled(true)
    } catch {
      setResult('Error')
      setJustEvaled(true)
    }
  }

  const clear  = () => { setExpr(''); setResult('0'); setJustEvaled(false) }
  const del    = () => {
    if (justEvaled) { setExpr(''); setResult('0'); setJustEvaled(false); return }
    setExpr(e => e.slice(0, -1))
  }

  const liveResult = () => {
    if (justEvaled || !expr) return ''
    try {
      let e = expr.replace(/×/g,'*').replace(/÷/g,'/').replace(/ANS/g,String(ans)).replace(/π/g,String(Math.PI)).replace(/e(?![0-9])/g,String(Math.E))
      if (isDeg) {
        e = e.replace(/sin\(/g,'sin((pi/180)*').replace(/cos\(/g,'cos((pi/180)*').replace(/tan\(/g,'tan((pi/180)*')
          .replace(/asin\(/g,'(180/pi)*asin(').replace(/acos\(/g,'(180/pi)*acos(').replace(/atan\(/g,'(180/pi)*atan(')
      }
      const r = math.evaluate(e)
      return Number.isFinite(r) ? parseFloat(r.toPrecision(10)).toString() : ''
    } catch { return '' }
  }

  const S = (label, action, bg = 'bg-[#1e1e1e]', fg = 'text-gray-200') =>
    <SBtn key={label} label={label} bg={bg} fg={fg} onPress={action} />

  return (
    <div className="flex flex-col h-full">

      {/* Display */}
      <div className="flex-shrink-0 bg-[#0a0a0a] px-4 pt-3 pb-2">
        <div className="text-gray-500 text-xs min-h-[18px] break-all">{justEvaled ? expr : (expr || '0')}</div>
        <div className="text-white text-3xl font-light mt-1 break-all min-h-[44px]">
          {justEvaled ? result : (liveResult() || result)}
        </div>
        <div className="flex gap-2 mt-2">
          <span className={`text-xs px-2 py-0.5 rounded ${isDeg ? 'bg-amber-500 text-black font-bold' : 'bg-[#222] text-gray-400'}`}
            onClick={() => setIsDeg(true)}>DEG</span>
          <span className={`text-xs px-2 py-0.5 rounded ${!isDeg ? 'bg-amber-500 text-black font-bold' : 'bg-[#222] text-gray-400'}`}
            onClick={() => setIsDeg(false)}>RAD</span>
          <span className="text-xs text-gray-600 ml-auto">MEM: {mem}</span>
          <span className="text-xs text-gray-600">ANS: {ans}</span>
        </div>
      </div>

      <div className="h-px bg-[#1a1a1a]" />

      {/* Keypad */}
      <div className="flex-1 p-1.5 grid grid-cols-5 gap-1 content-end overflow-hidden">

        {/* Row 1: Trig */}
        {S('sin',  () => applyFn('sin'),  'bg-[#1a1f2e]', 'text-blue-300')}
        {S('cos',  () => applyFn('cos'),  'bg-[#1a1f2e]', 'text-blue-300')}
        {S('tan',  () => applyFn('tan'),  'bg-[#1a1f2e]', 'text-blue-300')}
        {S('log',  () => applyFn('log10'), 'bg-[#1a1f2e]', 'text-blue-300')}
        {S('ln',   () => applyFn('log'),  'bg-[#1a1f2e]', 'text-blue-300')}

        {/* Row 2: Inverse trig */}
        {S('sin⁻¹', () => applyFn('asin'), 'bg-[#151c28]', 'text-blue-400')}
        {S('cos⁻¹', () => applyFn('acos'), 'bg-[#151c28]', 'text-blue-400')}
        {S('tan⁻¹', () => applyFn('atan'), 'bg-[#151c28]', 'text-blue-400')}
        {S('10^x', () => append('10^('),  'bg-[#151c28]', 'text-blue-400')}
        {S('eˣ',   () => append('e^('),   'bg-[#151c28]', 'text-blue-400')}

        {/* Row 3: Powers & roots */}
        {S('x²',  () => append('^2'),     'bg-[#1e1a0a]', 'text-amber-300')}
        {S('x³',  () => append('^3'),     'bg-[#1e1a0a]', 'text-amber-300')}
        {S('xʸ',  () => append('^('),     'bg-[#1e1a0a]', 'text-amber-300')}
        {S('√',   () => applyFn('sqrt'),  'bg-[#1e1a0a]', 'text-amber-300')}
        {S('∛',   () => applyFn('cbrt'),  'bg-[#1e1a0a]', 'text-amber-300')}

        {/* Row 4: Constants & special */}
        {S('π',   () => append('π'),      'bg-[#1a2a1a]', 'text-green-300')}
        {S('e',   () => append('e'),      'bg-[#1a2a1a]', 'text-green-300')}
        {S('(',   () => append('('),      'bg-[#1a2a1a]', 'text-green-300')}
        {S(')',   () => append(')'),      'bg-[#1a2a1a]', 'text-green-300')}
        {S('n!',  () => applyFn('factorial'), 'bg-[#1a2a1a]', 'text-green-300')}

        {/* Row 5: Memory */}
        {S('MC', () => setMem(0),                   'bg-[#200a0a]', 'text-red-400')}
        {S('MR', () => { append(String(mem)) },      'bg-[#200a0a]', 'text-red-400')}
        {S('M+', () => { try { setMem(m => m + (parseFloat(result)||0)) } catch{} }, 'bg-[#200a0a]', 'text-red-400')}
        {S('M−', () => { try { setMem(m => m - (parseFloat(result)||0)) } catch{} }, 'bg-[#200a0a]', 'text-red-400')}
        {S('ANS',() => append('ANS'),               'bg-[#200a0a]', 'text-red-400')}

        {/* Row 6 */}
        {S('AC', clear, 'bg-[#3a1a1a]', 'text-red-300')}
        {S('%',  () => append('%'), 'bg-[#222]', 'text-gray-300')}
        {S('⌫',  del,   'bg-[#222]', 'text-gray-300')}
        {S('EXP',() => append('e'),  'bg-[#222]', 'text-gray-300')}
        {S('÷',  () => append('÷'), 'bg-[#2a2a1a]', 'text-amber-400')}

        {/* Row 7 */}
        {S('7', () => append('7'), 'bg-[#1c1c1c]', 'text-white')}
        {S('8', () => append('8'), 'bg-[#1c1c1c]', 'text-white')}
        {S('9', () => append('9'), 'bg-[#1c1c1c]', 'text-white')}
        {S('×', () => append('×'), 'bg-[#2a2a1a]', 'text-amber-400')}
        {S('|x|',() => applyFn('abs'), 'bg-[#222]', 'text-gray-400')}

        {/* Row 8 */}
        {S('4', () => append('4'), 'bg-[#1c1c1c]', 'text-white')}
        {S('5', () => append('5'), 'bg-[#1c1c1c]', 'text-white')}
        {S('6', () => append('6'), 'bg-[#1c1c1c]', 'text-white')}
        {S('−', () => append('-'), 'bg-[#2a2a1a]', 'text-amber-400')}
        {S('mod',() => append('%'), 'bg-[#222]', 'text-gray-400')}

        {/* Row 9 */}
        {S('1', () => append('1'), 'bg-[#1c1c1c]', 'text-white')}
        {S('2', () => append('2'), 'bg-[#1c1c1c]', 'text-white')}
        {S('3', () => append('3'), 'bg-[#1c1c1c]', 'text-white')}
        {S('+', () => append('+'), 'bg-[#2a2a1a]', 'text-amber-400')}
        {S('1/x',() => append('^(-1)'), 'bg-[#222]', 'text-gray-400')}

        {/* Row 10 */}
        {S('+/−', () => setExpr(e => e.startsWith('-') ? e.slice(1) : '-'+e), 'bg-[#1c1c1c]', 'text-white')}
        {S('0',   () => append('0'), 'bg-[#1c1c1c]', 'text-white')}
        {S('.',   () => append('.'), 'bg-[#1c1c1c]', 'text-white')}
        <SBtn label="=" bg="bg-amber-500" fg="text-black font-black text-xl col-span-2" onPress={evaluate} span={2} />

      </div>
    </div>
  )
}

function SBtn({ label, bg, fg, onPress, span = 1 }) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onPress() }}
      className={`calc-btn ${bg} ${fg} ${span > 1 ? `col-span-${span}` : ''}`}
      style={{ fontSize: label.length > 3 ? '11px' : label.length > 2 ? '13px' : '15px' }}
    >
      {label}
    </button>
  )
}
