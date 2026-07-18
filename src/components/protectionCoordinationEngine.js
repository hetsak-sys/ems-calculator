// ── Protection Coordination Engine ──────────────────────────────────────────
// Pure calculation logic for the multi-device TCC (time-current curve)
// coordination study. No React, no DOM — testable standalone per [DES-3].
//
// Standards: IEC 60255-151 (IDMT relay formula, matches existing
// IdmtCoordination tab in Protection.jsx); ANSI/IEEE C37.41 / C37.42
// (generic K/T fuse link reference curves — see genericAnsiFusePoints
// for verification status).

// ── IDMT relay curves (identical constants to the existing single-relay tab —
//    do not duplicate elsewhere; both should import from one source) ────────
export const IDMT_CURVES = [
  { id: 'si',  label: 'Standard Inverse (SI)',   k: 0.14, a: 0.02 },
  { id: 'vi',  label: 'Very Inverse (VI)',       k: 13.5, a: 1.0  },
  { id: 'ei',  label: 'Extremely Inverse (EI)',  k: 80,   a: 2.0  },
  { id: 'lti', label: 'Long Time Inverse (LTI)', k: 120,  a: 1.0  },
]

/**
 * IEC 60255-151 IDMT operating time.
 * t = TMS × K ÷ ((I/Is)^a − 1)
 * Returns null if the fault current does not exceed pickup (relay never operates).
 */
export function idmtOperatingTime(curveId, pickupA, faultA, tms) {
  const curve = IDMT_CURVES.find(c => c.id === curveId)
  if (!curve) throw new Error(`Unknown IDMT curve: ${curveId}`)
  if (!pickupA || pickupA <= 0) throw new Error('Pickup current must be positive')
  const ratio = faultA / pickupA
  if (ratio <= 1) return null // relay does not operate at or below pickup
  return (tms * curve.k) / (Math.pow(ratio, curve.a) - 1)
}

// ── Generic ANSI K/T fuse link reference curves ─────────────────────────────
// VERIFICATION STATUS (per [AI-18]): the anchor points below are grounded in
// published ANSI standard requirements, not any specific manufacturer's exact
// curve:
//   - Melt-time anchor: ANSI C37.41 requires the element to melt within
//     200-240% of rated current at 300s (ratings <=100A) or 220-264% at 600s
//     (ratings >100A). We use the midpoint of each range as the anchor.
//   - Speed ratio: ANSI C37.42 defines K-link speed ratios from 6 (6A rating)
//     to 8.1 (200A rating), and T-link from 10 to 13, linearly interpolated
//     across the standard's own rating series. "Speed ratio" = ratio of the
//     minimum-melting current at a fast test time to that at the slow anchor
//     time above; we use it to place a second anchor point and log-log
//     interpolate a representative curve between them.
// This produces a REPRESENTATIVE / PLANNING-LEVEL curve consistent with how
// IEEE Std 242 (Buff Book) publishes generic K/T reference curves — it is
// NOT a specific manufacturer's exact tested curve. Label all UI output
// accordingly and prompt the user to confirm against the actual purchased
// fuse's datasheet before using the result as the sole basis for a final
// coordination decision.

const ANSI_PREFERRED_RATINGS = [6, 10, 15, 25, 40, 65, 100, 140, 200]

// Speed ratio per rating, per ANSI C37.42 (verified figures at the endpoints;
// intermediate values linearly interpolated across the standard's own series
// — the standard does not publish a formula for intermediate ratings, so this
// interpolation is itself an approximation, flagged here rather than silently
// presented as exact).
const SPEED_RATIO_K = { 6: 6.0, 200: 8.1 }
const SPEED_RATIO_T = { 6: 10.0, 200: 13.0 }

function interpolateSpeedRatio(ratingA, table) {
  const ratings = Object.keys(table).map(Number).sort((a, b) => a - b)
  const lo = ratings[0], hi = ratings[ratings.length - 1]
  const loV = table[lo], hiV = table[hi]
  const clamped = Math.min(Math.max(ratingA, lo), hi)
  const frac = (clamped - lo) / (hi - lo)
  return loV + frac * (hiV - loV)
}

/**
 * Generates a representative 3-point (current, time) curve for a generic
 * ANSI K or T fuse link at the given continuous current rating.
 * Points are anchored at slow (300s or 600s per ANSI C37.41), medium (10s,
 * geometric midpoint), and fast (0.1s) test times, using the standard's
 * own speed-ratio definition to place the fast-end anchor.
 * Returns { points: [[currentA, timeS], ...], anchorNote }.
 */
export function genericAnsiFusePoints(ratingA, fuseClass) {
  if (!ANSI_PREFERRED_RATINGS.includes(ratingA)) {
    // Not a hard error — non-preferred ratings exist in the field — but the
    // anchor% below is only standards-verified for the ratings ANSI actually
    // specifies test tolerances for. Proceed using the same %, flagged.
  }
  const slowTimeS = ratingA <= 100 ? 300 : 600
  const slowPct = ratingA <= 100 ? 0.5 * (2.0 + 2.4) : 0.5 * (2.2 + 2.64) // midpoint of ANSI tolerance band
  const slowCurrentA = ratingA * slowPct

  const speedRatio = fuseClass === 'K'
    ? interpolateSpeedRatio(ratingA, SPEED_RATIO_K)
    : interpolateSpeedRatio(ratingA, SPEED_RATIO_T)

  // Speed ratio = (fast-end melting current) / (slow-end melting current).
  // We take the "fast end" as the 0.1s point, consistent with how
  // manufacturer catalogs typically present K/T curves.
  const fastTimeS = 0.1
  const fastCurrentA = slowCurrentA * speedRatio

  // Middle anchor at 10s, log-log geometric interpolation between the two
  // verified ends (a straight line on log-log axes is the standard way
  // fuse curves are approximated between known points).
  const midTimeS = 10
  const midCurrentA = logLogInterpolateCurrent(
    [[slowTimeS, slowCurrentA], [fastTimeS, fastCurrentA]],
    midTimeS
  )

  return {
    points: [
      [slowCurrentA, slowTimeS],
      [midCurrentA, midTimeS],
      [fastCurrentA, fastTimeS],
    ],
    anchorNote: `Generic ANSI ${fuseClass}-link reference curve for ${ratingA}A rating — ` +
      `anchored at ANSI C37.41 melt tolerance (${(slowPct * 100).toFixed(0)}% of rating at ${slowTimeS}s) ` +
      `and ANSI C37.42 speed ratio (${speedRatio.toFixed(2)}). Representative/planning-level only — ` +
      `confirm against the specific manufacturer's datasheet before final sign-off.`,
  }
}

// Helper: given two (time, current) reference points, find the current
// at an intermediate time by interpolating linearly in log-log space —
// the standard way fuse and relay curves are read between published points.
function logLogInterpolateCurrent(refPoints, atTimeS) {
  const [[t1, i1], [t2, i2]] = refPoints
  const logT1 = Math.log10(t1), logT2 = Math.log10(t2)
  const logI1 = Math.log10(i1), logI2 = Math.log10(i2)
  const logT = Math.log10(atTimeS)
  const frac = (logT - logT1) / (logT2 - logT1)
  const logI = logI1 + frac * (logI2 - logI1)
  return Math.pow(10, logI)
}

/**
 * Operating time of a fuse (generic or custom) at a given fault current,
 * by log-log interpolation between the fuse's defined points.
 * points: [[currentA, timeS], ...] sorted by current, ascending.
 * Returns null if the fault current is below the fuse's lowest defined
 * melting current (fuse does not operate in the modeled range) or above
 * the highest.
 */
export function fuseOperatingTime(points, faultA) {
  if (!points || points.length < 2) throw new Error('Fuse needs at least 2 curve points')
  const sorted = [...points].sort((a, b) => a[0] - b[0])
  const [minI] = sorted[0]
  const [maxI] = sorted[sorted.length - 1]
  if (faultA < minI || faultA > maxI) return null

  for (let i = 0; i < sorted.length - 1; i++) {
    const [i1, t1] = sorted[i]
    const [i2, t2] = sorted[i + 1]
    if (faultA >= i1 && faultA <= i2) {
      // interpolate time in log-log space between the two bracketing points
      const logI1 = Math.log10(i1), logI2 = Math.log10(i2)
      const logT1 = Math.log10(t1), logT2 = Math.log10(t2)
      const logI = Math.log10(faultA)
      const frac = (logI - logI1) / (logI2 - logI1)
      const logT = logT1 + frac * (logT2 - logT1)
      return Math.pow(10, logT)
    }
  }
  return null // unreachable if bounds check above is correct
}

/**
 * Total clearing time estimate from a minimum-melt time, using the commonly
 * cited arcing-time allowance. FLAGGED per [AI-18]: this is an engineering
 * rule of thumb (roughly +15% below 0.1s melt time, +10% above), not a fixed
 * ANSI-mandated multiplier. Prefer an actual total-clearing curve entered by
 * the user when available.
 */
export function estimateTotalClearingTime(minMeltTimeS) {
  const factor = minMeltTimeS < 0.1 ? 1.15 : 1.10
  return minMeltTimeS * factor
}

// ── Transformer current translation ─────────────────────────────────────────
/**
 * Translates a current from one side of a transformer to the other,
 * by turns ratio. side: 'toSecondary' | 'toPrimary'.
 * Consistent with the ratio calculation already used in TransformerCalc.
 */
export function translateAcrossTransformer(currentA, vPrimary, vSecondary, side) {
  if (!vPrimary || vPrimary <= 0 || !vSecondary || vSecondary <= 0) {
    throw new Error('Transformer primary and secondary voltages must both be positive to translate current across it')
  }
  const ratio = vPrimary / vSecondary
  if (side === 'toSecondary') return currentA * ratio
  if (side === 'toPrimary') return currentA / ratio
  throw new Error(`Unknown side: ${side}`)
}

/**
 * Validates a single chain point's inputs, independent of any other point.
 * Returns an array of human-readable error strings (empty if valid).
 * This is deliberately proactive/UI-facing validation, distinct from the
 * engine's own runtime errors (thrown by evaluateChain etc. for genuinely
 * unrecoverable states) — this catches incomplete-input states early,
 * before the user has necessarily tried to run the study.
 */
export function validatePoint(point) {
  const errors = []
  if (point.type === 'relay') {
    if (!point.pickupA || point.pickupA <= 0) errors.push('Pickup current must be a positive number')
    if (!point.tms || point.tms <= 0) errors.push('TMS must be a positive number')
  } else if (point.type === 'fuse') {
    if (point.fuseSource === 'generic-ansi') {
      if (!point.ratingA || point.ratingA <= 0) errors.push('Select a current rating')
    } else if (point.fuseSource === 'custom') {
      const valid = (point.customPoints || []).filter(([c, t]) => c > 0 && t > 0)
      if (valid.length < 2) errors.push('Enter at least 2 valid curve points (current > 0, time > 0)')
    } else {
      errors.push('Select a curve source')
    }
  } else if (point.type === 'transformer') {
    if (!point.kva || point.kva <= 0) errors.push('Transformer rating must be a positive number')
    if (!point.vPrimary || point.vPrimary <= 0) errors.push('Primary voltage must be a positive number')
    if (!point.vSecondary || point.vSecondary <= 0) errors.push('Secondary voltage must be a positive number')
  } else {
    errors.push(`Unknown point type: ${point.type}`)
  }
  return errors
}

/**
 * Validates every point in a chain independently.
 * Returns an array parallel to the chain: [{ id, errors }, ...].
 */
export function validateChain(chain) {
  return chain.map(p => ({ id: p.id, errors: validatePoint(p) }))
}

/**
 * Computes the cumulative "referral factor" at each point in the chain —
 * the multiplier needed to express that point's ACTUAL current in
 * load-end-equivalent terms, so devices on different sides of a
 * transformer boundary can be plotted on one consistent current axis
 * (standard TCC-study practice: refer everything to one common base).
 *
 * factor[i] is the multiplier for point i's real current. Points before
 * any transformer have factor 1. Crossing a transformer (toPrimary
 * direction, matching evaluateChain) multiplies the running factor by
 * the turns ratio (vPrimary/vSecondary) for every point after it.
 *
 * Returns an array of numbers, same length and order as chain. Points
 * with invalid transformer voltages leave the running factor unchanged
 * (rather than throwing) since this is a display-only helper — real
 * validation errors are surfaced separately via validateChain.
 */
export function computeReferralFactors(chain) {
  let factor = 1
  const factors = []
  for (const point of chain) {
    factors.push(factor)
    if (point.type === 'transformer' && point.vPrimary > 0 && point.vSecondary > 0) {
      factor *= (point.vPrimary / point.vSecondary)
    }
  }
  return factors
}

/**
 * Evaluates every relay/fuse point in a chain, walking load-end to source-end.
 * Fault current at each point defaults to the running value inherited from
 * the previous point (translated across any transformer crossed), unless
 * the point itself specifies faultCurrentA, which overrides it — this is
 * the "maximum through-fault current at this location" design decision:
 * see project discussion for why fault current is a per-point property,
 * not a single study-wide value or a separate per-pair concept.
 *
 * IMPORTANT LIMITATION, surfaced to the UI layer via `inherited: true` on
 * each result: between two same-voltage points not separated by a modeled
 * transformer, the engine currently carries the fault current forward
 * UNCHANGED if not overridden — it does not model cable/line impedance
 * drop. This is an OPTIMISTIC (non-conservative) approximation when relied
 * on rather than overridden with real fault-study figures — flag this in
 * the UI wherever a point is using an inherited rather than entered value.
 *
 * chain: array of point objects (see data model in project discussion).
 * initialFaultA: fault current (A) at the load-end (first point) of the chain,
 * used as the starting value for inheritance if the first point doesn't
 * specify its own faultCurrentA.
 * Returns an array of { id, label, type, currentA, inherited, timeS }.
 */
export function evaluateChain(chain, initialFaultA) {
  let runningCurrentA = initialFaultA
  const results = []

  for (const point of chain) {
    const hasOverride = point.faultCurrentA != null && point.faultCurrentA > 0
    const currentA = hasOverride ? point.faultCurrentA : runningCurrentA
    const inherited = !hasOverride

    if (point.type === 'transformer') {
      results.push({ id: point.id, label: point.label, type: 'transformer', currentA, inherited, timeS: null })
      runningCurrentA = translateAcrossTransformer(currentA, point.vPrimary, point.vSecondary, 'toPrimary')
      continue
    }

    if (point.type === 'relay') {
      const timeS = idmtOperatingTime(point.curveId, point.pickupA, currentA, point.tms)
      results.push({ id: point.id, label: point.label, type: 'relay', currentA, inherited, timeS })
      runningCurrentA = currentA
      continue
    }

    if (point.type === 'fuse') {
      const curvePoints = point.fuseSource === 'custom'
        ? point.customPoints
        : genericAnsiFusePoints(point.ratingA, point.fuseClass).points
      const timeS = fuseOperatingTime(curvePoints, currentA)
      results.push({ id: point.id, label: point.label, type: 'fuse', currentA, inherited, timeS })
      runningCurrentA = currentA
      continue
    }

    throw new Error(`Unknown point type: ${point.type}`)
  }

  return results
}

/**
 * Checks discrimination margin between every adjacent pair of
 * operating (non-transformer) points in an evaluated chain.
 * Returns array of { fromId, toId, marginS, pass, requiredMarginS }.
 * A pair where either device doesn't operate at the study current is
 * reported with marginS: null, pass: null (not applicable, not a failure).
 */
export function checkChainMargins(evaluatedChain, requiredMarginS) {
  const operating = evaluatedChain.filter(p => p.type !== 'transformer')
  const margins = []

  for (let i = 0; i < operating.length - 1; i++) {
    const downstream = operating[i]     // closer to the fault (should trip first)
    const upstream = operating[i + 1]   // should trip after, with margin

    if (downstream.timeS == null || upstream.timeS == null) {
      margins.push({
        fromId: downstream.id, toId: upstream.id,
        marginS: null, pass: null, requiredMarginS,
      })
      continue
    }

    const marginS = upstream.timeS - downstream.timeS
    margins.push({
      fromId: downstream.id, toId: upstream.id,
      marginS, pass: marginS >= requiredMarginS, requiredMarginS,
    })
  }

  return margins
}
