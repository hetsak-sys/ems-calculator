// pdfExport.js — turns a ResultCard's data object into a shareable PDF.
//
// Deliberately built against the exact shape ResultCard already renders
// ({ calculator, site, standard, inputs, sections, notes }) so every module
// that already produces a result card gets PDF export for free — no
// per-module formatting logic to write or maintain.
//
// Runs entirely client-side (jsPDF) so it works offline in the field, then
// hands off to Android's native share sheet via Capacitor's Filesystem +
// Share plugins.

import { jsPDF } from 'jspdf'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

function pad2(n) { return String(n).padStart(2, '0') }

// jsPDF's built-in 'helvetica' font is WinAnsi/Latin-1 only — it has no
// glyphs for Greek letters or arrows, and silently substitutes whatever
// byte happens to collide (Ω -> '©', φ -> '¦' or 'Æ' depending on case,
// → -> garbage that also throws off text-width calculations, which is
// how the combined-report title got clipped rather than just garbled).
// Targeted substitution rather than embedding a Unicode font: keeps the
// jsPDF bundle-size tradeoff as-is (already an accepted call, see
// conventions.md §3) instead of adding a second embedded font on top of it.
// If full Unicode symbol fidelity is wanted later, that's the upgrade path.
function sanitizeForPdf(str) {
  if (str == null) return str
  return String(str)
    .replace(/Ω/g, 'ohm')
    .replace(/Φ/g, 'PH')
    .replace(/φ/g, 'ph')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
}

/**
 * Build a sensible default filename from the result data: calculator name,
 * site (if given), and a timestamp — editable by the user before export.
 */
export function defaultFilename(data) {
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}_${pad2(now.getHours())}${pad2(now.getMinutes())}`
  const calc = (data.calculator || 'Result').replace(/[^a-zA-Z0-9]+/g, '')
  const site = data.site ? '_' + data.site.replace(/[^a-zA-Z0-9]+/g, '') : ''
  return `PowerSuite_${calc}${site}_${stamp}`
}

function sanitizeFilename(name) {
  const cleaned = (name || 'PowerSuite_Result').trim().replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_')
  return (cleaned || 'PowerSuite_Result').slice(0, 100)
}

/**
 * Build a jsPDF document from a ResultCard-shaped data object.
 * @param {Object} data - { calculator, site, standard, inputs, sections, notes }
 * @returns {jsPDF}
 */
export function buildResultPdf(data) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  let y = 50

  const checkPageBreak = (need = 16) => {
    if (y + need > pageHeight - 50) {
      doc.addPage()
      y = 50
      return true
    }
    return false
  }

  // ── Header ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(20, 20, 20)
  doc.text('PowerSuite', margin, y)
  y += 22

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(90, 90, 90)
  // Wrapped, not a single doc.text() call — a long combined-report title
  // (or any future long calculator name) must never silently run off the
  // page edge the way it did before this fix.
  const titleLines = doc.splitTextToSize(sanitizeForPdf(data.calculator || 'Calculation Result'), pageWidth - margin * 2)
  titleLines.forEach(line => {
    doc.text(line, margin, y)
    y += 15
  })
  y += 1

  const now = new Date()
  doc.setFontSize(9)
  const dateStr = now.toLocaleDateString('en-ZA')
  const timeStr = now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
  doc.text(`Site: ${sanitizeForPdf(data.site) || '\u2014'}    Date: ${dateStr} ${timeStr}`, margin, y)
  y += 16

  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 18

  // ── Standard badge ──────────────────────────────────────────────────
  if (data.standard) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 80, 140)
    doc.text(`Standard: ${sanitizeForPdf(data.standard)}`, margin, y)
    y += 18
  }

  // ── Table renderer (shared by Inputs and each result section) ──────
  const drawTable = (title, rows, accentHeader) => {
    if (!rows || rows.length === 0) return
    checkPageBreak(14)
    const drawTitle = (label) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(accentHeader ? 150 : 90, accentHeader ? 100 : 90, 20)
      doc.text(sanitizeForPdf(String(label)).toUpperCase(), margin, y)
      y += 14
    }
    drawTitle(title)

    rows.forEach(r => {
      // If this row forces a page break mid-table, repeat the section
      // title (marked "cont.") so a page read on its own still has a
      // header instead of orphaned numbers — this is what happened with
      // the Fault Level section in the combined report.
      const broke = checkPageBreak(14)
      if (broke) drawTitle(`${title} (cont.)`)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(r.sub ? 130 : 90, r.sub ? 130 : 90, r.sub ? 130 : 90)
      doc.text(sanitizeForPdf(String(r.label ?? '')), margin + (r.sub ? 10 : 0), y)

      const valueText = sanitizeForPdf(`${r.value ?? ''}${r.unit ? ' ' + r.unit : ''}`)
      if (r.warn) doc.setTextColor(180, 30, 30)
      else if (r.accent) doc.setTextColor(150, 100, 20)
      else doc.setTextColor(20, 20, 20)
      doc.setFont('helvetica', r.accent ? 'bold' : 'normal')
      doc.text(valueText, pageWidth - margin, y, { align: 'right' })

      y += 14
    })
    y += 8
  }

  if (data.inputs?.length) drawTable('Inputs', data.inputs, false)
  data.sections?.forEach(s => drawTable(s.title, s.rows || [], true))

  // ── Notes ────────────────────────────────────────────────────────────
  if (data.notes) {
    checkPageBreak(24)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(180, 100, 20)
    doc.text('NOTE', margin, y)
    y += 13
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(90, 90, 90)
    const noteLines = doc.splitTextToSize(sanitizeForPdf(data.notes), pageWidth - margin * 2)
    noteLines.forEach(line => {
      checkPageBreak(12)
      doc.text(line, margin, y)
      y += 12
    })
    y += 8
  }

  // ── Footer (every page) ──────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text('PowerSuite \u2014 field calculation, not a substitute for professional sign-off', margin, pageHeight - 28)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 28, { align: 'right' })
  }

  return doc
}

/**
 * Build the PDF, write it to device storage, and open the native share
 * sheet so the user can save it, email it, or send it via WhatsApp/etc.
 * @param {Object} data - same shape ResultCard renders
 * @param {string} filename - user-confirmed filename (without extension)
 */
export async function exportAndSharePdf(data, filename) {
  const doc = buildResultPdf(data)
  const dataUri = doc.output('datauristring') // "data:application/pdf;filename=...;base64,XXXX"
  const base64 = dataUri.split(',')[1]
  const safeName = sanitizeFilename(filename) + '.pdf'

  await Filesystem.writeFile({
    path: safeName,
    data: base64,
    directory: Directory.Cache,
  })

  const { uri } = await Filesystem.getUri({ path: safeName, directory: Directory.Cache })

  await Share.share({
    title: safeName,
    text: `${data.calculator || 'Result'} \u2014 PowerSuite`,
    url: uri,
    dialogTitle: 'Share PDF',
  })

  return uri
}
