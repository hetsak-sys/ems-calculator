import { Preferences } from '@capacitor/preferences';
import { getDeviceId } from './deviceId';

// There is deliberately no build-mode bypass here. Every build — including
// the copy on Hertz's own device — goes through the same real server
// check and activates with a real license key. This is intentional: an
// "owner" bypass mode was considered and rejected, because a bypass baked
// into a compiled APK can't be revoked or scoped once that file leaves
// your hands (e.g. shared via ShareIt/Xender). Removing the code path
// entirely — rather than just avoiding building it — means there's no
// artifact that could ever leak fully-unlocked access.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const CACHE_KEY = 'hetsa_license_status';

// License keys are HETSA-XXXX-XXXX-XXXX. Auto-format as the user types so
// they don't have to type dashes themselves; doesn't validate character
// exclusions (O/0/I/1) client-side — the server is the source of truth,
// this is just input UX.
// Lives here (not in a UI component) because it's pure string formatting
// used by more than one screen (LicenseGate's post-expiry entry screen,
// and Settings' "activate early" entry) — one shared definition avoids
// the two drifting out of sync.
export function formatLicenseInput(raw) {
  const alnum = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17)
  const sizes = [5, 4, 4, 4]
  let i = 0
  const groups = []
  for (const size of sizes) {
    if (i >= alnum.length) break
    groups.push(alnum.slice(i, i + size))
    i += size
  }
  return groups.join('-')
}

// How often we're willing to re-hit the server, per status. This is the
// core offline-first tradeoff:
//  - trial users need daysLeft to be reasonably accurate, so 6h.
//  - paid status almost never changes, so 72h is plenty and keeps you well
//    under Render free-tier request volume even with hundreds of users.
// Cached status is ALWAYS used first if within its TTL — the app never
// blocks startup on a network call.
const REVALIDATE_MS = {
  trial: 6 * 60 * 60 * 1000,
  paid: 72 * 60 * 60 * 1000,
  trial_expired: 6 * 60 * 60 * 1000,
};

// Default timeout for routine revalidation calls (device already has a
// cache, this is just a background refresh).
const DEFAULT_TIMEOUT_MS = 15000;

// Render's free tier spins down an idle instance and takes ~30-50s to wake
// on the next request. That cold start must NOT look like "no connectivity"
// to a brand-new install with no cache yet — give the very first
// register/verify sequence much more room before we call it a failure.
const COLD_START_TIMEOUT_MS = 60000;

async function readCache() {
  const { value } = await Preferences.get({ key: CACHE_KEY });
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function writeCache(status) {
  await Preferences.set({
    key: CACHE_KEY,
    value: JSON.stringify({ ...status, cachedAt: Date.now() }),
  });
}

// CHANGE 1: optional timeoutMs param (defaults to the routine, short
// timeout). Callers on the cold-start-prone first-ever-contact path pass
// COLD_START_TIMEOUT_MS explicitly; every other call site is unaffected.
async function callApi(path, body, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is not set for this build mode.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Request to ${path} failed (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request to ${path} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Activates a license key entered by the user on the gate screen.
 * Always hits the server live (no point caching a failed key entry).
 */
export async function activateLicense(licenseKey) {
  const deviceId = await getDeviceId();
  const result = await callApi('/api/license/activate', { deviceId, licenseKey });
  const status = { status: 'paid', daysLeft: null, isOwner: false };
  await writeCache(status);
  return { ...result, ...status };
}

// Shared verify → register-if-new → re-verify sequence, parameterized by
// timeout so the first-ever-contact path can use the longer cold-start
// allowance without duplicating this logic.
async function verifyOrRegister(deviceId, timeoutMs) {
  let result = await callApi('/api/verify', { deviceId }, timeoutMs);
  if (result.status === 'not_registered') {
    await callApi('/api/trial/register', { deviceId }, timeoutMs);
    result = await callApi('/api/verify', { deviceId }, timeoutMs);
  }
  return result;
}

/**
 * Main entry point. Call this on app start (and optionally on resume).
 * Returns: { status, daysLeft, isOwner, offline? }
 *   status: 'paid' | 'trial' | 'trial_expired' | 'not_registered' | 'error'
 *
 * force=true skips the cache TTL check (use this right after activation
 * or if the user manually taps "Re-check license" on the gate screen).
 */
export async function checkLicenseStatus({ force = false } = {}) {
  const cached = await readCache();
  const ttl = REVALIDATE_MS[cached?.status] ?? REVALIDATE_MS.trial;

  if (!force && cached && Date.now() - cached.cachedAt < ttl) {
    return cached;
  }

  // No cache at all means this device has never once successfully
  // verified with the server — that's the only case where a slow/failed
  // request should be treated as a hard block rather than fail-open.
  const isFirstEverContact = !cached;
  const timeoutMs = isFirstEverContact ? COLD_START_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

  try {
    const deviceId = await getDeviceId();
    const result = await verifyOrRegister(deviceId, timeoutMs);
    const status = {
      status: result.status,
      daysLeft: result.daysLeft ?? null,
      isOwner: false,
    };
    await writeCache(status);
    return status;
  } catch (err) {
    // CHANGE 2: for a genuine first-ever-contact attempt, retry ONCE
    // automatically before giving up. This silently absorbs a Render
    // free-tier cold start (30-50s wake-up) so it doesn't get mistaken
    // for "no connectivity" on a legitimate new install. Subsequent
    // revalidation calls (cached !== null) never hit this branch — they
    // fall straight to the fail-open return below, unchanged from before.
    if (isFirstEverContact) {
      try {
        const deviceId = await getDeviceId();
        const result = await verifyOrRegister(deviceId, timeoutMs);
        const status = {
          status: result.status,
          daysLeft: result.daysLeft ?? null,
          isOwner: false,
        };
        await writeCache(status);
        return status;
      } catch (retryErr) {
        return { status: 'error', daysLeft: null, isOwner: false, offline: true };
      }
    }

    // Deliberate design choice: fail OPEN using the last known cache if
    // we have one (field techs work at mine sites with no signal — don't
    // lock them out of a tool they're mid-job with just because Render's
    // free tier had a cold start or the site has no data). This path is
    // unchanged — any cache present, even stale/expired, always wins.
    return { ...cached, offline: true };
  }
}

export async function clearLicenseCache() {
  await Preferences.remove({ key: CACHE_KEY });
}
