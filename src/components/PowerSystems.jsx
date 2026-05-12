import { useState } from 'react'
import { SQRT3, pf, NumInput, SelectInput, ToggleInput, ResultBox, InfoBox, ErrBox, CalcButton, SubTabBar } from './shared'

// ── Transformer ────────────────────────────────────────────────────────────
function TransformerCalc({ addHistory }) {
  const [mode,setMode]=useState('currents'),[vp,setVp]=useState(''),[vs,setVs]=useState('')
  const [kva,setKva]=useState(''),[eff,setEff]=useState('98'),[phase,setPhase]=useState('3ph')
  const [ip,setIp]=useState(''),[ratio,setRatio]=useState('')
  const [result,setResult]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    const VP=pf(vp),VS=pf(vs),KVA=pf(kva),EFF=pf(eff)/100
    if(mode==='currents'){
      if(!VP||!VS||!KVA){setError('Enter Vp, Vs, and kVA');return}
      const n=VP/VS
      const Ip=phase==='3ph'?(KVA*1000)/(SQRT3*VP):(KVA*1000)/VP
      const Is=phase==='3ph'?(KVA*1000)/(SQRT3*VS):(KVA*1000)/VS
      setResult({rows:[{label:'Turns Ratio (n)',value:`${n.toFixed(4)}:1`,accent:true},{label:'Primary Current (Ip)',value:`${Ip.toFixed(2)} A`},{label:'Secondary Current (Is)',value:`${Is.toFixed(2)} A`},{label:'Output Power (η)',value:`${(KVA*EFF).toFixed(2)} kW`},{label:'Losses',value:`${((1-EFF)*KVA*1000).toFixed(0)} W`}]})
      addHistory({tab:'Trafo',expr:`${KVA}kVA ${VP}/${VS}V`,result:`Ip=${Ip.toFixed(1)}A`})
    } else if(mode==='kva'){
      if(!VP||!VS||!pf(ip)){setError('Enter Vp, Vs, and Ip');return}
      const IP=pf(ip)
      const kvaC=phase==='3ph'?(SQRT3*VP*IP)/1000:(VP*IP)/1000
      const IS=kvaC*1000/(phase==='3ph'?SQRT3*VS:VS)
      setResult({rows:[{label:'Transformer kVA',value:`${kvaC.toFixed(2)} kVA`,accent:true},{label:'Turns Ratio',value:`${(VP/VS).toFixed(4)}:1`},{label:'Secondary Current',value:`${IS.toFixed(2)} A`},{label:'Output kW',value:`${(kvaC*EFF).toFixed(2)} kW`}]})
      addHistory({tab:'Trafo',expr:`${VP}/${VS}V Ip=${IP}A`,result:`${kvaC.toFixed(1)}kVA`})
    } else {
      if(!VP||!KVA||!pf(ratio)){setError('Enter Vp, kVA, and turns ratio');return}
      const N=pf(ratio),VSc=VP/N
      const Ip=phase==='3ph'?(KVA*1000)/(SQRT3*VP):(KVA*1000)/VP
      const Is=phase==='3ph'?(KVA*1000)/(SQRT3*VSc):(KVA*1000)/VSc
      setResult({rows:[{label:'Secondary Voltage',value:`${VSc.toFixed(2)} V`,accent:true},{label:'Primary Current',value:`${Ip.toFixed(2)} A`},{label:'Secondary Current',value:`${Is.toFixed(2)} A`}]})
    }
  }

  return(
    <div className="px-4 py-3">
      <div className="mb-3">
        <label className="text-gray-400 text-xs mb-2 block">Solve For</label>
        <div className="flex gap-2">
          {[['currents','Currents'],['kva','kVA'],['voltage','Voltage']].map(([id,l])=>(
            <button key={id} onClick={()=>{setMode(id);setResult(null);setError('')}} className={`flex-1 py-2 rounded-xl text-sm font-semibold ${mode===id?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>{l}</button>
          ))}
        </div>
      </div>
      <ToggleInput label="Type" options={[['1ph','1φ Single'],['3ph','3φ Three']]} value={phase} onChange={setPhase}/>
      <NumInput label="Primary Voltage (Vp)" value={vp} onChange={setVp} unit="V"/>
      <NumInput label="Secondary Voltage (Vs)" value={vs} onChange={setVs} unit="V"/>
      {mode==='currents'&&<NumInput label="Rating" value={kva} onChange={setKva} unit="kVA"/>}
      {mode==='kva'&&<NumInput label="Primary Current (Ip)" value={ip} onChange={setIp} unit="A"/>}
      {mode==='voltage'&&<><NumInput label="Rating" value={kva} onChange={setKva} unit="kVA"/><NumInput label="Turns Ratio (n = Vp/Vs)" value={ratio} onChange={setRatio} unit=":1"/></>}
      <NumInput label="Efficiency" value={eff} onChange={setEff} unit="%"/>
      <CalcButton onClick={calculate}/>
      <ErrBox msg={error}/>
      {result&&<ResultBox rows={result.rows}/>}
    </div>
  )
}

// ── Power Factor ───────────────────────────────────────────────────────────
function PowerFactorCalc({ addHistory }) {
  const [phase,setPhase]=useState('3ph'),[kw,setKw]=useState(''),[voltage,setVoltage]=useState('400')
  const [curPF,setCurPF]=useState(''),[tgtPF,setTgtPF]=useState('0.95'),[freq,setFreq]=useState('50')
  const [result,setResult]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    const KW=pf(kw),PFi=pf(curPF),PFt=pf(tgtPF),V=pf(voltage),F=pf(freq)||50
    if(!KW||!PFi||!PFt||!V){setError('All fields required');return}
    if(PFi<=0||PFi>1){setError('Current PF must be 0–1');return}
    if(PFt<=PFi){setError('Target PF must be higher than current PF');return}
    const thi=Math.acos(PFi),tht=Math.acos(PFt)
    const kvaI=KW/PFi,kvaT=KW/PFt
    const kvarI=KW*Math.tan(thi),kvarT=KW*Math.tan(tht)
    const kvarCap=kvarI-kvarT
    const omega=2*Math.PI*F
    const C_uF=phase==='3ph'?(kvarCap*1000)/(3*V*V*omega)*1e6:(kvarCap*1000)/(V*V*omega)*1e6
    const curI=phase==='3ph'?(kvaI*1000)/(SQRT3*V):(kvaI*1000)/V
    const tgtI=phase==='3ph'?(kvaT*1000)/(SQRT3*V):(kvaT*1000)/V
    setResult({kvarCap:kvarCap.toFixed(2),C:C_uF.toFixed(1),kvaI:kvaI.toFixed(2),kvaT:kvaT.toFixed(2),kvarI:kvarI.toFixed(2),kvarT:kvarT.toFixed(2),curI:curI.toFixed(2),tgtI:tgtI.toFixed(2),reduction:((curI-tgtI)/curI*100).toFixed(1)})
    addHistory({tab:'PF',expr:`${KW}kW ${PFi}→${PFt}`,result:`${kvarCap.toFixed(1)}kVAr`})
  }

  return(
    <div className="px-4 py-3">
      <ToggleInput label="System" options={[['1ph','Single Phase'],['3ph','Three Phase']]} value={phase} onChange={setPhase}/>
      <NumInput label="Active Power" value={kw} onChange={setKw} unit="kW"/>
      <NumInput label="System Voltage (L-L)" value={voltage} onChange={setVoltage} unit="V"/>
      <NumInput label="Current Power Factor" value={curPF} onChange={setCurPF} unit="PF" placeholder="e.g. 0.72"/>
      <NumInput label="Target Power Factor" value={tgtPF} onChange={setTgtPF} unit="PF" placeholder="e.g. 0.95"/>
      <NumInput label="Frequency" value={freq} onChange={setFreq} unit="Hz"/>
      <CalcButton onClick={calculate}/>
      <ErrBox msg={error}/>
      {result&&<>
        <div className="bg-[#0a1a0a] border border-[#1a3a1a] rounded-xl px-4 py-4 mb-4">
          <div className="text-green-400 text-xs font-bold mb-3">CAPACITOR BANK REQUIRED</div>
          <div className="flex justify-between">
            <div><div className="text-gray-500 text-xs">Reactive Power</div><div className="text-green-400 text-3xl font-bold">{result.kvarCap} <span className="text-sm font-normal text-green-600">kVAr</span></div></div>
            <div className="text-right"><div className="text-gray-500 text-xs">Capacitance ({phase==='3ph'?'Δ':'1φ'})</div><div className="text-amber-400 text-2xl font-bold">{result.C} <span className="text-sm font-normal text-amber-600">μF</span></div></div>
          </div>
        </div>
        <ResultBox title="BEFORE vs AFTER" rows={[
          {label:'kVA (before → after)',value:`${result.kvaI} → ${result.kvaT}`,unit:'kVA'},
          {label:'kVAr (before → after)',value:`${result.kvarI} → ${result.kvarT}`,unit:'kVAr'},
          {label:'Current (before → after)',value:`${result.curI} → ${result.tgtI}`,unit:'A'},
          {label:'Current Reduction',value:result.reduction,unit:'%',accent:true},
        ]}/>
        <InfoBox color="amber" title="⚠ VFD / Non-Linear Loads" lines={['Standard capacitors may cause harmonic resonance','Use detuned reactor banks (p-factor 5–7%) for VFD-driven loads']}/>
      </>}
    </div>
  )
}

// ── Generator Sizing ───────────────────────────────────────────────────────
function GeneratorSizing({ addHistory }) {
  const [loads,setLoads]=useState([{name:'',kw:'',pf:'0.85',qty:'1'}])
  const [largestMotorKW,setLargestMotorKW]=useState(''),[altitude,setAltitude]=useState('1500')
  const [ambientTemp,setAmbientTemp]=useState('25'),[result,setResult]=useState(null),[error,setError]=useState('')

  const addLoad=()=>setLoads(l=>[...l,{name:'',kw:'',pf:'0.85',qty:'1'}])
  const removeLoad=(i)=>setLoads(l=>l.filter((_,j)=>j!==i))
  const updateLoad=(i,field,val)=>setLoads(l=>l.map((item,j)=>j===i?{...item,[field]:val}:item))

  const calculate=()=>{
    setError('')
    const totalKW=loads.reduce((s,l)=>s+pf(l.kw)*pf(l.qty),0)
    const totalKVA=loads.reduce((s,l)=>{const kw=pf(l.kw)*pf(l.qty);return s+(pf(l.pf)>0?kw/pf(l.pf):kw)},0)
    if(!totalKW){setError('Add at least one load');return}
    // DOL starting kVA for largest motor (×6 FLC, PF=0.35 during start)
    const lmKW=pf(largestMotorKW)
    const startKVA=lmKW?((lmKW*1000)/(SQRT3*400*0.85)*6*400*SQRT3/1000):0
    // Altitude derating: -1% per 100m above 1000m
    const alt=pf(altitude)
    const altDerate=alt>1000?1-(alt-1000)*0.01/100:1
    // Temperature derating: -1% per °C above 40°C
    const temp=pf(ambientTemp)
    const tempDerate=temp>40?1-(temp-40)*0.01:1
    const totalDerate=altDerate*tempDerate
    const runningKVA=totalKVA/0.8  // assume 0.8 gen PF
    const withStart=runningKVA+startKVA*0.25  // 25% of start kVA added
    const requiredKVA=withStart/totalDerate
    // Standard generator sizes
    const genSizes=[20,30,45,60,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600]
    const selected=genSizes.find(s=>s>=requiredKVA)||1600
    setResult({totalKW:totalKW.toFixed(1),totalKVA:totalKVA.toFixed(1),startKVA:startKVA.toFixed(1),requiredKVA:requiredKVA.toFixed(1),selected,altDerate:(altDerate*100).toFixed(1),tempDerate:(tempDerate*100).toFixed(1)})
    addHistory({tab:'Generator',expr:`${totalKW.toFixed(0)}kW loads`,result:`${selected}kVA`})
  }

  return(
    <div className="px-4 py-3">
      <InfoBox title="Generator Sizing" lines={['Enter all connected loads','Largest motor starting kVA added to running load']}/>
      {loads.map((load,i)=>(
        <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 mb-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 text-xs">Load {i+1}</span>
            {loads.length>1&&<button onClick={()=>removeLoad(i)} className="text-red-500 text-xs">Remove</button>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-gray-500 text-[10px]">Name</label>
              <input type="text" value={load.name} onChange={e=>updateLoad(i,'name',e.target.value)}
                className="w-full bg-[#111] border border-[#333] text-white text-sm rounded-lg px-3 py-2 outline-none mt-1" placeholder="e.g. Pump"/>
            </div>
            <div>
              <label className="text-gray-500 text-[10px]">kW</label>
              <input type="text" inputMode="decimal" value={load.kw} onChange={e=>updateLoad(i,'kw',e.target.value.replace(',','.'))}
                className="w-full bg-[#111] border border-[#333] text-white text-sm rounded-lg px-3 py-2 outline-none mt-1" placeholder="0"/>
            </div>
            <div>
              <label className="text-gray-500 text-[10px]">Power Factor</label>
              <input type="text" inputMode="decimal" value={load.pf} onChange={e=>updateLoad(i,'pf',e.target.value.replace(',','.'))}
                className="w-full bg-[#111] border border-[#333] text-white text-sm rounded-lg px-3 py-2 outline-none mt-1" placeholder="0.85"/>
            </div>
            <div>
              <label className="text-gray-500 text-[10px]">Quantity</label>
              <input type="text" inputMode="decimal" value={load.qty} onChange={e=>updateLoad(i,'qty',e.target.value)}
                className="w-full bg-[#111] border border-[#333] text-white text-sm rounded-lg px-3 py-2 outline-none mt-1" placeholder="1"/>
            </div>
          </div>
        </div>
      ))}
      <button onClick={addLoad} className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-gray-400 py-3 rounded-xl text-sm mb-4">+ Add Load</button>
      <NumInput label="Largest Motor (for start kVA)" value={largestMotorKW} onChange={setLargestMotorKW} unit="kW" placeholder="0"/>
      <NumInput label="Site Altitude" value={altitude} onChange={setAltitude} unit="m" note="Letseng ≈ 3100m"/>
      <NumInput label="Max Ambient Temperature" value={ambientTemp} onChange={setAmbientTemp} unit="°C"/>
      <CalcButton onClick={calculate} label="SIZE GENERATOR"/>
      <ErrBox msg={error}/>
      {result&&<>
        <ResultBox rows={[
          {label:'Total Running Load',value:result.totalKW,unit:'kW'},
          {label:'Total Running Load',value:result.totalKVA,unit:'kVA'},
          {label:'Motor Start Contribution',value:result.startKVA,unit:'kVA'},
          {label:'Altitude Derating',value:result.altDerate,unit:'%'},
          {label:'Temperature Derating',value:result.tempDerate,unit:'%'},
          {label:'Required Generator Size',value:result.requiredKVA,unit:'kVA'},
          {label:'➤ Selected Standard Size',value:result.selected,unit:'kVA',accent:true},
        ]}/>
        <InfoBox color="amber" title="Letseng Altitude Note" lines={['At 3100m altitude, derating is approximately 21%','Specify altitude derating to generator supplier — this is critical','High-altitude generators require turbocharging or oversizing']}/>
      </>}
    </div>
  )
}

// ── Busbar Rating ──────────────────────────────────────────────────────────
const BUSBAR_DATA=[
  // [width mm, thickness mm, Cu A, Al A]
  [20,3,165,125],[25,3,200,150],[30,5,290,220],[40,5,365,275],[50,5,435,330],
  [50,6,490,375],[60,6,570,430],[80,6,715,540],[100,6,855,645],[100,10,1070,810],
  [120,10,1235,935],[160,10,1565,1185],[200,10,1870,1415],
]

function BusbarRating({ addHistory }) {
  const [width,setWidth]=useState('50'),[thick,setThick]=useState('6'),[material,setMat]=useState('Cu')
  const [result,setResult]=useState(null)

  const calculate=()=>{
    const W=pf(width),T=pf(thick)
    const area=W*T
    // Current density: Cu ~1.6 A/mm², Al ~1.2 A/mm² (conservative, flat mounted)
    const density=material==='Cu'?1.6:1.2
    const rating=area*density
    // Find closest standard
    const closest=BUSBAR_DATA.reduce((best,row)=>{
      const diff=Math.abs(row[0]-W)+Math.abs(row[1]-T)
      return diff<Math.abs(best[0]-W)+Math.abs(best[1]-T)?row:best
    },BUSBAR_DATA[0])
    const stdRating=material==='Cu'?closest[2]:closest[3]
    setResult({area,rating:rating.toFixed(0),stdRating,w:W,t:T})
    addHistory({tab:'Busbar',expr:`${W}×${T}mm ${material}`,result:`${stdRating}A`})
  }

  return(
    <div className="px-4 py-3">
      <InfoBox title="Busbar Current Rating" lines={['Flat mounted, natural convection','Based on IEC 60439 / SANS 60439 guidance']}/>
      <ToggleInput label="Material" options={[['Cu','Copper'],['Al','Aluminium']]} value={material} onChange={setMat}/>
      <NumInput label="Busbar Width" value={width} onChange={setWidth} unit="mm" placeholder="e.g. 50"/>
      <NumInput label="Busbar Thickness" value={thick} onChange={setThick} unit="mm" placeholder="e.g. 6"/>
      <CalcButton onClick={calculate} label="GET RATING"/>
      {result&&<ResultBox rows={[
        {label:'Cross-Section',value:result.area,unit:'mm²'},
        {label:'Calculated Rating',value:result.rating,unit:'A'},
        {label:'Standard Reference Rating',value:result.stdRating,unit:'A',accent:true},
      ]}/>}
    </div>
  )
}

// ── Motor Starting Methods ─────────────────────────────────────────────────
function MotorStarting({ addHistory }) {
  const [kw,setKw]=useState(''),[voltage,setVoltage]=useState('400'),[fla,setFla]=useState('')
  const [result,setResult]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    const KW=pf(kw),V=pf(voltage)
    const FLA=pf(fla)||(KW*1000)/(SQRT3*V*0.85)
    if(!KW){setError('Enter motor power');return}
    const dolStart=FLA*6, dolTorque=100
    const sdStart=FLA*2, sdTorque=33  // star: 1/3 torque, 1/3 current
    const atStart=FLA*3.5, atTorque=56  // 75% tap autotransformer
    const ssStart=FLA*3, ssTorque=80   // soft starter typical
    const vfdStart=FLA*1.1, vfdTorque=100  // VFD: full torque, controlled
    setResult({FLA:FLA.toFixed(1),methods:[
      {name:'DOL (Direct On Line)',start:dolStart.toFixed(0),torque:dolTorque,pros:'Simple, low cost',cons:'High start current, mechanical shock'},
      {name:'Star-Delta',start:sdStart.toFixed(0),torque:sdTorque,pros:'Reduced start current',cons:'Torque dip at changeover, not for high-inertia loads'},
      {name:'Autotransformer (75% tap)',start:atStart.toFixed(0),torque:atTorque,pros:'Better torque than Y/D',cons:'Expensive, large'},
      {name:'Soft Starter',start:ssStart.toFixed(0),torque:ssTorque,pros:'Smooth start, adjustable ramp',cons:'Generates harmonics, no speed control'},
      {name:'VFD (Variable Frequency Drive)',start:vfdStart.toFixed(0),torque:vfdTorque,pros:'Full torque, speed control, energy saving',cons:'Most expensive, generates harmonics'},
    ]})
    addHistory({tab:'Starting',expr:`${KW}kW ${V}V`,result:`DOL=${dolStart.toFixed(0)}A`})
  }

  return(
    <div className="px-4 py-3">
      <NumInput label="Motor Power" value={kw} onChange={setKw} unit="kW"/>
      <NumInput label="Supply Voltage (L-L)" value={voltage} onChange={setVoltage} unit="V"/>
      <NumInput label="Motor FLA (leave blank to calculate)" value={fla} onChange={setFla} unit="A" placeholder="auto-calculated"/>
      <CalcButton onClick={calculate} label="COMPARE METHODS"/>
      <ErrBox msg={error}/>
      {result&&<>
        <div className="text-gray-400 text-xs mb-3">Motor FLA: <span className="text-white font-bold">{result.FLA} A</span></div>
        {result.methods.map((m,i)=>(
          <div key={i} className="bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 mb-3">
            <div className="text-amber-400 text-sm font-bold mb-2">{m.name}</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-[#1a1a1a] rounded-lg px-3 py-2">
                <div className="text-gray-500 text-[10px]">Start Current</div>
                <div className="text-white font-bold">{m.start} A</div>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg px-3 py-2">
                <div className="text-gray-500 text-[10px]">Start Torque</div>
                <div className="text-white font-bold">{m.torque}%</div>
              </div>
            </div>
            <div className="text-green-400 text-xs">✓ {m.pros}</div>
            <div className="text-red-400 text-xs mt-1">✗ {m.cons}</div>
          </div>
        ))}
      </>}
    </div>
  )
}

const TABS=[
  {id:'trafo',    label:'Transformer',icon:'⇌'},
  {id:'pf',       label:'PF Correct', icon:'φ'},
  {id:'gen',      label:'Generator',  icon:'⚡'},
  {id:'busbar',   label:'Busbar',     icon:'▬'},
  {id:'starting', label:'Starting',   icon:'▶'},
]

export default function PowerSystems({ addHistory }) {
  const [sub,setSub]=useState('trafo')
  const map={trafo:<TransformerCalc addHistory={addHistory}/>,pf:<PowerFactorCalc addHistory={addHistory}/>,gen:<GeneratorSizing addHistory={addHistory}/>,busbar:<BusbarRating addHistory={addHistory}/>,starting:<MotorStarting addHistory={addHistory}/>}
  return(
    <div className="flex flex-col h-full overflow-hidden">
      <SubTabBar tabs={TABS} active={sub} onChange={setSub}/>
      <div className="flex-1 overflow-y-auto">{map[sub]}</div>
    </div>
  )
}
