// Shared UI components and utilities for EMS Calculator
import { useState } from 'react'

export const SQRT3 = Math.sqrt(3)
export const pf = (v) => parseFloat(String(v).replace(',', '.')) || 0

export function NumInput({ label, value, onChange, unit, placeholder = '0', note }) {
  return (
    <div className="mb-3">
      {label && (
        <label className="text-gray-400 text-xs mb-1 block">
          {label}{note && <span className="text-gray-600 ml-1 italic">— {note}</span>}
        </label>
      )}
      <div className="flex items-center bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value.replace(',', '.'))}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-white text-lg px-4 py-3 outline-none"
        />
        {unit && <span className="text-gray-500 text-sm px-3 flex-shrink-0">{unit}</span>}
      </div>
    </div>
  )
}

export function SelectInput({ label, value, onChange, options }) {
  return (
    <div className="mb-3">
      {label && <label className="text-gray-400 text-xs mb-1 block">{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-[#1c1c1c] border border-[#2a2a2a] text-white rounded-xl px-4 py-3 text-sm outline-none">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

export function ToggleInput({ label, options, value, onChange }) {
  return (
    <div className="mb-3">
      {label && <label className="text-gray-400 text-xs mb-2 block">{label}</label>}
      <div className="flex gap-2">
        {options.map(([id, lbl]) => (
          <button key={id} onClick={() => onChange(id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${value===id ? 'bg-amber-500 text-black' : 'bg-[#1c1c1c] text-gray-400'}`}>
            {lbl}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ResultRow({ label, value, unit, accent, warn, sub }) {
  return (
    <div className={`flex justify-between items-start px-4 py-3 border-b border-[#1a1a1a] last:border-0 ${accent?'bg-[#1a1500]':''} ${warn?'bg-[#1a0000]':''}`}>
      <span className={`text-sm flex-1 pr-2 ${sub?'text-gray-500 text-xs pl-2':'text-gray-400'}`}>{label}</span>
      <span className={`font-bold text-right flex-shrink-0 ${accent?'text-amber-400 text-lg':warn?'text-red-400 text-base':'text-white'}`}>
        {value}{unit ? <span className="text-xs font-normal text-gray-500 ml-1">{unit}</span> : null}
      </span>
    </div>
  )
}

export function ResultBox({ title = 'RESULTS', rows }) {
  return (
    <div className="bg-[#111] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
      <div className="bg-[#1a1a0a] px-4 py-2 border-b border-[#2a2a2a]">
        <span className="text-amber-400 text-xs font-bold">{title}</span>
      </div>
      {rows.map((r, i) => <ResultRow key={i} {...r} />)}
    </div>
  )
}

export function InfoBox({ title, color = 'blue', lines }) {
  const c = {
    blue:  'bg-[#0a1a2e] border-[#1a3a5a] text-blue-400',
    amber: 'bg-[#1a1400] border-[#3a2e00] text-amber-400',
    green: 'bg-[#0a1a0a] border-[#1a3a1a] text-green-400',
    red:   'bg-[#1a0a0a] border-[#3a1a1a] text-red-400',
  }[color] || 'bg-[#0a1a2e] border-[#1a3a5a] text-blue-400'
  return (
    <div className={`${c} border rounded-xl px-4 py-3 mb-4`}>
      {title && <div className="text-xs font-bold mb-1">{title}</div>}
      {lines.map((l, i) => <div key={i} className="text-gray-500 text-xs leading-relaxed">{l}</div>)}
    </div>
  )
}

export function ErrBox({ msg }) {
  return msg ? (
    <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 text-sm mb-4">{msg}</div>
  ) : null
}

export function CalcButton({ onClick, label = 'CALCULATE' }) {
  return (
    <button onClick={onClick} className="w-full bg-amber-500 text-black font-bold py-4 rounded-xl text-lg mb-4">
      {label}
    </button>
  )
}

export function SubTabBar({ tabs, active, onChange }) {
  return (
    <div className="flex-shrink-0 flex overflow-x-auto scrollbar-none bg-[#0a0a0a] border-b border-[#2a2a2a] px-1 py-1 gap-1">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-lg min-w-[56px] transition-colors ${active===t.id?'bg-amber-500 text-black':'text-gray-500'}`}>
          <span className="text-sm leading-none">{t.icon}</span>
          <span className="text-[9px] mt-1 font-medium leading-none text-center">{t.label}</span>
        </button>
      ))}
    </div>
  )
}
