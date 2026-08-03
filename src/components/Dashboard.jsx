import React, { useState } from 'react'
import { useSite } from './SiteContext'
import { openManual } from '../lib/openManual'
import WhatsNewBanner from './WhatsNewBanner'

const TOOL_GRID = [
  { id: 'motor',      label: 'Motors & Drives',  icon: '⚙',  desc: 'FLA · Starting · Relays · VFD',          bgKey: 'motorBg',   borderKey: 'motorBorder',   accentKey: 'motorAccent'   },
  { id: 'cable',      label: 'Cable & Wiring',   icon: '〰',  desc: 'Sizing · Volt Drop · Fault · Gland',     bgKey: 'cableBg',   borderKey: 'cableBorder',   accentKey: 'cableAccent'   },
  { id: 'earthing',   label: 'Earthing',         icon: '⏚',  desc: 'Electrode · Touch · Step · Grid',        bgKey: 'earthBg',   borderKey: 'earthBorder',   accentKey: 'earthAccent'   },
  { id: 'protection', label: 'Protection',       icon: '🛡',  desc: 'NER · IDMT · Arc Flash · CT/VT',         bgKey: 'protBg',    borderKey: 'protBorder',    accentKey: 'protAccent'    },
  { id: 'powersys',   label: 'Power Systems',    icon: '⚡',  desc: 'Transformer · Generator · PF',           bgKey: 'powerBg',   borderKey: 'powerBorder',   accentKey: 'powerAccent'   },
  { id: 'pq',         label: 'Power Quality',    icon: '∿',   desc: 'Harmonics · Battery · Lighting',         bgKey: 'pqBg',      borderKey: 'pqBorder',      accentKey: 'pqAccent'      },
  { id: 'renewable',  label: 'Renewable Energy', icon: '☀',  desc: 'PV Arrays · Battery · Grid-Tie · Hybrid', bgKey: 'renewableBg', borderKey: 'renewableBorder', accentKey: 'renewableAccent' },
  { id: 'installation', label: 'Installation Design', icon: '🏗', desc: 'Load Assessment · DB Sizing · Circuits', bgKey: 'installBg', borderKey: 'installBorder', accentKey: 'installAccent' },
  { id: 'overhead',     label: 'Overhead Reticulation', icon: '🗼', desc: 'Conductor Sizing · Pole Spacing · Clearances', bgKey: 'overheadBg', borderKey: 'overheadBorder', accentKey: 'overheadAccent' },
  { id: 'convert',    label: 'Unit Converter',   icon: '⇄',  desc: '12 engineering categories',               bgKey: 'convertBg', borderKey: 'convertBorder', accentKey: 'convertAccent' },
  { id: 'formulas',   label: 'Formula Library',  icon: '∑',  desc: 'IEC · SANS · Reference cards',            bgKey: 'formulaBg', borderKey: 'formulaBorder', accentKey: 'formulaAccent' },
]

export default function Dashboard({ onNavigate, theme: T, themeMode }) {
  const { site } = useSite()
  const [manualState, setManualState] = useState('idle') // 'idle' | 'opening' | 'error'
  const [manualError, setManualError] = useState(null)

  const handleOpenManual = async () => {
    if (manualState === 'opening') return
    setManualState('opening')
    setManualError(null)
    try {
      await openManual()
      setManualState('idle')
    } catch (e) {
      setManualState('error')
      setManualError(e.message || 'Could not open the manual')
    }
  }

  return (
    <div className="px-4 pt-4 pb-2">

      {/* What's New (shows only when the running build is newer than what was last seen) */}
      <WhatsNewBanner theme={T} />

      {/* Site Banner */}
      <div
        className="rounded-2xl p-4 mb-5 flex items-center justify-between"
        style={{
          background: themeMode === 'dark'
            ? 'linear-gradient(135deg, #1a0e00 0%, #0d0600 100%)'
            : 'linear-gradient(135deg, #fffbf0 0%, #fef3c7 100%)',
          border: `1px solid ${T.accentBorder}`,
        }}
      >
        <div>
          <div className="font-bold text-sm tracking-wide" style={{ color: T.accent }}>
            ENGINEERING FIELD PLATFORM
          </div>
          <div className="text-xs mt-0.5" style={{ color: T.textMuted }}>
            {site.defaultLV}V · {site.frequency}Hz · {site.altitude}m ASL
          </div>
        </div>
        <div className="text-3xl" style={{ filter: `drop-shadow(0 0 8px ${T.accent}88)` }}>
          ⚡
        </div>
      </div>

      {/* Section label */}
      <div className="flex items-center gap-2 mb-3">
        <div className="text-xs font-bold tracking-widest uppercase" style={{ color: T.accent }}>
          Modules
        </div>
        <div className="flex-1 h-px" style={{ backgroundColor: T.accentBorder, opacity: 0.4 }} />
      </div>

      {/* Tool Grid */}
      <div className="grid grid-cols-2 gap-3">
        {TOOL_GRID.map(tool => {
          const bg     = T[tool.bgKey]
          const border = T[tool.borderKey]
          const accent = T[tool.accentKey]
          return (
            <button
              key={tool.id}
              onClick={() => onNavigate(tool.id)}
              className="text-left rounded-2xl p-4 transition-all duration-150 active:scale-95"
              style={{ backgroundColor: bg, border: `1px solid ${border}` }}
            >
              {/* Icon box */}
              <div
                className="flex items-center justify-center rounded-xl mb-3"
                style={{
                  width: '44px', height: '44px',
                  backgroundColor: `${accent}18`,
                  border: `1px solid ${accent}35`,
                  color: accent, fontSize: '20px',
                }}
              >
                {tool.icon}
              </div>

              {/* Label */}
              <div className="font-bold text-sm leading-tight mb-1" style={{ color: T.textPrimary }}>
                {tool.label}
              </div>

              {/* Desc */}
              <div className="text-xs leading-snug" style={{ color: T.textMuted }}>
                {tool.desc}
              </div>

              {/* CTA */}
              <div className="mt-3 text-xs font-bold tracking-wider" style={{ color: accent }}>
                OPEN →
              </div>
            </button>
          )
        })}
      </div>

      {/* User Manual */}
      <button
        onClick={handleOpenManual}
        disabled={manualState === 'opening'}
        className="w-full mt-4 rounded-xl p-3 flex items-center gap-3 text-left transition-all duration-150 active:scale-95"
        style={{ backgroundColor: T.accentDim, border: `1px solid ${T.accentBorder}` }}
      >
        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{ width: '32px', height: '32px', backgroundColor: `${T.accent}22`, border: `1px solid ${T.accent}45` }}
        >
          <span style={{ fontSize: '16px' }}>📘</span>
        </div>
        <div className="flex-1">
          <div className="text-xs font-bold" style={{ color: T.textPrimary }}>
            {manualState === 'opening' ? 'Opening manual\u2026' : 'User Manual'}
          </div>
          <div className="text-xs" style={{ color: T.textMuted }}>
            {manualState === 'error'
              ? (manualError || 'Could not open the manual \u2014 tap to retry')
              : 'Full offline guide to every module'}
          </div>
        </div>
      </button>

      {/* Quick Math hint */}
      <div
        className="mt-5 mb-2 rounded-xl p-3 flex items-center gap-3"
        style={{ backgroundColor: T.accentDim, border: `1px solid ${T.accentBorder}` }}
      >
        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{ width: '32px', height: '32px', background: `linear-gradient(135deg, ${T.accent}, #d97706)` }}
        >
          <span className="text-black text-sm font-bold">⚡</span>
        </div>
        <div>
          <div className="text-xs font-bold" style={{ color: T.accent }}>Quick Math available</div>
          <div className="text-xs" style={{ color: T.textMuted }}>
            Tap ⚡ below for the calculator and saved formulas
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-3 text-xs" style={{ color: T.textDisabled }}>
        PowerSuite v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0'} · Built for field engineers
      </div>
    </div>
  )
}
