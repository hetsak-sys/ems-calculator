// PowerSysCalculator.jsx
// Stub — replace with your existing Power Systems component contents
// (previously may have been TransformerCalculator + PowerFactorCalculator + GeneratorCalculator etc.)

import React from 'react'

export default function PowerSysCalculator({ addHistory, preset }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
      <div className="text-3xl mb-3">⚡</div>
      <div className="text-amber-400 font-bold text-sm mb-1">Power Systems</div>
      <div className="text-gray-600 text-xs">
        Copy your existing Transformer, Generator, and Power Factor
        components into this file, or import them here as sub-tabs.
      </div>
    </div>
  )
}
