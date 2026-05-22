import React from 'react'

export default function HistoryView({ history, onClear }) {
  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-8 text-center">
        <div className="text-4xl mb-4" style={{ opacity: 0.3 }}>⏱</div>
        <div className="text-gray-500 text-sm">No calculations yet</div>
        <div className="text-gray-700 text-xs mt-1">
          Results from all modules will appear here
        </div>
      </div>
    )
  }

  const fmt = (ts) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) +
      ' · ' + d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-gray-400 text-sm font-bold">
          {history.length} calculation{history.length !== 1 ? 's' : ''}
        </div>
        <button
          onClick={onClear}
          className="px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ backgroundColor: '#1a0000', color: '#f87171', border: '1px solid #3d0000' }}
        >
          Clear All
        </button>
      </div>

      {history.map((entry, i) => (
        <div
          key={i}
          className="mb-3 rounded-xl p-4"
          style={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a' }}
        >
          <div className="flex items-start justify-between mb-2">
            <div
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#1a0f00', color: '#f59e0b', border: '1px solid #3d2800' }}
            >
              {entry.tool || 'Calculation'}
            </div>
            <div className="text-gray-700 text-xs">{fmt(entry.timestamp)}</div>
          </div>

          {entry.inputs && (
            <div className="mb-2">
              {Object.entries(entry.inputs).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs py-0.5">
                  <span className="text-gray-600 capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="text-gray-400 font-mono">{v}</span>
                </div>
              ))}
            </div>
          )}

          <div
            className="text-right font-mono font-bold text-base"
            style={{ color: '#f59e0b' }}
          >
            = {entry.result}
          </div>
        </div>
      ))}
    </div>
  )
}
