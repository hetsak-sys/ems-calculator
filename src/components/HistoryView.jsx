import React from 'react'

export default function HistoryView({ history, onClear, theme: T }) {
  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 px-8 text-center">
        <div className="text-4xl mb-4" style={{ opacity: 0.3 }}>⏱</div>
        <div className="text-sm" style={{ color: T.textSub }}>No calculations yet</div>
        <div className="text-xs mt-1" style={{ color: T.textMuted }}>
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
        <div className="text-sm font-bold" style={{ color: T.textSub }}>
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
          style={{ backgroundColor: T.surfaceBg, border: `1px solid ${T.border}` }}
        >
          <div className="flex items-start justify-between mb-2">
            <div
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: T.accentDim, color: T.accent, border: `1px solid ${T.accentBorder}` }}
            >
              {entry.tool || 'Calculation'}
            </div>
            <div className="text-xs" style={{ color: T.textMuted }}>{fmt(entry.timestamp)}</div>
          </div>

          {entry.inputs && (
            <div className="mb-2">
              {Object.entries(entry.inputs).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs py-0.5">
                  <span style={{ color: T.textMuted }} className="capitalize">{k.replace(/_/g, ' ')}</span>
                  <span style={{ color: T.textSub }} className="font-mono">{v}</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-right font-mono font-bold text-base" style={{ color: T.resultText }}>
            = {entry.result}
          </div>
        </div>
      ))}
    </div>
  )
}
