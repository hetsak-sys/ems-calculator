import { useState } from 'react'
import { SQRT3, pf, NumInput, SelectInput, ToggleInput, ResultBox, InfoBox, ErrBox, CalcButton, SubTabBar } from './shared'
import { useSite } from './SiteContext'

// ── Harmonics / THD ────────────────────────────────────────────────────────
function HarmonicsCalc({ addHistory }) {
  const [fund,setFund]=useState(''),[h3,setH3]=useState(''),[h5,setH5]=useState('')
  const [h7,setH7]=useState(''),[h9,setH9]=useState(''),[h11,setH11]=useState('')
  const [h13,setH13]=useState(''),[result,setResult]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    const I1=pf(fund)
    if(!I1){setError('Enter fundamental current');return}
    const harmonics=[{n:3,v:pf(h3)},{n:5,v:pf(h5)},{n:7,v:pf(h7)},{n:9,v:pf(h9)},{n:11,v:pf(h11)},{n:13,v:pf(h13)}].filter(h=>h.v>0)
    const sumSq=harmonics.reduce((s,h)=>s+h.v*h.v,0)
    const thd=(Math.sqrt(sumSq)/I1*100).toFixed(2)
    const rms=Math.sqrt(I1*I1+sumSq).toFixed(2)
    const kFactor=harmonics.reduce((s,h)=>s+(h.v/I1)**2*h.n*h.n,0)+(1)**2
    setResult({thd,rms,kFactor:kFactor.toFixed(2),harmonics,I1})
    addHistory({tab:'THD',expr:`I1=${I1}A`,result:`THD=${thd}%`})
  }

  // IEC 61000-3-2 limits
  const THD_LIMITS={good:'<5%',acceptable:'5–8%',poor:'8–20%',severe:'>20%'}

  return(
    <div className="px-4 py-3">
      <InfoBox title="Harmonic Current Analysis / THD" lines={['Enter fundamental and harmonic currents in amperes','THD = √(ΣIn²) / I1 × 100%']}/>
      <NumInput label="Fundamental Current (I₁ at 50Hz)" value={fund} onChange={setFund} unit="A" placeholder="e.g. 100"/>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[['3rd (150Hz)',h3,setH3],['5th (250Hz)',h5,setH5],['7th (350Hz)',h7,setH7],['9th (450Hz)',h9,setH9],['11th (550Hz)',h11,setH11],['13th (650Hz)',h13,setH13]].map(([l,v,s])=>(
          <div key={l}>
            <label className="text-gray-500 text-[10px] mb-1 block">{l}</label>
            <div className="flex items-center bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <input type="text" inputMode="decimal" value={v} onChange={e=>s(e.target.value.replace(',','.'))}
                placeholder="0" className="flex-1 bg-transparent text-white text-base px-3 py-2 outline-none"/>
              <span className="text-gray-600 text-xs px-2">A</span>
            </div>
          </div>
        ))}
      </div>
      <CalcButton onClick={calculate} label="CALCULATE THD"/>
      <ErrBox msg={error}/>
      {result&&<>
        <ResultBox rows={[
          {label:'THD-I',value:`${result.thd}%`,unit:pf(result.thd)<5?'✓ Good':pf(result.thd)<8?'⚠ Acceptable':'✗ High',accent:pf(result.thd)<5,warn:pf(result.thd)>=8},
          {label:'True RMS Current',value:result.rms,unit:'A',accent:true},
          {label:'K-Factor (transformer)',value:result.kFactor,unit:''},
        ]}/>
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
          <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]"><span className="text-amber-400 text-xs font-bold">HARMONIC BREAKDOWN</span></div>
          {result.harmonics.map(h=>(
            <div key={h.n} className="flex justify-between items-center px-4 py-2 border-b border-[#1a1a1a] last:border-0 text-sm">
              <span className="text-gray-400">{h.n}th harmonic</span>
              <span className="text-white">{h.v} A</span>
              <span className="text-amber-400">{(h.v/result.I1*100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <InfoBox title="K-Factor Guide" lines={[`K-Factor: ${result.kFactor} — ${pf(result.kFactor)<=4?'Standard transformer OK':pf(result.kFactor)<=9?'Use K-9 rated transformer':pf(result.kFactor)<=13?'Use K-13 rated transformer':'Use K-20 or higher transformer'}`,
          '• K-1: Standard (no harmonics)','• K-4: Minor harmonics','• K-9: Moderate (office equipment)','• K-13: Heavy (UPS, drives)','• K-20: Severe (large VFDs)']}/>
      </>}
    </div>
  )
}

// ── Battery / UPS Sizing ───────────────────────────────────────────────────
function BatterySizing({ addHistory }) {
  const [load,setLoad]=useState(''),[backupTime,setBackupTime]=useState(''),[voltage,setVoltage]=useState('48')
  const [dod,setDod]=useState('80'),[eff,setEff]=useState('85'),[temp,setTemp]=useState('20')
  const [result,setResult]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    const W=pf(load),T=pf(backupTime),V=pf(voltage),DOD=pf(dod)/100,EFF=pf(eff)/100
    const tempC=pf(temp)
    if(!W||!T||!V){setError('Enter load, backup time, and voltage');return}
    // Capacity required: C = (W × T) / (V × DOD × EFF)
    // Temperature derating: -1% capacity per °C below 25°C
    const tempFactor=tempC<25?1-(25-tempC)*0.01:1
    const rawAh=(W*T)/(V*DOD*EFF)
    const requiredAh=rawAh/tempFactor
    // Standard battery sizes
    const batSizes=[7,12,17,24,40,55,65,100,120,150,200,250,300]
    const selected=batSizes.find(s=>s>=requiredAh)||500
    const chargerA=(requiredAh/10).toFixed(1)  // C/10 rate
    setResult({rawAh:rawAh.toFixed(1),requiredAh:requiredAh.toFixed(1),selected,chargerA,tempFactor:(tempFactor*100).toFixed(0),kWhStored:(selected*V/1000).toFixed(2)})
    addHistory({tab:'Battery',expr:`${W}W ${T}h ${V}V`,result:`${selected}Ah`})
  }

  return(
    <div className="px-4 py-3">
      <InfoBox title="Battery / UPS Sizing" lines={['C = (Load × Time) / (V × DoD × η)','Temperature correction applied for cold environments']}/>
      <NumInput label="Load Power" value={load} onChange={setLoad} unit="W" placeholder="total connected load"/>
      <NumInput label="Required Backup Time" value={backupTime} onChange={setBackupTime} unit="hours"/>
      <NumInput label="Battery Bank Voltage" value={voltage} onChange={setVoltage} unit="V" note="12/24/48/110/220V"/>
      <NumInput label="Depth of Discharge (DoD)" value={dod} onChange={setDod} unit="%" note="80% for VRLA, 90% for Li-ion"/>
      <NumInput label="Inverter/UPS Efficiency" value={eff} onChange={setEff} unit="%"/>
      <NumInput label="Ambient Temperature" value={temp} onChange={setTemp} unit="°C" note="important for high-altitude cold sites"/>
      <CalcButton onClick={calculate} label="SIZE BATTERY"/>
      <ErrBox msg={error}/>
      {result&&<ResultBox rows={[
        {label:'Raw Capacity Required',value:result.rawAh,unit:'Ah'},
        {label:'Temperature Derating',value:result.tempFactor,unit:'%'},
        {label:'Required Capacity (temp corrected)',value:result.requiredAh,unit:'Ah',accent:true},
        {label:'➤ Selected Standard Size',value:result.selected,unit:'Ah',accent:true},
        {label:'Energy Stored',value:result.kWhStored,unit:'kWh'},
        {label:'Recommended Charger Size (C/10)',value:result.chargerA,unit:'A'},
      ]}/>}
    </div>
  )
}

// ── Lighting Calculator ────────────────────────────────────────────────────
const ROOM_TYPES=[
  {type:'Office',lux:500},{type:'Workshop/Factory',lux:300},{type:'Warehouse',lux:150},
  {type:'Corridor',lux:100},{type:'Tunnel/Mine',lux:200},{type:'Outdoor (general)',lux:50},
  {type:'Outdoor (security)',lux:20},{type:'Control room',lux:500},{type:'Emergency lighting',lux:10},
]
const FITTING_TYPES=[
  {name:'LED Highbay 100W',watts:100,lumens:12000},{name:'LED Highbay 150W',watts:150,lumens:18000},
  {name:'LED Highbay 200W',watts:200,lumens:24000},{name:'LED Batten 36W',watts:36,lumens:3600},
  {name:'LED Batten 58W',watts:58,lumens:6000},{name:'LED Floodlight 100W',watts:100,lumens:10000},
  {name:'LED Floodlight 200W',watts:200,lumens:20000},{name:'Fluorescent 2×36W',watts:72,lumens:6700},
  {name:'Metal Halide 250W',watts:250,lumens:20000},{name:'HPS 250W',watts:250,lumens:27500},
]

function LightingCalc({ addHistory }) {
  const [length,setLength]=useState(''),[width,setWidth]=useState(''),[height,setHeight]=useState('')
  const [roomIdx,setRoomIdx]=useState(2),[fittingIdx,setFittingIdx]=useState(0)
  const [mf,setMf]=useState('0.8'),[result,setResult]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    const L=pf(length),W=pf(width),H=pf(height)
    if(!L||!W){setError('Enter room dimensions');return}
    const area=L*W
    const room=ROOM_TYPES[roomIdx]
    const fitting=FITTING_TYPES[fittingIdx]
    const MF=pf(mf)||0.8
    // Room index (Utilisation Factor approximation)
    const k=H>0?(L*W)/(H*(L+W)):1
    const uf=Math.min(0.3+k*0.1,0.7)  // simplified UF
    // N = (E × A) / (Φ × UF × MF)
    const N=Math.ceil((room.lux*area)/(fitting.lumens*uf*MF))
    const totalW=N*fitting.watts
    const wperm2=(totalW/area).toFixed(1)
    setResult({N,totalW,wperm2,lux:room.lux,area:area.toFixed(0),uf:uf.toFixed(2)})
    addHistory({tab:'Lighting',expr:`${L}×${W}m ${room.type}`,result:`${N}× ${fitting.name}`})
  }

  return(
    <div className="px-4 py-3">
      <InfoBox title="Lumen Method — Lighting Calculator" lines={['N = (E × A) / (Φ × UF × MF)','E=required lux, Φ=lamp lumens, UF=utilisation, MF=maintenance']}/>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <NumInput label="Length" value={length} onChange={setLength} unit="m"/>
        <NumInput label="Width" value={width} onChange={setWidth} unit="m"/>
        <NumInput label="Height" value={height} onChange={setHeight} unit="m"/>
      </div>
      <SelectInput label="Room / Application Type" value={String(roomIdx)} onChange={v=>setRoomIdx(pf(v))} options={ROOM_TYPES.map((r,i)=>[String(i),`${r.type} (${r.lux} lux)`])}/>
      <SelectInput label="Luminaire Type" value={String(fittingIdx)} onChange={v=>setFittingIdx(pf(v))} options={FITTING_TYPES.map((f,i)=>[String(i),`${f.name} (${f.lumens} lm)`])}/>
      <NumInput label="Maintenance Factor (MF)" value={mf} onChange={setMf} unit="" note="0.7–0.9 typical"/>
      <CalcButton onClick={calculate} label="CALCULATE LIGHTING"/>
      <ErrBox msg={error}/>
      {result&&<ResultBox rows={[
        {label:'Room Area',value:result.area,unit:'m²'},
        {label:'Required Illuminance',value:result.lux,unit:'lux'},
        {label:'Utilisation Factor',value:result.uf,unit:''},
        {label:'➤ Number of Fittings',value:result.N,unit:'fittings',accent:true},
        {label:'Total Installed Load',value:result.totalW,unit:'W'},
        {label:'Power Density',value:result.wperm2,unit:'W/m²'},
      ]}/>}
    </div>
  )
}

const TABS=[
  {id:'thd',      label:'Harmonics', icon:'〰'},
  {id:'battery',  label:'Battery',   icon:'🔋'},
  {id:'lighting', label:'Lighting',  icon:'💡'},
]

export default function PowerQuality({ addHistory }) {
  const [sub,setSub]=useState('thd')
  const map={thd:<HarmonicsCalc addHistory={addHistory}/>,battery:<BatterySizing addHistory={addHistory}/>,lighting:<LightingCalc addHistory={addHistory}/>}
  return(
    <div className="flex flex-col h-full overflow-hidden">
      <SubTabBar tabs={TABS} active={sub} onChange={setSub}/>
      <div className="flex-1 overflow-y-auto">{map[sub]}</div>
    </div>
  )
}
