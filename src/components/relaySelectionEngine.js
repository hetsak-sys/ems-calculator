// ── Relay Selection Engine ───────────────────────────────────────────────────
// Pure calculation/decision-table logic for the Relay Selection wizard. No
// React, no DOM — testable standalone per [DES-3].
//
// Scope, per §5.3 of the project knowledge doc: feeder / transformer / motor /
// busbar applications only. Generator-neutral REF, paralleling and
// synchronizing protection are DELIBERATELY OUT OF SCOPE — this is a distinct,
// not-yet-scoped domain (11 kV generation, §5.3). Calling selectRelayFunctions
// with application 'generator' returns an explicit out-of-scope result rather
// than a guessed recommendation, per [AI-10] (never assert unverified
// capability) and [AI-12] (don't "fix"/guess what hasn't been scoped).
//
// Standards grounding:
//   - CT accuracy class structure (5P/10P protection classes, ALF): IEC 61869-2.
//   - REF/differential scheme guidance for transformers: IEEE Std 242 (Buff
//     Book), Figures 196 and 209 — cited only when application='transformer'
//     and earthingMethod='hr' triggers a REF recommendation.
//   - PX (low-impedance/balanced) class selection requires a knee-point EMF
//     calculation this wizard does NOT perform (needs CT internal resistance
//     and connected lead/relay resistance) — flagged as an explicit limitation
//     in the returned warnings, not silently approximated.

// ── Relay function recommendation by application + earthing method ─────────

const APPLICATION_RELAY_MAP = {
  feeder: {
    hr: {
      functions: ['51 (Time O/C)', '51N/50N (SEF, resistance-earthed basis — see Earth Fault tab Flow A)'],
      note: 'Feeder overcurrent plus sensitive earth fault sized per the Earth Fault tab HR flow.',
    },
    solid: {
      functions: ['51 (Time O/C)', '51N (SEF, solidly-earthed basis — see Earth Fault tab Flow B)'],
      note: 'Feeder overcurrent plus sensitive earth fault sized per the Earth Fault tab solid-earth flow.',
    },
  },
  transformer: {
    hr: {
      functions: ['87T (Differential)', '87G/REF (Restricted Earth Fault, neutral-side)', '51N (backup)'],
      note: 'REF is commonly added on the HR-earthed winding for stator/winding-to-earth sensitivity beyond what differential alone provides.',
      standardsRefs: ['IEEE 242 (Buff Book), Figs 196 & 209 — REF scheme guidance'],
    },
    solid: {
      functions: ['87T (Differential)', '51N (backup earth fault)'],
      note: 'REF is optional on solidly-earthed transformers — differential protection alone is usually adequate; add REF only if winding-earth sensitivity is specifically required.',
    },
  },
  motor: {
    hr: {
      functions: ['50/51 (O/C)', '50G/51G (Ground/SEF, HR basis)', '49 (Thermal)'],
      note: 'Motor ground fault sensitivity follows the same HR percentage-of-NER-current convention as the feeder case.',
    },
    solid: {
      functions: ['50/51 (O/C)', '50G/51G (Ground)', '49 (Thermal)'],
      note: 'Solidly-earthed motor ground protection typically needs less sensitivity than the HR case — high fault currents are readily detectable.',
    },
  },
  busbar: {
    hr: {
      functions: ['87B (Busbar Differential)', '51N (backup)'],
      note: 'Busbar protection is largely earthing-method-agnostic at the differential-scheme level; earthing method mainly affects the backup earth-fault stage sensitivity.',
    },
    solid: {
      functions: ['87B (Busbar Differential)', '51N (backup)'],
      note: 'Busbar protection is largely earthing-method-agnostic at the differential-scheme level; earthing method mainly affects the backup earth-fault stage sensitivity.',
    },
  },
}

/**
 * Recommend relay function set for a given application + earthing method.
 * Returns an explicit out-of-scope result for applications this wizard
 * deliberately does not cover (generator neutral/paralleling protection).
 */
export function selectRelayFunctions(application, earthingMethod) {
  if (application === 'generator') {
    return {
      outOfScope: true,
      message: '11 kV / MV generator protection (differential, REF, loss-of-excitation, reverse power, paralleling/synchronizing) is a distinct, not-yet-scoped domain per project roadmap §5.3. This wizard deliberately does not guess a recommendation here — treat as a separate scoping conversation.',
    }
  }
  const appEntry = APPLICATION_RELAY_MAP[application]
  if (!appEntry) throw new Error(`Unknown application: ${application}`)
  const entry = appEntry[earthingMethod]
  if (!entry) throw new Error(`Unknown earthing method: ${earthingMethod}`)
  return { outOfScope: false, ...entry }
}

// ── CT accuracy class recommendation ────────────────────────────────────────

// Standard protection-class accuracy limit factors per IEC 61869-2's
// commonly available series. This is the STANDARD SERIES the engine picks
// from — not a guessed/invented value.
const STANDARD_ALF_SERIES = [5, 10, 15, 20, 30]

/**
 * Recommend a protection-class CT accuracy class (5P/10P) from required
 * Accuracy Limit Factor (ALF = max primary fault current / CT rated primary
 * current), per IEC 61869-2.
 *
 * Does NOT cover PX (low-impedance/balanced) class selection — that requires
 * a knee-point EMF calculation (CT internal resistance + connected burden),
 * which this wizard does not perform. Flagged in warnings, not approximated.
 */
export function recommendCtAccuracyClass({ maxFaultCurrentPrimary, ctRatedPrimary, protectionClassPrefix = '5P' }) {
  if (!maxFaultCurrentPrimary || maxFaultCurrentPrimary <= 0) throw new Error('Max fault current must be positive')
  if (!ctRatedPrimary || ctRatedPrimary <= 0) throw new Error('CT rated primary current must be positive')
  if (protectionClassPrefix !== '5P' && protectionClassPrefix !== '10P') {
    throw new Error("protectionClassPrefix must be '5P' or '10P'")
  }

  const requiredAlf = maxFaultCurrentPrimary / ctRatedPrimary
  const chosenAlf = STANDARD_ALF_SERIES.find(alf => alf >= requiredAlf)

  const warnings = [
    'PX (low-impedance/balanced) class selection is NOT covered by this calculation — it requires a knee-point EMF calculation using CT internal resistance and connected burden. Use the CT Burden tab or the CT manufacturer datasheet for PX selection.',
  ]
  if (!chosenAlf) {
    warnings.push(`Required ALF (${requiredAlf.toFixed(1)}) exceeds the standard series up to 30 — a non-standard or specially-specified CT may be required. Consult the manufacturer.`)
  }

  return {
    requiredAlf,
    recommendedClass: chosenAlf ? `${protectionClassPrefix}${chosenAlf}` : null,
    warnings,
    standardsRefs: ['IEC 61869-2 (CT accuracy class structure and ALF series)'],
  }
}

/**
 * Combined wizard entry point: relay function recommendation + CT accuracy
 * class recommendation in one call, for the Relay Selection sub-tab.
 */
export function recommendRelaySelection({ application, earthingMethod, maxFaultCurrentPrimary, ctRatedPrimary, protectionClassPrefix }) {
  const relayRecommendation = selectRelayFunctions(application, earthingMethod)
  if (relayRecommendation.outOfScope) {
    return { outOfScope: true, message: relayRecommendation.message }
  }

  const ctRecommendation = recommendCtAccuracyClass({ maxFaultCurrentPrimary, ctRatedPrimary, protectionClassPrefix })

  return {
    outOfScope: false,
    relayFunctions: relayRecommendation.functions,
    relayNote: relayRecommendation.note,
    ctAccuracyClass: ctRecommendation.recommendedClass,
    requiredAlf: ctRecommendation.requiredAlf,
    warnings: [...ctRecommendation.warnings],
    standardsRefs: [
      ...(relayRecommendation.standardsRefs || []),
      ...ctRecommendation.standardsRefs,
    ],
  }
}
