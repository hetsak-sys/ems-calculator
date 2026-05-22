import React, { useState } from 'react'

const VOLTAGE_OPTIONS = [
  { label: '220 V',  value: 220  },
  { label: '230 V',  value: 230  },
  { label: '380 V',  value: 380  },
  { label: '400 V',  value: 400  },
  { label: '415 V',  value: 415  },
  { label: '525 V',  value: 525  },
  { label: '690 V',  value: 690  },
  { label: '1 000 V', value: 1000 },
  { label: '3 300 V', value: 3300 },
  { label: '6 600 V', value: 6600 },
  { label: '11 000 V', value: 11000 },
  { label: '22 000 V', value: 22000 },
  { label: '33 000 V', value: 33000 },
]

const CURRENCY_OPTIONS = [
  { label: 'ZAR — South African Rand', value: 'ZAR' },
  { label: 'LSL — Lesotho Loti',       value: 'LSL' },
  { label: 'USD — US Dollar',          value: 'USD' },
  { label: 'EUR — Euro',               value: 'EUR' },
]

export default function Settings({ siteConfig, setSiteConfig, themeMode, setThemeMode, theme: T }) {
  const [local, setLocal] = useState({ ...siteConfig })
  const [saved, setSaved] = useState(false)

  const update = (key, val) => setLocal(c => ({ ...c, [key]: val }))

  const handleSave = () => {
    setSiteConfig({ ...local })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const changed = JSON.stringify(local) !== JSON.stringify(siteConfig)

  // ── Shared field styles ──────────────────────────────────────────
  const fieldLabel = { fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', color: T.textMuted, textTransform: 'uppercase', marginBottom: '8px' }
  const fieldWrap  = { marginBottom: '24px' }
  const input = {
    width: '100%', padding: '12px 14px', borderRadius: '12px',
    backgroundColor: T.inputBg, border: `1px solid ${T.inputBorder}`,
    color: T.textPrimary, fontSize: '15px', fontFamily: 'monospace',
    outline: 'none',
  }
  const section = {
    backgroundColor: T.surfaceBg,
    border: `1px solid ${T.border}`,
    borderRadius: '16px',
    padding: '18px',
    marginBottom: '16px',
  }
  const sectionTitle = { fontSize: '12px', fontWeight: '800', letterSpacing: '0.12em', color: T.accent, marginBottom: '16px', textTransform: 'uppercase' }

  return (
    <div className="px-4 pt-4 pb-6">

      {/* ── APPEARANCE ────────────────────────────────── */}
      <div style={section}>
        <div style={sectionTitle}>Appearance</div>

        <div style={fieldLabel}>Theme</div>
        <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
          {[
            { id: 'dark',  icon: '🌙', label: 'Dark Mode'  },
            { id: 'light', icon: '☀️', label: 'Light Mode' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setThemeMode(opt.id)}
              className="flex-1 flex items-center justify-center gap-2 py-3"
              style={{
                backgroundColor: themeMode === opt.id ? T.accent : T.surface2Bg,
                color: themeMode === opt.id ? '#000000' : T.textSub,
                fontWeight: themeMode === opt.id ? '700' : '400',
                fontSize: '14px',
                transition: 'all 0.2s',
              }}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── SITE PARAMETERS ───────────────────────────── */}
      <div style={section}>
        <div style={sectionTitle}>Site Parameters</div>

        {/* Voltage */}
        <div style={fieldWrap}>
          <div style={fieldLabel}>System Voltage</div>
          <div className="grid grid-cols-3 gap-2">
            {VOLTAGE_OPTIONS.map(v => (
              <button
                key={v.value}
                onClick={() => update('voltage', v.value)}
                className="py-2.5 rounded-xl text-xs font-bold text-center"
                style={{
                  backgroundColor: local.voltage === v.value ? T.accentDim : T.surface2Bg,
                  border: `1px solid ${local.voltage === v.value ? T.accent : T.border}`,
                  color: local.voltage === v.value ? T.accent : T.textSub,
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Frequency */}
        <div style={fieldWrap}>
          <div style={fieldLabel}>Grid Frequency</div>
          <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
            {[50, 60].map(f => (
              <button
                key={f}
                onClick={() => update('freq', f)}
                className="flex-1 py-3 font-bold text-sm"
                style={{
                  backgroundColor: local.freq === f ? T.accent : T.surface2Bg,
                  color: local.freq === f ? '#000000' : T.textSub,
                  transition: 'all 0.2s',
                }}
              >
                {f} Hz
              </button>
            ))}
          </div>
        </div>

        {/* Altitude */}
        <div style={fieldWrap}>
          <div style={fieldLabel}>Site Altitude (metres above sea level)</div>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              value={local.altitude}
              onChange={e => update('altitude', parseInt(e.target.value) || 0)}
              style={input}
              placeholder="e.g. 1500"
            />
            <span
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold"
              style={{ color: T.textMuted }}
            >
              m ASL
            </span>
          </div>
          {/* Common altitude presets */}
          <div className="flex flex-wrap gap-2 mt-2">
            {[
              { label: 'Sea Level',    val: 0    },
              { label: 'Bloemfontein',val: 1395  },
              { label: 'Johannesburg',val: 1753  },
              { label: 'Maseru',       val: 1600 },
              { label: 'Letseng',      val: 3100 },
            ].map(p => (
              <button
                key={p.val}
                onClick={() => update('altitude', p.val)}
                className="px-3 py-1.5 rounded-full text-xs"
                style={{
                  backgroundColor: local.altitude === p.val ? T.accentDim : T.surface2Bg,
                  border: `1px solid ${local.altitude === p.val ? T.accent : T.border}`,
                  color: local.altitude === p.val ? T.accent : T.textMuted,
                }}
              >
                {p.label} ({p.val}m)
              </button>
            ))}
          </div>
        </div>

        {/* Currency */}
        <div style={{ ...fieldWrap, marginBottom: 0 }}>
          <div style={fieldLabel}>Currency</div>
          <select
            value={local.currency}
            onChange={e => update('currency', e.target.value)}
            style={{ ...input, appearance: 'none' }}
          >
            {CURRENCY_OPTIONS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── SAVE BUTTON ───────────────────────────────── */}
      <button
        onClick={handleSave}
        disabled={!changed && !saved}
        className="w-full py-4 rounded-xl font-bold text-base"
        style={{
          backgroundColor: saved ? '#15803d' : changed ? T.accent : T.surface2Bg,
          color: saved ? '#ffffff' : changed ? '#000000' : T.textMuted,
          border: `1px solid ${saved ? '#15803d' : changed ? T.accent : T.border}`,
          transition: 'all 0.3s',
          cursor: changed || saved ? 'pointer' : 'not-allowed',
        }}
      >
        {saved ? '✓ Settings Saved' : changed ? 'Save Changes' : 'No Changes'}
      </button>

      {/* Current active config summary */}
      <div
        className="mt-4 rounded-xl p-4"
        style={{ backgroundColor: T.surface2Bg, border: `1px solid ${T.border}` }}
      >
        <div style={{ ...sectionTitle, marginBottom: '8px' }}>Active Configuration</div>
        {[
          { label: 'Voltage',   value: `${siteConfig.voltage} V` },
          { label: 'Frequency', value: `${siteConfig.freq} Hz` },
          { label: 'Altitude',  value: `${siteConfig.altitude} m ASL` },
          { label: 'Currency',  value: siteConfig.currency },
          { label: 'Theme',     value: themeMode === 'dark' ? '🌙 Dark' : '☀️ Light' },
        ].map(row => (
          <div key={row.label} className="flex justify-between py-1.5" style={{ borderBottom: `1px solid ${T.border}` }}>
            <span style={{ fontSize: '13px', color: T.textSub }}>{row.label}</span>
            <span style={{ fontSize: '13px', color: T.textPrimary, fontWeight: '600', fontFamily: 'monospace' }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* App info */}
      <div className="text-center mt-6" style={{ color: T.textMuted, fontSize: '12px' }}>
        Hetsa PowerSuite v1.0 · Field Engineering Platform
      </div>
    </div>
  )
}
