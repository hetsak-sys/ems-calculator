import { useState, createContext } from 'react'
import { SiteProvider } from './components/SiteContext'
import SiteSelector from './components/SiteSelector'
import BasicCalculator from './components/BasicCalculator'
import ScientificCalculator from './components/ScientificCalculator'
import MotorCalculator from './components/MotorCalculator'
import CableCalculator from './components/CableCalculator'
import ProtectionCalculator from './components/ProtectionCalculator'
import EarthingCalculator from './components/EarthingCalculator'
import PowerSystems from './components/PowerSystems'
import PowerQuality from './components/PowerQuality'
import UnitConverter from './components/UnitConverter'
import FormulaReference from './components/FormulaReference'

export const HistoryContext = createContext({ history: [], addHistory: () => {} })

const TABS = [
  { id: 'basic',      label: 'Basic',    icon: '⊞' },
  { id: 'sci',        label: 'Sci',      icon: 'ƒ' },
  { id: 'motor',      label: 'Motor',    icon: '⚙' },
  { id: 'cable',      label: 'Cable',    icon: '≋' },
  { id: 'earthing',   label: 'Earthing', icon: '⏚' },
  { id: 'protection', label: 'Protect',  icon: '🛡' },
  { id: 'powersys',   label: 'Power Sys',icon: '⚡' },
  { id: 'quality',    label: 'PQ',       icon: '〰' },
  { id: 'converter',  label: 'Convert',  icon: '⇄' },
  { id: 'formulas',   label: 'Formulas', icon: '∑' },
]

function AppContent() {
  const [activeTab, setActiveTab] = useState('basic')
  const [history, setHistory] = useState([])

  const addHistory = (entry) => {
    setHistory(prev => [{ ...entry, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 100))
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'basic':      return <BasicCalculator addHistory={addHistory} />
      case 'sci':        return <ScientificCalculator addHistory={addHistory} />
      case 'motor':      return <MotorCalculator addHistory={addHistory} />
      case 'cable':      return <CableCalculator addHistory={addHistory} />
      case 'earthing':   return <EarthingCalculator addHistory={addHistory} />
      case 'protection': return <ProtectionCalculator addHistory={addHistory} />
      case 'powersys':   return <PowerSystems addHistory={addHistory} />
      case 'quality':    return <PowerQuality addHistory={addHistory} />
      case 'converter':  return <UnitConverter />
      case 'formulas':   return <FormulaReference history={history} />
      default:           return <BasicCalculator addHistory={addHistory} />
    }
  }

  return (
  <HistoryContext.Provider value={{ history, addHistory }}>
    <div
      className="flex flex-col h-full bg-black overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 24px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-[#111] border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-black text-xl tracking-tight">Hetsa PowerSuite</span>
            <span className="text-[#444] text-xs">v1.0</span>
          </div>
          <SiteSelector />
        </div>

        {/* Tab Bar */}
        <div className="flex-shrink-0 flex overflow-x-auto scrollbar-none bg-[#0a0a0a] border-b border-[#2a2a2a]">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 flex flex-col items-center justify-center px-3 py-2 min-w-[58px] transition-colors ${
                activeTab === tab.id
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-gray-500'
              }`}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>

      </div>
    </HistoryContext.Provider>
  )
}

export default function App() {
  return (
    <SiteProvider>
      <AppContent />
    </SiteProvider>
  )
}
