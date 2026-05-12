import { useState } from 'react'

const SQRT3 = Math.sqrt(3)

export default function PowerFactorCalculator({ addHistory }) {
  const [phase, setPhase]       = useState('3ph')
  const [kw, setKw]             = useState('')
  const [voltage, setVoltage]   = useState('400')
  const [currentPF, setCurrentPF] = useState('')
  const [targetPF, setTargetPF] = useState('0.95')
  const [freq, setFreq]         = useState('50')
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState('')

  const calculate = () => {
    setError('')
    const KW  = parseFloat(kw)
    const PFi = parseFloat(currentPF)
    const PFt = parseFloat(targetPF)
    const V   = parseFloat(voltage)
    const F   = parseFloat(freq) || 50

    if (!KW || !PFi || !PFt || !V) { setError('All fields required'); return }
    if (PFi <= 0 || PFi > 1)  { setError('Current PF must be between 0 and 1'); return }
    if (PFt <= PFi)            { setError('Target PF must be higher than current PF'); return }
    if (PFt > 1)               { setError('Target PF cannot exceed 1.0'); return }

    // Power triangle
    const thetaI  = Math.acos(PFi)
    const thetaT  = Math.acos(PFt)
    const kvaI    = KW / PFi
    const kvaT    = KW / PFt
    const kvarI   = KW * Math.tan(thetaI)
    const kvarT   = KW * Math.tan(thetaT)
    const kvarCap = kvarI - kvarT  // kVAr of capacitor bank needed

    // Capacitor sizing
    // Qc = V² × ω × C  →  C = Qc / (V² × ω)
    const omega = 2 * Math.PI * F
    let C_uF

    if (phase === '3ph') {
      // For 3-phase delta-connected capacitors: C = Qc / (3 × V² × ω)  (V = line voltage)
      // For star-connected: C = Qc / (V² × ω) per phase (V = phase voltage)
      // Using delta (line voltage):
      C_uF = (kvarCap * 1000) / (3 * V * V * omega) * 1e6
    } else {
      C_uF = (kvarCap * 1000) / (V * V * omega) * 1e6
    }

    // Current before and after
    let currentI, currentT
    if (phase === '3ph') {
      currentI = (kvaI * 1000) / (SQRT3 * V)
      currentT = (kvaT * 1000) / (SQRT3 * V)
    } else {
      currentI = (kvaI * 1000) / V
      currentT = (kvaT * 1000) / V
    }

    const currentReduction = ((currentI - currentT) / currentI * 100)
    const lossReduction = ((kvaI - kvaT) / kvaI * 100)

    setResult({
      kvarCap: kvarCap.toFixed(2),
      C_uF: C_uF.toFixed(1),
      kvaI: kvaI.toFixed(2),
      kvaT: kvaT.toFixed(2),
      kvarI: kvarI.toFixed(2),
      kvarT: kvarT.toFixed(2),
      currentI: currentI.toFixed(2),
      currentT: currentT.toFixed(2),
      currentReduction: currentReduction.toFixed(1),
      lossReduction: lossReduction.toFixed(1),
    })

    addHistory({
      tab: 'PF',
      expr: `${KW}kW PF ${PFi}→${PFt} ${phase} ${V}V`,
      result: `${kvarCap.toFixed(2)} kVAr`
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-3">

        {/* Phase */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">System Type</label>
          <div className="flex gap-2">
            {[['1ph','Single Phase'],['3ph','Three Phase']].map(([id,l]) => (
              <button key={id} onClick={() => setPhase(id)}
                className={`flex-1 py-2.5 rounded-xl text-sm ${phase===id ? 'bg-amber-500 text-black font-bold' : 'bg-[#1c1c1c] text-gray-400'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <PFField label="Active Power (kW)" value={kw} onChange={setKw} unit="kW" />
        <PFField label={`System Voltage ${phase==='3ph'?'(Line-to-Line)':''}`} value={voltage} onChange={setVoltage} unit="V" />
        <PFField label="Current Power Factor" value={currentPF} onChange={setCurrentPF} unit="PF" placeholder="e.g. 0.72" />
        <PFField label="Target Power Factor" value={targetPF} onChange={setTargetPF} unit="PF" placeholder="e.g. 0.95" />
        <PFField label="Supply Frequency" value={freq} onChange={setFreq} unit="Hz" />

        <button onClick={calculate}
          className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">
          CALCULATE
        </button>

        {error && <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}

        {result && (
          <>
            {/* Main result */}
            <div className="bg-[#0a1a0a] border border-[#1a3a1a] rounded-xl px-4 py-4 mb-4">
              <div className="text-green-400 text-xs font-bold mb-3">CAPACITOR BANK REQUIRED</div>
              <div className="flex justify-between mb-3">
                <div>
                  <div className="text-gray-500 text-xs">Reactive Power (kVAr)</div>
                  <div className="text-green-400 text-3xl font-bold">{result.kvarCap} <span className="text-base font-normal text-green-600">kVAr</span></div>
                </div>
                <div className="text-right">
                  <div className="text-gray-500 text-xs">Capacitance ({phase==='3ph'?'Δ':'single'})</div>
                  <div className="text-amber-400 text-2xl font-bold">{result.C_uF} <span className="text-sm font-normal text-amber-600">μF</span></div>
                </div>
              </div>
            </div>

            {/* Power triangle comparison */}
            <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
              <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
                <span className="text-amber-400 text-xs font-bold">BEFORE vs AFTER</span>
              </div>
              <div className="grid grid-cols-3 text-xs text-gray-500 px-4 py-2 border-b border-[#1a1a1a]">
                <span></span><span className="text-center text-red-400">BEFORE</span><span className="text-center text-green-400">AFTER</span>
              </div>
              {[
                ['kVA', result.kvaI, result.kvaT, 'kVA'],
                ['kVAr', result.kvarI, result.kvarT, 'kVAr'],
                ['Current', result.currentI, result.currentT, 'A'],
              ].map(([l, b, a, u]) => (
                <div key={l} className="grid grid-cols-3 px-4 py-2.5 border-b border-[#1a1a1a] last:border-0 text-sm">
                  <span className="text-gray-400">{l}</span>
                  <span className="text-center text-red-400">{b} {u}</span>
                  <span className="text-center text-green-400">{a} {u}</span>
                </div>
              ))}
            </div>

            {/* Savings */}
            <div className="bg-[#0f1520] border border-[#1e2a3a] rounded-xl px-4 py-3 mb-4">
              <div className="text-blue-400 text-xs font-bold mb-2">BENEFITS</div>
              <div className="text-gray-400 text-sm">Current reduction: <span className="text-white">{result.currentReduction}%</span></div>
              <div className="text-gray-400 text-sm mt-1">Apparent power reduction: <span className="text-white">{result.lossReduction}%</span></div>
              <div className="text-gray-400 text-xs mt-2">Smaller supply cable, lower transformer loading, reduced electricity tariff penalties</div>
            </div>

            {/* Warning */}
            <div className="bg-[#1a0f00] border border-[#3a2000] rounded-xl px-4 py-3 text-xs text-amber-600 mb-4">
              ⚠ With VFDs/non-linear loads, standard capacitors may cause harmonic resonance. Use detuned reactor banks (p-factor 5–7%) in those cases.
            </div>
          </>
        )}

        {/* Formula */}
        <div className="bg-[#0f1520] border border-[#1e2a3a] rounded-xl px-4 py-3 text-xs text-gray-500">
          <div className="text-blue-400 font-bold mb-1">Formula</div>
          <div>Qc (kVAr) = kW × (tan θ_old − tan θ_new)</div>
          <div>C = Qc / (V² × ω) &nbsp; [single phase / star 3φ]</div>
          <div>C = Qc / (3 × V² × ω) &nbsp; [delta 3φ]</div>
        </div>

      </div>
    </div>
  )
}

function PFField({ label, value, onChange, unit, placeholder = '0' }) {
  return (
    <div className="mb-3">
      <label className="text-gray-400 text-xs mb-1 block">{label}</label>
      <div className="flex items-center bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <input type="number" value={value} onChange={e => onChange(e.target.value)}
          inputMode="decimal" placeholder={placeholder}
          className="flex-1 bg-transparent text-white text-lg px-4 py-3 outline-none" />
        <span className="text-gray-500 text-sm px-3">{unit}</span>
      </div>
    </div>
  )
}
