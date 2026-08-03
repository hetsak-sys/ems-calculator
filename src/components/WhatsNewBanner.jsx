// src/components/WhatsNewBanner.jsx
//
// Dismissible "What's New" card shown on the Dashboard when the app has
// been updated since the person last saw it. Design (agreed 2026-08-03):
//   - lastSeenVersion is stored in @capacitor/preferences.
//   - On a genuine first-ever launch (no stored value at all) we store
//     the current version silently and show nothing — there's nothing
//     "new" to someone who has never used the app before.
//   - On any later launch where the stored version is older than the
//     running build, show the unseen changelog entries from whatsNew.js.
//   - Dismissing marks the current version as seen so it won't show
//     again until the next release adds a newer entry.

import React, { useEffect, useState } from 'react';
import { Preferences } from '@capacitor/preferences';
import { getUnseenEntries } from '../lib/whatsNew';

const LAST_SEEN_VERSION_KEY = 'ps_last_seen_version';

export default function WhatsNewBanner({ theme: T }) {
  const [entries, setEntries] = useState([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const currentVersion =
        typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null;
      if (!currentVersion) return; // no build-time version injected — nothing to compare

      const { value: storedVersion } = await Preferences.get({
        key: LAST_SEEN_VERSION_KEY,
      }).catch(() => ({ value: null }));

      if (cancelled) return;

      if (storedVersion == null) {
        // First-ever launch: nothing to announce, just start tracking.
        Preferences.set({ key: LAST_SEEN_VERSION_KEY, value: currentVersion }).catch(() => {});
        return;
      }

      const unseen = getUnseenEntries(storedVersion, currentVersion);
      if (unseen.length > 0) {
        setEntries(unseen);
        setVisible(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = () => {
    const currentVersion =
      typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null;
    setVisible(false);
    if (currentVersion) {
      Preferences.set({ key: LAST_SEEN_VERSION_KEY, value: currentVersion }).catch(() => {});
    }
  };

  if (!visible || entries.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-4 mb-5"
      style={{
        background: `linear-gradient(135deg, ${T.accentDim} 0%, ${T.surfaceBg} 100%)`,
        border: `1px solid ${T.accentBorder}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div
            className="text-xs font-bold tracking-widest uppercase mb-2"
            style={{ color: T.accent }}
          >
            ✨ What's New
          </div>
          <ul className="space-y-1.5">
            {entries.map((entry) => (
              <li
                key={entry.version}
                className="text-xs leading-snug"
                style={{ color: T.textPrimary }}
              >
                {entry.note}
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{
            width: '24px',
            height: '24px',
            backgroundColor: `${T.accent}22`,
            border: `1px solid ${T.accentBorder}`,
            color: T.accent,
            fontSize: '14px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <button
        onClick={handleDismiss}
        className="w-full mt-3 rounded-lg py-2 text-xs font-bold tracking-wide"
        style={{ backgroundColor: `${T.accent}18`, border: `1px solid ${T.accentBorder}`, color: T.accent }}
      >
        Got it
      </button>
    </div>
  );
}
