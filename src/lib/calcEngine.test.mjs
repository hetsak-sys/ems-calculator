import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateExpression, extractVariables, formatResult, RESERVED_NAMES,
  validateSyntax, runSteps, compareValues, COMPARISON_LABELS,
  analyzeWorksheetVariables,
} from './calcEngine.js'

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps

describe('evaluateExpression — basic arithmetic and precedence', () => {
  test('basic operators', () => {
    assert.equal(evaluateExpression('2+3'), 5)
    assert.equal(evaluateExpression('10-4'), 6)
    assert.equal(evaluateExpression('3*4'), 12)
    assert.equal(evaluateExpression('10/4'), 2.5)
  })

  test('standard operator precedence: * and / bind tighter than + and -', () => {
    assert.equal(evaluateExpression('2+3*4'), 14)
    assert.equal(evaluateExpression('(2+3)*4'), 20)
  })

  test('exponent is right-associative and binds tighter than unary minus applies to it correctly', () => {
    assert.equal(evaluateExpression('2^3^2'), 512) // 2^(3^2) = 2^9, not (2^3)^2=64
    assert.equal(evaluateExpression('2^-2'), 0.25)
  })

  test('unary minus and nested parens', () => {
    assert.equal(evaluateExpression('-5+3'), -2)
    assert.equal(evaluateExpression('-(5+3)'), -8)
    assert.equal(evaluateExpression('--5'), 5) // double negative
  })

  test('implicit multiplication: "2(3+4)" and "2 3" (adjacent atoms)', () => {
    assert.equal(evaluateExpression('2(3+4)'), 14)
    assert.equal(evaluateExpression('2sqrt(9)'), 6)
  })

  test('unicode operator symbols (× ÷ − √ π) are normalized', () => {
    assert.equal(evaluateExpression('2×3'), 6)
    assert.equal(evaluateExpression('10÷4'), 2.5)
    assert.equal(evaluateExpression('5−3'), 2)
    assert.equal(evaluateExpression('√9'), 3)
    assert.ok(close(evaluateExpression('π'), Math.PI))
  })

  test('whitespace is stripped before tokenizing', () => {
    assert.equal(evaluateExpression('  2 +  3 * 4  '), 14)
  })
})

describe('evaluateExpression — percent (calculator convention)', () => {
  test('percent as +/- right-hand side uses calculator convention: X+Y% = X + X*(Y/100)', () => {
    assert.equal(evaluateExpression('500+15%'), 575)
    assert.equal(evaluateExpression('500-15%'), 425)
  })

  test('percent everywhere else (*, /, standalone) is plain value/100', () => {
    assert.equal(evaluateExpression('500*15%'), 75)
    assert.equal(evaluateExpression('15%'), 0.15)
  })
})

describe('evaluateExpression — functions and constants', () => {
  test('trig functions default to degree mode when degMode option is set', () => {
    assert.ok(close(evaluateExpression('sin(90)', {}, { degMode: true }), 1))
    assert.ok(close(evaluateExpression('cos(0)', {}, { degMode: true }), 1))
  })

  test('trig functions use radians when degMode is false/unset', () => {
    assert.ok(close(evaluateExpression('sin(0)'), 0))
    assert.ok(close(evaluateExpression(`cos(0)`), 1))
  })

  test('log is base-10, ln is natural log', () => {
    assert.ok(close(evaluateExpression('log(100)'), 2))
    assert.ok(close(evaluateExpression('ln(1)'), 0))
  })

  test('sqrt, cbrt, abs', () => {
    assert.equal(evaluateExpression('sqrt(16)'), 4)
    assert.equal(evaluateExpression('cbrt(27)'), 3)
    assert.equal(evaluateExpression('abs(-5)'), 5)
  })

  test('constants pi/π/e are recognized', () => {
    assert.ok(close(evaluateExpression('pi'), Math.PI))
    assert.ok(close(evaluateExpression('e'), Math.E))
  })

  test('unknown function name throws a readable error', () => {
    assert.throws(() => evaluateExpression('foo(5)'), /Unknown function/)
  })
})

describe('evaluateExpression — variables (scope)', () => {
  test('resolves a variable from scope', () => {
    assert.equal(evaluateExpression('V*I', { V: 230, I: 10 }), 2300)
  })

  test('unknown variable throws a readable error naming the variable', () => {
    assert.throws(() => evaluateExpression('kVA', {}), /Unknown variable: kVA/)
  })

  test('empty-string or missing scope value throws "Missing value", not silently NaN', () => {
    assert.throws(() => evaluateExpression('V*2', { V: '' }), /Missing value for V/)
    assert.throws(() => evaluateExpression('V*2', { V: undefined }), /Missing value for V/)
  })

  test('string-numeric scope values are coerced correctly', () => {
    assert.equal(evaluateExpression('V*2', { V: '10' }), 20)
  })
})

describe('evaluateExpression — error handling', () => {
  test('division by zero throws explicitly rather than returning Infinity', () => {
    assert.throws(() => evaluateExpression('5/0'), /Division by zero/)
  })

  test('a result that is not a finite number throws "Result is not a valid number"', () => {
    // asin(2) is outside [-1,1] domain -> NaN
    assert.throws(() => evaluateExpression('asin(2)'), /Result is not a valid number/)
  })

  test('empty expression throws', () => {
    assert.throws(() => evaluateExpression(''), /Empty expression/)
    assert.throws(() => evaluateExpression('   '), /Empty expression/)
  })

  test('malformed expression (unbalanced parens) throws a syntax error, not a crash', () => {
    assert.throws(() => evaluateExpression('(2+3'))
    assert.throws(() => evaluateExpression('2+3)'))
  })

  test('unexpected character throws', () => {
    assert.throws(() => evaluateExpression('2 & 3'), /Unexpected character/)
  })
})

describe('extractVariables', () => {
  test('extracts free variables in order of first appearance, excluding functions/constants', () => {
    assert.deepEqual(extractVariables('V*I + sin(theta) - pi'), ['V', 'I', 'theta'])
  })

  test('does not duplicate a variable seen more than once', () => {
    assert.deepEqual(extractVariables('V*V + V'), ['V'])
  })

  test('returns empty array for an expression with no variables', () => {
    assert.deepEqual(extractVariables('2+3*4'), [])
  })

  test('returns empty array (not a throw) for a syntactically invalid expression', () => {
    assert.deepEqual(extractVariables('2+*3'), [])
  })
})

describe('formatResult', () => {
  test('integers display as-is, no trailing decimal', () => {
    assert.equal(formatResult(5), '5')
    assert.equal(formatResult(-100), '-100')
  })

  test('non-integers trim to 10 significant figures', () => {
    assert.equal(formatResult(1 / 3), '0.3333333333')
  })

  test('very large or very small magnitudes switch to exponential notation', () => {
    assert.ok(formatResult(1e15).includes('e'))
    assert.ok(formatResult(1e-12).includes('e'))
  })

  test('NaN input returns "Error", never "NaN" or a crash', () => {
    assert.equal(formatResult(NaN), 'Error')
  })
})

describe('validateSyntax', () => {
  test('valid expressions report valid:true', () => {
    assert.equal(validateSyntax('V*I').valid, true)
  })

  test('invalid syntax reports valid:false with an error message', () => {
    const r = validateSyntax('2+*3')
    assert.equal(r.valid, false)
    assert.ok(r.error)
  })

  test('empty expression is invalid', () => {
    assert.equal(validateSyntax('').valid, false)
  })

  test('validateSyntax does NOT require variables to be defined (syntax-only check)', () => {
    // undefined variable is still syntactically valid
    assert.equal(validateSyntax('someUndefinedVar*2').valid, true)
  })
})

describe('RESERVED_NAMES', () => {
  test('includes both function names and constant names', () => {
    assert.ok(RESERVED_NAMES.has('sqrt'))
    assert.ok(RESERVED_NAMES.has('pi'))
  })
})

describe('runSteps — worksheet execution', () => {
  test('threads each step\'s result into scope for subsequent steps', () => {
    const steps = [
      { id: 's1', resultVar: 'FLA', expression: 'P/(V*1.732)' },
      { id: 's2', resultVar: 'kVA', expression: 'V*FLA*1.732/1000' },
    ]
    const { results, scope } = runSteps(steps, { P: 10000, V: 400 })
    assert.ok(close(results[0].value, 10000 / (400 * 1.732)))
    assert.ok(close(scope.kVA, 400 * results[0].value * 1.732 / 1000))
    // Step 2's kVA should reconstruct close to the original P (10kW) within rounding
    assert.ok(close(scope.kVA, 10, 0.01))
  })

  test('a failing step throws an error identifying which step and why', () => {
    const steps = [{ id: 's1', label: 'Bad Step', resultVar: 'x', expression: 'undefinedVar*2' }]
    assert.throws(() => runSteps(steps, {}), /Bad Step: Unknown variable: undefinedVar/)
  })

  test('a step error carries the failing step\'s id for UI highlighting', () => {
    const steps = [{ id: 'step-42', resultVar: 'x', expression: '1/0' }]
    try {
      runSteps(steps, {})
      assert.fail('should have thrown')
    } catch (e) {
      assert.equal(e.stepId, 'step-42')
    }
  })
})

describe('compareValues (Pass/Fail checks)', () => {
  test('all six comparison operators', () => {
    assert.equal(compareValues(5, 'lt', 10), true)
    assert.equal(compareValues(10, 'lte', 10), true)
    assert.equal(compareValues(10, 'gt', 5), true)
    assert.equal(compareValues(10, 'gte', 10), true)
    assert.equal(compareValues(5, 'eq', 5), true)
    assert.equal(compareValues(5, 'neq', 6), true)
  })

  test('unknown operator throws', () => {
    assert.throws(() => compareValues(5, 'bogus', 5), /Unknown comparison operator/)
  })

  test('COMPARISON_LABELS has a display symbol for every operator compareValues supports', () => {
    for (const op of ['lt', 'lte', 'gt', 'gte', 'eq', 'neq']) {
      assert.ok(COMPARISON_LABELS[op])
    }
  })
})

describe('analyzeWorksheetVariables', () => {
  test('a clean two-step worksheet identifies its input variables correctly', () => {
    const steps = [
      { id: 's1', resultVar: 'FLA', expression: 'P/(V*1.732)' },
      { id: 's2', resultVar: 'kVA', expression: 'V*FLA*1.732/1000' },
    ]
    const r = analyzeWorksheetVariables(steps)
    assert.deepEqual(r.inputVars, ['P', 'V']) // FLA is a step result, not a true input
    assert.deepEqual(r.errors, [])
  })

  test('flags a step referencing a result before it is calculated (forward reference)', () => {
    const steps = [
      { id: 's1', resultVar: 'a', expression: 'b*2' }, // uses "b" before step 2 defines it
      { id: 's2', resultVar: 'b', expression: '5' },
    ]
    const r = analyzeWorksheetVariables(steps)
    assert.ok(r.errors.some(e => e.includes('before Step 2')))
  })

  test('flags a missing result name', () => {
    const steps = [{ id: 's1', resultVar: '', expression: '2+2' }]
    const r = analyzeWorksheetVariables(steps)
    assert.ok(r.errors.some(e => e.includes('needs a result name')))
  })

  test('flags a result name colliding with a reserved function/constant', () => {
    const steps = [{ id: 's1', resultVar: 'sqrt', expression: '2+2' }]
    const r = analyzeWorksheetVariables(steps)
    assert.ok(r.errors.some(e => e.includes('collides with a built-in')))
  })

  test('flags duplicate result names across steps', () => {
    const steps = [
      { id: 's1', resultVar: 'x', expression: '1+1' },
      { id: 's2', resultVar: 'x', expression: '2+2' },
    ]
    const r = analyzeWorksheetVariables(steps)
    assert.ok(r.errors.some(e => e.includes('Duplicate result name')))
  })

  test('flags invalid syntax in a step and includes the syntax error text', () => {
    const steps = [{ id: 's1', resultVar: 'x', expression: '2+*3' }]
    const r = analyzeWorksheetVariables(steps)
    assert.ok(r.errors.length > 0)
  })
})
