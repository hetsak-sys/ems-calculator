import React, { useState, useCallback } from 'react'
import { getTheme } from './theme'
import Dashboard from './components/Dashboard'
import QuickMath from './components/QuickMath'
import MotorCalculator from './components/MotorCalculator'
import CableCalculator from './components/CableCalculator'
import NerCalculator from './components/NerCalculator'
import EarthingCalculator from './components/EarthingCalculator'
import FormulaReference from './components/FormulaReference'
import ConvertCalculator from './components/ConvertCalculator'
import HistoryView from './components/HistoryView'
import Settings from './components/Settings'
import PowerSysCalculator from './components/PowerSysCalculator'
import PQCalculator from './components/PQCalculator'
import LicenseGate from './components/LicenseGate'

const SCREEN_LABELS = {
  motor:      'Motors & Drives',
  cable:      'Cable & Wiring',
  earthing:   'Earthing',
  protection: 'Protection',
  powersys:   'Power Systems',
  pq:         'Power Quality',
  convert:    'Unit Converter',
  formulas:   'Formula Library',
  history:    'Calculation History',
  settings:   'Settings',
}

const DEFAULT_SITE = {
  voltage:  400,
  freq:     50,
  altitude: 1200,
  currency: 'ZAR',
}

export default function App() {
  const [screen, setScreen]             = useState('dashboard')
  const [showQuickMath, setShowQuickMath] = useState(false)
  const [bottomTab, setBottomTab]       = useState('home')
  const [history, setHistory]           = useState([])
  const [themeMode, setThemeMode]       = useState('dark')   // 'dark' | 'light'
  const [siteConfig, setSiteConfig]     = useState(DEFAULT_SITE)

  const T = getTheme(themeMode)

  const addHistory = useCallback((entry) => {
    setHistory(h => [{ ...entry, timestamp: Date.now() }, ...h].slice(0, 100))
  }, [])

  const navigate = (screenId) => {
    setScreen(screenId)
    setShowQuickMath(false)
    if (screenId === 'dashboard') setBottomTab('home')
    if (screenId === 'history')   setBottomTab('history')
    if (screenId === 'settings')  setBottomTab('settings')
  }

  const goBack = () => navigate('dashboard')

  const handleBottomTab = (tab) => {
    if (tab === 'quickmath') { setShowQuickMath(true); return }
    setShowQuickMath(false)
    setBottomTab(tab)
    if (tab === 'home')     navigate('dashboard')
    if (tab === 'history')  navigate('history')
    if (tab === 'settings') navigate('settings')
  }

  const isInTool = !['dashboard', 'history', 'settings'].includes(screen)

  const renderScreen = () => {
    const props = { addHistory, siteConfig, theme: T, themeMode }
    switch (screen) {
      case 'dashboard':  return <Dashboard onNavigate={navigate} siteConfig={siteConfig} theme={T} themeMode={themeMode} />
      case 'motor':      return <MotorCalculator {...props} />
      case 'cable':      return <CableCalculator {...props} />
      case 'earthing':   return <EarthingCalculator {...props} />
      case 'protection': return <NerCalculator {...props} />
      case 'powersys':   return <PowerSysCalculator {...props} />
      case 'pq':         return <PQCalculator {...props} />
      case 'convert':    return <ConvertCalculator theme={T} themeMode={themeMode} />
      case 'formulas':   return <FormulaReference history={history} theme={T} themeMode={themeMode} />
      case 'history':    return <HistoryView history={history} onClear={() => setHistory([])} theme={T} themeMode={themeMode} />
      case 'settings':   return (
        <Settings
          siteConfig={siteConfig}
          setSiteConfig={setSiteConfig}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          theme={T}
        />
      )
      default: return <Dashboard onNavigate={navigate} siteConfig={siteConfig} theme={T} themeMode={themeMode} />
    }
  }

  // Summary label for header
  const siteLabel = `${siteConfig.voltage}V · ${siteConfig.freq}Hz · ${siteConfig.altitude}m`

  return (
    <LicenseGate theme={T} themeMode={themeMode}>
    <div
      className="flex flex-col h-screen overflow-hidden select-none"
      style={{ backgroundColor: T.appBg, color: T.textPrimary, transition: 'background-color 0.3s, color 0.3s' }}
    >
      {/* ── HEADER ──────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          backgroundColor: T.headerBg,
          borderBottom: `1px solid ${T.border}`,
          height: '56px',
          paddingTop: 'env(safe-area-inset-top)',
          boxShadow: themeMode === 'light' ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
        }}
      >
        <div className="flex items-center gap-2">
          {isInTool && (
            <button onClick={goBack} style={{ color: T.accent, fontSize: '24px', lineHeight: 1, paddingRight: '6px' }}>
              ‹
            </button>
          )}
          <div className="flex items-baseline gap-2">
            <span
              className="font-black tracking-tight"
              style={{
  fontSize: isInTool ? '15px' : '17px',
  color: T.accent,
  fontFamily: "'Rajdhani', 'Share Tech Mono', monospace",
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '180px',
}}
            >
              {isInTool ? SCREEN_LABELS[screen] : 'Hetsa PowerSuite'}
            </span>
            {!isInTool && <span className="text-xs" style={{ color: T.textMuted }}>v1.0</span>}
          </div>
        </div>

        {/* Site config summary + theme toggle */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            onClick={() => setThemeMode(m => m === 'dark' ? 'light' : 'dark')}
            className="flex items-center justify-center rounded-full"
            style={{
              width: '32px', height: '32px',
              backgroundColor: T.accentDim,
              border: `1px solid ${T.accentBorder}`,
              fontSize: '15px',
            }}
            title="Toggle theme"
          >
            {themeMode === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Site summary pill — hidden inside tools to save header space */}
{!isInTool && (
  <div
    className="px-3 py-1.5 rounded-full text-xs font-mono"
    style={{
      backgroundColor: T.accentDim,
      border: `1px solid ${T.accentBorder}`,
      color: T.accentText,
    }}
  >
    {siteLabel}
  </div>
)}
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}
      >
        {renderScreen()}
      </main>

      {/* ── QUICK MATH OVERLAY ───────────────────────────────── */}
      {showQuickMath && (
        <QuickMath
          onClose={() => { setShowQuickMath(false); setBottomTab('home') }}
          addHistory={addHistory}
          theme={T}
          themeMode={themeMode}
        />
      )}

      {/* ── BOTTOM NAVIGATION ────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 flex items-center z-30"
        style={{
          backgroundColor: T.headerBg,
          borderTop: `1px solid ${T.border}`,
          height: 'calc(60px + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: themeMode === 'light' ? '0 -1px 6px rgba(0,0,0,0.06)' : 'none',
        }}
      >
        {[
          { id: 'home',      icon: '⊞',  label: 'Home'       },
          { id: 'quickmath', icon: '⚡',  label: 'Quick Math' },
          { id: 'history',   icon: '⏱',  label: 'History'    },
          { id: 'settings',  icon: '⚙',  label: 'Settings'   },
        ].map(tab => {
          const active = tab.id === 'quickmath' ? showQuickMath : bottomTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => handleBottomTab(tab.id)}
              className="flex flex-col items-center justify-center flex-1 h-full gap-0.5"
            >
              {tab.id === 'quickmath' ? (
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: '42px', height: '42px',
                    background: active
                      ? `linear-gradient(135deg, ${T.accent}, #d97706)`
                      : T.accentDim,
                    border: active ? 'none' : `1px solid ${T.accentBorder}`,
                    marginTop: '-16px',
                    boxShadow: active ? `0 0 18px ${T.accent}55` : 'none',
                  }}
                >
                  <span style={{ color: active ? '#000' : T.accent, fontSize: '18px' }}>⚡</span>
                </div>
              ) : (
                <span style={{ fontSize: '18px', color: active ? T.accent : T.textMuted }}>
                  {tab.icon}
                </span>
              )}
              <span style={{ fontSize: '10px', color: active ? T.accent : T.textMuted, marginTop: tab.id === 'quickmath' ? '2px' : '0' }}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
    </LicenseGate>
  )
}
