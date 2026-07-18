import React, { useState, useCallback, useEffect } from 'react'
import { getTheme } from './theme'
import Dashboard from './components/Dashboard'
import QuickMath from './components/QuickMath'
import MotorCalculator from './components/MotorCalculator'
import CableCalculator from './components/CableCalculator'
import Protection from './components/Protection'
import EarthingCalculator from './components/EarthingCalculator'
import FormulaReference from './components/FormulaReference'
import ConvertCalculator from './components/ConvertCalculator'
import HistoryView from './components/HistoryView'
import Settings from './components/Settings'
import PowerSysCalculator from './components/PowerSysCalculator'
import PQCalculator from './components/PQCalculator'
import RenewableEnergyCalculator from './components/RenewableEnergyCalculator'
import LicenseGate from './components/LicenseGate'
import { SiteProvider, useSite } from './components/SiteContext'
import { WorkspaceProvider } from './components/WorkspaceContext'
import { ResultCard, getPendingResult, clearPendingResult } from './components/shared'

const SCREEN_LABELS = {
  motor:      'Motors & Drives',
  cable:      'Cable & Wiring',
  earthing:   'Earthing',
  protection: 'Protection',
  powersys:   'Power Systems',
  pq:         'Power Quality',
  renewable:  'Renewable Energy',
  convert:    'Unit Converter',
  formulas:   'Formula Library',
  history:    'Calculation History',
  settings:   'Settings',
}

// Site parameters (voltage, altitude, frequency, currency, etc.) live in
// SiteContext now — no separate flat default here. See SiteContext.jsx for
// why: this used to be a second, disconnected copy of the same concept.

export default function App() {
  const [screen, setScreen]             = useState('dashboard')
  const [showQuickMath, setShowQuickMath] = useState(false)
  const [bottomTab, setBottomTab]       = useState('home')
  const [history, setHistory]           = useState([])
  const [themeMode, setThemeMode]       = useState('dark')   // 'dark' | 'light'

  // Result recovery (Option A): if a calculation was left unexported when
  // the app last closed, offer it back via a small banner rather than
  // silently losing it. See shared.jsx's PENDING RESULT RECOVERY comment
  // for the full design and why it's a single global slot, not per-tab.
  const [pendingResult, setPendingResult] = useState(null)   // the recovered data, once loaded
  const [showRecoveredCard, setShowRecoveredCard] = useState(false)

  useEffect(() => {
    getPendingResult().then(setPendingResult)
  }, [])

  const dismissPendingResult = () => {
    clearPendingResult()
    setPendingResult(null)
    setShowRecoveredCard(false)
  }

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
    const props = { addHistory, theme: T, themeMode }
    switch (screen) {
      case 'dashboard':  return <Dashboard onNavigate={navigate} theme={T} themeMode={themeMode} />
      case 'motor':      return <MotorCalculator {...props} />
      case 'cable':      return <CableCalculator {...props} />
      case 'earthing':   return <EarthingCalculator {...props} />
      case 'protection': return <Protection {...props} />
      case 'powersys':   return <PowerSysCalculator {...props} />
      case 'pq':         return <PQCalculator {...props} />
      case 'renewable':  return <RenewableEnergyCalculator {...props} />
      case 'convert':    return <ConvertCalculator theme={T} themeMode={themeMode} />
      case 'formulas':   return <FormulaReference history={history} theme={T} themeMode={themeMode} />
      case 'history':    return <HistoryView history={history} onClear={() => setHistory([])} theme={T} themeMode={themeMode} />
      case 'settings':   return (
        <Settings
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          theme={T}
        />
      )
      default: return <Dashboard onNavigate={navigate} theme={T} themeMode={themeMode} />
    }
  }

  // Site summary text now comes from SiteContext, via the SiteSummaryPill
  // component below — App itself sits above SiteProvider in the tree (it's
  // the one creating the provider), so it can't call useSite() here directly.

  return (
    <SiteProvider>
    <WorkspaceProvider>
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
              {isInTool ? SCREEN_LABELS[screen] : 'PowerSuite'}
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
{!isInTool && <SiteSummaryPill T={T} />}
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}
      >
        {renderScreen()}
      </main>

      {/* ── PENDING RESULT RECOVERY BANNER ──────────────────────
          Shown when a calculation was left unexported the last time the
          app closed. Deliberately screen-agnostic — ResultCard only ever
          needs the `data` object, so this works regardless of which
          screen is currently open, with no need to know or navigate back
          to whichever calculator originally produced it. */}
      {pendingResult && !showRecoveredCard && (
        <div
          className="fixed z-40 left-3 right-3 rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{
            top: 'calc(env(safe-area-inset-top) + 64px)',
            backgroundColor: T.accentDim,
            border: `1px solid ${T.accentBorder}`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          }}
        >
          <span style={{ fontSize: '18px' }}>📋</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold truncate" style={{ color: T.accentText }}>
              Unexported result: {pendingResult.calculator}
            </div>
            <div className="text-[11px]" style={{ color: T.textMuted }}>
              Left over from before the app last closed
            </div>
          </div>
          <button
            onClick={() => setShowRecoveredCard(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0"
            style={{ backgroundColor: T.accent, color: '#000' }}
          >
            View
          </button>
          <button
            onClick={dismissPendingResult}
            className="text-lg px-1 shrink-0"
            style={{ color: T.textMuted }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {showRecoveredCard && pendingResult && (
        <ResultCard data={pendingResult} onClose={dismissPendingResult} />
      )}

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
    </WorkspaceProvider>
    </SiteProvider>
  )
}

// Small standalone component so it can call useSite() — it's rendered as a
// child inside <SiteProvider>, whereas App() itself is the component that
// creates the provider and so sits above it in the tree.
function SiteSummaryPill({ T }) {
  const { site } = useSite()
  return (
    <div
      className="px-3 py-1.5 rounded-full text-xs font-mono"
      style={{
        backgroundColor: T.accentDim,
        border: `1px solid ${T.accentBorder}`,
        color: T.accentText,
      }}
    >
      {site.defaultLV}V · {site.frequency}Hz · {site.altitude}m
    </div>
  )
}
