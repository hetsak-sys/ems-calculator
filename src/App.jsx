import React, { useState, useCallback } from 'react'
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

const PRESETS = [
  { id: 'sa_mine_surface',     label: '🇿🇦 SA Mine (Surface)',   voltage: 525, freq: 50, altitude: 1500, currency: 'ZAR' },
  { id: 'sa_mine_underground', label: '🇿🇦 SA Mine (UG)',         voltage: 525, freq: 50, altitude: 0,    currency: 'ZAR' },
  { id: 'lesotho_industrial',  label: '🇱🇸 Lesotho Industrial',   voltage: 400, freq: 50, altitude: 1600, currency: 'LSL' },
  { id: 'sa_industrial',       label: '🇿🇦 SA Industrial',        voltage: 400, freq: 50, altitude: 1200, currency: 'ZAR' },
]

// Tool label for header breadcrumb
const SCREEN_LABELS = {
  dashboard:  null,
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

export default function App() {
  const [screen, setScreen]           = useState('dashboard')
  const [showQuickMath, setShowQuickMath] = useState(false)
  const [bottomTab, setBottomTab]     = useState('home')
  const [history, setHistory]         = useState([])
  const [preset, setPreset]           = useState(PRESETS[0])
  const [showPresetMenu, setShowPresetMenu] = useState(false)

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
    if (tab === 'quickmath') {
      setShowQuickMath(true)
      return
    }
    setShowQuickMath(false)
    setBottomTab(tab)
    if (tab === 'home')     navigate('dashboard')
    if (tab === 'history')  navigate('history')
    if (tab === 'settings') navigate('settings')
  }

  const isInTool = !['dashboard', 'history', 'settings'].includes(screen)

  const renderScreen = () => {
    switch (screen) {
      case 'dashboard':  return <Dashboard onNavigate={navigate} preset={preset} />
      case 'motor':      return <MotorCalculator addHistory={addHistory} preset={preset} />
      case 'cable':      return <CableCalculator addHistory={addHistory} preset={preset} />
      case 'earthing':   return <EarthingCalculator addHistory={addHistory} preset={preset} />
      case 'protection': return <NerCalculator addHistory={addHistory} preset={preset} />
      case 'powersys':   return <PowerSysCalculator addHistory={addHistory} preset={preset} />
      case 'pq':         return <PQCalculator addHistory={addHistory} preset={preset} />
      case 'convert':    return <ConvertCalculator />
      case 'formulas':   return <FormulaReference history={history} />
      case 'history':    return <HistoryView history={history} onClear={() => setHistory([])} />
      case 'settings':   return <Settings preset={preset} setPreset={setPreset} presets={PRESETS} />
      default:           return <Dashboard onNavigate={navigate} preset={preset} />
    }
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden select-none">

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          backgroundColor: '#080808',
          borderBottom: '1px solid #1c1c1c',
          height: '56px',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className="flex items-center gap-2">
          {isInTool ? (
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-amber-400 pr-2"
              style={{ fontSize: '22px', lineHeight: 1 }}
            >
              ‹
            </button>
          ) : null}

          <div className="flex items-baseline gap-2">
            <span
              className="font-black tracking-tight text-amber-400"
              style={{ fontSize: '17px', fontFamily: "'Rajdhani', 'Share Tech Mono', monospace" }}
            >
              {isInTool ? SCREEN_LABELS[screen] : 'Hetsa PowerSuite'}
            </span>
            {!isInTool && (
              <span className="text-gray-600 text-xs">v1.0</span>
            )}
          </div>
        </div>

        {/* Preset Selector */}
        <button
          onClick={() => setShowPresetMenu(p => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
          style={{
            backgroundColor: '#130d00',
            border: '1px solid #3d2800',
            color: '#fbbf24',
          }}
        >
          <span>{preset.label.slice(0, 20)}</span>
          <span className="text-amber-600" style={{ fontSize: '9px' }}>▼</span>
        </button>
      </div>

      {/* ── PRESET DROPDOWN ────────────────────────────────────── */}
      {showPresetMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPresetMenu(false)}
          />
          <div
            className="absolute right-3 z-50 rounded-xl overflow-hidden shadow-2xl"
            style={{
              top: '58px',
              backgroundColor: '#0f0f0f',
              border: '1px solid #2a1800',
              minWidth: '220px',
            }}
          >
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => { setPreset(p); setShowPresetMenu(false) }}
                className="flex items-center justify-between w-full text-left px-4 py-3 text-sm"
                style={{
                  color: preset.id === p.id ? '#fbbf24' : '#9ca3af',
                  backgroundColor: preset.id === p.id ? '#1a0f00' : 'transparent',
                  borderBottom: '1px solid #1a1a1a',
                }}
              >
                <span>{p.label}</span>
                <span className="text-xs text-gray-600">{p.voltage}V</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── MAIN CONTENT ───────────────────────────────────────── */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}
      >
        {renderScreen()}
      </main>

      {/* ── QUICK MATH OVERLAY ─────────────────────────────────── */}
      {showQuickMath && (
        <QuickMath
          onClose={() => { setShowQuickMath(false); setBottomTab('home') }}
          addHistory={addHistory}
        />
      )}

      {/* ── BOTTOM NAVIGATION ──────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 flex items-center z-30"
        style={{
          backgroundColor: '#080808',
          borderTop: '1px solid #1c1c1c',
          height: 'calc(60px + env(safe-area-inset-bottom))',
          paddingBottom: 'env(safe-area-inset-bottom)',
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
                    width: '42px',
                    height: '42px',
                    background: active
                      ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                      : '#1a0f00',
                    border: active ? 'none' : '1px solid #3d2800',
                    marginTop: '-16px',
                    boxShadow: active ? '0 0 20px #f59e0b66' : 'none',
                  }}
                >
                  <span className={active ? 'text-black text-lg' : 'text-amber-500 text-lg'}>
                    {tab.icon}
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: '18px', color: active ? '#f59e0b' : '#4b5563' }}>
                  {tab.icon}
                </span>
              )}
              <span
                style={{
                  fontSize: '10px',
                  color: active ? '#f59e0b' : '#4b5563',
                  marginTop: tab.id === 'quickmath' ? '2px' : '0',
                }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
