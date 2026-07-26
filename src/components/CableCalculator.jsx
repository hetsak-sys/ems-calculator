import { useState } from 'react'
import { pf, NumInput, SelectInput, ToggleInput, ResultBox, InfoBox, ErrBox, CalcButton, SubTabBar, UnitNumInput, VOLTAGE_UNITS } from './shared'
import { useSite } from './SiteContext'
import { useWorkspace } from './WorkspaceContext'
import {
  CABLE_DATA, AMBIENT, GROUP, INSTALL,
  cableSizing, cableVoltageDropDetailed, cableShortCircuitCurrent,
  trailingCableSizing,
  CONDUIT_SIZES, CABLE_OD, conduitFill,
  GLAND_SIZES, CABLE_OD_TABLE, glandSelection,
  scheduleAutoSize, vfdCableSizing,
  GROUND_TEMP_FACTOR, SOIL_RESISTIVITY_FACTOR, SOIL_NATURE_FACTOR, DEPTH_FACTOR_DIRECT, CLEARANCE_OPTIONS,
  directBuriedSizing, ductDerating, routeFaultLevel,
} from './cableEngine'

function CableSizing({ addHistory }) {
  const { site } = useSite()
  const { flaSnapshot } = useWorkspace()
  const [phase,setPhase]=useState(flaSnapshot?.phase||site.phase||'3ph'),[current,setCurrent]=useState(flaSnapshot?.fla||''),[length,setLength]=useState('')
  const [voltage,setVoltage]=useState(site.defaultLV||'400'),[insul,setInsul]=useState(site.insulation||'PVC'),[material,setMat]=useState(site.material||'Cu')
  const [ambient,setAmbient]=useState(site.ambient||'30'),[groups,setGroups]=useState('1'),[install,setInstall]=useState('Clipped direct')
  const [maxVd,setMaxVd]=useState(site.maxVd||'3'),[results,setResults]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    setResults(null)
    const r = cableSizing({ phase, current, length, voltage, insul, material, ambient, groups, install, maxVd })
    if (r.error) { setError(r.error); return }
    const allResults = r.allResults.map(x => ({ size: x.size, derated: x.derated.toFixed(1), vdV: x.vdV.toFixed(2), vdPct: x.vdPct.toFixed(2), currentOK: x.currentOK, vdOK: x.vdOK, pass: x.pass }))
    if(!r.recommended)setError('No single size meets criteria — consider parallel cables')
    setResults({recommended: r.recommended, allResults, derating:(r.derating*100).toFixed(1), required:r.required.toFixed(1)})
    if(r.recommended)addHistory({tab:'Cable',expr:`${pf(current)}A ${pf(length)}m ${phase}`,result:`${r.recommended}mm²`})
  }

  return(
    <div className="px-4 py-3">
      {flaSnapshot && (
        <div className="bg-[#001a00] border border-[#1a3a1a] rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
          <span className="text-green-400 text-lg">✓</span>
          <div>
            <div className="text-green-400 text-xs font-bold">FLA loaded from Motor tab</div>
            <div className="text-gray-500 text-[10px]">{flaSnapshot.fla} A · {flaSnapshot.kw} kW · {flaSnapshot.voltage}V · {flaSnapshot.phase}</div>
          </div>
        </div>
      )}
      <ToggleInput label="Phase" options={[['1ph','1φ Single'],['3ph','3φ Three']]} value={phase} onChange={setPhase}/>
      <ToggleInput label="Insulation" options={[['PVC','PVC 70°C'],['XLPE','XLPE 90°C']]} value={insul} onChange={setInsul}/>
      <ToggleInput label="Conductor" options={[['Cu','Copper'],['Al','Aluminium']]} value={material} onChange={setMat}/>
      <NumInput label="Design Current" value={current} onChange={setCurrent} unit="A"/>
      <NumInput label="Cable Length (one-way)" value={length} onChange={setLength} unit="m"/>
      <UnitNumInput label="System Voltage" value={voltage} onChange={(v)=>setVoltage(v)} units={VOLTAGE_UNITS}/>
      <NumInput label="Max Voltage Drop" value={maxVd} onChange={setMaxVd} unit="%"/>
      <SelectInput label="Ambient Temperature" value={ambient} onChange={setAmbient} options={Object.keys(AMBIENT).map(t=>[t,`${t}°C (×${AMBIENT[t]})`])}/>
      <SelectInput label="Grouped Circuits" value={groups} onChange={setGroups} options={Object.entries(GROUP).map(([g,f])=>[g,`${g} circuit${g>1?'s':''} (×${f})`])}/>
      <SelectInput label="Installation Method" value={install} onChange={setInstall} options={Object.entries(INSTALL).map(([k,v])=>[k,`${k} (×${v})`])}/>
      <CalcButton onClick={calculate}/>
      <ErrBox msg={error}/>
      {results&&<>
        <div className="bg-[#0f1a0f] border border-[#1a3a1a] rounded-xl px-4 py-3 mb-4">
          <div className="text-gray-400 text-xs mb-1">Derating: {results.derating}% | Required: {results.required}A</div>
          {results.recommended?<div className="text-2xl font-bold text-green-400">✓ Recommended: {results.recommended} mm²</div>:<div className="text-red-400 font-bold">No standard size meets criteria</div>}
        </div>
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
          <div className="grid grid-cols-5 text-[10px] text-gray-500 font-bold px-4 py-2 bg-[#1a1a0a] border-b border-[#2a2a2a]"><span>SIZE</span><span>DERATED</span><span>VD(V)</span><span>VD%</span><span>STATUS</span></div>
          {results.allResults.map(r=>(
            <div key={r.size} className={`grid grid-cols-5 px-4 py-2 border-b border-[#1a1a1a] last:border-0 text-xs ${r.size===results.recommended?'bg-[#002a00]':''}`}>
              <span className={`font-bold ${r.size===results.recommended?'text-green-400':'text-white'}`}>{r.size}mm²</span>
              <span className={r.currentOK?'text-green-400':'text-red-400'}>{r.derated}A</span>
              <span className="text-gray-300">{r.vdV}V</span>
              <span className={r.vdOK?'text-green-400':'text-red-400'}>{r.vdPct}%</span>
              <span className="text-gray-400">{r.pass?'✓ OK':(!r.currentOK?'✗ I':'⚠ VD')}</span>
            </div>
          ))}
        </div>
      </>}
    </div>
  )
}

function VoltDrop({ addHistory }) {
  const { flaSnapshot } = useWorkspace()
  const [phase,setPhase]=useState(flaSnapshot?.phase||'3ph'),[current,setCurrent]=useState(flaSnapshot?.fla||''),[pfVal,setPf]=useState(flaSnapshot?.pfVal||'0.85')
  const [length,setLength]=useState(''),[voltage,setVoltage]=useState('400'),[size,setSize]=useState('16')
  const [material,setMat]=useState('Cu'),[result,setResult]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    setResult(null)
    const r = cableVoltageDropDetailed({ phase, current, pfVal, length, voltage, size, material })
    if (r.error) { setError(r.error); return }
    setResult({vdD:r.vdD.toFixed(3),vdS:r.vdS.toFixed(3),pctD:r.pctD.toFixed(3),pctS:r.pctS.toFixed(3),Vend:r.Vend.toFixed(1),pass:r.pass})
    addHistory({tab:'VD',expr:`${pf(current)}A ${pf(length)}m ${pf(size)}mm²`,result:`${r.pctD.toFixed(2)}%`})
  }

  return(
    <div className="px-4 py-3">
      {flaSnapshot && (
        <div className="bg-[#001a00] border border-[#1a3a1a] rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
          <span className="text-green-400 text-lg">✓</span>
          <div>
            <div className="text-green-400 text-xs font-bold">FLA loaded from Motor tab</div>
            <div className="text-gray-500 text-[10px]">{flaSnapshot.fla} A · {flaSnapshot.kw} kW · {flaSnapshot.voltage}V · {flaSnapshot.phase}</div>
          </div>
        </div>
      )}
      <InfoBox title="Detailed Voltage Drop — IEC Method" lines={['Uses R×cosφ + X×sinφ for accuracy','More precise than simple resistivity method']}/>
      <ToggleInput label="Phase" options={[['1ph','1φ Single'],['3ph','3φ Three']]} value={phase} onChange={setPhase}/>
      <ToggleInput label="Conductor" options={[['Cu','Copper'],['Al','Aluminium']]} value={material} onChange={setMat}/>
      <NumInput label="Load Current" value={current} onChange={setCurrent} unit="A"/>
      <NumInput label="Power Factor" value={pfVal} onChange={setPf} unit="PF"/>
      <NumInput label="Cable Length (one-way)" value={length} onChange={setLength} unit="m"/>
      <NumInput label="System Voltage" value={voltage} onChange={setVoltage} unit="V"/>
      <SelectInput label="Cable Size" value={size} onChange={setSize} options={CABLE_DATA.map(r=>[String(r[0]),`${r[0]} mm²`])}/>
      <CalcButton onClick={calculate}/>
      <ErrBox msg={error}/>
      {result&&<ResultBox rows={[
        {label:'IEC Detailed Voltage Drop',value:result.vdD,unit:'V',accent:true},
        {label:'IEC %VD',value:`${result.pctD}%`,unit:result.pass?'✓ OK':'✗ Exceeds 3%',accent:true},
        {label:'Simple Method VD',value:result.vdS,unit:'V'},
        {label:'Simple %VD',value:`${result.pctS}%`,unit:''},
        {label:'Voltage at Load End',value:result.Vend,unit:'V'},
      ]}/>}
    </div>
  )
}

function ShortCircuit({ addHistory }) {
  const [sourceKVA,setSourceKVA]=useState(''),[voltage,setVoltage]=useState('400')
  const [cableSize,setCableSize]=useState('16'),[cableLen,setCableLen]=useState('')
  const [material,setMat]=useState('Cu'),[result,setResult]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    setResult(null)
    const r = cableShortCircuitCurrent({ sourceKVA, voltage, cableSize, cableLen, material })
    if (r.error) { setError(r.error); return }
    const i3s = r.i3.toFixed(0), i1s = r.i1.toFixed(0)
    setResult({Zs:(r.Zs*1000).toFixed(2),Zc:(r.Zc*1000).toFixed(2),Zt:(r.Zt*1000).toFixed(2),i3:i3s,i1:i1s,i3kA:(r.i3/1000).toFixed(3),i1kA:(r.i1/1000).toFixed(3)})
    addHistory({tab:'ISC',expr:`${pf(sourceKVA)}kVA ${pf(voltage)}V`,result:`${(r.i3/1000).toFixed(3)}kA`})
  }

  return(
    <div className="px-4 py-3">
      <InfoBox title="Short Circuit Current" lines={['Fault current at end of cable run','Source impedance derived from transformer kVA']}/>
      <NumInput label="Transformer / Source Rating" value={sourceKVA} onChange={setSourceKVA} unit="kVA"/>
      <NumInput label="System Voltage (L-L)" value={voltage} onChange={setVoltage} unit="V"/>
      <ToggleInput label="Conductor" options={[['Cu','Copper'],['Al','Aluminium']]} value={material} onChange={setMat}/>
      <SelectInput label="Cable Size to Fault Point" value={cableSize} onChange={setCableSize} options={CABLE_DATA.map(r=>[String(r[0]),`${r[0]} mm²`])}/>
      <NumInput label="Cable Length to Fault" value={cableLen} onChange={setCableLen} unit="m" note="0 = fault at source"/>
      <CalcButton onClick={calculate}/>
      <ErrBox msg={error}/>
      {result&&<ResultBox rows={[
        {label:'Source Impedance Zs',value:result.Zs,unit:'mΩ'},
        {label:'Cable Loop Impedance Zc',value:result.Zc,unit:'mΩ'},
        {label:'Total Impedance',value:result.Zt,unit:'mΩ'},
        {label:'3-Phase Fault Current',value:`${result.i3} A`,unit:`(${result.i3kA} kA)`,accent:true},
        {label:'1-Phase Fault Current',value:`${result.i1} A`,unit:`(${result.i1kA} kA)`},
      ]}/>}
    </div>
  )
}

function TrailingCable({ addHistory }) {
  const { flaSnapshot } = useWorkspace()
  const [current,setCurrent]=useState(flaSnapshot?.fla||''),[length,setLength]=useState('')
  const [voltage,setVoltage]=useState('525'),[maxVd,setMaxVd]=useState('5')
  const [results,setResults]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    setResults(null)
    const r = trailingCableSizing({ current, length, voltage, maxVd })
    if (r.error) { setError(r.error); return }
    const allResults = r.allResults.map(x => ({ size: x.size, derated: x.derated.toFixed(0), vdPct: x.vdPct.toFixed(2), weight: x.weight.toFixed(0), pass: x.pass, currentOK: x.currentOK, vdOK: x.vdOK }))
    if(!r.recommended)setError('No standard trailing cable meets criteria')
    setResults({recommended: r.recommended, allResults, required:r.required.toFixed(1)})
    if(r.recommended)addHistory({tab:'Trailing',expr:`${pf(current)}A ${pf(length)}m ${pf(voltage)}V`,result:`${r.recommended}mm²`})
  }

  return(
    <div className="px-4 py-3">
      {flaSnapshot && (
        <div className="bg-[#001a00] border border-[#1a3a1a] rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
          <span className="text-green-400 text-lg">✓</span>
          <div>
            <div className="text-green-400 text-xs font-bold">FLA loaded from Motor tab</div>
            <div className="text-gray-500 text-[10px]">{flaSnapshot.fla} A · {flaSnapshot.kw} kW · {flaSnapshot.voltage}V · {flaSnapshot.phase}</div>
          </div>
        </div>
      )}
      <InfoBox title="Mining Trailing Cable" lines={['Derating factor 0.85 applied for flexible use','Common mine voltages: 525V, 1000V, 3300V']}/>
      <NumInput label="Load Current" value={current} onChange={setCurrent} unit="A"/>
      <NumInput label="Cable Length" value={length} onChange={setLength} unit="m"/>
      <NumInput label="System Voltage" value={voltage} onChange={setVoltage} unit="V" note="525/1000/3300V"/>
      <NumInput label="Max Voltage Drop" value={maxVd} onChange={setMaxVd} unit="%"/>
      <CalcButton onClick={calculate}/>
      <ErrBox msg={error}/>
      {results&&<>
        <div className="bg-[#0f1a0f] border border-[#1a3a1a] rounded-xl px-4 py-3 mb-4">
          <div className="text-xs text-gray-400 mb-1">Required capacity: {results.required}A</div>
          {results.recommended?<div className="text-2xl font-bold text-green-400">✓ {results.recommended} mm²</div>:<div className="text-red-400 font-bold">No standard size meets criteria</div>}
        </div>
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
          <div className="grid grid-cols-4 text-[10px] text-gray-500 font-bold px-4 py-2 bg-[#1a1a0a] border-b border-[#2a2a2a]"><span>SIZE</span><span>DERATED</span><span>%VD</span><span>MASS kg</span></div>
          {results.allResults.map(r=>(
            <div key={r.size} className={`grid grid-cols-4 px-4 py-2 border-b border-[#1a1a1a] last:border-0 text-xs ${r.size===results.recommended?'bg-[#002a00]':''}`}>
              <span className={`font-bold ${r.size===results.recommended?'text-green-400':'text-white'}`}>{r.size}mm²</span>
              <span className={r.currentOK?'text-green-400':'text-red-400'}>{r.derated}A</span>
              <span className={r.vdOK?'text-green-400':'text-red-400'}>{r.vdPct}%</span>
              <span className="text-gray-400">{r.weight}</span>
            </div>
          ))}
        </div>
      </>}
    </div>
  )
}

function ConduitFill() {
  const [conduit,setConduit]=useState('25'),[cableSize,setCableSize]=useState('2.5')
  const [numCables,setNumCables]=useState(''),[result,setResult]=useState(null)

  const calculate=()=>{
    setResult(null)
    const r = conduitFill({ conduit, cableSize, numCables })
    if (!r) return
    setResult({ fill: r.fill.toFixed(1), max33: r.max33, max40: r.max40, pass: r.pass, pass40: r.pass40 })
  }

  return(
    <div className="px-4 py-3">
      <InfoBox title="Conduit Fill" lines={['33% fill for bends/long runs','40% maximum for straight runs']}/>
      <SelectInput label="Conduit ID" value={conduit} onChange={setConduit} options={CONDUIT_SIZES.map(s=>[String(s),`${s}mm`])}/>
      <SelectInput label="Cable Size" value={cableSize} onChange={setCableSize} options={Object.keys(CABLE_OD).map(k=>[k,`${k}mm² (OD≈${CABLE_OD[k]}mm)`])}/>
      <NumInput label="Number of Cables" value={numCables} onChange={setNumCables} unit="cables"/>
      <CalcButton onClick={calculate} label="CHECK FILL"/>
      {result&&<ResultBox rows={[
        {label:'Actual Fill',value:result.fill+'%',unit:result.pass?'✓ OK ≤33%':result.pass40?'⚠ OK ≤40%':'✗ OVERFULL',accent:!result.pass&&!result.pass40,warn:!result.pass&&!result.pass40},
        {label:'Max cables (33%)',value:result.max33,unit:'cables'},
        {label:'Max cables (40%)',value:result.max40,unit:'cables'},
      ]}/>}
    </div>
  )
}


const CONDUCTOR_SIZES = [...new Set(CABLE_OD_TABLE.map(r => r[0]))].map(s => [String(s), `${s} mm²`])
const CORE_OPTIONS = [['2','2 Core'],['3','3 Core'],['4','4 Core']]
const ARMOUR_OPTIONS = [['unarm','Unarmoured'],['swa','SWA (Steel Wire Armoured)']]
const INSUL_OPTIONS  = [['pvc','PVC'],['xlpe','XLPE']]

function GlandSize() {
  const [method, setMethod]   = useState('conductor')
  // Method 1 — conductor
  const [condSize, setCondSize] = useState('16')
  const [cores, setCores]       = useState('3')
  const [armour, setArmour]     = useState('unarm')
  const [insul, setInsul]       = useState('pvc')
  // Method 2 — OD
  const [od, setOd]             = useState('')
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState('')

  const calculate = () => {
    setError('')
    setResult(null)
    const r = glandSelection({ method, condSize, cores, armour, insul, od })
    if (r.error) { setError(r.error); return }
    if (method === 'conductor') {
      setResult({ ...r, conductor: condSize, cores, armour, insul })
    } else {
      setResult(r)
    }
  }

  return (
    <div className="px-4 py-3">
      <InfoBox title="Cable Gland Size Selector" lines={['Standard metric gland sizes 0–7','A2 = unarmoured PVC | CW/BW = SWA armoured']}/>

      {/* Method toggle */}
      <div className="mb-4">
        <label className="text-gray-400 text-xs mb-2 block">Selection Method</label>
        <div className="flex gap-2">
          {[['conductor','By Cable Size'],['od','By Measured OD']].map(([id,l]) => (
            <button key={id} onClick={() => { setMethod(id); setResult(null); setError('') }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${method===id?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {method === 'conductor' ? (
        <>
          <SelectInput label="Conductor Size" value={condSize} onChange={setCondSize} options={CONDUCTOR_SIZES}/>
          <div className="mb-3">
            <label className="text-gray-400 text-xs mb-2 block">Number of Cores</label>
            <div className="flex gap-2">
              {CORE_OPTIONS.map(([id,l]) => (
                <button key={id} onClick={() => setCores(id)}
                  className={`flex-1 py-2.5 rounded-xl text-sm ${cores===id?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="mb-3">
            <label className="text-gray-400 text-xs mb-2 block">Cable Type</label>
            <div className="flex gap-2">
              {ARMOUR_OPTIONS.map(([id,l]) => (
                <button key={id} onClick={() => setArmour(id)}
                  className={`flex-1 py-2.5 rounded-xl text-sm ${armour===id?'bg-blue-600 text-white':'bg-[#1c1c1c] text-gray-400'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="text-gray-400 text-xs mb-2 block">Insulation</label>
            <div className="flex gap-2">
              {INSUL_OPTIONS.map(([id,l]) => (
                <button key={id} onClick={() => setInsul(id)}
                  className={`flex-1 py-2.5 rounded-xl text-sm ${insul===id?'bg-[#1a3a5a] text-blue-300':'bg-[#1c1c1c] text-gray-400'}`}>{l}</button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <NumInput label="Cable Outer Diameter (measured)" value={od} onChange={setOd} unit="mm" placeholder="e.g. 18.5"/>
      )}

      <CalcButton onClick={calculate} label="SELECT GLAND"/>
      <ErrBox msg={error}/>

      {result && (
        <>
          <ResultBox rows={[
            { label: 'Typical Cable OD', value: result.od, unit: 'mm' },
            { label: '➤ Gland Size', value: `Size ${result.gland}`, unit: '', accent: true },
            { label: '➤ Thread Size', value: result.thread, unit: '', accent: true },
            { label: '➤ Gland Type', value: result.type, unit: '', accent: true },
            { label: 'Type Description', value: result.glandType, unit: '' },
            { label: 'OD Range for this Size', value: `${result.min}–${result.max}`, unit: 'mm' },
          ]} />

          {/* Size reference table */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
            <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
              <span className="text-amber-400 text-xs font-bold">FULL GLAND SIZE REFERENCE</span>
            </div>
            <div className="grid grid-cols-4 text-[10px] text-gray-500 font-bold px-4 py-2 border-b border-[#1a1a1a]">
              <span>SIZE</span><span>OD RANGE</span><span>THREAD</span><span>TYPE</span>
            </div>
            {GLAND_SIZES.map(g => (
              <div key={g.size}
                className={`grid grid-cols-4 px-4 py-2.5 border-b border-[#1a1a1a] last:border-0 text-xs ${g.size===result.gland?'bg-[#1a1500]':''}`}>
                <span className={`font-bold ${g.size===result.gland?'text-amber-400':'text-white'}`}>Size {g.size}</span>
                <span className="text-gray-300">{g.min}–{g.max}mm</span>
                <span className="text-gray-400">{g.thread}</span>
                <span className="text-gray-500">{g.a2}/{g.cw}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Underground Reticulation: Direct-Buried Sizing (§5.6.2, roadmap.md) ──────
// Shared results-table renderer used by both DirectBuried and DuctDerating below —
// they share the exact same result shape (recommended/allResults/derating/required/factors).
function BuriedResultsTable({ results }) {
  return(
    <>
      <div className="bg-[#0f1a0f] border border-[#1a3a1a] rounded-xl px-4 py-3 mb-4">
        <div className="text-gray-400 text-xs mb-1">Overall derating: ×{results.derating} | Required: {results.required}A</div>
        {results.recommended?<div className="text-2xl font-bold text-green-400">✓ Recommended: {results.recommended} mm²</div>:<div className="text-red-400 font-bold">No standard size meets criteria</div>}
      </div>
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
        <div className="grid grid-cols-5 text-[10px] text-gray-500 font-bold px-4 py-2 bg-[#1a1a0a] border-b border-[#2a2a2a]"><span>SIZE</span><span>DERATED</span><span>VD(V)</span><span>VD%</span><span>STATUS</span></div>
        {results.allResults.map(r=>(
          <div key={r.size} className={`grid grid-cols-5 px-4 py-2 border-b border-[#1a1a1a] last:border-0 text-xs ${r.size===results.recommended?'bg-[#002a00]':''}`}>
            <span className={`font-bold ${r.size===results.recommended?'text-green-400':'text-white'}`}>{r.size}mm²</span>
            <span className={r.currentOK?'text-green-400':'text-red-400'}>{r.derated}A</span>
            <span className="text-gray-300">{r.vdV}V</span>
            <span className={r.vdOK?'text-green-400':'text-red-400'}>{r.vdPct}%</span>
            <span className="text-gray-400">{r.pass?'✓ OK':(!r.currentOK?'✗ I':'⚠ VD')}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function ResistivityInputs({ resistivityMode, setResistivityMode, resistivity, setResistivity, soilNature, setSoilNature }) {
  return(
    <div className="mb-3">
      <label className="text-gray-400 text-xs mb-2 block">Soil Thermal Resistivity</label>
      <div className="flex gap-2 mb-2">
        {[['value','Known K.m/W'],['nature','Describe soil']].map(([id,l]) => (
          <button key={id} onClick={() => setResistivityMode(id)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold ${resistivityMode===id?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>{l}</button>
        ))}
      </div>
      {resistivityMode==='value'
        ? <SelectInput label="" value={resistivity} onChange={setResistivity} options={Object.keys(SOIL_RESISTIVITY_FACTOR).map(k=>[k,`${k} K.m/W`])}/>
        : <SelectInput label="" value={soilNature} onChange={setSoilNature} options={Object.keys(SOIL_NATURE_FACTOR).map(k=>[k,`${k} (×${SOIL_NATURE_FACTOR[k]})`])}/>}
    </div>
  )
}

function DirectBuriedSizing({ addHistory }) {
  const { flaSnapshot } = useWorkspace()
  const [current,setCurrent]=useState(flaSnapshot?.fla||''),[length,setLength]=useState('')
  const [voltage,setVoltage]=useState('400'),[insul,setInsul]=useState('PVC'),[material,setMat]=useState('Cu')
  const [groundTemp,setGroundTemp]=useState('20'),[resistivityMode,setResistivityMode]=useState('value')
  const [resistivity,setResistivity]=useState('2.5'),[soilNature,setSoilNature]=useState('Damp')
  const [depth,setDepth]=useState('0.6'),[circuits,setCircuits]=useState('1'),[clearance,setClearance]=useState('touching')
  const [maxVd,setMaxVd]=useState('3'),[results,setResults]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    setResults(null)
    const r = directBuriedSizing({ current, length, voltage, insul, material, groundTemp, resistivityMode, resistivity, soilNature, depth, circuits, clearance, maxVd })
    if (r.error) { setError(r.error); return }
    const allResults = r.allResults.map(x => ({ size: x.size, derated: x.derated.toFixed(1), vdV: x.vdV.toFixed(2), vdPct: x.vdPct.toFixed(2), currentOK: x.currentOK, vdOK: x.vdOK, pass: x.pass }))
    if(!r.recommended)setError('No standard size meets criteria - consider parallel cables or a shallower/less-grouped route')
    setResults({recommended: r.recommended, allResults, derating:(r.derating).toFixed(3), required:r.required.toFixed(1)})
    if(r.recommended)addHistory({tab:'Direct-Buried',expr:`${pf(current)}A ${pf(length)}m buried`,result:`${r.recommended}mm²`})
  }

  return(
    <div className="px-4 py-3">
      <InfoBox title="Direct-Buried Cable Sizing" color="amber" lines={[
        'IEC 60364-5-52 Annex B (method D2) base ampacities + soil/depth/grouping correction factors',
        'Depth correction sourced from IEC 60502-2 Table B.12 - a different but compatible standard',
        'Planning-level: for critical/parallel multi-circuit installations, confirm with a full IEC 60287 thermal study',
      ]}/>
      {flaSnapshot && (
        <div className="bg-[#001a00] border border-[#1a3a1a] rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
          <span className="text-green-400 text-lg">✓</span>
          <div>
            <div className="text-green-400 text-xs font-bold">FLA loaded from Motor tab</div>
            <div className="text-gray-500 text-[10px]">{flaSnapshot.fla} A · {flaSnapshot.kw} kW · {flaSnapshot.voltage}V · {flaSnapshot.phase}</div>
          </div>
        </div>
      )}
      <ToggleInput label="Insulation" options={[['PVC','PVC 70°C'],['XLPE','XLPE 90°C']]} value={insul} onChange={setInsul}/>
      <ToggleInput label="Conductor" options={[['Cu','Copper'],['Al','Aluminium']]} value={material} onChange={setMat}/>
      <NumInput label="Design Current" value={current} onChange={setCurrent} unit="A"/>
      <NumInput label="Cable Length (one-way)" value={length} onChange={setLength} unit="m"/>
      <NumInput label="System Voltage" value={voltage} onChange={setVoltage} unit="V"/>
      <NumInput label="Max Voltage Drop" value={maxVd} onChange={setMaxVd} unit="%"/>
      <SelectInput label="Ground Temperature" value={groundTemp} onChange={setGroundTemp} options={Object.keys(GROUND_TEMP_FACTOR).map(t=>[t,`${t}°C`])}/>
      <SelectInput label="Depth of Laying" value={depth} onChange={setDepth} options={Object.keys(DEPTH_FACTOR_DIRECT).map(d=>[d,`${d} m`])}/>
      <ResistivityInputs resistivityMode={resistivityMode} setResistivityMode={setResistivityMode} resistivity={resistivity} setResistivity={setResistivity} soilNature={soilNature} setSoilNature={setSoilNature}/>
      <SelectInput label="Parallel Circuits in Trench" value={circuits} onChange={setCircuits} options={['1','2','3','4','5','6','7','8','9','12','16','20'].map(n=>[n,n==='1'?'None (single circuit)':`${n} circuits`])}/>
      {circuits!=='1' && <SelectInput label="Cable-to-Cable Clearance" value={clearance} onChange={setClearance} options={CLEARANCE_OPTIONS.map(c=>[c,c==='touching'?'Touching':c==='1dia'?'1 cable diameter':c])}/>}
      <CalcButton onClick={calculate}/>
      <ErrBox msg={error}/>
      {results && <BuriedResultsTable results={results}/>}
    </div>
  )
}

// ── Underground Reticulation: Duct Derating ─────────────────────────────────
function DuctDerating({ addHistory }) {
  const { flaSnapshot } = useWorkspace()
  const [current,setCurrent]=useState(flaSnapshot?.fla||''),[length,setLength]=useState('')
  const [voltage,setVoltage]=useState('400'),[insul,setInsul]=useState('PVC'),[material,setMat]=useState('Cu')
  const [groundTemp,setGroundTemp]=useState('20'),[resistivityMode,setResistivityMode]=useState('value')
  const [resistivity,setResistivity]=useState('2.5'),[soilNature,setSoilNature]=useState('Damp')
  const [circuits,setCircuits]=useState('1'),[clearance,setClearance]=useState('touching')
  const [maxVd,setMaxVd]=useState('3'),[results,setResults]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    setResults(null)
    const r = ductDerating({ current, length, voltage, insul, material, groundTemp, resistivityMode, resistivity, soilNature, circuits, clearance, maxVd })
    if (r.error) { setError(r.error); return }
    const allResults = r.allResults.map(x => ({ size: x.size, derated: x.derated.toFixed(1), vdV: x.vdV.toFixed(2), vdPct: x.vdPct.toFixed(2), currentOK: x.currentOK, vdOK: x.vdOK, pass: x.pass }))
    if(!r.recommended)setError('No standard size meets criteria - consider parallel cables or fewer ducts per bank')
    setResults({recommended: r.recommended, allResults, derating:(r.derating).toFixed(3), required:r.required.toFixed(1)})
    if(r.recommended)addHistory({tab:'Duct Derating',expr:`${pf(current)}A ${pf(length)}m in duct`,result:`${r.recommended}mm²`})
  }

  return(
    <div className="px-4 py-3">
      <InfoBox title="Duct-Installed Cable Derating" color="amber" lines={[
        'IEC 60364-5-52 Annex B (method D1) base ampacities + soil/grouping correction factors',
        'No depth correction offered - no verified full-range IEC 60502-2 duct-depth table (see notes)',
        'Grouping factor reuses the direct-buried table - confirm against a duct-bank-specific study for large banks (>4 circuits)',
      ]}/>
      {flaSnapshot && (
        <div className="bg-[#001a00] border border-[#1a3a1a] rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
          <span className="text-green-400 text-lg">✓</span>
          <div>
            <div className="text-green-400 text-xs font-bold">FLA loaded from Motor tab</div>
            <div className="text-gray-500 text-[10px]">{flaSnapshot.fla} A · {flaSnapshot.kw} kW · {flaSnapshot.voltage}V · {flaSnapshot.phase}</div>
          </div>
        </div>
      )}
      <ToggleInput label="Insulation" options={[['PVC','PVC 70°C'],['XLPE','XLPE 90°C']]} value={insul} onChange={setInsul}/>
      <ToggleInput label="Conductor" options={[['Cu','Copper'],['Al','Aluminium']]} value={material} onChange={setMat}/>
      <NumInput label="Design Current" value={current} onChange={setCurrent} unit="A"/>
      <NumInput label="Cable Length (one-way)" value={length} onChange={setLength} unit="m"/>
      <NumInput label="System Voltage" value={voltage} onChange={setVoltage} unit="V"/>
      <NumInput label="Max Voltage Drop" value={maxVd} onChange={setMaxVd} unit="%"/>
      <SelectInput label="Ground Temperature" value={groundTemp} onChange={setGroundTemp} options={Object.keys(GROUND_TEMP_FACTOR).map(t=>[t,`${t}°C`])}/>
      <ResistivityInputs resistivityMode={resistivityMode} setResistivityMode={setResistivityMode} resistivity={resistivity} setResistivity={setResistivity} soilNature={soilNature} setSoilNature={setSoilNature}/>
      <SelectInput label="Ducts / Circuits in Bank" value={circuits} onChange={setCircuits} options={['1','2','3','4','5','6','7','8','9','12','16','20'].map(n=>[n,n==='1'?'None (single duct)':`${n} circuits`])}/>
      {circuits!=='1' && <SelectInput label="Duct-to-Duct Clearance" value={clearance} onChange={setClearance} options={CLEARANCE_OPTIONS.map(c=>[c,c==='touching'?'Touching':c==='1dia'?'1 cable diameter':c])}/>}
      <CalcButton onClick={calculate}/>
      <ErrBox msg={error}/>
      {results && <BuriedResultsTable results={results}/>}
    </div>
  )
}

// ── Underground Reticulation: Route Fault Level ─────────────────────────────
function RouteFaultLevel() {
  const [sourceKVA,setSourceKVA]=useState(''),[voltage,setVoltage]=useState('400')
  const [segments,setSegments]=useState([{size:'95',length:'',material:'Cu'}])
  const [result,setResult]=useState(null),[error,setError]=useState('')

  const addSegment=()=>setSegments(s=>[...s,{size:'95',length:'',material:'Cu'}])
  const removeSegment=(i)=>setSegments(s=>s.filter((_,j)=>j!==i))
  const update=(i,field,val)=>setSegments(s=>s.map((seg,j)=>j===i?{...seg,[field]:val}:seg))

  const calculate=()=>{
    setError('')
    setResult(null)
    const r = routeFaultLevel({ sourceKVA, voltage, segments })
    if (r.error) { setError(r.error); return }
    setResult(r.nodes.map(n => ({ label: n.label, i3: (n.i3/1000).toFixed(3), i1: (n.i1/1000).toFixed(3), Zt: (n.Zt*1000).toFixed(2) })))
  }

  return(
    <div className="px-4 py-3">
      <InfoBox title="Route Fault Level" color="amber" lines={[
        'Fault current at each point along a multi-segment reticulation route',
        "Reuses the Fault I tab's simplified model (Zt = Zs + Zc), chained across segments in series",
        'Simplified per IEC 60909 Clause 8 - for protection grading studies, confirm critical points with a full analysis',
      ]}/>
      <NumInput label="Source Rating (transformer/generator)" value={sourceKVA} onChange={setSourceKVA} unit="kVA"/>
      <NumInput label="System Voltage (L-L)" value={voltage} onChange={setVoltage} unit="V"/>
      <div className="mb-2 mt-4">
        <label className="text-gray-400 text-xs mb-2 block">Route Segments (in order, source → furthest point)</label>
        {segments.map((seg,i)=>(
          <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 mb-2">
            <div className="flex justify-between items-center mb-2">
              <span className="text-amber-400 text-xs font-bold">Segment {i+1}</span>
              {segments.length>1 && <button onClick={()=>removeSegment(i)} className="text-red-500 text-xs">Remove</button>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-gray-500 text-[10px]">Size</label>
                <select value={seg.size} onChange={e=>update(i,'size',e.target.value)} className="w-full bg-[#111] border border-[#333] text-white text-sm rounded-lg px-2 py-1.5 outline-none mt-1">
                  {CABLE_DATA.map(r=><option key={r[0]} value={String(r[0])}>{r[0]}mm²</option>)}
                </select></div>
              <div><label className="text-gray-500 text-[10px]">Length (m)</label>
                <input type="text" inputMode="decimal" value={seg.length} onChange={e=>update(i,'length',e.target.value.replace(',','.'))}
                  className="w-full bg-[#111] border border-[#333] text-white text-sm rounded-lg px-2 py-1.5 outline-none mt-1"/></div>
              <div><label className="text-gray-500 text-[10px]">Material</label>
                <select value={seg.material} onChange={e=>update(i,'material',e.target.value)} className="w-full bg-[#111] border border-[#333] text-white text-sm rounded-lg px-2 py-1.5 outline-none mt-1">
                  <option value="Cu">Cu</option><option value="Al">Al</option>
                </select></div>
            </div>
          </div>
        ))}
        <button onClick={addSegment} className="w-full bg-[#1c1c1c] text-gray-400 py-2 rounded-xl text-sm mb-3">+ Add Segment</button>
      </div>
      <CalcButton onClick={calculate} label="CALCULATE ROUTE"/>
      <ErrBox msg={error}/>
      {result && (
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
          <div className="grid grid-cols-4 text-[10px] text-gray-500 font-bold px-4 py-2 bg-[#1a1a0a] border-b border-[#2a2a2a]"><span>POINT</span><span>Zt (mΩ)</span><span>3φ FAULT</span><span>1φ FAULT</span></div>
          {result.map((n,i)=>(
            <div key={i} className="grid grid-cols-4 px-4 py-2 border-b border-[#1a1a1a] last:border-0 text-xs">
              <span className={`font-bold ${i===0?'text-amber-400':'text-white'}`}>{n.label}</span>
              <span className="text-gray-300">{n.Zt}</span>
              <span className="text-green-400">{n.i3} kA</span>
              <span className="text-gray-400">{n.i1} kA</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const TABS=[{id:'sizing',label:'Sizing',icon:'≋'},{id:'vd',label:'Volt Drop',icon:'⬇'},{id:'isc',label:'Fault I',icon:'⚡'},{id:'trailing',label:'Trailing',icon:'〰'},{id:'conduit',label:'Conduit',icon:'○'},{id:'gland',label:'Gland',icon:'⊗'},{id:'schedule',label:'Schedule',icon:'📋'},{id:'vfd',label:'VFD',icon:'∿'},{id:'buried',label:'Buried',icon:'⏚'},{id:'duct',label:'Duct',icon:'▭'},{id:'route',label:'Route Fault',icon:'⚡'}]

export default function CableCalculator({ addHistory }) {
  const [sub,setSub]=useState('sizing')
  const map={sizing:<CableSizing addHistory={addHistory}/>,vd:<VoltDrop addHistory={addHistory}/>,isc:<ShortCircuit addHistory={addHistory}/>,trailing:<TrailingCable addHistory={addHistory}/>,conduit:<ConduitFill/>,gland:<GlandSize/>,schedule:<CableSchedule/>,vfd:<VfdCable addHistory={addHistory}/>,buried:<DirectBuriedSizing addHistory={addHistory}/>,duct:<DuctDerating addHistory={addHistory}/>,route:<RouteFaultLevel/>}
  return(
    <div className="flex flex-col h-full overflow-hidden">
      <SubTabBar tabs={TABS} active={sub} onChange={setSub}/>
      <div className="flex-1 overflow-y-auto">{map[sub]}</div>
    </div>
  )
}

// ── Cable Schedule ─────────────────────────────────────────────────────────
function CableSchedule() {
  const [cables,setCables]=useState([{ref:'CB-01',from:'MDB',to:'Load 1',current:'',length:'',voltage:'400',phase:'3ph',material:'Cu',insul:'PVC',size:'',notes:''}])
  const [error,setError]=useState('')

  const addCable=()=>setCables(c=>[...c,{ref:`CB-0${c.length+1}`,from:'',to:'',current:'',length:'',voltage:'400',phase:'3ph',material:'Cu',insul:'PVC',size:'',notes:''}])
  const removeCable=(i)=>setCables(c=>c.filter((_,j)=>j!==i))
  const update=(i,field,val)=>setCables(c=>c.map((item,j)=>j===i?{...item,[field]:val}:item))

  const autoSizeAll=()=>{
    setCables(c=>c.map(cable=>{
      const I=pf(cable.current)
      if(!I)return cable
      const size=scheduleAutoSize({ current: cable.current, phase: cable.phase, material: cable.material, insul: cable.insul })
      return{...cable,size:String(size)}
    }))
  }

  const exportCSV=()=>{
    const header='Ref,From,To,Current(A),Length(m),Voltage(V),Phase,Material,Insul,Size(mm²),Notes'
    const rows=cables.map(c=>`${c.ref},${c.from},${c.to},${c.current},${c.length},${c.voltage},${c.phase},${c.material},${c.insul},${c.size},${c.notes}`)
    const csv=[header,...rows].join('\n')
    const blob=new Blob([csv],{type:'text/csv'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a')
    a.href=url;a.download='cable-schedule.csv';a.click()
    URL.revokeObjectURL(url)
  }

  return(
    <div className="px-4 py-3">
      <InfoBox title="Cable Schedule" lines={['Build your cable list, auto-size, and export to CSV','Open CSV in Excel for full schedule']}/>
      <div className="flex gap-2 mb-4">
        <button onClick={autoSizeAll} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold">⚡ Auto-Size All</button>
        <button onClick={exportCSV} className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-bold">📥 Export CSV</button>
        <button onClick={addCable} className="flex-1 bg-[#1c1c1c] text-gray-400 py-2.5 rounded-xl text-sm">+ Add</button>
      </div>
      {cables.map((c,i)=>(
        <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 mb-3">
          <div className="flex justify-between items-center mb-2">
            <input type="text" value={c.ref} onChange={e=>update(i,'ref',e.target.value)}
              className="bg-[#111] border border-[#333] text-amber-400 text-sm font-bold rounded-lg px-3 py-1.5 w-24 outline-none"/>
            <button onClick={()=>removeCable(i)} className="text-red-500 text-xs">Remove</button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {[['from','From (source)'],['to','To (load)']].map(([f,l])=>(
              <div key={f}><label className="text-gray-500 text-[10px]">{l}</label>
                <input type="text" value={c[f]} onChange={e=>update(i,f,e.target.value)}
                  className="w-full bg-[#111] border border-[#333] text-white text-sm rounded-lg px-3 py-1.5 outline-none mt-1"/></div>
            ))}
            {[['current','Current (A)'],['length','Length (m)'],['voltage','Voltage (V)']].map(([f,l])=>(
              <div key={f}><label className="text-gray-500 text-[10px]">{l}</label>
                <input type="text" inputMode="decimal" value={c[f]} onChange={e=>update(i,f,e.target.value.replace(',','.'))}
                  className="w-full bg-[#111] border border-[#333] text-white text-sm rounded-lg px-3 py-1.5 outline-none mt-1"/></div>
            ))}
            <div><label className="text-gray-500 text-[10px]">Phase</label>
              <select value={c.phase} onChange={e=>update(i,'phase',e.target.value)} className="w-full bg-[#111] border border-[#333] text-white text-sm rounded-lg px-3 py-1.5 outline-none mt-1">
                <option value="1ph">1φ</option><option value="3ph">3φ</option>
              </select></div>
            <div><label className="text-gray-500 text-[10px]">Material</label>
              <select value={c.material} onChange={e=>update(i,'material',e.target.value)} className="w-full bg-[#111] border border-[#333] text-white text-sm rounded-lg px-3 py-1.5 outline-none mt-1">
                <option value="Cu">Copper</option><option value="Al">Aluminium</option>
              </select></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1"><label className="text-gray-500 text-[10px]">Auto-sized: {c.size?c.size+'mm²':'—'}</label></div>
            <div className="flex-1"><label className="text-gray-500 text-[10px]">Notes</label>
              <input type="text" value={c.notes} onChange={e=>update(i,'notes',e.target.value)}
                className="w-full bg-[#111] border border-[#333] text-gray-300 text-xs rounded-lg px-3 py-1.5 outline-none mt-1" placeholder="optional"/></div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── VFD Cable Sizing ────────────────────────────────────────────────────────
function VfdCable({ addHistory }) {
  const { flaSnapshot } = useWorkspace()
  const [current,setCurrent]=useState(flaSnapshot?.fla||''),[length,setLength]=useState('')
  const [voltage,setVoltage]=useState('400'),[result,setResult]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    setResult(null)
    const r = vfdCableSizing({ current, length, voltage })
    if (r.error) { setError(r.error); return }
    setResult({size:r.size, deratedI:r.deratedI.toFixed(1), vd:r.vd.toFixed(2), vdPct:r.vdPct.toFixed(2), lengthOK:r.lengthOK, maxLen:r.maxLen})
    addHistory({tab:'VFD Cable',expr:`${pf(current)}A ${pf(length)}m VFD`,result:`${r.size}mm²`})
  }

  return(
    <div className="px-4 py-3">
      {flaSnapshot && (
        <div className="bg-[#001a00] border border-[#1a3a1a] rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
          <span className="text-green-400 text-lg">✓</span>
          <div>
            <div className="text-green-400 text-xs font-bold">FLA loaded from Motor tab</div>
            <div className="text-gray-500 text-[10px]">{flaSnapshot.fla} A · {flaSnapshot.kw} kW · {flaSnapshot.voltage}V · {flaSnapshot.phase}</div>
          </div>
        </div>
      )}
      <InfoBox title="VFD Output Cable Sizing" lines={['Screened cable required for VFD output','Derating applied: ×1.1 for harmonics, ×0.8 for screening effect']}/>
      <NumInput label="Motor FLA" value={current} onChange={setCurrent} unit="A"/>
      <NumInput label="Cable Length (drive to motor)" value={length} onChange={setLength} unit="m"/>
      <NumInput label="System Voltage" value={voltage} onChange={setVoltage} unit="V"/>
      <CalcButton onClick={calculate} label="SIZE VFD CABLE"/>
      <ErrBox msg={error}/>
      {result&&<>
        <ResultBox rows={[
          {label:'Derated Design Current',value:result.deratedI,unit:'A'},
          {label:'➤ Recommended Cable Size',value:result.size,unit:'mm² (screened)',accent:true},
          {label:'Voltage Drop',value:result.vd,unit:`V (${result.vdPct}%)`},
          {label:'Cable Length Check',value:result.lengthOK?`✓ OK (≤${result.maxLen}m)`:`⚠ Exceeds ${result.maxLen}m — fit output reactor`,unit:'',accent:result.lengthOK,warn:!result.lengthOK},
        ]}/>
        <InfoBox color="amber" title="VFD Cable Requirements" lines={[
          '• Always use screened (shielded) cable — 360° termination at both ends',
          '• Do NOT use SWA armoured cable for VFD output — use SY, YY, or LIYCY',
          '• Max unfiltered length ≈ 50m to limit dV/dt stress on motor winding',
          '• Add output reactor/filter for lengths >50m or older motors',
          '• Separate VFD cable from signal cables by ≥300mm',
        ]}/>
      </>}
    </div>
  )
}
