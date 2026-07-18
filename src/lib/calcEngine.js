// calcEngine.js — standalone expression engine for PowerSuite
//
// Used by QuickMath's Calculator tab AND its Programs (user formula) tab.
// Deliberately has no React/DOM dependency so any other module can import it
// later ("callable calculator") without pulling in UI code.
//
// Design notes:
// - Full tokenize -> parse (AST) -> evaluate pipeline. No string regex
//   patching of expressions (that was the root cause of the old percent /
//   truncation bugs).
// - Percent (%) is a first-class postfix AST node. It is evaluated with
//   calculator-convention semantics when it is the right-hand side of a
//   + or - (e.g. 500+15% => 575, matching every physical calculator),
//   and as plain /100 everywhere else (e.g. 500*15% => 75, 15% alone => 0.15).
// - Supports named variables (kVA, V, pf1, PF, etc.) for user-saved formulas,
//   plus a small set of functions/constants needed by those formulas
//   (sin/cos/tan/asin/acos/atan/log/ln/sqrt/cbrt/abs, pi, e).
// - Accepts the unicode symbols engineers actually type/paste: × ÷ − √ π.

const FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'log', 'ln', 'sqrt', 'cbrt', 'abs',
])

const CONSTANTS = {
  pi: Math.PI,
  'π': Math.PI,
  e: Math.E,
}

// ── Tokenizer ────────────────────────────────────────────────────────────
// Token types: NUM, IDENT, and single-char operator/punctuation tokens
// ('+', '-', '*', '/', '^', '(', ')', '%', ',', '√')
function tokenize(input) {
  // Normalize the unicode variants engineers paste in before scanning.
  const src = input
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-') // U+2212 minus sign, en dash
    .replace(/\s+/g, '')

  const tokens = []
  let i = 0

  while (i < src.length) {
    const ch = src[i]

    // Number (with optional decimal point and scientific-notation exponent,
    // e.g. 2.65e-8). The exponent 'e'/'E' must be checked before falling
    // back to identifier scanning, or "2.65e-8" would tokenize as
    // NUM(2.65) IDENT(e) NUM(-8).
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i
      while (/[0-9]/.test(src[j])) j++
      if (src[j] === '.') {
        j++
        while (/[0-9]/.test(src[j])) j++
      }
      if (src[j] === 'e' || src[j] === 'E') {
        let k = j + 1
        if (src[k] === '+' || src[k] === '-') k++
        if (/[0-9]/.test(src[k] || '')) {
          k++
          while (/[0-9]/.test(src[k] || '')) k++
          j = k
        }
      }
      tokens.push({ type: 'NUM', value: parseFloat(src.slice(i, j)) })
      i = j
      continue
    }

    // Identifier: function name, constant name, or variable name.
    // Allows letters + digits, e.g. "pf1", "kVA", "V2".
    if (/[A-Za-zπ]/.test(ch)) {
      let j = i + 1
      while (/[A-Za-z0-9]/.test(src[j] || '')) j++
      tokens.push({ type: 'IDENT', value: src.slice(i, j) })
      i = j
      continue
    }

    if (ch === '√') {
      tokens.push({ type: 'SQRT' })
      i++
      continue
    }

    if ('+-*/^()%,'.includes(ch)) {
      tokens.push({ type: ch })
      i++
      continue
    }

    throw new Error(`Unexpected character: ${ch}`)
  }

  return tokens
}

// ── Parser (recursive descent) ──────────────────────────────────────────
// Grammar (low to high precedence):
//   expr    := term (('+' | '-') term)*
//   term    := unary (('*' | '/') unary)*        -- also handles implicit "*"
//   unary   := ('-' | '+') unary | power
//   power   := postfix ('^' unary)?              -- right-associative
//   postfix := prefixed ('%')*
//   prefixed:= 'SQRT' unary | atom
//   atom    := NUM | IDENT '(' args ')' | IDENT | '(' expr ')'
function parse(tokens) {
  let pos = 0
  const peek = () => tokens[pos]
  const next = () => tokens[pos++]
  const expect = (type) => {
    const t = next()
    if (!t || t.type !== type) {
      throw new Error(`Expected '${type}' but got '${t ? t.type : 'end of expression'}'`)
    }
    return t
  }

  function startsAtom(t) {
    if (!t) return false
    return t.type === 'NUM' || t.type === 'IDENT' || t.type === '(' || t.type === 'SQRT'
  }

  function parseExpr() {
    let left = parseTerm()
    while (peek() && (peek().type === '+' || peek().type === '-')) {
      const op = next().type
      const right = parseTerm()
      left = { type: 'BinOp', op, left, right }
    }
    return left
  }

  function parseTerm() {
    let left = parseUnary()
    while (peek() && (peek().type === '*' || peek().type === '/' || startsAtom(peek()))) {
      let op = '*'
      if (peek().type === '*' || peek().type === '/') {
        op = next().type
      }
      // else: implicit multiplication, e.g. "2V" or ")(" — consume no operator token
      const right = parseUnary()
      left = { type: 'BinOp', op, left, right }
    }
    return left
  }

  function parseUnary() {
    if (peek() && (peek().type === '+' || peek().type === '-')) {
      const op = next().type
      const arg = parseUnary()
      return op === '-' ? { type: 'Neg', arg } : arg
    }
    return parsePower()
  }

  function parsePower() {
    const base = parsePostfix()
    if (peek() && peek().type === '^') {
      next()
      const exp = parseUnary() // right-assoc, allows 2^-2
      return { type: 'BinOp', op: '^', left: base, right: exp }
    }
    return base
  }

  function parsePostfix() {
    let node = parsePrefixed()
    while (peek() && peek().type === '%') {
      next()
      node = { type: 'Percent', arg: node }
    }
    return node
  }

  function parsePrefixed() {
    if (peek() && peek().type === 'SQRT') {
      next()
      const arg = parseUnary()
      return { type: 'Call', name: 'sqrt', args: [arg] }
    }
    return parseAtom()
  }

  function parseAtom() {
    const t = peek()
    if (!t) throw new Error('Unexpected end of expression')

    if (t.type === 'NUM') {
      next()
      return { type: 'Num', value: t.value }
    }

    if (t.type === '(') {
      next()
      const inner = parseExpr()
      expect(')')
      return inner
    }

    if (t.type === 'IDENT') {
      next()
      const name = t.value
      if (peek() && peek().type === '(') {
        next()
        const args = []
        if (peek() && peek().type !== ')') {
          args.push(parseExpr())
          while (peek() && peek().type === ',') {
            next()
            args.push(parseExpr())
          }
        }
        expect(')')
        return { type: 'Call', name: name.toLowerCase(), args }
      }
      return { type: 'Ident', name }
    }

    throw new Error(`Unexpected token: ${t.type}`)
  }

  const ast = parseExpr()
  if (pos < tokens.length) {
    throw new Error(`Unexpected token after expression: ${tokens[pos].type}`)
  }
  return ast
}

// ── Evaluator ────────────────────────────────────────────────────────────
const DEG_TO_RAD = Math.PI / 180

function evaluate(node, scope, opts) {
  const degMode = !!(opts && opts.degMode)
  const toRad = (v) => (degMode ? v * DEG_TO_RAD : v)
  const fromRad = (v) => (degMode ? v / DEG_TO_RAD : v)

  function evalNode(n) {
    switch (n.type) {
      case 'Num':
        return n.value

      case 'Neg':
        return -evalNode(n.arg)

      case 'Percent':
        return evalNode(n.arg) / 100

      case 'Ident': {
        if (n.name in CONSTANTS) return CONSTANTS[n.name]
        if (scope && Object.prototype.hasOwnProperty.call(scope, n.name)) {
          const v = scope[n.name]
          if (v === '' || v === undefined || v === null || Number.isNaN(Number(v))) {
            throw new Error(`Missing value for ${n.name}`)
          }
          return Number(v)
        }
        throw new Error(`Unknown variable: ${n.name}`)
      }

      case 'Call': {
        const arg = () => evalNode(n.args[0])
        switch (n.name) {
          case 'sin':  return Math.sin(toRad(arg()))
          case 'cos':  return Math.cos(toRad(arg()))
          case 'tan':  return Math.tan(toRad(arg()))
          case 'asin': return fromRad(Math.asin(arg()))
          case 'acos': return fromRad(Math.acos(arg()))
          case 'atan': return fromRad(Math.atan(arg()))
          case 'log':  return Math.log10(arg())
          case 'ln':   return Math.log(arg())
          case 'sqrt': return Math.sqrt(arg())
          case 'cbrt': return Math.cbrt(arg())
          case 'abs':  return Math.abs(arg())
          default:
            throw new Error(`Unknown function: ${n.name}`)
        }
      }

      case 'BinOp': {
        // Calculator-convention percent: X+Y% => X + X*(Y/100), X-Y% => X - X*(Y/100).
        // For * and / (and everywhere else), Percent already evaluates to value/100
        // via the case above, which is the correct plain-math behaviour.
        if ((n.op === '+' || n.op === '-') && n.right.type === 'Percent') {
          const left = evalNode(n.left)
          const pct = evalNode(n.right.arg)
          return n.op === '+' ? left + (left * pct) / 100 : left - (left * pct) / 100
        }
        const l = evalNode(n.left)
        const r = evalNode(n.right)
        switch (n.op) {
          case '+': return l + r
          case '-': return l - r
          case '*': return l * r
          case '/':
            if (r === 0) throw new Error('Division by zero')
            return l / r
          case '^': return Math.pow(l, r)
          default:
            throw new Error(`Unknown operator: ${n.op}`)
        }
      }

      default:
        throw new Error(`Unknown node: ${n.type}`)
    }
  }

  return evalNode(node)
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Evaluate an expression string.
 * @param {string} exprString
 * @param {Object} [scope] - variable name -> numeric value (or numeric string)
 * @param {Object} [opts] - { degMode: boolean }
 * @returns {number}
 * @throws {Error} with a human-readable message on invalid syntax, unknown
 *   variable/function, or division by zero.
 */
export function evaluateExpression(exprString, scope = {}, opts = {}) {
  if (!exprString || !exprString.trim()) throw new Error('Empty expression')
  const tokens = tokenize(exprString)
  if (tokens.length === 0) throw new Error('Empty expression')
  const ast = parse(tokens)
  const result = evaluate(ast, scope, opts)
  if (typeof result !== 'number' || Number.isNaN(result) || !Number.isFinite(result)) {
    throw new Error('Result is not a valid number')
  }
  return result
}

/**
 * Extract the list of free variable names from an expression, in order of
 * first appearance, excluding known function and constant names.
 * @param {string} exprString
 * @returns {string[]}
 */
export function extractVariables(exprString) {
  if (!exprString || !exprString.trim()) return []
  let tokens
  try {
    tokens = tokenize(exprString)
  } catch {
    return []
  }

  const seen = new Set()
  const order = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type !== 'IDENT') continue
    const isFunctionCall = tokens[i + 1] && tokens[i + 1].type === '('
    const lower = t.value.toLowerCase()
    if (isFunctionCall && FUNCTIONS.has(lower)) continue
    if (t.value in CONSTANTS) continue
    if (!seen.has(t.value)) {
      seen.add(t.value)
      order.push(t.value)
    }
  }
  return order
}

/**
 * Format a numeric result for display: integers as-is, otherwise trimmed to
 * 10 significant figures, switching to exponential notation for very large
 * or very small magnitudes.
 * @param {number} n
 * @returns {string}
 */
export function formatResult(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 'Error'
  if (Number.isInteger(n) && Math.abs(n) < 1e12) return String(n)
  if (Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-9 && n !== 0)) return n.toExponential(6)
  return parseFloat(n.toPrecision(10)).toString()
}

export const RESERVED_NAMES = new Set([...FUNCTIONS, ...Object.keys(CONSTANTS)])

/**
 * Check whether an expression is syntactically valid (tokenizes and parses),
 * without requiring variable values. Used when a user saves a new formula,
 * so typos are caught at save time rather than at run time.
 * @param {string} exprString
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSyntax(exprString) {
  if (!exprString || !exprString.trim()) return { valid: false, error: 'Empty expression' }
  try {
    const tokens = tokenize(exprString)
    if (tokens.length === 0) return { valid: false, error: 'Empty expression' }
    parse(tokens)
    return { valid: true }
  } catch (e) {
    return { valid: false, error: e.message }
  }
}

// ── Worksheets (multi-step formula chains) ────────────────────────────────
//
// A worksheet is a sequence of steps, each of which evaluates one expression
// and stores its result under a name (e.g. "FLA") that later steps — or a
// final Pass/Fail check — can reference. Kept in this framework-agnostic
// module (rather than in the UI component) so any other part of the suite
// can run a worksheet later without depending on QuickMath's UI code.

/**
 * Run a worksheet's steps in order, threading each step's result into the
 * scope available to subsequent steps.
 * @param {Array<{id:string, label?:string, expression:string, resultVar:string}>} steps
 * @param {Object} [inputScope] - user-supplied input variable values
 * @param {Object} [opts] - { degMode: boolean }
 * @returns {{ results: Array<{id:string, resultVar:string, label?:string, value:number}>, scope: Object }}
 * @throws {Error} identifying which step failed and why
 */
export function runSteps(steps, inputScope = {}, opts = {}) {
  const scope = { ...inputScope }
  const results = []
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    let value
    try {
      value = evaluateExpression(step.expression, scope, opts)
    } catch (e) {
      const label = step.label ? `${step.label}` : `Step ${i + 1}`
      const err = new Error(`${label}: ${e.message}`)
      err.stepId = step.id
      throw err
    }
    scope[step.resultVar] = value
    results.push({ id: step.id, resultVar: step.resultVar, label: step.label, value })
  }
  return { results, scope }
}

/**
 * Compare two numbers with a named operator. Kept separate from the
 * expression grammar deliberately — Pass/Fail is evaluated on already-
 * computed step results, not parsed as part of an expression.
 * @param {number} a
 * @param {'lt'|'lte'|'gt'|'gte'|'eq'|'neq'} op
 * @param {number} b
 * @returns {boolean}
 */
export function compareValues(a, op, b) {
  switch (op) {
    case 'lt':  return a < b
    case 'lte': return a <= b
    case 'gt':  return a > b
    case 'gte': return a >= b
    case 'eq':  return a === b
    case 'neq': return a !== b
    default:
      throw new Error(`Unknown comparison operator: ${op}`)
  }
}

export const COMPARISON_LABELS = {
  lt: '<', lte: '≤', gt: '>', gte: '≥', eq: '=', neq: '≠',
}

/**
 * Analyze a worksheet's steps: determine which variable names are true
 * user-supplied inputs (as opposed to a name produced by an earlier step),
 * in order of first appearance, and catch structural mistakes at save time
 * — invalid syntax, missing result names, duplicate result names, a step
 * referencing a result that isn't calculated until a later step, or a
 * result name that collides with a reserved function/constant.
 * @param {Array<{id:string, label?:string, expression:string, resultVar:string}>} steps
 * @returns {{ inputVars: string[], errors: string[] }}
 */
export function analyzeWorksheetVariables(steps) {
  const definedSoFar = new Set()
  const seenInputs = new Set()
  const inputVars = []
  const errors = []

  steps.forEach((step, idx) => {
    const stepTag = step.label ? `Step ${idx + 1} (${step.label})` : `Step ${idx + 1}`

    const check = validateSyntax(step.expression)
    if (!check.valid) {
      errors.push(`${stepTag}: ${check.error}`)
    } else {
      const vars = extractVariables(step.expression)
      vars.forEach(v => {
        if (definedSoFar.has(v)) return // resolved by an earlier step's result
        const laterIdx = steps.findIndex((s, i) => i > idx && s.resultVar === v)
        if (laterIdx !== -1) {
          errors.push(`${stepTag} references "${v}" before Step ${laterIdx + 1} calculates it.`)
          return
        }
        if (!seenInputs.has(v)) {
          seenInputs.add(v)
          inputVars.push(v)
        }
      })
    }

    if (!step.resultVar || !step.resultVar.trim()) {
      errors.push(`${stepTag} needs a result name.`)
    } else if (RESERVED_NAMES.has(step.resultVar.toLowerCase())) {
      errors.push(`${stepTag}: result name "${step.resultVar}" collides with a built-in function/constant.`)
    } else {
      definedSoFar.add(step.resultVar)
    }
  })

  const resultNames = steps.map(s => s.resultVar).filter(Boolean)
  const dupes = [...new Set(resultNames.filter((v, i) => resultNames.indexOf(v) !== i))]
  if (dupes.length) errors.push(`Duplicate result name(s): ${dupes.join(', ')}`)

  return { inputVars, errors }
}
