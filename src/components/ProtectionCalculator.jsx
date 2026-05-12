import { useState } from 'react'
import { SQRT3, pf, NumInput, SelectInput, ToggleInput, ResultBox, InfoBox, ErrBox, CalcButton, SubTabBar } from './shared'

const VOLTAGES=[{label:'400V LV',vll:400},{label:'3.3kV',vll:3300},{label:'6.6kV',vll:6600},{label:'11kV',vll:11000},{label:'22kV',vll:22000},{label:'33kV',vll:33000}]

// ── NER ────────────────────────────────────────────────────────────────────
function NerSizing({ addHistory }) {
  const [vi,setVi]=useState(2),[If,setIf]=useState(''),[durIdx,setDurIdx]=useState(1)
  const [result,setResult]=useState(null),[error,setError]=useState('')
  const DURS=[{l:'5s',s:5},{l:'10s',s:10},{l:'30s',s:30},{l:'60s',s:60},{l:'Cont',s:null}]

  const calculate=()=>{
    setError('')
    const Ifv=pf(If)
    if(!Ifv){setError('Enter desired earth fault current limit');return}
    const V=VOLTAGES[vi],Vln=V.vll/SQRT3
    const R=Vln/Ifv
    const pwr=(Ifv*Ifv*R/1000)
    const dur=DURS[durIdx]
    const energy=dur.s?(Ifv*Ifv*R*dur.s/1000):null
    const nct1=Math.ceil(Ifv),nct5=Math.ceil(Ifv/5)
    setResult({R:R.toFixed(2),Vln:Vln.toFixed(1),pwr:pwr.toFixed(2),energy:energy?energy.toFixed(2):null,nct1,nct5,vLabel:V.label,durLabel:dur.l})
    addHistory({tab:'NER',expr:`${V.label} If=${Ifv}A`,result:`R=${R.toFixed(2)}Ω`})
  }

  return(
    <div className="px-4 py-3">
      <InfoBox title="NER Sizing — R = Vln ÷ If" lines={['Neutral Earthing Resistor limits earth fault current','Select voltage, enter desired fault current limit']}/>
      <div className="mb-3">
        <label className="text-gray-400 text-xs mb-2 block">System Voltage</label>
        <div className="flex flex-wrap gap-1.5">{VOLTAGES.map((v,i)=>(
          <button key={i} onClick={()=>setVi(i)} className={`px-3 py-2 rounded-xl text-xs font-medium ${vi===i?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>{v.label}</button>
        ))}</div>
      </div>
      <NumInput label="Earth Fault Current Limit (If)" value={If} onChange={setIf} unit="A" note="5–400A MV, 50–1000A LV"/>
      <div className="mb-4">
        <label className="text-gray-400 text-xs mb-2 block">Fault Duration</label>
        <div className="flex gap-1.5">{DURS.map((d,i)=>(
          <button key={i} onClick={()=>setDurIdx(i)} className={`flex-1 py-2 rounded-xl text-xs ${durIdx===i?'bg-blue-600 text-white':'bg-[#1c1c1c] text-gray-400'}`}>{d.l}</button>
        ))}</div>
      </div>
      <CalcButton onClick={calculate} label="CALCULATE NER"/>
      <ErrBox msg={error}/>
      {result&&<>
        <ResultBox title="NER PARAMETERS" rows={[
          {label:'Phase-to-Neutral Voltage',value:result.Vln,unit:'V'},
          {label:'➤ NER Resistance',value:result.R,unit:'Ω',accent:true},
          {label:'➤ Voltage Rating (Vln)',value:result.Vln,unit:'V',accent:true},
          {label:'➤ Continuous Current',value:pf(If).toFixed(0),unit:'A',accent:true},
          {label:'Continuous Power Loss',value:result.pwr,unit:'kW'},
          ...(result.energy?[{label:`Thermal Energy (${result.durLabel})`,value:result.energy,unit:'kJ'}]:[]),
        ]}/>
        <ResultBox title="NCRT SIZING" rows={[
          {label:'NCRT Ratio (1A secondary)',value:`${result.nct1}/1`,unit:'A'},
          {label:'NCRT Ratio (5A secondary)',value:`${result.nct5}/5`,unit:'A'},
          {label:'NCRT Voltage Class',value:result.Vln,unit:'V min'},
        ]}/>
        <InfoBox title="Notes" color="amber" lines={['For MV: If = 5–10A typical low-resistance earthing','NER voltage rating ≥ Vln (phase to neutral)','SANS 10198 / IEC 60364 applies']}/>
      </>}
    </div>
  )
}

// ── IDMT Relay Coordination ────────────────────────────────────────────────
function IdmtRelay({ addHistory }) {
  const [curve,setCurve]=useState('SI'),[pickup,setPickup]=useState(''),[tms,setTms]=useState('')
  const [faultI,setFaultI]=useState(''),[result,setResult]=useState(null),[error,setError]=useState('')

  // IEC IDMT curve constants
  const CURVES={
    'SI':  {name:'Standard Inverse',   k:0.14,  alpha:0.02},
    'VI':  {name:'Very Inverse',        k:13.5,  alpha:1.0},
    'EI':  {name:'Extremely Inverse',   k:80,    alpha:2.0},
    'LTI': {name:'Long Time Inverse',   k:120,   alpha:1.0},
  }

  const calculate=()=>{
    setError('')
    const Ip=pf(pickup),TMS=pf(tms),If=pf(faultI)
    if(!Ip||!TMS||!If){setError('Enter pickup current, TMS, and fault current');return}
    if(If<=Ip){setError('Fault current must be greater than pickup');return}
    const c=CURVES[curve]
    const M=If/Ip  // multiple of pickup
    const t=TMS*(c.k/(Math.pow(M,c.alpha)-1))
    // Grade times at various multiples
    const multiples=[2,5,10,20,50]
    const grades=multiples.map(m=>({m,t:m>1?(TMS*(c.k/(Math.pow(m,c.alpha)-1))).toFixed(3):'∞'}))
    setResult({t:t.toFixed(3),M:M.toFixed(1),curve:c.name,grades})
    addHistory({tab:'IDMT',expr:`${c.name} Ip=${Ip}A TMS=${TMS}`,result:`t=${t.toFixed(2)}s`})
  }

  return(
    <div className="px-4 py-3">
      <InfoBox title="IDMT Relay Coordination — IEC 60255" lines={['t = TMS × k / (M^α − 1)  where M = If / Ip','Used for overcurrent relay grading']}/>
      <div className="mb-3">
        <label className="text-gray-400 text-xs mb-2 block">IEC Curve Type</label>
        <div className="flex flex-wrap gap-1.5">{Object.entries(CURVES).map(([id,c])=>(
          <button key={id} onClick={()=>setCurve(id)} className={`px-3 py-2 rounded-xl text-xs font-medium ${curve===id?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>{c.name}</button>
        ))}</div>
      </div>
      <NumInput label="Pickup Current (Ip)" value={pickup} onChange={setPickup} unit="A" note="relay setting"/>
      <NumInput label="Time Multiplier Setting (TMS)" value={tms} onChange={setTms} unit="" note="0.1–1.0 typical"/>
      <NumInput label="Fault Current (If)" value={faultI} onChange={setFaultI} unit="A"/>
      <CalcButton onClick={calculate} label="CALCULATE TRIP TIME"/>
      <ErrBox msg={error}/>
      {result&&<>
        <ResultBox title="TRIP TIME" rows={[
          {label:'Curve',value:result.curve,unit:''},
          {label:'Multiple of Pickup (M)',value:result.M,unit:'×'},
          {label:'➤ Trip Time',value:result.t,unit:'seconds',accent:true},
        ]}/>
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
          <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]"><span className="text-amber-400 text-xs font-bold">TRIP TIME vs CURRENT MULTIPLE</span></div>
          <div className="grid grid-cols-3 px-4 py-2 text-[10px] text-gray-500 font-bold border-b border-[#1a1a1a]"><span>Multiple (M)</span><span>Fault Current</span><span>Trip Time</span></div>
          {result.grades.map(g=>(
            <div key={g.m} className="grid grid-cols-3 px-4 py-2.5 border-b border-[#1a1a1a] last:border-0 text-xs">
              <span className="text-gray-300">{g.m}×</span>
              <span className="text-white">{(pf(pickup)*g.m).toFixed(1)} A</span>
              <span className="text-amber-400 font-bold">{g.t} s</span>
            </div>
          ))}
        </div>
        <InfoBox title="Grading Notes" lines={['Minimum grading margin: 0.3–0.4s between upstream and downstream relays','Upstream TMS must give longer trip time at same fault level','Verify with manufacturer curve data']}/>
      </>}
    </div>
  )
}

// ── CT Burden ──────────────────────────────────────────────────────────────
function CtBurden({ addHistory }) {
  const [ctRatio,setCtRatio]=useState(''),[accuracy,setAccuracy]=useState('5P20')
  const [leadR,setLeadR]=useState(''),[relayBurden,setRelayBurden]=useState('')
  const [result,setResult]=useState(null),[error,setError]=useState('')

  const ACCURACY_CLASSES=['5P10','5P20','10P10','10P20','Class X','0.5','1','3']

  const calculate=()=>{
    setError('')
    const CTR=pf(ctRatio),LR=pf(leadR),RB=pf(relayBurden)
    if(!CTR){setError('Enter CT ratio');return}
    // Total burden on CT secondary
    // Lead burden = 2 × lead resistance × secondary current²  (for 1A or 5A secondary)
    const secI = CTR > 200 ? 5 : 1  // guess secondary from ratio
    const leadBurden = 2 * LR * secI * secI  // VA
    const totalBurden = leadBurden + RB
    // Rated burden from accuracy class (typical values)
    const ratedBurden = accuracy.includes('5P') ? (accuracy.includes('20') ? 15 : 10) : accuracy.includes('10P') ? (accuracy.includes('20') ? 15 : 10) : 15
    const margin = ratedBurden - totalBurden
    setResult({secI,leadBurden:leadBurden.toFixed(2),totalBurden:totalBurden.toFixed(2),ratedBurden,margin:margin.toFixed(2),pass:margin>=0})
    addHistory({tab:'CT Burden',expr:`${CTR}:${secI} ${accuracy}`,result:`${totalBurden.toFixed(1)}VA`})
  }

  return(
    <div className="px-4 py-3">
      <InfoBox title="CT Burden Calculator" lines={['Total VA must not exceed CT rated burden','Excess burden causes saturation and metering errors']}/>
      <NumInput label="CT Ratio (primary)" value={ctRatio} onChange={setCtRatio} unit="A" placeholder="e.g. 100 (for 100/5)"/>
      <SelectInput label="Accuracy Class" value={accuracy} onChange={setAccuracy} options={ACCURACY_CLASSES.map(a=>[a,a])}/>
      <NumInput label="Lead Resistance (one way)" value={leadR} onChange={setLeadR} unit="Ω" placeholder="e.g. 0.5"/>
      <NumInput label="Relay VA Burden" value={relayBurden} onChange={setRelayBurden} unit="VA" note="from relay datasheet"/>
      <CalcButton onClick={calculate} label="CHECK BURDEN"/>
      <ErrBox msg={error}/>
      {result&&<ResultBox rows={[
        {label:'CT Secondary Current',value:result.secI,unit:'A'},
        {label:'Lead Burden',value:result.leadBurden,unit:'VA'},
        {label:'Total Burden',value:result.totalBurden,unit:'VA',accent:true},
        {label:'CT Rated Burden',value:result.ratedBurden,unit:'VA'},
        {label:'Margin',value:result.margin,unit:'VA',accent:result.pass,warn:!result.pass},
        {label:'Status',value:result.pass?'✓ Within rating':'✗ EXCEEDS — upgrade CT',unit:'',accent:result.pass,warn:!result.pass},
      ]}/>}
    </div>
  )
}

// ── Megger Testing ─────────────────────────────────────────────────────────
function MeggerTest({ addHistory }) {
  const [equipment,setEquipment]=useState('motor'),[voltage,setVoltage]=useState('400')
  const [r1min,setR1min]=useState(''),[r10min,setR10min]=useState('')
  const [r30s,setR30s]=useState(''),[r60s,setR60s]=useState('')
  const [temp,setTemp]=useState('20'),[result,setResult]=useState(null),[error,setError]=useState('')

  // Recommended test voltages per equipment voltage rating
  const testVoltage=(v)=>{
    if(v<=50)return 250
    if(v<=250)return 500
    if(v<=600)return 1000
    if(v<=5000)return 2500
    return 5000
  }

  // IEC 60364 / IEEE 43 minimum IR values
  const minIR=(v)=>{
    if(v<=1000)return 1  // MΩ
    return v/1000  // MΩ = kV
  }

  // Temperature correction to 40°C (factor doubles per 10°C rise)
  const tempCorrect=(R,t)=>{
    const diff=40-pf(t)
    return R * Math.pow(2, diff/10)
  }

  const PI_RESULT=(pi)=>{
    if(pi<1.0)return{text:'DANGEROUS — Do not energise',color:'text-red-500'}
    if(pi<2.0)return{text:'Questionable — investigate',color:'text-orange-400'}
    if(pi<4.0)return{text:'Good condition',color:'text-green-400'}
    return{text:'Excellent condition',color:'text-green-300'}
  }

  const DAR_RESULT=(dar)=>{
    if(dar<1.25)return{text:'Poor — probable moisture/contamination',color:'text-red-500'}
    if(dar<1.6)return{text:'Questionable',color:'text-orange-400'}
    return{text:'Good',color:'text-green-400'}
  }

  const calculate=()=>{
    setError('')
    const V=pf(voltage)
    const tv=testVoltage(V)
    const minR=minIR(V)
    const R1=pf(r1min),R10=pf(r10min),R30s=pf(r30s),R60s=pf(r60s)
    if(!R1&&!R30s){setError('Enter at least R1min or R30s reading');return}
    const pi=R10&&R1?R10/R1:null
    const dar=R60s&&R30s?R60s/R30s:null
    const r1Corrected=R1?tempCorrect(R1,pf(temp)):null
    const r10Corrected=R10?tempCorrect(R10,pf(temp)):null
    const r30Corrected=R30s?tempCorrect(R30s,pf(temp)):null
    const r60Corrected=R60s?tempCorrect(R60s,pf(temp)):null
    const piRes=pi?PI_RESULT(pi):null
    const darRes=dar?DAR_RESULT(dar):null
    setResult({tv,minR,pi:pi?pi.toFixed(2):null,dar:dar?dar.toFixed(2):null,piRes,darRes,r1Corrected:r1Corrected?r1Corrected.toFixed(1):null,r10Corrected:r10Corrected?r10Corrected.toFixed(1):null,pass:r1Corrected?r1Corrected>=minR:null})
    addHistory({tab:'Megger',expr:`${V}V ${equipment}`,result:pi?`PI=${pi.toFixed(2)}`:`R=${R1}MΩ`})
  }

  const EQUIPMENT=[['motor','Motor/Pump'],['cable','Cable'],['trafo','Transformer'],['panel','Switchgear']]
  const TEMPS=['5','10','15','20','25','30','35','40','45','50','55','60']

  return(
    <div className="px-4 py-3">
      <InfoBox title="Megger / Insulation Resistance Testing" lines={['IEEE 43 / IEC 60364 based assessment','Readings corrected to 40°C reference temperature']}/>
      <div className="mb-3">
        <label className="text-gray-400 text-xs mb-2 block">Equipment Type</label>
        <div className="flex flex-wrap gap-1.5">{EQUIPMENT.map(([id,l])=>(
          <button key={id} onClick={()=>setEquipment(id)} className={`px-3 py-2 rounded-xl text-xs font-medium ${equipment===id?'bg-amber-500 text-black':'bg-[#1c1c1c] text-gray-400'}`}>{l}</button>
        ))}</div>
      </div>
      <NumInput label="Equipment Voltage Rating" value={voltage} onChange={setVoltage} unit="V"/>
      <SelectInput label="Winding/Insulation Temperature at Time of Test" value={temp} onChange={setTemp} options={TEMPS.map(t=>[t,`${t}°C`])}/>

      <div className="bg-[#1a1a0a] border border-[#2a2a2a] rounded-xl px-4 py-3 mb-3">
        <div className="text-amber-400 text-xs font-bold mb-2">IR READINGS (MΩ)</div>
        <NumInput label="R at 1 minute" value={r1min} onChange={setR1min} unit="MΩ" placeholder="required"/>
        <NumInput label="R at 10 minutes (for PI)" value={r10min} onChange={setR10min} unit="MΩ" placeholder="optional"/>
        <NumInput label="R at 30 seconds (for DAR)" value={r30s} onChange={setR30s} unit="MΩ" placeholder="optional"/>
        <NumInput label="R at 60 seconds (for DAR)" value={r60s} onChange={setR60s} unit="MΩ" placeholder="optional"/>
      </div>

      <CalcButton onClick={calculate} label="ASSESS INSULATION"/>
      <ErrBox msg={error}/>

      {result&&<>
        <ResultBox title="TEST PARAMETERS" rows={[
          {label:'Recommended Test Voltage',value:result.tv,unit:'V DC',accent:true},
          {label:'Minimum IR (IEEE 43)',value:result.minR,unit:'MΩ'},
        ]}/>

        {result.r1Corrected&&<ResultBox title="CORRECTED TO 40°C" rows={[
          {label:'R1min @ 40°C',value:result.r1Corrected,unit:'MΩ',accent:true},
          ...(result.r10Corrected?[{label:'R10min @ 40°C',value:result.r10Corrected,unit:'MΩ'}]:[]),
          {label:'Min Required',value:result.minR,unit:'MΩ'},
          {label:'Status',value:result.pass?'✓ PASS':'✗ FAIL — investigate insulation',unit:'',accent:result.pass,warn:!result.pass},
        ]}/>}

        {result.pi&&<div className="bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 mb-4">
          <div className="text-amber-400 text-xs font-bold mb-2">POLARISATION INDEX (PI)</div>
          <div className="text-3xl font-bold text-white mb-1">{result.pi}</div>
          <div className={`text-sm font-bold ${result.piRes.color}`}>{result.piRes.text}</div>
          <div className="mt-2 text-xs text-gray-500">PI = R10min ÷ R1min</div>
          <div className="mt-1 grid grid-cols-4 gap-1 text-[10px]">
            {[['<1.0','Dangerous','text-red-500'],['1.0–2.0','Question','text-orange-400'],['2.0–4.0','Good','text-green-400'],['>4.0','Excellent','text-green-300']].map(([r,l,c])=>(
              <div key={r} className={`bg-[#1a1a1a] rounded p-1.5 text-center ${c}`}><div className="font-bold">{r}</div><div className="text-gray-500">{l}</div></div>
            ))}
          </div>
        </div>}

        {result.dar&&<div className="bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 mb-4">
          <div className="text-amber-400 text-xs font-bold mb-2">DIELECTRIC ABSORPTION RATIO (DAR)</div>
          <div className="text-3xl font-bold text-white mb-1">{result.dar}</div>
          <div className={`text-sm font-bold ${result.darRes.color}`}>{result.darRes.text}</div>
          <div className="mt-1 text-xs text-gray-500">DAR = R60s ÷ R30s | &lt;1.25 = Poor | &gt;1.6 = Good</div>
        </div>}

        <InfoBox title="Testing Notes" color="amber" lines={[
          '• Disconnect all equipment from supply before testing',
          '• Discharge capacitance after test (hold for 4× test duration)',
          '• Record temperature and humidity with readings',
          '• Compare trend over time — absolute value less important than change',
          '• Motors: test phase-to-earth with rotor stationary',
        ]}/>
      </>}
    </div>
  )
}

// ── Arc Flash (Simplified) ─────────────────────────────────────────────────
function ArcFlash({ addHistory }) {
  const [voltage,setVoltage]=useState('400'),[faultKA,setFaultKA]=useState('')
  const [workDist,setWorkDist]=useState('600'),[clearTime,setClearTime]=useState('')
  const [result,setResult]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    const V=pf(voltage),IBF=pf(faultKA),D=pf(workDist)/1000,tc=pf(clearTime)
    if(!IBF||!D||!tc){setError('Enter fault current, working distance, and clearing time');return}
    // Lee method (simplified IEEE 1584) for systems >15kV or quick estimate
    // Incident energy E = 2.142e6 × V × IBF² × tc / D² (J/m² → cal/cm²)
    // Convert: 1 J/m² = 0.02390 cal/cm²... simplified:
    // E (cal/cm²) = 5.12e-7 × V × IBF² × tc × (1/D²)  (D in m, V in V, IBF in A, tc in s)
    const Iarc = IBF * 0.85  // arcing current approx 85% of bolted
    const E = (5.12e-7 * V * (Iarc*1000)**2 * tc) / (D*D)

    // PPE Category (NFPA 70E / IEC 62271 based)
    let ppe, boundary
    if(E < 1.2)       {ppe='Cat 0 — No PPE required';boundary=300}
    else if(E < 4)    {ppe='Cat 1 — Arc flash suit 4 cal/cm²';boundary=600}
    else if(E < 8)    {ppe='Cat 2 — Arc flash suit 8 cal/cm²';boundary=900}
    else if(E < 25)   {ppe='Cat 3 — Arc flash suit 25 cal/cm²';boundary=1500}
    else if(E < 40)   {ppe='Cat 4 — Arc flash suit 40 cal/cm²';boundary=1800}
    else              {ppe='DANGER — Incident energy >40 cal/cm² — DO NOT WORK LIVE';boundary=null}

    setResult({E:E.toFixed(2),ppe,boundary,Iarc:(Iarc).toFixed(2)})
    addHistory({tab:'ArcFlash',expr:`${V}V ${IBF}kA ${tc}s`,result:`${E.toFixed(1)} cal/cm²`})
  }

  return(
    <div className="px-4 py-3">
      <InfoBox color="red" title="⚠ Arc Flash — Simplified Estimate Only" lines={['This is an engineering estimate using Lee method','Full IEEE 1584 study required for PPE labelling and formal assessment','Always conduct a full arc flash study before live work']}/>
      <NumInput label="System Voltage" value={voltage} onChange={setVoltage} unit="V"/>
      <NumInput label="Bolted Fault Current" value={faultKA} onChange={setFaultKA} unit="kA"/>
      <NumInput label="Working Distance" value={workDist} onChange={setWorkDist} unit="mm" note="typical: 600mm LV, 900mm MV"/>
      <NumInput label="Arcing Fault Clearing Time" value={clearTime} onChange={setClearTime} unit="s" note="e.g. 0.1 for 100ms"/>
      <CalcButton onClick={calculate} label="ESTIMATE INCIDENT ENERGY"/>
      <ErrBox msg={error}/>
      {result&&<>
        <ResultBox title="ARC FLASH ESTIMATE" rows={[
          {label:'Estimated Arcing Current',value:result.Iarc,unit:'kA'},
          {label:'Incident Energy',value:result.E,unit:'cal/cm²',accent:true},
          {label:'PPE Requirement',value:result.ppe,unit:'',accent:true},
          ...(result.boundary?[{label:'Arc Flash Boundary (est.)',value:result.boundary,unit:'mm'}]:[]),
        ]}/>
        <InfoBox color="red" title="This is an estimate only" lines={['Do not use for PPE selection without full IEEE 1584 study','Consult a qualified protection engineer for formal arc flash assessment']}/>
      </>}
    </div>
  )
}

// ── VT Sizing ──────────────────────────────────────────────────────────────
function VtSizing({ addHistory }) {
  const [primary,setPrimary]=useState(''),[secondary,setSecondary]=useState('110')
  const [burden,setBurden]=useState(''),[accuracy,setAccuracy]=useState('0.5')
  const [result,setResult]=useState(null),[error,setError]=useState('')

  const calculate=()=>{
    setError('')
    const Vp=pf(primary),Vs=pf(secondary),B=pf(burden)
    if(!Vp||!Vs){setError('Enter primary and secondary voltages');return}
    const ratio=(Vp/Vs).toFixed(1)
    const ratedBurden=accuracy==='0.1'?10:accuracy==='0.5'?15:accuracy==='1'?15:15
    const margin=ratedBurden-B
    setResult({ratio,ratedBurden,margin:margin.toFixed(1),pass:margin>=0})
    addHistory({tab:'VT',expr:`${Vp}/${Vs}V`,result:`${ratio}:1`})
  }

  return(
    <div className="px-4 py-3">
      <InfoBox title="VT / PT Sizing" lines={['Verify burden within rated VA for accuracy class','Standard secondary: 110V or 63.5V (L-N)']}/>
      <NumInput label="Primary Voltage" value={primary} onChange={setPrimary} unit="V"/>
      <NumInput label="Secondary Voltage" value={secondary} onChange={setSecondary} unit="V" note="110V or 63.5V"/>
      <SelectInput label="Accuracy Class" value={accuracy} onChange={setAccuracy} options={[['0.1','0.1 (revenue metering)'],['0.5','0.5 (metering)'],['1','1 (general metering)'],['3P','3P (protection)'],['6P','6P (protection)']]}/>
      <NumInput label="Connected Burden" value={burden} onChange={setBurden} unit="VA" note="sum of all connected devices"/>
      <CalcButton onClick={calculate} label="CHECK VT"/>
      <ErrBox msg={error}/>
      {result&&<ResultBox rows={[
        {label:'VT Ratio',value:`${result.ratio}:1`,unit:'',accent:true},
        {label:'Rated Burden',value:result.ratedBurden,unit:'VA'},
        {label:'Connected Burden',value:pf(burden),unit:'VA'},
        {label:'Margin',value:result.margin,unit:'VA',accent:result.pass,warn:!result.pass},
        {label:'Status',value:result.pass?'✓ Within rating':'✗ Exceeds rating',unit:'',accent:result.pass,warn:!result.pass},
      ]}/>}
    </div>
  )
}

const TABS=[
  {id:'ner',    label:'NER/NCRT', icon:'⏚'},
  {id:'idmt',   label:'IDMT',     icon:'⏱'},
  {id:'ct',     label:'CT Burden',icon:'◎'},
  {id:'megger', label:'Megger',   icon:'🔬'},
  {id:'arc',    label:'Arc Flash',icon:'⚠'},
  {id:'vt',     label:'VT Size',  icon:'🔌'},
]

export default function ProtectionCalculator({ addHistory }) {
  const [sub,setSub]=useState('ner')
  const map={ner:<NerSizing addHistory={addHistory}/>,idmt:<IdmtRelay addHistory={addHistory}/>,ct:<CtBurden addHistory={addHistory}/>,megger:<MeggerTest addHistory={addHistory}/>,arc:<ArcFlash addHistory={addHistory}/>,vt:<VtSizing addHistory={addHistory}/>}
  return(
    <div className="flex flex-col h-full overflow-hidden">
      <SubTabBar tabs={TABS} active={sub} onChange={setSub}/>
      <div className="flex-1 overflow-y-auto">{map[sub]}</div>
    </div>
  )
}
