/**
 * RenewableEnergyCalculator.jsx
 * PowerSuite — Renewable Energy module
 *
 * Drop into: src/components/RenewableEnergyCalculator.jsx
 *
 * Integration (App.jsx or wherever top-level modules are registered):
 *   1. Add to imports:
 *        import RenewableEnergyCalculator from './RenewableEnergyCalculator'
 *   2. Add to your module/tab list, same pattern as other top-level modules
 *      (Motor, Cable, Earthing, Protection, Power Systems, Power Quality...)
 *   3. Pass addHistory (siteConfig is no longer needed — see below)
 *
 * Props:
 *   addHistory(obj) — same shape as other modules: { tab, expr, result }
 *   siteConfig — no longer accepted; site data now comes from useSite()
 *     (SiteContext), matching MotorCalculator.jsx's pattern. Also fixes a
 *     real gap: none of this file's four PDF exports set a `site:` field
 *     at all until this pass — every exported PDF's "Site:" line was blank.
 *
 * Engineering references: IEC 62548, IEC 61727, IEC 62109, NRS 097-2, ISO 8528-1
 * (generator tie-in only). See src/lib/pvArraySizing.js, batterySizing.js,
 * gridTieCompliance.js, hybridSizing.js for full standards/verification notes —
 * this file is UI only, all calculation logic lives in those engines.
 *
 * NOT DONE IN THIS PASS (flagged, not silently skipped):
 *   - Array/Battery/Grid-Tie/Hybrid tabs' own scenario inputs (altitude,
 *     ambient temp, system voltage) are still tab-local state, not prefilled
 *     from useSite(). This session only fixed the PDF export site *label*;
 *     prefilling the tabs' own calculation inputs from the real site is a
 *     separate, larger follow-up (same category of fix, bigger surface).
 *
 * DONE, worth knowing about:
 *   - Generator Sizing -> Hybrid tab cross-module prefill IS wired up, via
 *     WorkspaceContext (see generatorSnapshot), same prefill-only contract
 *     as the existing Motor -> Cable FLA pattern. Visit Power Systems ›
 *     Generator Sizing first in a session for the Hybrid tab to prefill
 *     from it; otherwise it falls back to the real configured site
 *     (useSite()) — no hardcoded location, per the standing decision that
 *     PowerSuite never assumes or embeds a particular place.
 */

import { useState, useMemo } from 'react'
import {
  designStringConfiguration,
  requiredArrayPowerWp,
  PARALLEL_STRING_SAFETY_FACTOR_DEFAULT,
  SYSTEM_DERATE_FACTOR_DEFAULT,
} from '../lib/pvArraySizing.js'
import {
  BATTERY_CHEMISTRY_PRESETS,
  CHARGE_CONTROLLER_SAFETY_FACTOR_DEFAULT,
  offGridBatteryBankSizing,
  checkDischargeCurrent,
  chargeControllerSizing,
  recommendControllerType,
} from '../lib/batterySizing.js'
import {
  classifySSEGCategory,
  dcAcRatio,
  recommendInverterAcRating,
  GRID_TIE_COMPLIANCE_CHECKLIST,
} from '../lib/gridTieCompliance.js'
import {
  batteryBridgeSizing,
  generatorEnergyDeficit,
  generatorRunHoursForEnergy,
  generatorOutputFromSizingResult,
} from '../lib/hybridSizing.js'
import { calculateGeneratorDerating, GEN_SIZES } from '../lib/generatorDerating.js'
import { useWorkspace } from './WorkspaceContext'
import { useResultCard, ResultCard } from './shared'
import { useSite } from './SiteContext'

// ─── Constants ─────────────────────────────────────────────────────────────

const CHEMISTRY_OPTIONS = [
  { v: 'leadAcidFlooded', label: 'Lead-Acid Flooded' },
  { v: 'leadAcidAGM', label: 'Lead-Acid AGM' },
  { v: 'leadAcidGel', label: 'Lead-Acid Gel' },
  { v: 'lifepo4', label: 'LiFePO4' },
]

const nextStd = (arr, val) => arr.find((s) => s >= val) || arr[arr.length - 1]
const pf = (v, fallback = 0) => parseFloat(v) || fallback

// ─── Style (matches GeneratorSizing.jsx conventions) ────────────────────────

const ACCENT = '#2dd4bf'    // teal — Renewable Energy module colour (matches Dashboard tile)
const SOLAR_C = '#fbbf24'   // gold — Array/solar tab content
const BATTERY_C = '#38bdf8' // sky blue — battery/charge controller
const GRID_C = '#4ade80'    // green — grid-tie/compliance
const HYBRID_C = '#c084fc'  // purple — hybrid/combined systems
const RED = '#f87171'       // warnings

const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '0.5px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '12px 14px',
    marginBottom: '10px',
  },
  lbl: { fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '3px', display: 'block' },
  inp: {
    width: '100%', boxSizing: 'border-box', fontSize: '13px', fontFamily: 'monospace',
    background: 'rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.15)',
    borderRadius: '6px', color: '#fff', padding: '5px 8px',
  },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '5px 0', borderBottom: '0.5px solid rgba(255,255,255,0.07)',
  },
  rowLbl: { fontSize: '12px', color: 'rgba(255,255,255,0.55)' },
  rowVal: { fontSize: '12px', fontFamily: 'monospace', fontWeight: '500', color: '#fff' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' },
  result: { padding: '12px', borderRadius: '10px', textAlign: 'center', marginTop: '10px' },
  warn: {
    background: 'rgba(248,113,113,0.1)', border: '0.5px solid rgba(248,113,113,0.3)',
    borderRadius: '8px', padding: '8px 10px', fontSize: '10px', color: '#fca5a5',
    marginTop: '8px', lineHeight: '1.5',
  },
  note: {
    background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', padding: '8px 10px', fontSize: '10px', color: 'rgba(255,255,255,0.45)',
    marginTop: '8px', lineHeight: '1.5',
  },
  subHead: { fontSize: '12px', fontWeight: '500', marginBottom: '8px' },
}

function Inp({ label, sub, ...rest }) {
  return (
    <div>
      {label && <span style={S.lbl}>{label}</span>}
      <input style={S.inp} {...rest} />
      {sub && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>{sub}</div>}
    </div>
  )
}

function Sel({ label, value, onChange, options }) {
  return (
    <div>
      {label && <span style={S.lbl}>{label}</span>}
      <select style={{ ...S.inp, cursor: 'pointer' }} value={value} onChange={onChange}>
        {options.map((o) => {
          const val = typeof o === 'string' ? o : o.v
          const lbl = typeof o === 'string' ? o : o.label || o.v
          return <option key={val} value={val}>{lbl}</option>
        })}
      </select>
    </div>
  )
}

function RowVal({ label, value, accent }) {
  return (
    <div style={S.row}>
      <span style={S.rowLbl}>{label}</span>
      <span style={{ ...S.rowVal, color: accent || '#fff' }}>{value}</span>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────

export default function RenewableEnergyCalculator({ addHistory }) {
  const [tab, setTab] = useState('array')
  const { site } = useSite()
  const workspace = useWorkspace()
  const { cardData, showCard, hideCard } = useResultCard()

  // ── Shared scenario inputs (used across multiple tabs) ──────────────────
  const [dailyLoadWh, setDailyLoadWh] = useState('10000')
  const [systemVoltageV, setSystemVoltageV] = useState('48')
  const [chemistry, setChemistry] = useState('leadAcidAGM')
  const preset = BATTERY_CHEMISTRY_PRESETS[chemistry]
  const [dodPct, setDodPct] = useState(String(preset.dodFraction * 100))
  const [effPct, setEffPct] = useState(String(preset.roundTripEfficiency * 100))

  // keep dod/efficiency in sync with chemistry choice, but let the user
  // override afterwards (explicit-over-implicit — never silently reset an override)
  const applyChemistryDefaults = (v) => {
    setChemistry(v)
    const p = BATTERY_CHEMISTRY_PRESETS[v]
    setDodPct(String(p.dodFraction * 100))
    setEffPct(String(p.roundTripEfficiency * 100))
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAB 1: ARRAY & STRINGS
  // ══════════════════════════════════════════════════════════════════════
  const [vocStc, setVocStc] = useState('49.5')
  const [vmpStc, setVmpStc] = useState('41.5')
  const [iscStc, setIscStc] = useState('11.5')
  const [tcVoc, setTcVoc] = useState('-0.27')
  const [tcVmp, setTcVmp] = useState('-0.35')
  const [tcIsc, setTcIsc] = useState('0.05')
  const [noct, setNoct] = useState('45')
  const [panelW, setPanelW] = useState('450')

  const [invMaxDc, setInvMaxDc] = useState('600')
  const [mpptMin, setMpptMin] = useState('120')
  const [invMaxA, setInvMaxA] = useState('15')

  const [minTemp, setMinTemp] = useState('-5')
  const [maxTemp, setMaxTemp] = useState('35')

  const [peakSunHours, setPeakSunHours] = useState('5.2')
  const [derateFactorPct, setDerateFactorPct] = useState(String(SYSTEM_DERATE_FACTOR_DEFAULT * 100))
  const [stringSafetyPct, setStringSafetyPct] = useState(String(PARALLEL_STRING_SAFETY_FACTOR_DEFAULT * 100))

  const arrayRes = useMemo(() => {
    const panel = {
      vocStc: pf(vocStc), vmpStc: pf(vmpStc), iscStc: pf(iscStc),
      tempCoeffVocPctPerC: pf(tcVoc), tempCoeffVmpPctPerC: pf(tcVmp), tempCoeffIscPctPerC: pf(tcIsc),
      noctC: pf(noct), wattage: pf(panelW),
    }
    const inverter = { maxDcVoltage: pf(invMaxDc), mpptMinVoltage: pf(mpptMin), maxInputCurrent: pf(invMaxA) }
    const site = { designMinAmbientTempC: pf(minTemp), designMaxAmbientTempC: pf(maxTemp) }
    const safetyFactor = pf(stringSafetyPct, 125) / 100

    const strings = designStringConfiguration(panel, inverter, site, { safetyFactor })
    const requiredWp = requiredArrayPowerWp(pf(dailyLoadWh), pf(peakSunHours, 1), pf(derateFactorPct, 80) / 100)
    const approxPanels = panel.wattage > 0 ? Math.ceil(requiredWp / panel.wattage) : 0

    return { strings, requiredWp, approxPanels, panel }
  }, [vocStc, vmpStc, iscStc, tcVoc, tcVmp, tcIsc, noct, panelW, invMaxDc, mpptMin, invMaxA,
      minTemp, maxTemp, dailyLoadWh, peakSunHours, derateFactorPct, stringSafetyPct])

  const pushHistoryArray = () => {
    if (!addHistory) return
    addHistory({
      tab: 'Renewable — Array',
      expr: `${panelW}W panel · ${dailyLoadWh}Wh/day · ${peakSunHours}PSH`,
      result: `${arrayRes.strings.minPanelsSeries}-${arrayRes.strings.maxPanelsSeries} series · ${arrayRes.strings.maxStringsParallel} strings · ${arrayRes.approxPanels} panels req'd`,
    })
  }

  const exportArray = () => {
    showCard({
      calculator: 'Renewable Energy — Array & Strings',
      site: site.name,
      standard: 'IEC 62548 (array design), IEC 62109 (inverter safety)',
      inputs: [
        { label: 'Panel', value: `${panelW}Wp · Voc ${vocStc}V · Vmp ${vmpStc}V · Isc ${iscStc}A · NOCT ${noct}°C` },
        { label: 'Inverter / charge controller', value: `Max DC ${invMaxDc}V · MPPT min ${mpptMin}V · ${invMaxA}A max input` },
        { label: 'Site design temps', value: `${minTemp}°C to ${maxTemp}°C` },
        { label: 'Daily load / peak sun hours', value: `${dailyLoadWh}Wh/day @ ${peakSunHours}h` },
      ],
      sections: [{
        title: 'STRING CONFIGURATION',
        rows: [
          { label: 'Max panels in series', value: arrayRes.strings.maxPanelsSeries, accent: true },
          { label: 'Min panels in series', value: arrayRes.strings.minPanelsSeries },
          { label: 'Max strings in parallel', value: arrayRes.strings.maxStringsParallel, accent: true },
          { label: 'Worst-case cold Voc', value: `${arrayRes.strings.worstCaseVoc} V` },
          { label: 'Worst-case hot Vmp', value: `${arrayRes.strings.worstCaseVmp} V` },
          { label: 'Design current per string', value: `${arrayRes.strings.designCurrentPerString} A` },
          { label: 'Required array power', value: `${arrayRes.requiredWp.toFixed(0)} Wp (~${arrayRes.approxPanels} panels)`, accent: true },
        ],
      }],
      notes: arrayRes.strings.warnings.length
        ? arrayRes.strings.warnings.join(' ') + ' System derate and string safety factor are UNVERIFIED-FLAGGED guideline defaults — confirm against SANS 10142-1 before relying on for real overcurrent protection sizing.'
        : 'System derate and string safety factor are UNVERIFIED-FLAGGED guideline defaults — confirm against SANS 10142-1 before relying on for real overcurrent protection sizing.',
    })
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAB 2: BATTERY & CHARGE CONTROLLER
  // ══════════════════════════════════════════════════════════════════════
  const [autonomyDays, setAutonomyDays] = useState('2')
  const [peakLoadW, setPeakLoadW] = useState('3000')
  const [maxChargeCRatePct, setMaxChargeCRatePct] = useState(String(preset.maxChargeCRate * 100))
  const [maxDischargeCRatePct, setMaxDischargeCRatePct] = useState(String(preset.maxDischargeCRate * 100))
  const [controllerSafetyPct, setControllerSafetyPct] = useState(String(CHARGE_CONTROLLER_SAFETY_FACTOR_DEFAULT * 100))

  // Suggested from Tab 1 — prefilled but editable, not force-synced
  const [arrayMaxCurrentA, setArrayMaxCurrentA] = useState('')
  const suggestedArrayCurrentA = useMemo(
    () => round2(arrayRes.strings.designCurrentPerString * arrayRes.strings.maxStringsParallel),
    [arrayRes]
  )
  const [arrayVmpOverride, setArrayVmpOverride] = useState('')

  const batteryRes = useMemo(() => {
    const dod = pf(dodPct, 50) / 100
    const eff = pf(effPct, 85) / 100
    const V = pf(systemVoltageV, 48)

    const bank = offGridBatteryBankSizing({
      dailyLoadWh: pf(dailyLoadWh),
      autonomyDays: pf(autonomyDays, 1),
      dodFraction: dod,
      systemVoltageV: V,
      roundTripEfficiency: eff,
    })

    const discharge = checkDischargeCurrent({
      peakLoadW: pf(peakLoadW),
      systemVoltageV: V,
      bankCapacityAh: bank.requiredCapacityAh,
      maxDischargeCRate: pf(maxDischargeCRatePct, 20) / 100,
    })

    const usedArrayCurrent = arrayMaxCurrentA !== '' ? pf(arrayMaxCurrentA) : suggestedArrayCurrentA
    const controller = chargeControllerSizing({
      arrayMaxCurrentA: usedArrayCurrent,
      bankCapacityAh: bank.requiredCapacityAh,
      maxChargeCRate: pf(maxChargeCRatePct, 10) / 100,
      safetyFactor: pf(controllerSafetyPct, 125) / 100,
    })

    const usedVmp = arrayVmpOverride !== '' ? pf(arrayVmpOverride) : arrayRes.strings.worstCaseVmp
    const typeRec = recommendControllerType(usedVmp, V)

    return { bank, discharge, controller, typeRec, usedArrayCurrent, usedVmp }
  }, [dodPct, effPct, systemVoltageV, dailyLoadWh, autonomyDays, peakLoadW, maxDischargeCRatePct,
      maxChargeCRatePct, controllerSafetyPct, arrayMaxCurrentA, suggestedArrayCurrentA, arrayVmpOverride, arrayRes])

  const pushHistoryBattery = () => {
    if (!addHistory) return
    addHistory({
      tab: 'Renewable — Battery',
      expr: `${dailyLoadWh}Wh/day · ${autonomyDays}d autonomy · ${chemistry}`,
      result: `${batteryRes.bank.requiredCapacityAh}Ah @ ${systemVoltageV}V · Controller ${batteryRes.controller.requiredControllerRatingA}A`,
    })
  }

  const exportBattery = () => {
    showCard({
      calculator: 'Renewable Energy — Battery & Charge Controller',
      site: site.name,
      standard: 'General battery-bank sizing practice (chemistry-independent arithmetic); IEC 62109 (charge controller safety context)',
      inputs: [
        { label: 'Daily load / autonomy', value: `${dailyLoadWh}Wh/day · ${autonomyDays} days` },
        { label: 'Chemistry', value: `${chemistry} · DoD ${dodPct}% · RTE ${effPct}%` },
        { label: 'System voltage', value: `${systemVoltageV} Vdc` },
        { label: 'Peak load', value: `${peakLoadW} W` },
      ],
      sections: [{
        title: 'BATTERY BANK & CHARGE CONTROLLER',
        rows: [
          { label: 'Required capacity', value: `${batteryRes.bank.requiredCapacityWh.toFixed(0)} Wh` },
          { label: 'Required capacity', value: `${batteryRes.bank.requiredCapacityAh.toFixed(0)} Ah`, accent: true },
          { label: 'Discharge current within limit', value: batteryRes.discharge.withinLimit ? 'Yes' : 'No', warn: !batteryRes.discharge.withinLimit },
          { label: 'Required controller rating', value: `${batteryRes.controller.requiredControllerRatingA} A`, accent: true },
          { label: 'Controller type', value: batteryRes.typeRec.recommendation, sub: true },
        ],
      }],
      notes: [
        ...batteryRes.controller.warnings,
        'Chemistry preset DoD/efficiency/C-rate values are UNVERIFIED-FLAGGED typical guideline figures — verify against the actual battery datasheet.',
      ].join(' '),
    })
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAB 3: GRID-TIE & COMPLIANCE
  // ══════════════════════════════════════════════════════════════════════
  const [arrayDcWp, setArrayDcWp] = useState('')
  const [inverterAcW, setInverterAcW] = useState('5000')

  const gridTieRes = useMemo(() => {
    const dcWp = arrayDcWp !== '' ? pf(arrayDcWp) : arrayRes.requiredWp
    const acW = pf(inverterAcW, 5000)
    const ratio = dcAcRatio(dcWp, acW)
    const recommendedAc = recommendInverterAcRating(dcWp)
    const capacityKva = acW / 1000
    const classification = classifySSEGCategory(capacityKva)
    return { dcWp, ratio, recommendedAc, capacityKva, classification }
  }, [arrayDcWp, inverterAcW, arrayRes])

  const pushHistoryGridTie = () => {
    if (!addHistory) return
    addHistory({
      tab: 'Renewable — Grid-Tie',
      expr: `${gridTieRes.dcWp.toFixed(0)}Wp array · ${inverterAcW}W inverter`,
      result: `Ratio ${gridTieRes.ratio.ratio} · ${gridTieRes.classification.category ? gridTieRes.classification.category.label : 'Above SSEG scope'}`,
    })
  }

  const exportGridTie = () => {
    showCard({
      calculator: 'Renewable Energy — Grid-Tie & Compliance',
      site: site.name,
      standard: 'IEC 61727 (utility interface), NRS 097-2 (South Africa SSEG)',
      inputs: [
        { label: 'Array DC nameplate', value: `${gridTieRes.dcWp.toFixed(0)} Wp` },
        { label: 'Inverter AC rated output', value: `${inverterAcW} W` },
      ],
      sections: [{
        title: 'DC:AC RATIO & CLASSIFICATION',
        rows: [
          { label: 'DC:AC ratio', value: gridTieRes.ratio.ratio, accent: true },
          { label: 'Assessment', value: gridTieRes.ratio.assessment, sub: true },
          { label: 'Recommended inverter AC (1.2 target)', value: `${gridTieRes.recommendedAc.toFixed(0)} W` },
          { label: 'Capacity', value: `${gridTieRes.capacityKva.toFixed(1)} kVA` },
          {
            label: 'NRS 097-2 category',
            value: gridTieRes.classification.category ? gridTieRes.classification.category.label : 'Above SSEG scope',
            accent: !gridTieRes.classification.aboveSseegScope,
            warn: gridTieRes.classification.aboveSseegScope,
          },
        ],
      }],
      notes: 'NRS 097-2 is a South African standard. For Lesotho sites, confirm actual connection/registration requirements directly with the Lesotho Electricity Company (LEC) — no published Lesotho-specific SSEG code was identified. Grid-tied SSEG requires utility registration by law regardless of category.',
    })
  }

  // ══════════════════════════════════════════════════════════════════════
  // TAB 4: HYBRID
  // ══════════════════════════════════════════════════════════════════════
  const [dailySolarLowWh, setDailySolarLowWh] = useState('4000')
  const [bridgeDays, setBridgeDays] = useState('2')
  const [extendedDays, setExtendedDays] = useState('5')

  // Generator — prefilled from GeneratorSizing.jsx's workspace snapshot if
  // available (Generator Sizing tab visited this session), same prefill-only
  // contract as Motor -> Cable FLA: read once as initial state, never
  // force-overwritten afterwards. Falls back to the real configured site
  // (useSite()) if no snapshot exists yet — not a hardcoded location.
  const [genNameplateKva, setGenNameplateKva] = useState(() =>
    workspace.generatorSnapshot ? String(workspace.generatorSnapshot.stdSize) : '50'
  )
  const [genAltitude, setGenAltitude] = useState(() =>
    workspace.generatorSnapshot ? String(workspace.generatorSnapshot.altitudeM) : String(site.altitude || '1000')
  )
  const [genAmbTemp, setGenAmbTemp] = useState(() =>
    workspace.generatorSnapshot ? String(workspace.generatorSnapshot.ambientTempC) : String(site.ambient || '30')
  )
  const [genPFVal, setGenPFVal] = useState(() =>
    workspace.generatorSnapshot ? String(workspace.generatorSnapshot.gpf) : '0.8'
  )
  const [fuelLPerHour, setFuelLPerHour] = useState('')

  const hybridRes = useMemo(() => {
    const dod = pf(dodPct, 50) / 100
    const eff = pf(effPct, 85) / 100
    const V = pf(systemVoltageV, 48)

    const bridge = batteryBridgeSizing({
      dailyLoadWh: pf(dailyLoadWh),
      dailySolarOutputWh: pf(dailySolarLowWh),
      bridgeDays: pf(bridgeDays, 1),
      dodFraction: dod,
      systemVoltageV: V,
      roundTripEfficiency: eff,
    })

    const deficit = generatorEnergyDeficit({
      dailyLoadWh: pf(dailyLoadWh),
      dailySolarOutputWh: pf(dailySolarLowWh),
      batteryUsableCapacityWh: bridge.requiredUsableEnergyWh,
      extendedLowSunDays: pf(extendedDays, pf(bridgeDays, 1)),
    })

    // Migrated to the shared lib function — this used to be a duplicated
    // inline copy of GeneratorSizing.jsx's formula. Both files now import
    // the same src/lib/generatorDerating.js.
    const { altFactor, tempFactor, netFactor } = calculateGeneratorDerating({
      altitudeM: pf(genAltitude, 1600),
      ambientTempC: pf(genAmbTemp, 25),
    })
    const gpf = pf(genPFVal, 0.8)
    const stdSize = nextStd(GEN_SIZES, pf(genNameplateKva, 50))

    const genOutput = generatorOutputFromSizingResult({ stdSize, netFactor, gpf })

    const runtime = generatorRunHoursForEnergy({
      energyWh: deficit.generatorEnergyRequiredWh,
      generatorOutputW: genOutput.deratedOutputW,
      fuelConsumptionLPerHour: fuelLPerHour !== '' ? pf(fuelLPerHour) : undefined,
    })

    const warnings = []
    if (extendedDays !== '' && pf(extendedDays) < pf(bridgeDays)) {
      warnings.push('Extended low-sun design period is shorter than the battery bridge days — increase it, or the generator sizing understates real need.')
    }

    return { bridge, deficit, netFactor, altFactor, tempFactor, genOutput, runtime, warnings }
  }, [dodPct, effPct, systemVoltageV, dailyLoadWh, dailySolarLowWh, bridgeDays, extendedDays,
      genNameplateKva, genAltitude, genAmbTemp, genPFVal, fuelLPerHour])

  const pushHistoryHybrid = () => {
    if (!addHistory) return
    addHistory({
      tab: 'Renewable — Hybrid',
      expr: `${dailyLoadWh}Wh/day · ${bridgeDays}d bridge · ${extendedDays}d design period`,
      result: `Battery ${hybridRes.bridge.requiredCapacityAh}Ah · Gen ${hybridRes.runtime.runHours}h${hybridRes.runtime.fuelRequiredL !== null ? ` · ${hybridRes.runtime.fuelRequiredL}L` : ''}`,
    })
  }

  const exportHybrid = () => {
    showCard({
      calculator: 'Renewable Energy — Hybrid System',
      site: site.name,
      standard: 'General sizing calculation (not a dispatch simulation); generator figures per ISO 8528-1 derating',
      inputs: [
        { label: 'Daily load', value: `${dailyLoadWh} Wh/day` },
        { label: 'Design low-sun day output', value: `${dailySolarLowWh} Wh/day` },
        { label: 'Bridge / design period', value: `${bridgeDays}d bridge, ${extendedDays}d extended` },
        { label: 'Generator', value: `${genNameplateKva} kVA nameplate · ${genAltitude}m · ${genAmbTemp}°C · PF ${genPFVal}` },
      ],
      sections: [{
        title: 'BATTERY BRIDGE & GENERATOR',
        rows: [
          { label: 'Battery bridge capacity', value: `${hybridRes.bridge.requiredCapacityAh.toFixed(0)} Ah`, accent: true },
          { label: 'Generator energy required', value: `${hybridRes.deficit.generatorEnergyRequiredWh} Wh` },
          { label: 'Generator derated output', value: `${hybridRes.genOutput.deratedOutputKVA} kVA (${(hybridRes.netFactor * 100).toFixed(1)}% of nameplate)` },
          { label: 'Generator runtime required', value: Number.isFinite(hybridRes.runtime.runHours) ? `${hybridRes.runtime.runHours} h` : '—', accent: true },
          ...(hybridRes.runtime.fuelRequiredL !== null
            ? [{ label: 'Fuel required', value: `${hybridRes.runtime.fuelRequiredL} L` }]
            : []),
        ],
      }],
      notes: [
        ...hybridRes.warnings,
        'Sizing calculation only — not a dispatch/energy-management simulation. Solar low-sun-day output and generator fuel-consumption rate are site/datasheet inputs, not looked up automatically.',
      ].join(' '),
    })
  }

  // ── Tab definitions ──────────────────────────────────────────────────
  const TABS = [
    { id: 'array', label: 'Array', icon: '☀' },
    { id: 'battery', label: 'Battery', icon: '🔋' },
    { id: 'gridtie', label: 'Grid-Tie', icon: '⚡' },
    { id: 'hybrid', label: 'Hybrid', icon: '⚙' },
  ]

  return (
    <div style={{ padding: '12px', fontFamily: 'sans-serif' }}>
      {/* ── Tab bar ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: '1', padding: '7px 4px', fontSize: '11px', borderRadius: '8px', cursor: 'pointer',
              border: tab === t.id ? `1px solid ${ACCENT}` : '0.5px solid rgba(255,255,255,0.12)',
              background: tab === t.id ? `${ACCENT}1a` : 'rgba(255,255,255,0.04)',
              color: tab === t.id ? ACCENT : 'rgba(255,255,255,0.5)',
              transition: 'all 0.15s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Shared scenario card — visible on every tab, single source of truth */}
      <div style={{ ...S.card, borderColor: `${ACCENT}44` }}>
        <div style={{ ...S.subHead, color: ACCENT }}>Scenario (shared across tabs)</div>
        <div style={S.grid2}>
          <Inp label="Daily load" sub="Wh/day" type="text" inputMode="decimal" value={dailyLoadWh} onChange={(e) => setDailyLoadWh(e.target.value)} />
          <Inp label="System voltage" sub="Vdc" type="text" inputMode="decimal" value={systemVoltageV} onChange={(e) => setSystemVoltageV(e.target.value)} />
        </div>
        <Sel label="Battery chemistry" value={chemistry} onChange={(e) => applyChemistryDefaults(e.target.value)} options={CHEMISTRY_OPTIONS} />
        <div style={S.grid2}>
          <Inp label="Max DoD" sub="% — override if datasheet differs" type="text" inputMode="decimal" value={dodPct} onChange={(e) => setDodPct(e.target.value)} />
          <Inp label="Round-trip efficiency" sub="%" type="text" inputMode="decimal" value={effPct} onChange={(e) => setEffPct(e.target.value)} />
        </div>
        <div style={S.note}>
          DoD/efficiency defaults are typical guideline values for the selected chemistry, not from a specific datasheet — verify against your actual battery spec.
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          TAB: ARRAY & STRINGS
      ════════════════════════════════════════════════════════════ */}
      {tab === 'array' && (
        <div>
          <div style={S.card}>
            <div style={{ ...S.subHead, color: SOLAR_C }}>Panel datasheet</div>
            <div style={S.grid2}>
              <Inp label="Voc (STC)" sub="V" type="text" inputMode="decimal" value={vocStc} onChange={(e) => setVocStc(e.target.value)} />
              <Inp label="Vmp (STC)" sub="V" type="text" inputMode="decimal" value={vmpStc} onChange={(e) => setVmpStc(e.target.value)} />
            </div>
            <div style={S.grid2}>
              <Inp label="Isc (STC)" sub="A" type="text" inputMode="decimal" value={iscStc} onChange={(e) => setIscStc(e.target.value)} />
              <Inp label="NOCT" sub="°C" type="text" inputMode="decimal" value={noct} onChange={(e) => setNoct(e.target.value)} />
            </div>
            <div style={S.grid2}>
              <Inp label="Temp coeff. Voc" sub="%/°C (negative)" type="text" inputMode="decimal" value={tcVoc} onChange={(e) => setTcVoc(e.target.value)} />
              <Inp label="Temp coeff. Vmp" sub="%/°C (negative)" type="text" inputMode="decimal" value={tcVmp} onChange={(e) => setTcVmp(e.target.value)} />
            </div>
            <div style={S.grid2}>
              <Inp label="Temp coeff. Isc" sub="%/°C (positive)" type="text" inputMode="decimal" value={tcIsc} onChange={(e) => setTcIsc(e.target.value)} />
              <Inp label="Panel wattage" sub="Wp" type="text" inputMode="decimal" value={panelW} onChange={(e) => setPanelW(e.target.value)} />
            </div>
          </div>

          <div style={S.card}>
            <div style={{ ...S.subHead, color: SOLAR_C }}>Inverter / charge controller</div>
            <div style={S.grid2}>
              <Inp label="Max DC voltage" sub="V" type="text" inputMode="decimal" value={invMaxDc} onChange={(e) => setInvMaxDc(e.target.value)} />
              <Inp label="MPPT min voltage" sub="V" type="text" inputMode="decimal" value={mpptMin} onChange={(e) => setMpptMin(e.target.value)} />
            </div>
            <Inp label="Max input current" sub="A (per MPPT input)" type="text" inputMode="decimal" value={invMaxA} onChange={(e) => setInvMaxA(e.target.value)} />
          </div>

          <div style={S.card}>
            <div style={{ ...S.subHead, color: SOLAR_C }}>Site design temperatures</div>
            <div style={S.grid2}>
              <Inp label="Design min ambient" sub="°C — use your coldest expected design day, not a regional guess" type="text" inputMode="decimal" value={minTemp} onChange={(e) => setMinTemp(e.target.value)} />
              <Inp label="Design max ambient" sub="°C" type="text" inputMode="decimal" value={maxTemp} onChange={(e) => setMaxTemp(e.target.value)} />
            </div>
            <div style={S.note}>
              Not looked up automatically — enter real site design temperatures (e.g. from local records), not a guessed regional default.
            </div>
          </div>

          <div style={S.card}>
            <div style={{ ...S.subHead, color: SOLAR_C }}>Array sizing from load</div>
            <Inp label="Peak sun hours" sub="h/day, site-specific" type="text" inputMode="decimal" value={peakSunHours} onChange={(e) => setPeakSunHours(e.target.value)} />
            <div style={S.grid2}>
              <Inp label="System derate" sub="% — soiling/wiring/mismatch/inverter, UNVERIFIED guideline" type="text" inputMode="decimal" value={derateFactorPct} onChange={(e) => setDerateFactorPct(e.target.value)} />
              <Inp label="Parallel-string safety factor" sub="% — UNVERIFIED, confirm vs SANS 10142-1" type="text" inputMode="decimal" value={stringSafetyPct} onChange={(e) => setStringSafetyPct(e.target.value)} />
            </div>
          </div>

          <div style={{ ...S.card, borderColor: `${SOLAR_C}44` }}>
            <div style={{ ...S.subHead, color: SOLAR_C }}>String configuration</div>
            <RowVal label="Max panels in series" value={arrayRes.strings.maxPanelsSeries} accent={SOLAR_C} />
            <RowVal label="Min panels in series" value={arrayRes.strings.minPanelsSeries} />
            <RowVal label="Max strings in parallel" value={arrayRes.strings.maxStringsParallel} accent={SOLAR_C} />
            <RowVal label="Worst-case cold Voc" value={`${arrayRes.strings.worstCaseVoc} V`} />
            <RowVal label="Worst-case hot Vmp" value={`${arrayRes.strings.worstCaseVmp} V`} />
            <RowVal label="Worst-case hot cell temp" value={`${arrayRes.strings.worstCaseCellTempC} °C`} />
            <RowVal label="Design current / string" value={`${arrayRes.strings.designCurrentPerString} A`} />

            {arrayRes.strings.warnings.map((w, i) => (
              <div key={i} style={S.warn}>⚠ {w}</div>
            ))}

            <div style={{ ...S.result, background: `${SOLAR_C}1a`, border: `0.5px solid ${SOLAR_C}44` }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Required array power</div>
              <div style={{ fontSize: '28px', fontWeight: '500', color: SOLAR_C, fontFamily: 'monospace' }}>
                {arrayRes.requiredWp.toFixed(0)} Wp
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                ≈ {arrayRes.approxPanels} × {panelW}W panels
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button onClick={pushHistoryArray} style={{ ...btnStyle(SOLAR_C), marginTop: 0, flex: 1 }}>Save to history</button>
              <button onClick={exportArray} style={{ ...btnStyle(SOLAR_C), marginTop: 0, flex: 1, background: `${SOLAR_C}1a` }}>📄 Result / Export</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          TAB: BATTERY & CHARGE CONTROLLER
      ════════════════════════════════════════════════════════════ */}
      {tab === 'battery' && (
        <div>
          <div style={S.card}>
            <div style={{ ...S.subHead, color: BATTERY_C }}>Off-grid demand</div>
            <div style={S.grid2}>
              <Inp label="Autonomy days" sub="days battery covers alone" type="text" inputMode="decimal" value={autonomyDays} onChange={(e) => setAutonomyDays(e.target.value)} />
              <Inp label="Peak load" sub="W — for discharge current check" type="text" inputMode="decimal" value={peakLoadW} onChange={(e) => setPeakLoadW(e.target.value)} />
            </div>
          </div>

          <div style={S.card}>
            <div style={{ ...S.subHead, color: BATTERY_C }}>Battery C-rate limits</div>
            <div style={S.grid2}>
              <Inp label="Max charge C-rate" sub="% of capacity/hour" type="text" inputMode="decimal" value={maxChargeCRatePct} onChange={(e) => setMaxChargeCRatePct(e.target.value)} />
              <Inp label="Max discharge C-rate" sub="% of capacity/hour" type="text" inputMode="decimal" value={maxDischargeCRatePct} onChange={(e) => setMaxDischargeCRatePct(e.target.value)} />
            </div>
            <div style={S.note}>Chemistry-preset defaults — UNVERIFIED against a specific datasheet, override if known.</div>
          </div>

          <div style={S.card}>
            <div style={{ ...S.subHead, color: BATTERY_C }}>Charge controller inputs</div>
            <Inp
              label="Array max current into controller"
              sub={`A — suggested from Array tab: ${suggestedArrayCurrentA} A`}
              type="text" inputMode="decimal" placeholder={String(suggestedArrayCurrentA)}
              value={arrayMaxCurrentA} onChange={(e) => setArrayMaxCurrentA(e.target.value)}
            />
            <Inp
              label="Array Vmp (worst-case hot)"
              sub={`V — suggested from Array tab: ${arrayRes.strings.worstCaseVmp} V`}
              type="text" inputMode="decimal" placeholder={String(arrayRes.strings.worstCaseVmp)}
              value={arrayVmpOverride} onChange={(e) => setArrayVmpOverride(e.target.value)}
            />
            <Inp label="Controller safety factor" sub="% — UNVERIFIED, confirm vs SANS 10142-1" type="text" inputMode="decimal" value={controllerSafetyPct} onChange={(e) => setControllerSafetyPct(e.target.value)} />
          </div>

          <div style={{ ...S.card, borderColor: `${BATTERY_C}44` }}>
            <div style={{ ...S.subHead, color: BATTERY_C }}>Battery bank</div>
            <RowVal label="Required capacity" value={`${batteryRes.bank.requiredCapacityWh.toFixed(0)} Wh`} />
            <RowVal label="Required capacity" value={`${batteryRes.bank.requiredCapacityAh.toFixed(0)} Ah`} accent={BATTERY_C} />

            <div style={{ ...S.subHead, color: BATTERY_C, marginTop: '10px' }}>Discharge current check</div>
            <RowVal label="Load current" value={`${batteryRes.discharge.loadCurrentA} A`} />
            <RowVal label="Battery max discharge current" value={`${batteryRes.discharge.batteryMaxDischargeCurrentA} A`} />
            <RowVal label="Within limit?" value={batteryRes.discharge.withinLimit ? 'Yes' : 'No'} accent={batteryRes.discharge.withinLimit ? BATTERY_C : RED} />

            <div style={{ ...S.subHead, color: BATTERY_C, marginTop: '10px' }}>Charge controller</div>
            <RowVal label="Required controller rating" value={`${batteryRes.controller.requiredControllerRatingA} A`} accent={BATTERY_C} />
            <RowVal label="Battery max charge current" value={`${batteryRes.controller.batteryMaxChargeCurrentA} A`} />
            {batteryRes.controller.warnings.map((w, i) => (<div key={i} style={S.warn}>⚠ {w}</div>))}

            <div style={{ ...S.subHead, color: BATTERY_C, marginTop: '10px' }}>Controller type</div>
            <div style={S.note}>{batteryRes.typeRec.recommendation} (Vmp:Vbank ratio {batteryRes.typeRec.ratio})</div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button onClick={pushHistoryBattery} style={{ ...btnStyle(BATTERY_C), marginTop: 0, flex: 1 }}>Save to history</button>
              <button onClick={exportBattery} style={{ ...btnStyle(BATTERY_C), marginTop: 0, flex: 1, background: `${BATTERY_C}1a` }}>📄 Result / Export</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          TAB: GRID-TIE & COMPLIANCE
      ════════════════════════════════════════════════════════════ */}
      {tab === 'gridtie' && (
        <div>
          <div style={S.card}>
            <div style={{ ...S.subHead, color: GRID_C }}>Sizing inputs</div>
            <Inp
              label="Array DC nameplate"
              sub={`Wp — suggested from Array tab: ${arrayRes.requiredWp.toFixed(0)} Wp`}
              type="text" inputMode="decimal" placeholder={arrayRes.requiredWp.toFixed(0)}
              value={arrayDcWp} onChange={(e) => setArrayDcWp(e.target.value)}
            />
            <Inp label="Inverter AC rated output" sub="W" type="text" inputMode="decimal" value={inverterAcW} onChange={(e) => setInverterAcW(e.target.value)} />
          </div>

          <div style={{ ...S.card, borderColor: `${GRID_C}44` }}>
            <div style={{ ...S.subHead, color: GRID_C }}>DC:AC ratio</div>
            <RowVal label="Ratio" value={gridTieRes.ratio.ratio} accent={GRID_C} />
            <div style={S.note}>{gridTieRes.ratio.assessment}</div>
            <RowVal label="Recommended inverter AC (1.2 target ratio)" value={`${gridTieRes.recommendedAc.toFixed(0)} W`} />
          </div>

          <div style={{ ...S.card, borderColor: `${GRID_C}44` }}>
            <div style={{ ...S.subHead, color: GRID_C }}>NRS 097-2 classification (South Africa)</div>
            <RowVal label="Capacity" value={`${gridTieRes.capacityKva.toFixed(1)} kVA`} />
            <RowVal
              label="Category"
              value={gridTieRes.classification.category ? gridTieRes.classification.category.label : 'Above SSEG scope'}
              accent={gridTieRes.classification.aboveSseegScope ? RED : GRID_C}
            />
            {gridTieRes.classification.notes.map((n, i) => (<div key={i} style={S.note}>{n}</div>))}
          </div>

          <div style={{ ...S.card, borderColor: `${GRID_C}44` }}>
            <div style={{ ...S.subHead, color: GRID_C }}>Compliance checklist</div>
            {GRID_TIE_COMPLIANCE_CHECKLIST.map((item) => (
              <div key={item.id} style={{ marginBottom: '10px', paddingBottom: '8px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: '12px', fontWeight: '500', color: item.id === 'jurisdiction-check' ? RED : '#fff' }}>
                  {item.id === 'jurisdiction-check' ? '⚠ ' : ''}{item.topic}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>{item.requirement}</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{item.reference}</div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button onClick={pushHistoryGridTie} style={{ ...btnStyle(GRID_C), marginTop: 0, flex: 1 }}>Save to history</button>
              <button onClick={exportGridTie} style={{ ...btnStyle(GRID_C), marginTop: 0, flex: 1, background: `${GRID_C}1a` }}>📄 Result / Export</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          TAB: HYBRID
      ════════════════════════════════════════════════════════════ */}
      {tab === 'hybrid' && (
        <div>
          <div style={S.card}>
            <div style={{ ...S.subHead, color: HYBRID_C }}>Low-sun design scenario</div>
            <Inp label="Solar output on a design low-sun day" sub="Wh/day — real site figure, not guessed" type="text" inputMode="decimal" value={dailySolarLowWh} onChange={(e) => setDailySolarLowWh(e.target.value)} />
            <div style={S.grid2}>
              <Inp label="Battery bridge days" sub="days battery alone should cover" type="text" inputMode="decimal" value={bridgeDays} onChange={(e) => setBridgeDays(e.target.value)} />
              <Inp label="Extended design period" sub="days, >= bridge days" type="text" inputMode="decimal" value={extendedDays} onChange={(e) => setExtendedDays(e.target.value)} />
            </div>
          </div>

          <div style={S.card}>
            <div style={{ ...S.subHead, color: HYBRID_C }}>Generator</div>
            {workspace.generatorSnapshot ? (
              <div style={{ ...S.note, background: `${HYBRID_C}14`, border: `0.5px solid ${HYBRID_C}44`, color: HYBRID_C }}>
                ✓ Prefilled from Generator Sizing ({workspace.generatorSnapshot.stdSize} kVA @ {workspace.generatorSnapshot.altitudeM}m, {workspace.generatorSnapshot.ambientTempC}°C). Edit freely below — this won't be overwritten.
              </div>
            ) : (
              <div style={S.note}>
                No Generator Sizing result found yet this session — visit Power Systems › Generator Sizing, tap "Save to history" there, then come back here to prefill these. Or enter manually below.
              </div>
            )}
            <div style={S.grid2}>
              <Inp label="Nameplate size" sub="kVA — nearest standard size used" type="text" inputMode="decimal" value={genNameplateKva} onChange={(e) => setGenNameplateKva(e.target.value)} />
              <Inp label="Generator PF" sub="typically 0.8" type="text" inputMode="decimal" value={genPFVal} onChange={(e) => setGenPFVal(e.target.value)} />
            </div>
            <div style={S.grid2}>
              <Inp label="Altitude" sub="m AMSL — uses your configured site altitude by default" type="text" inputMode="decimal" value={genAltitude} onChange={(e) => setGenAltitude(e.target.value)} />
              <Inp label="Ambient temp" sub="°C" type="text" inputMode="decimal" value={genAmbTemp} onChange={(e) => setGenAmbTemp(e.target.value)} />
            </div>
            <Inp label="Fuel consumption at this load" sub="L/hour, optional — from genset datasheet" type="text" inputMode="decimal" value={fuelLPerHour} onChange={(e) => setFuelLPerHour(e.target.value)} />
          </div>

          <div style={{ ...S.card, borderColor: `${HYBRID_C}44` }}>
            <div style={{ ...S.subHead, color: HYBRID_C }}>Battery bridge</div>
            <RowVal label="Daily deficit (load - solar)" value={`${hybridRes.bridge.dailyDeficitWh} Wh`} />
            <RowVal label="Bridge capacity" value={`${hybridRes.bridge.requiredCapacityAh.toFixed(0)} Ah`} accent={HYBRID_C} />

            <div style={{ ...S.subHead, color: HYBRID_C, marginTop: '10px' }}>Generator deficit</div>
            <RowVal label="Total deficit over design period" value={`${hybridRes.deficit.totalDeficitWh} Wh`} />
            <RowVal label="Generator energy required" value={`${hybridRes.deficit.generatorEnergyRequiredWh} Wh`} accent={HYBRID_C} />
            <RowVal label="Days battery alone can bridge" value={hybridRes.deficit.daysBatteryCanBridgeAlone} />

            <div style={{ ...S.subHead, color: HYBRID_C, marginTop: '10px' }}>Generator output (derated for site)</div>
            <RowVal label="Nameplate" value={`${hybridRes.genOutput.nameplateKVA} kVA`} />
            <RowVal label="Derated at site conditions" value={`${hybridRes.genOutput.deratedOutputKVA} kVA`} accent={HYBRID_C} />
            <RowVal label="Derate factor" value={`${(hybridRes.netFactor * 100).toFixed(1)}%`} />

            {hybridRes.warnings.map((w, i) => (<div key={i} style={S.warn}>⚠ {w}</div>))}
            {hybridRes.runtime.runHours !== undefined && !Number.isFinite(hybridRes.runtime.runHours) && (
              <div style={S.warn}>⚠ Generator energy deficit is zero or negative for this scenario — check inputs (battery bridge may already cover the full design period).</div>
            )}

            <div style={{ ...S.result, background: `${HYBRID_C}1a`, border: `0.5px solid ${HYBRID_C}44` }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>Generator runtime required</div>
              <div style={{ fontSize: '28px', fontWeight: '500', color: HYBRID_C, fontFamily: 'monospace' }}>
                {Number.isFinite(hybridRes.runtime.runHours) ? hybridRes.runtime.runHours : '—'} h
              </div>
              {hybridRes.runtime.fuelRequiredL !== null && (
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>≈ {hybridRes.runtime.fuelRequiredL} L fuel</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button onClick={pushHistoryHybrid} style={{ ...btnStyle(HYBRID_C), marginTop: 0, flex: 1 }}>Save to history</button>
              <button onClick={exportHybrid} style={{ ...btnStyle(HYBRID_C), marginTop: 0, flex: 1, background: `${HYBRID_C}1a` }}>📄 Result / Export</button>
            </div>
          </div>
        </div>
      )}

      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}

function btnStyle(color) {
  return {
    marginTop: '10px', width: '100%', padding: '7px',
    borderRadius: '8px', border: `0.5px solid ${color}`,
    background: 'transparent', color, cursor: 'pointer', fontSize: '12px',
  }
}

function round2(n) {
  return Math.round(n * 100) / 100
}
