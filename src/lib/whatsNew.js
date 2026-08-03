// src/lib/whatsNew.js
//
// Single place to record what changed in each release. Bumping
// package.json's "version" and adding one entry here is the whole
// workflow for a new "What's New" banner entry — no other UI work
// needed (WhatsNewBanner.jsx renders whatever this returns).
//
// Add new entries to the TOP of this array as releases ship.

export const WHATS_NEW = [
  {
    version: '1.0.0',
    note: 'New: Suggestions — send feedback straight to WhatsApp, in Settings.',
  },
];

// Compares two "x.y.z"-style version strings numerically, segment by
// segment (never a plain string compare — "1.10.0" must sort after
// "1.9.0", not before it). Missing segments are treated as 0.
// Returns: negative if a<b, 0 if equal, positive if a>b.
export function compareVersions(a, b) {
  const pa = String(a ?? '0').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b ?? '0').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function isNewerVersion(a, b) {
  return compareVersions(a, b) > 0;
}

// Returns the entries the person hasn't seen yet: strictly newer than
// lastSeenVersion, and not newer than the currently-running app version
// (defensive — an entry accidentally dated ahead of the build should
// never surface). lastSeenVersion of null/undefined is treated as
// "nothing seen" (everything up to currentVersion qualifies) — callers
// that want fresh installs to see nothing should handle that as a
// separate first-run case, not by calling this with a fake version.
// Result is sorted newest-first for display.
export function getUnseenEntries(lastSeenVersion, currentVersion, entries = WHATS_NEW) {
  return entries
    .filter(
      (e) =>
        compareVersions(e.version, lastSeenVersion) > 0 &&
        compareVersions(e.version, currentVersion) <= 0
    )
    .sort((a, b) => compareVersions(b.version, a.version));
}
