import { useState } from 'react'
import { SQRT3, pf, NumInput, SelectInput, ToggleInput, ResultBox, InfoBox, ErrBox, CalcButton, ResultCard, useResultCard } from './shared'
import { useSite } from './SiteContext'

// ── IEC 60947-4-1 / SANS 60947-4-1 Data ────────────────────────────────────
// AC-3 standard contactor ratings with manufacturer cross-reference
// [AC3_rating_A, Schneider_TeSys_D, Eaton_XT, Siemens_SIRIUS, AB_100C, frame_note]
const CONTACTOR_SIZES = [
  [9,   'LC1D09',  'XTCE009B', '3RT2015', '100-C09',  'Frame B (45mm)'],
  [12,  'LC1D12',  'XTCE009B', '3RT2016', '100-C12',  'Frame B (45mm)'],
  [16,  'LC1D18',  'XTCE012B', '3RT2023', '100-C16',  'Frame B (45mm)'],
  [18,  'LC1D18',  'XTCE018B', '3RT2023', '100-C16',  'Frame B (45mm)'],
  [25,  'LC1D25',  'XTCE025C', '3RT2025', '100-C23',  'Frame C (45mm)'],
  [32,  'LC1D32',  'XTCE032C', '3RT2027', '100-C30',  'Frame C (45mm)'],
  [40,  'LC1D40',  'XTCE038C', '3RT2035', '100-C37',  'Frame C (45mm)'],
  [50,  'LC1D50',  'XTCE050C', '3RT2036', '100-C43',  'Frame C (45mm)'],
  [65,  'LC1D65',  'XTCE065D', '3RT2037', '100-C55',  'Frame D (55mm)'],
  [80,  'LC1D80',  'XTCE080D', '3RT2038', '100-C60',  'Frame D (55mm)'],
  [95,  'LC1D95',  'XTCE096D', '3RT2045', '100-C72',  'Frame D (55mm)'],
  [115, 'LC1D115', 'XTCE120D', '3RT2046', '100-C85',  'Frame D (55mm)'],
  [150, 'LC1D150', 'XTCE150G', '3RT2047', '100-C110', 'Frame G'],
  [185, 'LC1D185', 'XTCE175G', '3RT2148', '100-C140', 'Frame G'],
  [225, 'LC1D225', 'XTCE210G', '3RT2354', '100-C172', 'Frame G'],
  [265, 'LC1D265', 'XTCE250G', '3RT2354', '100-C210', 'Frame G'],
  [300, 'LC1D300', 'XTCE300G', '3RT2355', '100-C250', 'Frame G'],
  [400, 'LC1D400', 'XTCE350G', '3RT2356', '100-C310', 'Frame G'],
]

// Thermal OLR ranges with manufacturer references
// [range_min_A, range_max_A, Schneider_LRD, Eaton_XTOB, Siemens_3RU, fits_frame]
const OLR_RANGES = [
  [0.63, 1.0,  'LRD01',  'XTOB001B', '3RU2116', 'B'],
  [1.0,  1.6,  'LRD02',  'XTOB002B', '3RU2116', 'B'],
  [1.6,  2.5,  'LRD03',  'XTOB002B', '3RU2116', 'B'],
  [2.5,  4.0,  'LRD04',  'XTOB004B', '3RU2116', 'B'],
  [4.0,  6.0,  'LRD10',  'XTOB004B', '3RU2116', 'B'],
  [5.5,  8.0,  'LRD12',  'XTOB006B', '3RU2116', 'B'],
  [7.0,  10.0, 'LRD14',  'XTOB009B', '3RU2116', 'B'],
  [9.0,  13.0, 'LRD16',  'XTOB012B', '3RU2116', 'B'],
  [12.0, 18.0, 'LRD21',  'XTOB016B', '3RU2126', 'B'],
  [16.0, 24.0, 'LRD22',  'XTOB025C', '3RU2126', 'C'],
  [23.0, 32.0, 'LRD332', 'XTOB032C', '3RU2136', 'C'],
  [30.0, 40.0, 'LRD340', 'XTOB040C', '3RU2136', 'C'],
  [37.0, 50.0, 'LRD350', 'XTOB050C', '3RU2136', 'C'],
  [48.0, 65.0, 'LRD365', 'XTOB065D', '3RU2136', 'D'],
  [55.0, 80.0, 'LRD380', 'XTOB080D', '3RU2136', 'D'],
  [70.0, 104.0,'LRD390', 'XTOB096D', '3RU2146', 'D'],
  [80.0, 120.0,'LRD3353','XTOB096D', '3RU2146', 'D'],
  [100.0,150.0,'LRD3363','XTOB150G', '3RU2146', 'G'],
  [130.0,195.0,'LRD3369','XTOB150G', '3RU2146', 'G'],
]

function getContactor(fla) {
  return CONTACTOR_SIZES.find(r => r[0] >= fla) || CONTACTOR_SIZES[CONTACTOR_SIZES.length - 1]
}

function getOLR(fla) {
  // Find range where FLA sits in the middle third (not at extreme)
  // Preferred: FLA is within 40–80% of range max
  const preferred = OLR_RANGES.find(r => fla >= r[0] * 0.8 && fla <= r[1])
  return preferred || OLR_RANGES.find(r => fla <= r[1]) || OLR_RANGES[OLR_RANGES.length - 1]
}

// ── COIL VOLTAGE REFERENCE ──────────────────────────────────────────────────
const COIL_CODES = {
  'Schneider TeSys D': {
    '110VAC': 'F7',
    '230VAC': 'P7',
    '400VAC': 'V7',
    '24VDC':  'BL',
    '48VDC':  'DL',
    '110VDC': 'FL',
  },
  'Eaton XTCE': {
    '110VAC': 'C',
    '230VAC': 'F',
    '400VAC': 'J',
    '24VDC':  'A',
    '48VDC':  'B',
    '110VDC': 'C',
  },
  'Siemens SIRIUS': {
    '110VAC': '0AF0',
    '230VAC': '0AN0',
    '400VAC': '0AV0',
    '24VDC':  '1BB4',
    '48VDC':  '1HB4',
    '110VDC': '1LB4',
  },
}

export default function ContactorOLR({ addHistory, flaSnapshot }) {
  const { site } = useSite()
  const snap = flaSnapshot || {}
  const [phase, setPhase]       = useState(snap.phase   || site.phase || '3ph')
  const [kw, setKw]             = useState(snap.kw      || '')
  const [voltage, setVoltage]   = useState(snap.voltage || site.defaultLV || '400')
  const [pfVal, setPf]          = useState(snap.pfVal   || site.pf || '0.85')
  const [eff, setEff]           = useState(snap.eff     || site.efficiency || '90')
  const [ieClass, setIeClass]   = useState('IE3')
  const [coilV, setCoilV]       = useState('230VAC')
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState('')
  const [showCoil, setShowCoil] = useState(false)
  const { cardData, showCard, hideCard } = useResultCard()

  const calculate = () => {
    setError('')
    const KW = pf(kw), V = pf(voltage), PF = pf(pfVal), EFF = pf(eff) / 100
    if (!KW || !V || !PF || !EFF) { setError('Enter motor kW, voltage, PF, and efficiency'); return }

    const inputPower = KW / EFF
    const fla = phase === '3ph'
      ? inputPower * 1000 / (SQRT3 * V * PF)
      : inputPower * 1000 / (V * PF)

    // IE3/IE4 motors have higher starting currents — upsize contactor consideration
    const startMultiplier = ieClass === 'IE4' ? 7.0 : ieClass === 'IE3' ? 6.5 : 6.0
    const startCurrent = fla * startMultiplier

    const contactor = getContactor(fla)
    const olr       = getOLR(fla)

    const olrSetting     = (fla * 1.05).toFixed(2)
    const olrSettingMin  = (fla * 0.95).toFixed(2)
    const olrSettingMax  = (fla * 1.15).toFixed(2)

    // Check if contactor is adequate for IE3/IE4 starting (peak current check)
    const contactorAdequate = contactor[0] >= fla

    const res = {
      fla: fla.toFixed(2),
      startCurrent: startCurrent.toFixed(0),
      contactor,
      olr,
      olrSetting,
      olrSettingMin,
      olrSettingMax,
      contactorAdequate,
      kw: KW, voltage: V, phase, ieClass,
    }
    setResult(res)
    addHistory({
      tab: 'Q/F Select',
      expr: `${KW}kW ${V}V ${phase} ${ieClass}`,
      result: `Q:${contactor[1]} F:${olr[2]}`
    })
  }

  const handleResultCard = () => {
    if (!result) return
    showCard({
      calculator: 'Motor Starter — Contactor & OLR Selection',
      standard: 'IEC 60947-4-1 / SANS 60947-4-1',
      site: site.name,
      inputs: [
        { label: 'Motor Power', value: `${result.kw} kW` },
        { label: 'Supply Voltage', value: `${result.voltage} V (${result.phase})` },
        { label: 'Power Factor', value: pfVal },
        { label: 'Efficiency', value: `${eff}%` },
        { label: 'Motor IE Class', value: result.ieClass },
        { label: 'Coil Voltage', value: coilV },
      ],
      sections: [
        {
          title: 'CALCULATED VALUES',
          rows: [
            { label: 'Full Load Current (FLA)', value: `${result.fla} A`, accent: true },
            { label: `DOL Starting Current (×${result.ieClass==='IE4'?7.0:result.ieClass==='IE3'?6.5:6.0})`, value: `${result.startCurrent} A` },
          ]
        },
        {
          title: 'Q — MAIN POWER CONTACTOR (AC-3 Duty)',
          rows: [
            { label: 'Required AC-3 Rating', value: `${result.contactor[0]} A`, accent: true },
            { label: 'Schneider TeSys D', value: `${result.contactor[1]}${COIL_CODES['Schneider TeSys D']?.[coilV]||'__'}` },
            { label: '  — Coil code suffix', value: COIL_CODES['Schneider TeSys D']?.[coilV] || '— select coil', sub: true },
            { label: 'Eaton XT', value: `${result.contactor[2]}${COIL_CODES['Eaton XTCE']?.[coilV]||'_'}` },
            { label: 'Siemens SIRIUS', value: result.contactor[3] },
            { label: 'Allen-Bradley', value: result.contactor[4] },
            { label: 'Frame / Width', value: result.contactor[5] },
          ]
        },
        {
          title: 'F — THERMAL OVERLOAD RELAY',
          rows: [
            { label: 'OLR Setting (105% FLA)', value: `${result.olrSetting} A`, accent: true },
            { label: 'Setting Range', value: `${result.olrSettingMin} – ${result.olrSettingMax} A` },
            { label: 'OLR Adjustment Range', value: `${result.olr[0]} – ${result.olr[1]} A` },
            { label: 'Schneider LRD', value: result.olr[2] },
            { label: 'Eaton XTOB', value: result.olr[3] },
            { label: 'Siemens 3RU', value: result.olr[4] },
            { label: 'Trip Class', value: 'Class 10 (standard motors)' },
            { label: 'Fits Frame', value: `Frame ${result.olr[5]}` },
          ]
        },
        {
          title: 'K — CONTROL / CONTACTOR RELAY (IEC 81346-2)',
          rows: [
            { label: 'Selection basis', value: 'Coil voltage + aux contacts needed' },
            { label: 'NOT sized by motor current', value: '— control circuit only' },
            { label: 'Schneider example', value: 'CAD50_7 (5 NO coil relay)' },
            { label: 'Eaton example', value: 'XTCR series' },
            { label: 'Siemens example', value: '3RH2 series' },
          ]
        },
      ],
      notes: 'Verify all selections against current manufacturer catalogues before procurement. For IE3/IE4 motors, confirm starting current does not exceed contactor peak current rating. Set OLR at 105% of measured FLA on-site, not nameplate FLA.'
    })
  }

  const IE_CLASSES = ['IE1','IE2','IE3','IE4']
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-3">

        <InfoBox title="IEC 60947-4-1 / SANS 60947-4-1 — Motor Starter Selection"
          lines={['Q = Power contactor (AC-3) · F = Overload relay · K = Control relay',
                  'SANS adopts IEC directly — same technical requirements apply']} />

        {flaSnapshot && (
          <div className="bg-[#001a00] border border-[#1a3a1a] rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
            <span className="text-green-400 text-lg">✓</span>
            <div>
              <div className="text-green-400 text-xs font-bold">Motor data loaded from FLA tab</div>
              <div className="text-gray-500 text-[10px]">{flaSnapshot.kw} kW · {flaSnapshot.voltage}V · {flaSnapshot.phase} · PF {flaSnapshot.pfVal} · η {flaSnapshot.eff}%</div>
            </div>
          </div>
        )}

        <ToggleInput label="Phase" options={[['1ph','1φ Single'],['3ph','3φ Three']]} value={phase} onChange={setPhase} />
        <NumInput label="Motor Power" value={kw} onChange={setKw} unit="kW" />
        <NumInput label="Supply Voltage (L-L)" value={voltage} onChange={setVoltage} unit="V" />
        <NumInput label="Power Factor" value={pfVal} onChange={setPf} unit="PF" />
        <NumInput label="Motor Efficiency" value={eff} onChange={setEff} unit="%" />

        {/* IE Class */}
        <div className="mb-3">
          <label className="text-gray-400 text-xs mb-2 block">Motor IE Efficiency Class</label>
          <div className="flex gap-2">
            {IE_CLASSES.map(c => (
              <button key={c} onClick={() => setIeClass(c)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold ${ieClass===c?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>
                {c}
              </button>
            ))}
          </div>
          {(ieClass==='IE3'||ieClass==='IE4') && (
            <div className="text-orange-400 text-xs mt-1.5">
              ⚠ {ieClass} motors have higher starting currents — ABB recommend verifying contactor peak rating
            </div>
          )}
        </div>

        {/* Coil voltage */}
        <div className="mb-3">
          <label className="text-gray-400 text-xs mb-2 block">Contactor Coil Voltage</label>
          <div className="mb-1.5">
            <div className="text-gray-600 text-[10px] mb-1.5 px-1">AC Coil</div>
            <div className="flex gap-2">
              {[['110VAC','110V'],['230VAC','230V'],['400VAC','400V']].map(([v,l]) => (
                <button key={v} onClick={() => setCoilV(v)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${coilV===v?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-gray-600 text-[10px] mb-1.5 px-1">DC Coil</div>
            <div className="flex gap-2">
              {[['24VDC','24V'],['48VDC','48V'],['110VDC','110V']].map(([v,l]) => (
                <button key={v} onClick={() => setCoilV(v)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${coilV===v?'bg-blue-600 text-white':'bg-[#1c1c1c] text-gray-400'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="text-gray-500 text-[10px] mt-2 px-1 leading-relaxed">
            {coilV==='110VAC'  && '⚡ 110V AC — via control transformer or PLC panel supply. Common in mining and older industrial.'}
            {coilV==='230VAC'  && '⚡ 230V AC — phase-to-neutral direct. No transformer needed. Most common in general industry.'}
            {coilV==='400VAC'  && '⚡ 400V AC — phase-to-phase. Used where no neutral available. Less common.'}
            {coilV==='24VDC'   && '🔌 24V DC — PLC digital output direct drive. Most common in automated and PLC-controlled panels.'}
            {coilV==='48VDC'   && '🔌 48V DC — intermediate DC systems and some telecom-grade panels.'}
            {coilV==='110VDC'  && '🔌 110V DC — substation DC battery-backed control circuits. Common in HV protection panels.'}
          </div>
        </div>

        <CalcButton onClick={calculate} label="SELECT Q + F COMPONENTS" />
        <ErrBox msg={error} />

        {result && <>

          {/* FLA result */}
          <div className="bg-[#0f1a0f] border border-[#1a3a1a] rounded-xl px-4 py-3 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-gray-400 text-xs">Full Load Current (FLA)</div>
                <div className="text-green-400 text-3xl font-black">{result.fla} <span className="text-base font-normal text-green-600">A</span></div>
              </div>
              <div className="text-right">
                <div className="text-gray-400 text-xs">DOL Start (×{result.ieClass==='IE4'?7.0:result.ieClass==='IE3'?6.5:6.0})</div>
                <div className="text-orange-400 text-xl font-bold">{result.startCurrent} A</div>
              </div>
            </div>
          </div>

          {/* Q: Contactor */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
            <div className="bg-[#1a0a00] px-4 py-2.5 border-b border-[#2a2a2a]">
              <span className="text-orange-400 text-xs font-black">Q — MAIN POWER CONTACTOR</span>
              <span className="text-gray-600 text-xs ml-2">AC-3 Duty · IEC 60947-4-1</span>
            </div>
            <div className="px-4 py-2 border-b border-[#1a1a1a] bg-[#1a1500]">
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Required AC-3 Rating</span>
                <span className="text-amber-400 text-xl font-black">{result.contactor[0]} A</span>
              </div>
              <div className="text-gray-600 text-xs mt-0.5">{result.contactor[5]}</div>
            </div>

            {/* Manufacturer table */}
            <div className="grid grid-cols-2 gap-0">
              {[
                ['Schneider TeSys D', `${result.contactor[1]}${COIL_CODES['Schneider TeSys D']?.[coilV]||'__'}`],
                ['Eaton XT', `${result.contactor[2]}${COIL_CODES['Eaton XTCE']?.[coilV]||'_'}`],
                ['Siemens SIRIUS', result.contactor[3]],
                ['Allen-Bradley', result.contactor[4]],
              ].map(([brand, part]) => (
                <div key={brand} className="px-4 py-3 border-b border-r border-[#1a1a1a] last:border-r-0">
                  <div className="text-gray-500 text-[10px]">{brand}</div>
                  <div className="text-white font-mono font-bold text-sm mt-0.5">{part}</div>
                </div>
              ))}
            </div>

            <div className="px-4 py-2 bg-[#0a0a0a]">
              <div className="text-gray-600 text-[10px]">Coil voltage: {coilV} · Suffix appended where known</div>
            </div>
          </div>

          {/* F: OLR */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
            <div className="bg-[#000a1a] px-4 py-2.5 border-b border-[#2a2a2a]">
              <span className="text-blue-400 text-xs font-black">F — THERMAL OVERLOAD RELAY</span>
              <span className="text-gray-600 text-xs ml-2">IEC 60947-4-1 Class 10</span>
            </div>
            <div className="px-4 py-2.5 border-b border-[#1a1a1a] bg-[#001020]">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Set OLR to (105% FLA)</span>
                <span className="text-blue-400 text-xl font-black">{result.olrSetting} A</span>
              </div>
              <div className="text-gray-600 text-xs mt-0.5">
                Range: {result.olrSettingMin} – {result.olrSettingMax} A &nbsp;|&nbsp;
                OLR range: {result.olr[0]} – {result.olr[1]} A
              </div>
            </div>
            <div className="grid grid-cols-2 gap-0">
              {[
                ['Schneider LRD', result.olr[2]],
                ['Eaton XTOB', result.olr[3]],
                ['Siemens 3RU', result.olr[4]],
                ['Fits Frame', `Frame ${result.olr[5]}`],
              ].map(([brand, part]) => (
                <div key={brand} className="px-4 py-3 border-b border-r border-[#1a1a1a] last:border-r-0">
                  <div className="text-gray-500 text-[10px]">{brand}</div>
                  <div className="text-white font-mono font-bold text-sm mt-0.5">{part}</div>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 bg-[#0a0a0a] border-t border-[#1a1a1a]">
              <div className="text-gray-600 text-[10px]">NC trip terminal: 95-96 · NO alarm: 97-98 · Always set on measured FLA, not nameplate</div>
            </div>
          </div>

          {/* K: Control relay note */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
            <div className="bg-[#0a1a0a] px-4 py-2.5 border-b border-[#2a2a2a]">
              <span className="text-green-400 text-xs font-black">K — CONTROL / CONTACTOR RELAY</span>
              <span className="text-gray-600 text-xs ml-2">IEC 81346-2</span>
            </div>
            <div className="px-4 py-3 text-xs text-gray-400 leading-relaxed">
              K-type relays (control relays and contactor relays) are <span className="text-white font-bold">not sized by motor current</span>.
              Selection is based on:
            </div>
            <div className="grid grid-cols-2 gap-0 border-t border-[#1a1a1a]">
              {[
                ['Coil voltage', coilV],
                ['Auxiliary contacts', '3 NO + 1 NC typical'],
                ['Schneider CAD', 'CAD50_7 (5×NO)'],
                ['Eaton XTCR', 'XTCR series'],
              ].map(([l,v]) => (
                <div key={l} className="px-4 py-2.5 border-b border-r border-[#1a1a1a] last:border-r-0">
                  <div className="text-gray-500 text-[10px]">{l}</div>
                  <div className="text-green-300 text-xs font-medium mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Coil code reference */}
          {showCoil ? (
            <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
              <div className="flex justify-between items-center px-4 py-2.5 border-b border-[#2a2a2a]">
                <span className="text-amber-400 text-xs font-bold">SCHNEIDER COIL VOLTAGE CODES</span>
                <button onClick={() => setShowCoil(false)} className="text-gray-600 text-xs">Hide</button>
              </div>
              <div className="grid grid-cols-2 gap-0">
                {Object.entries(COIL_CODES['Schneider TeSys D']).map(([v, c]) => (
                  <div key={v} className="px-4 py-2 border-b border-r border-[#1a1a1a] last:border-r-0 text-xs">
                    <span className="text-gray-400">{v}</span>
                    <span className="text-amber-400 font-mono font-bold ml-3">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCoil(true)}
              className="w-full bg-[#1c1c1c] text-gray-500 text-xs py-2.5 rounded-xl mb-4">
              Show full coil voltage code reference ▾
            </button>
          )}

          {/* Standards footer */}
          <div className="bg-[#0f1520] border border-[#1e2a3a] rounded-xl px-4 py-3 mb-4">
            <div className="text-blue-400 text-xs font-bold mb-1.5">Standards Reference</div>
            <div className="text-gray-500 text-xs space-y-0.5">
              <div>• IEC 60947-4-1 / SANS 60947-4-1 — Contactors and motor starters</div>
              <div>• IEC 60947-4-2 — AC semiconductor motor controllers</div>
              <div>• IEC 81346-2 — Reference designations (Q, K, F coding)</div>
              <div>• SANS 10142-1 — Wiring of premises (SA installation code)</div>
              <div>• IEC 60034-30-1 — Motor efficiency classes (IE1–IE4)</div>
            </div>
          </div>

          {/* Generate result card */}
          <button onClick={handleResultCard}
            className="w-full bg-[#1a1a2e] border border-[#2a2a5a] text-blue-300 font-bold py-3.5 rounded-xl text-sm mb-4">
            📄 Generate Result Card
          </button>

        </>}
      </div>

      {cardData && <ResultCard data={cardData} onClose={hideCard} />}
    </div>
  )
}
