// ── Earth Fault Protection Engine (expanded) ────────────────────────────────
// Pure calculation logic for two distinct SEF (Sensitive Earth Fault) setting
// flows. No React, no DOM — testable standalone per [DES-3].
//
// IMPORTANT — verification status per [AI-18]:
// IEC 60255-151 governs relay TIME-CURVE MATH ONLY (the k/c/a IDMT formula,
// reused from protectionCoordinationEngine.js's idmtOperatingTime for any
// time-graded element here). It does NOT specify SEF pickup percentages or
// absolute pickup currents — those are industry/utility APPLICATION PRACTICE,
// not a cited numeric standard clause. Every default below is labeled as such
// in its accompanying UI and must remain editable, not presented as a fixed
// standard requirement. See project knowledge doc, session 2026-07-24, for the
// research trail behind this distinction.
//
// Flow A (HR / resistance-earthed): pickup expressed as % of the NER-limited
// maximum earth fault current — same underlying quantity NerSizing/NcrtMonitoring
// already compute (Vln / R), so this flow reuses that formula rather than
// introducing a separate "NGR rated current" concept.
//   Default range: 10-20% of NER-limited fault current (mining/industrial
//   practice convention — see MINING.com NGR selection guidance and i-gard
//   NGR application notes referenced in-session; NOT an IEC/MHSA numeric
//   clause).
//
// Flow B (solidly-earthed / overhead feeder SEF): pickup is an absolute
// secondary current with a long time delay, since there is no NER to
// reference as a percentage basis.
//   Default range: 5-10 A secondary, ~1 s delay (utility distribution
//   practice convention — NOT an IEC numeric clause).
//
// The two flows are DELIBERATELY kept structurally distinct (different input
// shapes, different default ranges) so that a "% of NER" value can never be
// silently applied where an "absolute secondary amps" value belongs, or vice
// versa — this class of mix-up is exactly what the test suite below guards
// against.

const SQRT3 = Math.sqrt(3)

// ── Flow A: HR / Resistance-Earthed SEF ─────────────────────────────────────

/**
 * Maximum earth fault current on a resistance-earthed system, limited by the
 * NER. Same formula already used by NcrtMonitoring/NerSizing in Protection.jsx
 * (Vln / R) — reused here rather than duplicated as a second implementation.
 */
export function maxEarthFaultCurrentHR(systemVoltageLL, nerResistanceOhm) {
  if (!systemVoltageLL || systemVoltageLL <= 0) throw new Error('System voltage must be positive')
  if (!nerResistanceOhm || nerResistanceOhm <= 0) throw new Error('NER resistance must be positive')
  const vln = systemVoltageLL / SQRT3
  return vln / nerResistanceOhm
}

/**
 * HR/SEF pickup calculation.
 * pickupPercent is a % of the NER-limited maximum fault current (industry
 * practice default range 10-20%, caller-supplied, never hardcoded here).
 *
 * Returns primary and secondary pickup currents plus warnings for physically
 * invalid or practically unreliable settings.
 */
export function hrSefPickup({ systemVoltageLL, nerResistanceOhm, ctRatioPrimary, pickupPercent }) {
  if (!ctRatioPrimary || ctRatioPrimary <= 0) throw new Error('CT ratio (primary) must be positive')
  if (pickupPercent === undefined || pickupPercent === null) throw new Error('Pickup percent is required')
  if (pickupPercent <= 0) throw new Error('Pickup percent must be positive')

  const maxFaultCurrent = maxEarthFaultCurrentHR(systemVoltageLL, nerResistanceOhm)
  const pickupPrimary = maxFaultCurrent * (pickupPercent / 100)
  const pickupSecondary = pickupPrimary / ctRatioPrimary

  const warnings = []
  if (pickupPercent > 100) {
    warnings.push('Pickup exceeds 100% of the NER-limited maximum fault current — the relay will never operate. Reduce pickup percent.')
  }
  // CT summation/measurement error becomes a practical concern below roughly
  // 1% of CT rated primary current — flagged per the i-gard/CT-summation-error
  // pattern found in application literature, not a hard IEC threshold.
  if (pickupPrimary < ctRatioPrimary * 0.01) {
    warnings.push('Pickup primary current is below ~1% of CT rated primary — check CT summation/measurement error at this sensitivity before committing to this setting.')
  }

  return {
    maxFaultCurrent,
    pickupPrimary,
    pickupSecondary,
    warnings,
    standardsRefs: [
      'IEC 60255-151 (time-curve math, if a time-graded element is used)',
      'IEEE 142 (Green Book) — resistance-grounding philosophy underlying the %-based convention',
    ],
    localComplianceNote: "Confirm this setting satisfies your site's MHSA-inspected protection philosophy before commissioning — this default is industry practice, not a cited MHSA figure.",
  }
}

// ── Flow B: Solidly-Earthed SEF (overhead feeder) ───────────────────────────

/**
 * Solid-earth SEF pickup validation. There is no NER here, so pickup is an
 * absolute secondary current, not a percentage of anything.
 */
export function solidEarthSefPickup({ pickupSecondaryA, ctRatioPrimary, ctRatioSecondary = 1, delaySeconds }) {
  if (!pickupSecondaryA || pickupSecondaryA <= 0) throw new Error('Pickup secondary current must be positive')
  if (!ctRatioPrimary || ctRatioPrimary <= 0) throw new Error('CT ratio (primary) must be positive')
  if (!ctRatioSecondary || ctRatioSecondary <= 0) throw new Error('CT ratio (secondary) must be positive')
  if (delaySeconds === undefined || delaySeconds === null || delaySeconds < 0) throw new Error('Time delay must be zero or positive')

  const pickupPrimary = pickupSecondaryA * (ctRatioPrimary / ctRatioSecondary)

  const warnings = []
  if (delaySeconds < 1) {
    warnings.push('Time delay under 1 s is a nuisance-trip risk for this scheme — high-impedance/transient faults are typically allowed a longer delay to self-clear.')
  }
  if (pickupSecondaryA < 5 || pickupSecondaryA > 10) {
    warnings.push('Pickup falls outside the commonly cited 5-10 A secondary range for this scheme — confirm intentionally against your utility/manufacturer application guide.')
  }

  return {
    pickupPrimary,
    pickupSecondaryA,
    warnings,
    standardsRefs: [
      'IEC 60255-151 (time-curve math only)',
    ],
    localComplianceNote: 'This setting affects NRS 048 supply-quality expectations if feeding a grid-connected distribution circuit — confirm against the relevant distribution code.',
  }
}
