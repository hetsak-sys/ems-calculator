import { useState } from 'react'
import { SITES } from './SiteContext'
import { useSite } from './SiteContext'

export default function SiteSelector() {
  const { site, siteId, setSiteById, customSite, setCustomField } = useSite()
  const [open, setOpen] = useState(false)
  const [showCustom, setShowCustom] = useState(false)

  const select = (id) => {
    setSiteById(id)
    if (id === 'custom') { setShowCustom(true) }
    else { setShowCustom(false); setOpen(false) }
  }

  const CURRENCIES = ['ZAR', 'LSL', 'USD', 'EUR', 'GBP']
  const ALL_VOLTAGES = ['230', '400', '415', '525', '690', '1000']
  const ALL_MV = ['3300', '6600', '11000', '22000', '33000']

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl px-3 py-1.5 text-xs"
      >
        <span>{site.flag}</span>
        <span className="text-gray-300 font-medium max-w-[90px] truncate">{site.name}</span>
        <span className="text-gray-600">▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-[#111] border border-[#2a2a2a] rounded-2xl shadow-2xl z-50 overflow-hidden">

          {/* Site list */}
          {SITES.map(s => (
            <button
              key={s.id}
              onClick={() => select(s.id)}
              className={`w-full flex items-start gap-3 px-4 py-3 border-b border-[#1a1a1a] last:border-0 text-left ${siteId === s.id ? 'bg-[#1a1500]' : 'hover:bg-[#1a1a1a]'}`}
            >
              <span className="text-lg flex-shrink-0 mt-0.5">{s.flag}</span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-bold ${siteId === s.id ? 'text-amber-400' : 'text-white'}`}>
                  {s.name}
                  {siteId === s.id && <span className="text-amber-600 text-xs ml-2">● active</span>}
                </div>
                <div className="text-gray-600 text-[10px] mt-0.5">
                  LV: {s.voltages.join('/')}V · MV: {s.mvVoltages.map(v => `${parseInt(v)/1000}kV`).join('/')}
                </div>
                <div className="text-gray-600 text-[10px]">
                  {s.altitude}m alt · {s.ambient}°C · {s.currency}
                </div>
              </div>
            </button>
          ))}

          {/* Custom site editor */}
          {showCustom && siteId === 'custom' && (
            <div className="bg-[#0a0a1a] border-t border-[#2a2a2a] px-4 py-3">
              <div className="text-amber-400 text-xs font-bold mb-3">CUSTOM SITE SETTINGS</div>

              <div className="space-y-2">
                <CField label="Site Name" value={customSite.name} onChange={v => setCustomField('name', v)} text />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-gray-500 text-[10px] block mb-1">Default LV (V)</label>
                    <select value={customSite.defaultLV} onChange={e => setCustomField('defaultLV', e.target.value)}
                      className="w-full bg-[#111] border border-[#333] text-white text-xs rounded-lg px-2 py-1.5 outline-none">
                      {ALL_VOLTAGES.map(v => <option key={v} value={v}>{v}V</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-500 text-[10px] block mb-1">Default MV (V)</label>
                    <select value={customSite.defaultMV} onChange={e => setCustomField('defaultMV', e.target.value)}
                      className="w-full bg-[#111] border border-[#333] text-white text-xs rounded-lg px-2 py-1.5 outline-none">
                      {ALL_MV.map(v => <option key={v} value={v}>{parseInt(v)/1000}kV</option>)}
                    </select>
                  </div>
                  <CField label="Altitude (m)" value={customSite.altitude} onChange={v => setCustomField('altitude', v)} />
                  <CField label="Ambient (°C)" value={customSite.ambient} onChange={v => setCustomField('ambient', v)} />
                  <CField label="Tariff (/kWh)" value={customSite.tariff} onChange={v => setCustomField('tariff', v)} />
                  <div>
                    <label className="text-gray-500 text-[10px] block mb-1">Currency</label>
                    <select value={customSite.currency} onChange={e => setCustomField('currency', e.target.value)}
                      className="w-full bg-[#111] border border-[#333] text-white text-xs rounded-lg px-2 py-1.5 outline-none">
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <button onClick={() => setOpen(false)}
                className="w-full bg-amber-500 text-black font-bold py-2.5 rounded-xl text-sm mt-3">
                Apply Custom Site
              </button>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setShowCustom(false) }} />
      )}
    </div>
  )
}

function CField({ label, value, onChange, text }) {
  return (
    <div>
      <label className="text-gray-500 text-[10px] block mb-1">{label}</label>
      <input
        type={text ? 'text' : 'text'}
        inputMode={text ? 'text' : 'decimal'}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-[#111] border border-[#333] text-white text-xs rounded-lg px-2 py-1.5 outline-none"
      />
    </div>
  )
}
