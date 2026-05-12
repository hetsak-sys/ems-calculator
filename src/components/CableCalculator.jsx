import { useState } from 'react'
import { SQRT3, pf, NumInput, SelectInput, ToggleInput, ResultBox, InfoBox, ErrBox, CalcButton, SubTabBar } from './shared'

const CABLE_DATA = [
  [1.5,  17.5,16.5,12.10,20.00,0.10],[2.5,  24,  23,  7.41, 12.10,0.10],
  [4,    32,  31,  4.61, 7.41, 0.10],[6,    41,  40,  3.08, 4.61, 0.10],
  [10,   57,  54,  1.83, 3.08, 0.09],[16,   76,  73,  1.15, 1.83, 0.09],
  [25,   99,  96,  0.727,1.20, 0.09],[35,   121, 119, 0.524,0.868,0.08],
  [50,   150, 144, 0.387,0.641,0.08],[70,   191, 184, 0.268,0.443,0.08],
  [95,   232, 223, 0.193,0.320,0.08],[120,  269, 259, 0.153,0.253,0.08],
  [150,  309, 299, 0.124,0.206,0.08],[185,  353, 341, 0.0991,0.164,0.08],
  [240,  415, 403, 0.0754,0.125,0.08],[300, 477, 464, 0.0601,0.100,0.08],
]
const XLPE=1.15, AL=0.78
const AMBIENT={'-20':1.36,'-15':1.31,'-10':1.26,'-5':1.21,'0':1.15,'5':1.10,'10':1.05,'15':1.03,'20':1.01,'25':1.03,'30':1.00,'35':0.94,'40':0.87,'45':0.79,'50':0.71,'55':0.61,'60':0.50}
const GROUP={'1':1.00,'2':0.80,'3':0.70,'4':0.65,'5':0.60,'6':0.57}
const INSTALL={'Clipped direct':1.00,'Free air':1.04,'Conduit in wall':0.77,'Trunking':0.85,'Buried direct':0.96,'Buried in duct':0.80}

function CableSizing({ addHistory }) {
  const [phase,setPhase]=useState('3ph'),[current,setCurrent]=useState(''),[length,setLength]=useState('')
  const [voltage,setVoltage]=useState('400'),[insul,setInsul]=useState('PVC'),[material,setMat]=useState('Cu')
  const [ambient,setAmbient]=useState('30'),[groups,setGroups]=useState('1'),[install,setInstall]=useState('Clipped direct')
  const [maxVd,setMaxVd]=useState('3'),[results,setResults]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    const I=pf(current),L=pf(length),V=pf(voltage)
    if(!I||!L||!V){setError('Enter current, length, and voltage');return}
    const tF=AMBIENT[ambient]||1,gF=GROUP[groups]||0.57,iF=INSTALL[install]||1
    const derating=tF*gF*iF,required=I/derating
    let recommended=null
    const allResults=CABLE_DATA.map(row=>{
      let base=phase==='1ph'?row[1]:row[2]
      if(insul==='XLPE')base*=XLPE
      if(material==='Al')base*=AL
      const derated=base*derating
      const R=material==='Cu'?row[3]:row[4]
      const mult=phase==='1ph'?2:SQRT3
      const vdV=(mult*R*L*I)/1000,vdPct=(vdV/V*100)
      const pass=derated>=I&&vdPct<=pf(maxVd)
      if(pass&&!recommended)recommended=row[0]
      return{size:row[0],derated:derated.toFixed(1),vdV:vdV.toFixed(2),vdPct:vdPct.toFixed(2),currentOK:derated>=I,vdOK:vdPct<=pf(maxVd),pass}
    })
    if(!recommended)setError('No single size meets criteria — consider parallel cables')
    setResults({recommended,allResults,derating:(derating*100).toFixed(1),required:required.toFixed(1)})
    if(recommended)addHistory({tab:'Cable',expr:`${I}A ${L}m ${phase}`,result:`${recommended}mm²`})
  }

  return(
    <div className="px-4 py-3">
      <ToggleInput label="Phase" options={[['1ph','1φ Single'],['3ph','3φ Three']]} value={phase} onChange={setPhase}/>
      <ToggleInput label="Insulation" options={[['PVC','PVC 70°C'],['XLPE','XLPE 90°C']]} value={insul} onChange={setInsul}/>
      <ToggleInput label="Conductor" options={[['Cu','Copper'],['Al','Aluminium']]} value={material} onChange={setMat}/>
      <NumInput label="Design Current" value={current} onChange={setCurrent} unit="A"/>
      <NumInput label="Cable Length (one-way)" value={length} onChange={setLength} unit="m"/>
      <NumInput label="System Voltage" value={voltage} onChange={setVoltage} unit="V"/>
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
  const [phase,setPhase]=useState('3ph'),[current,setCurrent]=useState(''),[pfVal,setPf]=useState('0.85')
  const [length,setLength]=useState(''),[voltage,setVoltage]=useState('400'),[size,setSize]=useState('16')
  const [material,setMat]=useState('Cu'),[result,setResult]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    const I=pf(current),L=pf(length),V=pf(voltage),PF=pf(pfVal),S=pf(size)
    if(!I||!L||!V||!S){setError('Fill all fields');return}
    const row=CABLE_DATA.find(r=>r[0]===S)
    if(!row){setError('Invalid size');return}
    const R=material==='Cu'?row[3]:row[4],X=row[5],sinPhi=Math.sqrt(1-PF*PF)
    const mult=phase==='1ph'?2:SQRT3
    const vdD=(mult*I*L*(R*PF+X*sinPhi))/1000
    const vdS=(mult*R*L*I)/1000
    const pctD=(vdD/V*100),pctS=(vdS/V*100)
    setResult({vdD:vdD.toFixed(3),vdS:vdS.toFixed(3),pctD:pctD.toFixed(3),pctS:pctS.toFixed(3),Vend:(V-vdD).toFixed(1),pass:pctD<=3})
    addHistory({tab:'VD',expr:`${I}A ${L}m ${S}mm²`,result:`${pctD.toFixed(2)}%`})
  }

  return(
    <div className="px-4 py-3">
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
    const kVA=pf(sourceKVA),V=pf(voltage),L=pf(cableLen),S=pf(cableSize)
    if(!kVA||!V){setError('Enter source kVA and voltage');return}
    const Zs=(V*V)/(kVA*1000)
    let Zc=0
    if(L&&S){
      const row=CABLE_DATA.find(r=>r[0]===S)
      if(row){const R=(material==='Cu'?row[3]:row[4])*L/1000,X=row[5]*L/1000;Zc=Math.sqrt((2*R)**2+(2*X)**2)}
    }
    const Zt=Zs+Zc
    const i3=(V/(SQRT3*Zt)).toFixed(0),i1=(V/(2*Zt)).toFixed(0)
    setResult({Zs:(Zs*1000).toFixed(2),Zc:(Zc*1000).toFixed(2),Zt:(Zt*1000).toFixed(2),i3,i1,i3kA:(pf(i3)/1000).toFixed(3),i1kA:(pf(i1)/1000).toFixed(3)})
    addHistory({tab:'ISC',expr:`${kVA}kVA ${V}V`,result:`${(pf(i3)/1000).toFixed(3)}kA`})
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

const TRAILING=[
  [4,42,4.61,0.55],[6,53,3.08,0.71],[10,72,1.83,1.01],[16,96,1.15,1.42],
  [25,125,0.727,2.05],[35,152,0.524,2.72],[50,183,0.387,3.60],[70,232,0.268,4.80],
  [95,278,0.193,6.30],[120,320,0.153,7.80],[150,365,0.124,9.40],[185,415,0.0991,11.5],
]

function TrailingCable({ addHistory }) {
  const [current,setCurrent]=useState(''),[length,setLength]=useState('')
  const [voltage,setVoltage]=useState('525'),[maxVd,setMaxVd]=useState('5')
  const [results,setResults]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    const I=pf(current),L=pf(length),V=pf(voltage)
    if(!I||!L||!V){setError('Enter current, length, voltage');return}
    const derating=0.85,required=I/derating
    let recommended=null
    const allResults=TRAILING.map(row=>{
      const derated=row[1]*derating,vdV=(SQRT3*row[2]*L*I)/1000,vdPct=(vdV/V*100)
      const pass=derated>=I&&vdPct<=pf(maxVd)
      if(pass&&!recommended)recommended=row[0]
      return{size:row[0],derated:derated.toFixed(0),vdPct:vdPct.toFixed(2),weight:(row[3]*L).toFixed(0),pass,currentOK:derated>=I,vdOK:vdPct<=pf(maxVd)}
    })
    if(!recommended)setError('No standard trailing cable meets criteria')
    setResults({recommended,allResults,required:required.toFixed(1)})
    if(recommended)addHistory({tab:'Trailing',expr:`${I}A ${L}m ${V}V`,result:`${recommended}mm²`})
  }

  return(
    <div className="px-4 py-3">
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

const CONDUIT_SIZES=[16,20,25,32,40,50,63,75,100]
const CABLE_OD={'1.5':7.6,'2.5':8.2,'4':9.2,'6':10.2,'10':12.2,'16':14.2,'25':17.5,'35':19.5,'50':22.3,'70':26.7,'95':30.5,'120':33.5}

function ConduitFill() {
  const [conduit,setConduit]=useState('25'),[cableSize,setCableSize]=useState('2.5')
  const [numCables,setNumCables]=useState(''),[result,setResult]=useState(null)

  const calculate=()=>{
    const D=pf(conduit),d=CABLE_OD[cableSize]||8,N=pf(numCables)
    if(!N){return}
    const cA=Math.PI*(D/2)**2,ca=Math.PI*(d/2)**2
    const fill=(N*ca/cA*100).toFixed(1)
    setResult({fill,max33:Math.floor(cA*0.33/ca),max40:Math.floor(cA*0.40/ca),pass:N*ca<=cA*0.33,pass40:N*ca<=cA*0.40})
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

const GLANDS=[[3,7,'20S','M20'],[6,12,'20','M20'],[10,17,'25','M25'],[14,21,'32','M32'],[18,25,'40','M40'],[22,32,'50','M50'],[29,38,'63','M63'],[35,45,'75','M75'],[42,54,'90','M90'],[50,65,'110','M110']]

function GlandSize() {
  const [od,setOd]=useState(''),[result,setResult]=useState(null),[error,setError]=useState('')
  const calculate=()=>{
    setError('')
    const OD=pf(od)
    if(!OD){setError('Enter cable OD');return}
    const m=GLANDS.find(r=>OD>=r[0]&&OD<=r[1])
    if(!m){setError('OD outside standard range');return}
    setResult({gland:m[2],thread:m[3],min:m[0],max:m[1]})
  }
  return(
    <div className="px-4 py-3">
      <InfoBox title="Cable Gland Size Selector" lines={['Enter measured cable outer diameter','Metric thread standard (IEC)']}/>
      <NumInput label="Cable Outer Diameter (measured)" value={od} onChange={setOd} unit="mm" placeholder="e.g. 18.5"/>
      <CalcButton onClick={calculate} label="SELECT GLAND"/>
      <ErrBox msg={error}/>
      {result&&<ResultBox rows={[
        {label:'Gland Size',value:result.gland,unit:'',accent:true},
        {label:'Thread',value:result.thread,unit:'',accent:true},
        {label:'Cable OD Range',value:`${result.min}–${result.max}`,unit:'mm'},
      ]}/>}
    </div>
  )
}

const TABS=[{id:'sizing',label:'Sizing',icon:'≋'},{id:'vd',label:'Volt Drop',icon:'⬇'},{id:'isc',label:'Fault I',icon:'⚡'},{id:'trailing',label:'Trailing',icon:'〰'},{id:'conduit',label:'Conduit',icon:'○'},{id:'gland',label:'Gland',icon:'⊗'}]

export default function CableCalculator({ addHistory }) {
  const [sub,setSub]=useState('sizing')
  const map={sizing:<CableSizing addHistory={addHistory}/>,vd:<VoltDrop addHistory={addHistory}/>,isc:<ShortCircuit addHistory={addHistory}/>,trailing:<TrailingCable addHistory={addHistory}/>,conduit:<ConduitFill/>,gland:<GlandSize/>}
  return(
    <div className="flex flex-col h-full overflow-hidden">
      <SubTabBar tabs={TABS} active={sub} onChange={setSub}/>
      <div className="flex-1 overflow-y-auto">{map[sub]}</div>
    </div>
  )
}
