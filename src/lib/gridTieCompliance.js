/**
 * gridTieCompliance.js
 * ------------------------------------------------------------------------
 * Grid-tied inverter DC:AC ratio sizing + NRS 097-2 small-scale embedded
 * generation (SSEG) compliance checklist — Phase 3 of the Renewable
 * Energy module.
 *
 * JURISDICTION NOTE — read before using the checklist:
 *   NRS 097-2 is a South African (Eskom/NRS) standard. It does NOT
 *   automatically apply in Lesotho. No published Lesotho-specific SSEG
 *   interconnection code equivalent was found; Lesotho's grid is
 *   operated by the Lesotho Electricity Company (LEC), which is the
 *   correct point of contact to confirm actual connection/registration
 *   requirements for a Lesotho installation. This checklist is a
 *   reasonable SOUTH AFRICAN technical baseline — for Lesotho projects,
 *   surface it as reference/best-practice, not as "the" applicable code,
 *   and flag the LEC-confirmation step explicitly in the UI. Per [PRV-5]
 *   this is a "flag for local/legal review" situation, not something to
 *   silently paper over with the SA standard.
 *
 * VERIFICATION STATUS (per AI-18):
 *   - NRS 097-2 category thresholds (0-13.8 kVA / >13.8-100 kVA /
 *     100-1000 kVA) and the mandatory-registration-by-law point:
 *     VERIFIED against current NRS 097-2 documentation and Eskom's own
 *     published SSEG guidance (checked via live search, not memory).
 *   - Feeder capacity (<15% of MV feeder peak load) and NMD/MEC limits
 *     (<75% of Notified Maximum Demand, ~350kW LV upper limit): these
 *     are Eskom-specific practical connection limits, NOT clauses of
 *     NRS 097-2 itself. Municipalities and other utilities (and Lesotho's
 *     LEC) may apply different limits. Presented as "typical utility
 *     practice to expect", explicitly not as a universal numeric rule.
 *   - DC:AC oversizing ratio guidance (1.1-1.3 typical, >1.4 flagged for
 *     clipping risk): UNVERIFIED-FLAGGED. This is an industry design/
 *     economics convention for maximizing energy yield per inverter
 *     dollar, NOT a requirement of IEC 61727 or NRS 097 (those standards
 *     govern interconnection safety characteristics, not DC:AC sizing
 *     economics). Exposed as editable, never a hard limit.
 * ------------------------------------------------------------------------
 */

/** NRS 097-2 SSEG size categories (South Africa). Thresholds in kVA. */
const SSEG_CATEGORIES = [
  {
    id: 'A1',
    minKva: 0,
    maxKva: 13.8,
    label: 'Category A1 (0 - 13.8 kVA)',
    notes: 'Single-phase connection typically permitted; balanced three-phase requirement does not yet apply below this threshold.',
  },
  {
    id: 'A2',
    minKva: 13.8,
    maxKva: 100,
    label: 'Category A2 (>13.8 - 100 kVA)',
    notes: 'Must be balanced three-phase (unless only single-phase supply is available). Registration with the utility is mandatory before connection.',
  },
  {
    id: 'A3',
    minKva: 100,
    maxKva: 1000,
    label: 'Category A3 (100 - 1000 kVA)',
    notes: 'Formal registration and connection/supply agreement required before connection. More detailed utility assessment likely.',
  },
];

/**
 * Classify a proposed SSEG's size against NRS 097-2 categories.
 * SOUTH AFRICA CONTEXT ONLY — see jurisdiction note in file header.
 *
 * @param {number} generationCapacityKva - proposed generator/inverter nameplate capacity, kVA
 * @returns {{category: object|null, aboveSseegScope: boolean, notes: string[]}}
 */
export function classifySSEGCategory(generationCapacityKva) {
  const notes = [];

  if (generationCapacityKva >= 1000) {
    notes.push(
      'At or above 1000 kVA (1 MVA), this falls outside NRS 097-2 (small-scale) scope entirely — ' +
      'NRS 097-1 (MV/HV interconnection) applies instead, a materially different and more involved process.'
    );
    return { category: null, aboveSseegScope: true, notes };
  }

  const category = SSEG_CATEGORIES.find(
    (c) => generationCapacityKva > c.minKva && generationCapacityKva <= c.maxKva
  ) || SSEG_CATEGORIES[0]; // capacity of exactly 0 or below falls to A1 by convention

  notes.push(category.notes);
  notes.push('Grid-tied SSEG connection requires utility registration by law regardless of category — confirm process with the relevant utility before commissioning.');

  return { category, aboveSseegScope: false, notes };
}

/**
 * Structured checklist items for NRS 097-2-class SSEG compliance.
 * This is a CHECKLIST for the UI to render and let the user tick off /
 * record evidence against — not a pass/fail calculation. Exact
 * requirements always need confirmation against the current standard
 * text and the specific utility (see jurisdiction note).
 */
export const GRID_TIE_COMPLIANCE_CHECKLIST = [
  {
    id: 'registration',
    topic: 'Utility registration',
    requirement: 'SSEG must be registered with the utility (Eskom or municipality) before/at connection — a legal requirement, not optional.',
    reference: 'Electricity Regulation Act; NRS 097-2 Part 4 (procedures for implementation and application)',
  },
  {
    id: 'metering',
    topic: 'Metering',
    requirement: 'Bi-directional/TOU-capable metering required; prepaid meters are generally not compatible with grid-tied SSEG connections.',
    reference: 'NRS 097-2-1 §6 Metering; SANS 474/NRS 057; SANS 473/NRS 071; NRS 049',
  },
  {
    id: 'anti-islanding',
    topic: 'Anti-islanding protection',
    requirement: 'Inverter must disconnect automatically on loss of grid supply — required for utility worker safety during outages/maintenance.',
    reference: 'IEC 62116 (islanding prevention test procedure); SANS/IEC 62109-1/-2 (inverter safety)',
  },
  {
    id: 'utility-interface',
    topic: 'Utility interface characteristics',
    requirement: 'Inverter voltage/frequency ride-through and interface behaviour must comply with the utility interface specification.',
    reference: 'IEC 61727; NRS 097-2-1 §4 Utility compatibility',
  },
  {
    id: 'three-phase-balance',
    topic: 'Phase balance (Category A2/A3)',
    requirement: 'Above 13.8 kVA, the installation must generally be balanced three-phase, unless only a single-phase supply is available at the site.',
    reference: 'NRS 097-2-1 §4.1.1.8',
  },
  {
    id: 'fault-level',
    topic: 'Fault level / equipment rating (synchronous or asynchronous generators)',
    requirement: 'For non-inverter-based generators above 13.8 kVA, fault current contribution and equipment fault ratings must be checked. Inverter-based systems are typically limited by converter current rating, but this should still be confirmed, not assumed.',
    reference: 'NRS 097-2-1 §4.1.5',
  },
  {
    id: 'feeder-capacity',
    topic: 'Feeder/network capacity limits',
    requirement: 'Utility-specific practical limits often apply (e.g. total SSEG on a feeder as a fraction of feeder peak load, or generation as a fraction of Notified Maximum Demand). These are utility policy, not universal NRS 097 clauses — confirm the actual limit with the specific utility.',
    reference: 'Utility-specific (e.g. published Eskom SSEG connection rules) — NOT a fixed NRS 097 numeric clause',
  },
  {
    id: 'jurisdiction-check',
    topic: 'Jurisdiction — Lesotho installations',
    requirement: 'NRS 097-2 is a South African standard. For Lesotho sites, confirm actual connection/registration requirements directly with the Lesotho Electricity Company (LEC) rather than assuming NRS 097 applies as-is.',
    reference: 'No published Lesotho-specific SSEG interconnection code identified — direct LEC confirmation required',
  },
];

/**
 * DC:AC (array-to-inverter) oversizing ratio.
 *
 * @param {number} arrayDcNameplateWp - total array DC nameplate power, Wp (sum of panel Wp ratings)
 * @param {number} inverterAcRatedW - inverter continuous AC rated output power, W
 * @returns {{ratio: number, assessment: string}}
 */
export function dcAcRatio(arrayDcNameplateWp, inverterAcRatedW) {
  const ratio = arrayDcNameplateWp / inverterAcRatedW;
  let assessment;
  if (ratio < 1.0) {
    assessment = 'Array undersized relative to inverter — inverter capacity is not being fully utilized. Not unsafe, just likely suboptimal economically.';
  } else if (ratio <= 1.3) {
    assessment = 'Within the commonly-used 1.1-1.3 oversizing range — typical practice to capture more energy yield without excessive clipping.';
  } else if (ratio <= 1.4) {
    assessment = 'Above the typical 1.3 guideline — some inverters/climates tolerate this, but check expected clipping losses before committing.';
  } else {
    assessment = 'Meaningfully oversized (>1.4) — significant clipping losses likely during peak-output hours. Verify this is intentional (e.g. hot climate with low temp-coefficient panels) rather than a sizing error.';
  }
  return { ratio: round2(ratio), assessment };
}

/**
 * Recommend inverter AC rating from array DC size and a target oversizing ratio.
 *
 * @param {number} arrayDcNameplateWp
 * @param {number} [targetOversizingRatio=1.2] - UNVERIFIED-FLAGGED guideline default, see file header
 * @returns {number} recommended inverter AC rating, W
 */
export function recommendInverterAcRating(arrayDcNameplateWp, targetOversizingRatio = 1.2) {
  return round2(arrayDcNameplateWp / targetOversizingRatio);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
