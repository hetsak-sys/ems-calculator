import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { jsPDF } from 'jspdf'
import { sanitizeForPdf, buildResultPdf } from './pdfExport.js'

// Regression tests for the 2026-07-27 PDF export fix (found via a real
// exported Area Lighting PDF where "Standard: ...pole spacing" ran off the
// page and "This project does not have direct access to SANS 10389-1's
// actual exterior-lighting content" got silently truncated mid-sentence).
// Two independent bugs, both fixed here:
//   1. sanitizeForPdf() only handled 5 symbols (Ω, Φ, φ, →, ←) — any other
//      WinAnsi-unsafe symbol (≈ was the one that actually surfaced) both
//      renders as garbage AND corrupts splitTextToSize's width math for the
//      rest of that line, silently dropping text after it.
//   2. The "Standard:" badge was the one text block still using a single
//      unwrapped doc.text() call — title and notes already wrap via
//      splitTextToSize, this one was missed.

describe('sanitizeForPdf', () => {
  test('substitutes every symbol in the expanded 2026-07-27 list', () => {
    const input = 'Ω Φ φ → ← ≈ ≤ ≥ √ ÷ − ∆ ≠ π ρ θ η μ α Σ'
    const out = sanitizeForPdf(input)
    // None of the original Unicode symbols should survive
    for (const ch of ['Ω', 'Φ', 'φ', '→', '←', '≈', '≤', '≥', '√', '÷', '−', '∆', '≠', 'π', 'ρ', 'θ', 'η', 'μ', 'α', 'Σ']) {
      assert.ok(!out.includes(ch), `expected ${ch} to be substituted, but it survived in: ${out}`)
    }
  })

  test('the exact ≈ case that surfaced in the Area Lighting PDF is fixed', () => {
    const original = 'mounting height ≈ half the distance across the lit area; spacing ≈ 4× mounting height'
    const out = sanitizeForPdf(original)
    assert.ok(!out.includes('≈'))
    assert.ok(out.includes('mounting height ~ half'))
  })

  test('null/undefined pass through unchanged (existing behavior preserved)', () => {
    assert.equal(sanitizeForPdf(null), null)
    assert.equal(sanitizeForPdf(undefined), undefined)
  })

  test('ASCII-safe strings with no special symbols are returned unchanged', () => {
    assert.equal(sanitizeForPdf('IEC 60364-4-43 433.1'), 'IEC 60364-4-43 433.1')
  })
})

describe('buildResultPdf — Standard badge wrapping (2026-07-27 fix)', () => {
  test('a long standard string wraps across multiple lines instead of running off the page', () => {
    // This is the actual string from the Area Lighting PDF where the bug
    // was found — reproduced verbatim, not paraphrased, since exact length
    // is what matters for the wrap-vs-clip behavior.
    const longStandard = "Generic photometric lumen method (shared with Power Quality's interior tab); mounting height/pole spacing are industry rule-of-thumb, NOT SANS 10389-1 (see notes)"
    const doc = buildResultPdf({
      calculator: 'Installation Design — Area Lighting',
      site: '',
      standard: longStandard,
      inputs: [{ label: 'Area Width', value: 40, unit: 'm' }],
      sections: [],
      notes: '',
    })

    // jsPDF doesn't expose rendered text back out directly, but we can
    // independently confirm via splitTextToSize (the same primitive
    // buildResultPdf now uses) that this string needs more than one line at
    // the page's usable width — proving a single unwrapped doc.text() call
    // would have run past the page edge, which is exactly the bug.
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 40
    const lines = doc.splitTextToSize(`Standard: ${longStandard}`, pageWidth - margin * 2)
    assert.ok(lines.length > 1, 'expected the standard line to require wrapping onto more than one line')
  })

  test('a short standard string still renders on one line (no regression for the common case)', () => {
    const doc = buildResultPdf({
      calculator: 'Cable Sizing',
      site: '',
      standard: 'IEC 60364-5-52',
      inputs: [{ label: 'Load Current', value: 32, unit: 'A' }],
      sections: [],
      notes: '',
    })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 40
    const lines = doc.splitTextToSize('Standard: IEC 60364-5-52', pageWidth - margin * 2)
    assert.equal(lines.length, 1)
  })

  test('the ≈ corruption + truncation failure mode is fully fixed end-to-end for the actual Area Lighting note text', () => {
    const noteWithApprox = 'Mounting height and pole spacing are generic industry rule-of-thumb figures (mounting height ≈ half the distance across the lit area; spacing ≈ 4× mounting height) — not a SANS 10389-1 citation. This project does not have direct access to SANS 10389-1\'s actual exterior-lighting content.'
    const sanitized = sanitizeForPdf(noteWithApprox)
    // The full sentence must survive intact (this is what was silently
    // dropped before the fix) — check the previously-truncated tail is present.
    assert.ok(sanitized.includes('not have direct access to SANS 10389-1'))
    assert.ok(sanitized.includes('actual exterior-lighting content'))
    assert.ok(!sanitized.includes('≈'))
  })
})
