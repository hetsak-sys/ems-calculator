import { createContext, useContext, useState, useEffect } from 'react'
import { Preferences } from '@capacitor/preferences'

/**
 * SiteContext — the single source of truth for the current site's
 * electrical parameters (voltage, altitude, frequency, currency, phase,
 * power factor, efficiency, material, etc.), consumed via useSite() by
 * MotorCalculator, CableCalculator, ContactorOLR, PowerSysCalculator,
 * Dashboard, and PQCalculator/GeneratorSizing's PDF export site label.
 *
 * DELIBERATELY NOT a picker between named locations (no "SA Mine
 * (Surface)" / "Lesotho Highlands Mine" / etc.). Standing decision:
 * PowerSuite must not assume or embed a particular location — the user
 * types their own site parameters, same as the altitude field has always
 * worked ("Sea Level" is the only preset; everything else is free input).
 * `name` is an optional free-text label purely for record-keeping (shows
 * up as "Site:" on exported PDFs) — it carries no calculation meaning and
 * defaults to blank rather than a guessed/assumed value.
 *
 * Previously this held six hardcoded named mine profiles behind a
 * setSiteById() picker that no screen ever called — so every module
 * reading useSite() silently always got the same default profile,
 * regardless of what a user might have wanted to configure. Collapsing to
 * one directly-editable site removes that dead, unreachable branch and
 * makes Settings.jsx the one real, working way to change these values.
 *
 * PERSISTENCE: site config is saved to @capacitor/preferences — same
 * durable on-device storage LicenseManager.js already uses for the
 * license cache, same reasoning: plain useState() lives only in RAM and
 * is wiped every time the app process ends, so without this every site
 * setting silently reset to DEFAULT_SITE on every relaunch (confirmed by
 * on-device testing). Loaded once on startup; written every time
 * setSiteField/setSiteFields runs — which, per Settings.jsx's own design,
 * only happens when the user taps "Save Changes", not on every keystroke.
 */

const SITE_STORAGE_KEY = 'hetsa_site_config'

export const DEFAULT_SITE = {
  name:       '',       // optional free-text label for PDF/record-keeping — e.g. "Client X — DB2"
  defaultLV:  '400',    // system voltage (V) — SANS/IEC common LV values: 230/400/525/690/1000
  defaultMV:  '11000',  // MV reference (V), used where a module needs it (transformer primary, etc.)
  altitude:   '1000',   // m ASL — free input, no location presets (standing decision)
  ambient:    '30',     // °C — used for derating calculations (cable, generator)
  frequency:  '50',     // Hz — 50 or 60
  currency:   'ZAR',
  tariff:     '2.50',   // per-kWh energy cost, used by lifecycle/payback-style calculations
  phase:      '3ph',    // '1ph' | '3ph'
  material:   'Cu',     // 'Cu' | 'Al' — default conductor material
  insulation: 'PVC',    // cable insulation type, read by CableCalculator
  maxVd:      '3',      // % — max allowable voltage drop
  pf:         '0.85',   // default assumed load power factor
  efficiency: '90',     // % — default assumed motor/inverter efficiency
}

export const SiteContext = createContext({
  site: DEFAULT_SITE,
  setSiteField: () => {},
  setSiteFields: () => {},
  resetSite: () => {},
})

export function SiteProvider({ children }) {
  const [site, setSite] = useState({ ...DEFAULT_SITE })

  // Load any previously saved site config once, on startup. Runs
  // concurrently with LicenseGate's own (slower, network-dependent)
  // check, so in practice this local read resolves well before the
  // license gate opens. Corrupt or missing cache just falls back to
  // DEFAULT_SITE — never blocks startup, never throws.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { value } = await Preferences.get({ key: SITE_STORAGE_KEY })
        if (value && !cancelled) {
          const saved = JSON.parse(value)
          setSite(s => ({ ...s, ...saved }))
        }
      } catch {
        // No saved config yet, or it's corrupt — DEFAULT_SITE stands.
      }
    })()
    return () => { cancelled = true }
  }, [])

  const persist = (next) => {
    Preferences.set({ key: SITE_STORAGE_KEY, value: JSON.stringify(next) }).catch(() => {})
  }

  /** Update a single field, e.g. setSiteField('altitude', '1600') */
  const setSiteField = (field, value) => {
    setSite(s => {
      const next = { ...s, [field]: value }
      persist(next)
      return next
    })
  }

  /** Update several fields at once, e.g. from Settings' Save button */
  const setSiteFields = (partial) => {
    setSite(s => {
      const next = { ...s, ...partial }
      persist(next)
      return next
    })
  }

  const resetSite = () => {
    setSite({ ...DEFAULT_SITE })
    persist({ ...DEFAULT_SITE })
  }

  return (
    <SiteContext.Provider value={{ site, setSiteField, setSiteFields, resetSite }}>
      {children}
    </SiteContext.Provider>
  )
}

export function useSite() {
  return useContext(SiteContext)
}
