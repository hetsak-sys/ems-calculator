import { createContext, useContext, useState } from 'react'

export const SITES = [
  {
    id: 'sa_surface',
    name: 'SA Mine (Surface)',
    flag: '🇿🇦',
    voltages:   ['230', '400', '525'],
    mvVoltages: ['6600', '11000'],
    defaultLV:  '525',
    defaultMV:  '6600',
    altitude:   '1500',
    ambient:    '25',
    frequency:  '50',
    currency:   'ZAR',
    tariff:     '2.50',
    phase:      '3ph',
    material:   'Cu',
    maxVd:      '3',
    pf:         '0.85',
    efficiency: '90',
  },
  {
    id: 'lesotho_highlands',
    name: 'Lesotho Highlands Mine',
    flag: '🇱🇸',
    voltages:   ['230', '400', '525'],
    mvVoltages: ['11000', '33000'],
    defaultLV:  '525',
    defaultMV:  '11000',
    altitude:   '3100',
    ambient:    '10',
    frequency:  '50',
    currency:   'LSL',
    tariff:     '2.80',
    phase:      '3ph',
    material:   'Cu',
    maxVd:      '3',
    pf:         '0.85',
    efficiency: '90',
  },
  {
    id: 'sa_underground',
    name: 'SA Mine (U/G)',
    flag: '⛏',
    voltages:   ['525', '1000'],
    mvVoltages: ['6600', '11000'],
    defaultLV:  '525',
    defaultMV:  '6600',
    altitude:   '1500',
    ambient:    '28',
    frequency:  '50',
    currency:   'ZAR',
    tariff:     '2.50',
    phase:      '3ph',
    material:   'Cu',
    maxVd:      '3',
    pf:         '0.85',
    efficiency: '90',
  },
  {
    id: 'sa_industrial',
    name: 'SA Industrial',
    flag: '🏭',
    voltages:   ['230', '400'],
    mvVoltages: ['11000', '22000'],
    defaultLV:  '400',
    defaultMV:  '11000',
    altitude:   '1200',
    ambient:    '30',
    frequency:  '50',
    currency:   'ZAR',
    tariff:     '2.20',
    phase:      '3ph',
    material:   'Cu',
    maxVd:      '3',
    pf:         '0.85',
    efficiency: '90',
  },
  {
    id: 'offshore',
    name: 'Offshore/Coastal',
    flag: '🌊',
    voltages:   ['230', '400'],
    mvVoltages: ['6600', '11000'],
    defaultLV:  '400',
    defaultMV:  '6600',
    altitude:   '0',
    ambient:    '35',
    frequency:  '50',
    currency:   'ZAR',
    tariff:     '2.50',
    phase:      '3ph',
    material:   'Cu',
    maxVd:      '3',
    pf:         '0.85',
    efficiency: '90',
  },
  {
    id: 'custom',
    name: 'Custom Site',
    flag: '⚙',
    voltages:   ['230', '400', '525', '690', '1000'],
    mvVoltages: ['3300', '6600', '11000', '22000', '33000'],
    defaultLV:  '400',
    defaultMV:  '11000',
    altitude:   '1000',
    ambient:    '30',
    frequency:  '50',
    currency:   'ZAR',
    tariff:     '2.50',
    phase:      '3ph',
    material:   'Cu',
    maxVd:      '3',
    pf:         '0.85',
    efficiency: '90',
  },
]

export const SiteContext = createContext({
  site: SITES[0],
  setSiteById: () => {},
  customSite: SITES[5],
  setCustomField: () => {},
})

export function SiteProvider({ children }) {
  const [siteId, setSiteId] = useState('sa_surface')
  const [customSite, setCustomSite] = useState({ ...SITES[5] })

  const setSiteById = (id) => setSiteId(id)
  const setCustomField = (field, value) => {
    setCustomSite(s => ({ ...s, [field]: value }))
  }

  const site = siteId === 'custom'
    ? customSite
    : SITES.find(s => s.id === siteId) || SITES[0]

  return (
    <SiteContext.Provider value={{ site, siteId, setSiteById, customSite, setCustomField }}>
      {children}
    </SiteContext.Provider>
  )
}

export function useSite() {
  return useContext(SiteContext)
}
