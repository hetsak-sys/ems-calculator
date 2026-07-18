// theme.js — central design tokens for PowerSuite
// Import this in any component: import { getTheme } from '../theme'

export const THEMES = {
  dark: {
    // Backgrounds
    appBg:      '#000000',
    headerBg:   '#080808',
    surfaceBg:  '#0a0a0a',
    surface2Bg: '#111111',
    cardBg:     '#0d0d0d',

    // Borders
    border:     '#1c1c1c',
    borderSub:  '#141414',

    // Text
    textPrimary:  '#f0f0f0',
    textSub:      '#9ca3af',
    textMuted:    '#4b5563',
    textDisabled: '#2d2d2d',

    // Accent (amber/gold)
    accent:       '#f59e0b',
    accentDim:    '#1a0f00',
    accentBorder: '#3d2800',
    accentText:   '#fbbf24',

    // Module card tints
    motorBg:    '#100800',  motorBorder: '#3d2800',  motorAccent: '#f59e0b',
    cableBg:    '#001008',  cableBorder: '#003d20',  cableAccent: '#10b981',
    earthBg:    '#08080f',  earthBorder: '#1e1e4a',  earthAccent: '#818cf8',
    protBg:     '#100004',  protBorder:  '#3d0010',  protAccent:  '#f87171',
    powerBg:    '#000f10',  powerBorder: '#003d40',  powerAccent: '#22d3ee',
    pqBg:       '#080f00',  pqBorder:   '#1e3d00',  pqAccent:   '#a3e635',
    convertBg:  '#0f0f00',  convertBorder:'#3d3800', convertAccent:'#fbbf24',
    formulaBg:  '#0a0010',  formulaBorder:'#2d0040', formulaAccent:'#c084fc',
    renewableBg:'#001210',  renewableBorder:'#00473d', renewableAccent:'#2dd4bf',

    // Buttons
    btnNum:     { bg: '#141414', text: '#e5e7eb', border: '#222222' },
    btnOp:      { bg: '#1a0f00', text: '#f59e0b', border: '#3d2800' },
    btnFn:      { bg: '#0a1628', text: '#60a5fa', border: '#1e3a5f' },
    btnGold:    { bg: '#180e00', text: '#f59e0b', border: '#3d2800' },
    btnGreen:   { bg: '#001408', text: '#34d399', border: '#003d20' },
    btnRed:     { bg: '#1a0008', text: '#f87171', border: '#3d0010' },
    btnDanger:  { bg: '#2d0000', text: '#ef4444', border: '#5a0000' },
    btnDark:    { bg: '#111111', text: '#9ca3af', border: '#1f1f1f' },
    btnEquals:  { bg: '#f59e0b', text: '#000000', border: '#f59e0b' },

    // Status
    inputBg:    '#0a0a0a',
    inputBorder:'#2a2a2a',
    resultText: '#f59e0b',
  },

  light: {
    // Backgrounds
    appBg:      '#f4f1ea',
    headerBg:   '#ffffff',
    surfaceBg:  '#ffffff',
    surface2Bg: '#f9f7f2',
    cardBg:     '#ffffff',

    // Borders
    border:     '#e2ddd4',
    borderSub:  '#ede9e0',

    // Text
    textPrimary:  '#111111',
    textSub:      '#555555',
    textMuted:    '#888888',
    textDisabled: '#cccccc',

    // Accent (amber/gold — slightly darker for readability on white)
    accent:       '#d97706',
    accentDim:    '#fef3c7',
    accentBorder: '#fcd34d',
    accentText:   '#b45309',

    // Module card tints (light-mode versions)
    motorBg:    '#fffbf0',  motorBorder: '#fde68a',  motorAccent: '#d97706',
    cableBg:    '#f0fdf8',  cableBorder: '#a7f3d0',  cableAccent: '#059669',
    earthBg:    '#f5f3ff',  earthBorder: '#c4b5fd',  earthAccent: '#6d28d9',
    protBg:     '#fff1f2',  protBorder:  '#fecdd3',  protAccent:  '#e11d48',
    powerBg:    '#ecfeff',  powerBorder: '#a5f3fc',  powerAccent: '#0891b2',
    pqBg:       '#f7fee7',  pqBorder:   '#bef264',  pqAccent:   '#65a30d',
    convertBg:  '#fefce8',  convertBorder:'#fde047', convertAccent:'#ca8a04',
    formulaBg:  '#faf5ff',  formulaBorder:'#e9d5ff', formulaAccent:'#9333ea',
    renewableBg:'#f0fdfa',  renewableBorder:'#99f6e4', renewableAccent:'#0d9488',

    // Buttons
    btnNum:     { bg: '#f5f3ee', text: '#111111', border: '#ddd9d0' },
    btnOp:      { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },
    btnFn:      { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    btnGold:    { bg: '#fef9ee', text: '#d97706', border: '#fde68a' },
    btnGreen:   { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    btnRed:     { bg: '#fff1f2', text: '#e11d48', border: '#fecdd3' },
    btnDanger:  { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
    btnDark:    { bg: '#f5f3ee', text: '#555555', border: '#ddd9d0' },
    btnEquals:  { bg: '#d97706', text: '#ffffff', border: '#d97706' },

    // Status
    inputBg:    '#f9f7f2',
    inputBorder:'#ddd9d0',
    resultText: '#d97706',
  },
}

export const getTheme = (mode = 'dark') => THEMES[mode] || THEMES.dark
