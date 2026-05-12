import { useState, useEffect } from 'react'

const DEFAULTS = {
  voltage: '400',
  altVoltage: '525',
  mvVoltage: '6600',
  altitude: '1500',
  ambient: '30',
  frequency: '50',
  currency: 'ZAR',
  tariff: '2.50',
  phase: '3ph',
  material: 'Cu',
  insulation: 'PVC',
  maxVd: '3',
  pf: '0.85',
  efficiency: '90',
  siteName: '',
}

const PRESET_SITES = [
  { name: 'Letseng Diamond Mine', altitude: '3100', ambient: '10', voltage: '525', mvVoltage: '11000', currency: 'LSL', tariff: '2.80' },
  { name: 'General SA Mine (surface)', altitude: '1500', ambient: '25', voltage: '525', mvVoltage: '6600', currency: 'ZAR', tariff: '2.50' },
  { name: 'General SA Mine (underground)', altitude: '1500', ambient: '28', voltage: '1000', mvVoltage: '6600', currency: 'ZAR', tariff: '2.50' },
  { name: 'Standard LV Industrial (SA)', altitude: '1200', ambient: '30', voltage: '400', mvVoltage: '11000', currency: 'ZAR', tariff: '2.20' },
  { name: 'Offshore / Coastal', altitude: '0', ambient: '35', voltage: '400', mvVoltage: '6600', currency: 'ZAR', tariff: '2.50' },
]

const CURRENCIES = [['ZAR','ZAR — South African Rand'],['LSL','LSL — Lesotho Loti'],['USD','USD — US Dollar'],['EUR','EUR — Euro'],['GBP','GBP — British Pound']]
const VOLTAGES = [['230','230V'],['400','400V'],['415','415V'],['525','525V'],['690','690V'],['1000','1000V']]
const MV_VOLTAGES = [['3300','3.3kV'],['6600','6.6kV'],['11000','11kV'],['22000','22kV'],['33000','33kV']]
const FREQUENCIES = [['50','50 Hz'],['60','60 Hz']]

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('ems_settings')
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS
    } catch { return DEFAULTS }
  })
  const save = (updates) => {
    const newSettings = { ...settings, ...updates }
    setSettings(newSettings)
    try { localStorage.setItem('ems_settings', JSON.stringify(newSettings)) } catch {}
  }
  return [settings, save]
}

export default function Settings() {
  const [settings, save] = useSettings()
  const [saved, setSaved] = useState(false)
  const [local, setLocal] = useState(settings)

  const update = (field, val) => setLocal(s => ({ ...s, [field]: val }))

  const saveAll = () => {
    save(local)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const applyPreset = (preset) => {
    const updated = { ...local, ...preset }
    setLocal(updated)
  }

  const reset = () => setLocal(DEFAULTS)

  const Field = ({ label, value, onChange, unit, placeholder }) => (
    <div className="mb-3">
      <label className="text-gray-400 text-xs mb-1 block">{label}</label>
      <div className="flex items-center bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <input type="text" inputMode="decimal" value={value}
          onChange={e => onChange(e.target.value.replace(',', '.'))}
          placeholder={placeholder || '0'}
          className="flex-1 bg-transparent text-white text-base px-4 py-2.5 outline-none" />
        {unit && <span className="text-gray-500 text-sm px-3">{unit}</span>}
      </div>
    </div>
  )

  const Select = ({ label, value, onChange, options }) => (
    <div className="mb-3">
      <label className="text-gray-400 text-xs mb-1 block">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white rounded-xl px-4 py-2.5 text-sm outline-none">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-3">

        {/* Site presets */}
        <div className="mb-4">
          <label className="text-gray-400 text-xs mb-2 block">Quick Load — Site Preset</label>
          <div className="space-y-2">
            {PRESET_SITES.map((p, i) => (
              <button key={i} onClick={() => applyPreset(p)}
                className="w-full bg-[#1a1a2e] border border-[#2a2a4a] text-left px-4 py-3 rounded-xl">
                <div className="text-blue-300 text-sm font-medium">{p.name}</div>
                <div className="text-gray-500 text-xs mt-0.5">{p.altitude}m alt · {p.ambient}°C · {p.voltage}V LV · {parseInt(p.mvVoltage)/1000}kV MV</div>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-[#2a2a2a] mb-4" />

        {/* Site name */}
        <Field label="Site / Project Name" value={local.siteName} onChange={v => update('siteName', v)} placeholder="e.g. Letseng Diamond Mine" unit="" />

        {/* Electrical defaults */}
        <div className="text-amber-400 text-xs font-bold mb-3 mt-2">ELECTRICAL DEFAULTS</div>
        <Select label="Default LV System Voltage" value={local.voltage} onChange={v => update('voltage', v)} options={VOLTAGES} />
        <Select label="Default MV System Voltage" value={local.mvVoltage} onChange={v => update('mvVoltage', v)} options={MV_VOLTAGES} />
        <Select label="Supply Frequency" value={local.frequency} onChange={v => update('frequency', v)} options={FREQUENCIES} />
        <Select label="Default Phase" value={local.phase} onChange={v => update('phase', v)} options={[['1ph','Single Phase (1φ)'],['3ph','Three Phase (3φ)']]} />
        <Select label="Default Conductor Material" value={local.material} onChange={v => update('material', v)} options={[['Cu','Copper'],['Al','Aluminium']]} />
        <Select label="Default Insulation" value={local.insulation} onChange={v => update('insulation', v)} options={[['PVC','PVC (70°C)'],['XLPE','XLPE (90°C)']]} />
        <Field label="Default Power Factor" value={local.pf} onChange={v => update('pf', v)} placeholder="0.85" />
        <Field label="Default Motor Efficiency" value={local.efficiency} onChange={v => update('efficiency', v)} unit="%" />
        <Field label="Max Voltage Drop" value={local.maxVd} onChange={v => update('maxVd', v)} unit="%" />

        {/* Site conditions */}
        <div className="text-amber-400 text-xs font-bold mb-3 mt-2">SITE CONDITIONS</div>
        <Field label="Site Altitude" value={local.altitude} onChange={v => update('altitude', v)} unit="m" placeholder="e.g. 3100 for Letseng" />
        <Field label="Maximum Ambient Temperature" value={local.ambient} onChange={v => update('ambient', v)} unit="°C" />

        {/* Cost / currency */}
        <div className="text-amber-400 text-xs font-bold mb-3 mt-2">COST & CURRENCY</div>
        <Select label="Currency" value={local.currency} onChange={v => update('currency', v)} options={CURRENCIES} />
        <Field label="Electricity Tariff (cost per kWh)" value={local.tariff} onChange={v => update('tariff', v)} unit={local.currency + '/kWh'} />

        {/* Buttons */}
        <div className="flex gap-3 mt-4 mb-6">
          <button onClick={reset} className="flex-1 bg-[#1c1c1c] text-gray-400 py-3 rounded-xl text-sm">Reset Defaults</button>
          <button onClick={saveAll} className={`flex-1 py-3 rounded-xl text-sm font-bold ${saved ? 'bg-green-600 text-white' : 'bg-amber-500 text-black'}`}>
            {saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>

        <div className="bg-[#0f1520] border border-[#1e2a3a] rounded-xl px-4 py-3 text-xs text-gray-500 mb-4">
          <div className="text-blue-400 font-bold mb-1">Note</div>
          <div>Settings are saved locally on this device. They pre-fill default values across all calculators.</div>
        </div>

      </div>
    </div>
  )
}
