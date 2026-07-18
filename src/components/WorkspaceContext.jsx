// WorkspaceContext.jsx — carries calculated values between modules so a
// field tech doesn't have to re-type the same figure into multiple tabs.
//
// Distinct from SiteContext (which holds static site presets the user
// picks from). This holds the most recent *calculated result* from one
// module that other modules can use as a prefilled starting point —
// motor FLA snapshot (Motor -> Cable), and generator sizing snapshot
// (Generator Sizing -> Renewable Energy Hybrid tab), each following the
// same pattern. Extend the same way for future values.
//
// Prefill only: consumer modules read this once as their initial useState
// value, the same way they already read site.* defaults. It never
// overwrites a value the user is actively editing.
import { createContext, useContext, useState } from 'react'

export const WorkspaceContext = createContext({
  flaSnapshot: null,
  setFlaSnapshot: () => {},
  generatorSnapshot: null,
  setGeneratorSnapshot: () => {},
})

export function WorkspaceProvider({ children }) {
  const [flaSnapshot, setFlaSnapshot] = useState(null)
  const [generatorSnapshot, setGeneratorSnapshot] = useState(null)
  return (
    <WorkspaceContext.Provider value={{ flaSnapshot, setFlaSnapshot, generatorSnapshot, setGeneratorSnapshot }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
