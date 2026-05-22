import React from 'react'

const TOOL_GRID = [
  {
    id: 'motor',
    label: 'Motors & Drives',
    icon: '⚙',
    desc: 'FLA · Starting · Relays · VFD',
    accent: '#f59e0b',
    bg: '#100800',
    border: '#3d2800',
  },
  {
    id: 'cable',
    label: 'Cable & Wiring',
    icon: '〰',
    desc: 'Sizing · Volt Drop · Fault · Gland',
    accent: '#10b981',
    bg: '#001008',
    border: '#003d20',
  },
  {
    id: 'earthing',
    label: 'Earthing',
    icon: '⏚',
    desc: 'Electrode · Touch · Step · Grid',
    accent: '#818cf8',
    bg: '#08080f',
    border: '#1e1e4a',
  },
  {
    id: 'protection',
    label: 'Protection',
    icon: '🛡',
    desc: 'NER · IDMT · Arc Flash · CT/VT',
    accent: '#f87171',
    bg: '#100004',
    border: '#3d0010',
  },
  {
    id: 'powersys',
    label: 'Power Systems',
    icon: '⚡',
    desc: 'Transformer · Generator · PF',
    accent: '#22d3ee',
    bg: '#000f10',
    border: '#003d40',
  },
  {
    id: 'pq',
    label: 'Power Quality',
    icon: '∿',
    desc: 'Harmonics · Battery · Lighting',
    accent: '#a3e635',
    bg: '#080f00',
    border: '#1e3d00',
  },
  {
    id: 'convert',
    label: 'Unit Converter',
    icon: '⇄',
    desc: '12 engineering categories',
    accent: '#fbbf24',
    bg: '#0f0f00',
    border: '#3d3800',
  },
  {
    id: 'formulas',
    label: 'Formula Library',
    icon: '∑',
    desc: 'IEC · SANS · Reference cards',
    accent: '#c084fc',
    bg: '#0a0010',
    border: '#2d0040',
  },
]

export default function Dashboard({ onNavigate, preset }) {
  return (
    <div className="px-4 pt-4 pb-2">

      {/* Site Banner */}
      <div
        className="rounded-2xl p-4 mb-5 flex items-center justify-between"
        style={{
          background: 'linear-gradient(135deg, #1a0e00 0%, #0d0600 100%)',
          border: '1px solid #3d2800',
        }}
      >
        <div>
          <div className="text-amber-400 font-bold text-sm tracking-wide">
            ENGINEERING FIELD PLATFORM
          </div>
          <div className="text-gray-500 text-xs mt-0.5">
            {preset?.voltage}V · {preset?.freq}Hz · {preset?.altitude}m ASL
          </div>
        </div>
        <div
          className="text-3xl"
          style={{ filter: 'drop-shadow(0 0 8px #f59e0b88)' }}
        >
          ⚡
        </div>
      </div>

      {/* Section Label */}
      <div className="flex items-center gap-2 mb-3">
        <div className="text-amber-600 text-xs font-bold tracking-widest uppercase">
          Modules
        </div>
        <div className="flex-1 h-px bg-amber-900/30" />
      </div>

      {/* Tool Grid */}
      <div className="grid grid-cols-2 gap-3">
        {TOOL_GRID.map(tool => (
          <button
            key={tool.id}
            onClick={() => onNavigate(tool.id)}
            className="text-left rounded-2xl p-4 transition-all duration-150 active:scale-95"
            style={{
              backgroundColor: tool.bg,
              border: `1px solid ${tool.border}`,
            }}
          >
            {/* Icon */}
            <div
              className="text-2xl mb-3 flex items-center justify-center rounded-xl"
              style={{
                width: '44px',
                height: '44px',
                backgroundColor: `${tool.accent}18`,
                color: tool.accent,
                fontSize: '20px',
                border: `1px solid ${tool.accent}30`,
              }}
            >
              {tool.icon}
            </div>

            {/* Label */}
            <div
              className="font-bold text-sm leading-tight mb-1"
              style={{ color: '#e5e7eb' }}
            >
              {tool.label}
            </div>

            {/* Sub-desc */}
            <div
              className="text-xs leading-snug"
              style={{ color: '#4b5563' }}
            >
              {tool.desc}
            </div>

            {/* Arrow indicator */}
            <div
              className="mt-3 text-xs font-bold tracking-wider"
              style={{ color: tool.accent }}
            >
              OPEN →
            </div>
          </button>
        ))}
      </div>

      {/* Quick Math hint */}
      <div
        className="mt-5 mb-2 rounded-xl p-3 flex items-center gap-3"
        style={{
          backgroundColor: '#0a0600',
          border: '1px solid #2a1600',
        }}
      >
        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{
            width: '32px',
            height: '32px',
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          }}
        >
          <span className="text-black text-sm font-bold">⚡</span>
        </div>
        <div>
          <div className="text-amber-400 text-xs font-bold">Quick Math available</div>
          <div className="text-gray-600 text-xs">
            Tap ⚡ below for the full scientific calculator
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-gray-800 text-xs py-3">
        Hetsa PowerSuite v1.0 · Built for field engineers
      </div>
    </div>
  )
}
