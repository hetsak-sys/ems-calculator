// Settings.jsx
// Stub — replace with your existing Settings component contents

import React from 'react'

export default function Settings({ preset, setPreset, presets }) {
  return (
    <div className="px-4 pt-4">
      <div className="text-amber-400 font-bold text-sm mb-4">Settings</div>

      <div className="mb-4">
        <div className="text-gray-500 text-xs font-bold mb-2 tracking-widest">ACTIVE PRESET</div>
        {presets && presets.map(p => (
          <button
            key={p.id}
            onClick={() => setPreset(p)}
            className="flex items-center justify-between w-full rounded-xl px-4 py-3 mb-2"
            style={{
              backgroundColor: preset?.id === p.id ? '#1a0f00' : '#0a0a0a',
              border: preset?.id === p.id ? '1px solid #f59e0b' : '1px solid #1a1a1a',
            }}
          >
            <span className="text-sm" style={{ color: preset?.id === p.id ? '#f59e0b' : '#9ca3af' }}>
              {p.label}
            </span>
            <span className="text-xs text-gray-600">{p.voltage}V · {p.altitude}m</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl p-4 mt-4" style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}>
        <div className="text-gray-600 text-xs text-center">
          More settings will appear here as modules are configured.
        </div>
      </div>
    </div>
  )
}
