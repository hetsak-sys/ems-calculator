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

// ── GLAND DATA ──────────────────────────────────────────────────────────────
// Standard metric cable gland sizes 0–7
// [size number, OD min, OD max, thread, A2(unarm), CW(SWA)]
const GLAND_SIZES = [
  { size: '0',  min: 3,   max: 7,   thread: 'M16',  a2: 'Size 0',  cw: 'CW0'  },
  { size: '1',  min: 6,   max: 12,  thread: 'M20',  a2: 'Size 1',  cw: 'CW1'  },
  { size: '2',  min: 10,  max: 17,  thread: 'M25',  a2: 'Size 2',  cw: 'CW2'  },
  { size: '3',  min: 14,  max: 21,  thread: 'M32',  a2: 'Size 3',  cw: 'CW3'  },
  { size: '4',  min: 18,  max: 27,  thread: 'M40',  a2: 'Size 4',  cw: 'CW4'  },
  { size: '5',  min: 24,  max: 34,  thread: 'M50',  a2: 'Size 5',  cw: 'CW5'  },
  { size: '6',  min: 30,  max: 45,  thread: 'M63',  a2: 'Size 6',  cw: 'CW6'  },
  { size: '7',  min: 42,  max: 60,  thread: 'M75',  a2: 'Size 7',  cw: 'CW7'  },
]

// Typical OD table: [conductor mm², cores, PVC-unarm OD, PVC-SWA OD, XLPE-unarm OD, XLPE-SWA OD]
const CABLE_OD_TABLE = [
  // size,  cores, PVC-UA, PVC-A,  XLPE-UA, XLPE-A
  [1.5,  2,  8.2,   11.0,  8.5,   11.5 ],
  [1.5,  3,  8.8,   11.8,  9.0,   12.0 ],
  [1.5,  4,  9.8,   13.0,  10.0,  13.5 ],
  [2.5,  2,  9.0,   12.0,  9.5,   12.5 ],
  [2.5,  3,  9.8,   13.0,  10.2,  13.5 ],
  [2.5,  4,  11.0,  14.5,  11.5,  15.0 ],
  [4,    2,  10.0,  13.5,  10.5,  14.0 ],
  [4,    3,  11.0,  14.5,  11.5,  15.0 ],
  [4,    4,  12.5,  16.5,  13.0,  17.0 ],
  [6,    2,  11.0,  14.5,  11.5,  15.0 ],
  [6,    3,  12.2,  16.0,  12.8,  16.8 ],
  [6,    4,  14.0,  18.0,  14.5,  18.8 ],
  [10,   2,  12.8,  16.8,  13.5,  17.5 ],
  [10,   3,  14.2,  18.5,  15.0,  19.5 ],
  [10,   4,  16.5,  21.0,  17.0,  22.0 ],
  [16,   2,  14.5,  19.0,  15.2,  20.0 ],
  [16,   3,  16.5,  21.5,  17.0,  22.5 ],
  [16,   4,  19.0,  24.5,  20.0,  25.5 ],
  [25,   2,  17.0,  22.0,  17.8,  23.0 ],
  [25,   3,  19.5,  25.5,  20.5,  26.5 ],
  [25,   4,  22.5,  29.0,  23.5,  30.0 ],
  [35,   2,  19.0,  25.0,  20.0,  26.0 ],
  [35,   3,  22.0,  28.5,  23.0,  30.0 ],
  [35,   4,  25.5,  33.0,  26.5,  34.5 ],
  [50,   2,  21.5,  28.5,  22.5,  30.0 ],
  [50,   3,  25.0,  32.5,  26.0,  34.0 ],
  [50,   4,  29.0,  37.5,  30.5,  39.5 ],
  [70,   2,  24.5,  32.5,  25.5,  34.0 ],
  [70,   3,  28.5,  37.0,  30.0,  39.0 ],
  [70,   4,  33.5,  43.0,  35.0,  45.0 ],
  [95,   2,  27.5,  36.5,  29.0,  38.5 ],
  [95,   3,  32.5,  42.0,  34.0,  44.0 ],
  [95,   4,  38.0,  49.0,  40.0,  51.5 ],
  [120,  2,  30.5,  40.5,  32.0,  42.5 ],
  [120,  3,  36.0,  46.5,  37.5,  48.5 ],
  [120,  4,  42.5,  54.5,  44.5,  57.0 ],
  [150,  2,  33.5,  44.5,  35.0,  46.5 ],
  [150,  3,  39.5,  51.0,  41.5,  53.5 ],
  [150,  4,  46.5,  59.5,  49.0,  62.5 ],
  [185,  2,  37.0,  49.0,  39.0,  51.5 ],
  [185,  3,  43.5,  56.5,  45.5,  59.0 ],
  [185,  4,  51.5,  65.5,  54.0,  68.5 ],
  [240,  3,  49.0,  63.0,  51.5,  66.0 ],
  [300,  3,  55.0,  70.0,  58.0,  73.5 ],
]

const CONDUCTOR_SIZES = [...new Set(CABLE_OD_TABLE.map(r => r[0]))].map(s => [String(s), `${s} mm²`])
const CORE_OPTIONS = [['2','2 Core'],['3','3 Core'],['4','4 Core']]
const ARMOUR_OPTIONS = [['unarm','Unarmoured'],['swa','SWA (Steel Wire Armoured)']]
const INSUL_OPTIONS  = [['pvc','PVC'],['xlpe','XLPE']]

function getOD(size, cores, armoured, insul) {
  const row = CABLE_OD_TABLE.find(r => r[0] === size && r[1] === cores)
  if (!row) return null
  if (armoured === 'swa') return insul === 'xlpe' ? row[5] : row[3]
  return insul === 'xlpe' ? row[4] : row[2]
}

function findGland(od) {
  return GLAND_SIZES.find(g => od >= g.min && od <= g.max) || null
}

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
    if (method === 'conductor') {
      const size = pf(condSize), coreN = pf(cores)
      const typOD = getOD(size, coreN, armour, insul)
      if (!typOD) { setError('No data for this combination'); return }
      const gland = findGland(typOD)
      if (!gland) { setError('Cable OD outside standard gland range'); return }
      setResult({
        od: typOD,
        gland: gland.size,
        thread: gland.thread,
        type: armour === 'swa' ? gland.cw : gland.a2,
        glandType: armour === 'swa' ? 'CW (SWA Armoured)' : 'A2 (Unarmoured)',
        min: gland.min, max: gland.max,
        conductor: condSize, cores, armour, insul,
      })
    } else {
      const OD = pf(od)
      if (!OD) { setError('Enter cable outer diameter'); return }
      const gland = findGland(OD)
      if (!gland) { setError('OD outside standard gland range (3–60mm)'); return }
      setResult({
        od: OD,
        gland: gland.size,
        thread: gland.thread,
        type: `${gland.a2} (unarm) / ${gland.cw} (SWA)`,
        glandType: 'Check armour type',
        min: gland.min, max: gland.max,
      })
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
