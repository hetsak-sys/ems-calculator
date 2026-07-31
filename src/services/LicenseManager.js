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

// Every key has the literal, unchanging prefix "HETSA-" — only the 12
// characters after it vary between keys. Shown in the earlier version
// as an editable placeholder ("HETSA-XXXX-XXXX-XXXX"), which real usage
// showed is easy to misread as "HETSA" being a static brand label rather
// than something to type — leading to a malformed key (missing prefix,
// wrong grouping) getting submitted with no client-side way to catch it.
// Fix: the prefix is now a fixed label in the UI, never part of what the
// user types; this module only formats/reassembles the variable suffix.
export const LICENSE_PREFIX = 'HETSA-';

// Formats the 12-character variable portion as the user types it, into
// XXXX-XXXX-XXXX. Tolerant of the user pasting the ENTIRE key including
// the "HETSA" prefix (e.g. copy-pasted whole from a sales email) — in
// that case the leading "HETSA" is stripped before grouping, so both
// "TMSF-RRWQ-38BY" and "HETSA-TMSF-RRWQ-38BY" pasted into this field
// produce the same correct result.
export function formatLicenseSuffix(raw) {
  let alnum = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (alnum.startsWith('HETSA')) {
    alnum = alnum.slice(5)
  }
  alnum = alnum.slice(0, 12)
  const sizes = [4, 4, 4]
  let i = 0
  const groups = []
  for (const size of sizes) {
    if (i >= alnum.length) break
    groups.push(alnum.slice(i, i + size))
    i += size
  }
  return groups.join('-')
}

// Reassembles the full key to actually send to the server. The prefix
// lives in exactly one place (LICENSE_PREFIX above) so it can never get
// out of sync between screens.
export function buildFullLicenseKey(suffix) {
  return LICENSE_PREFIX + suffix
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

// ApiError carries the HTTP status code alongside the message, and the
// parsed JSON error body (if any) in `.body`. This is the fix this session
// is built around: before, callApi() discarded the status code entirely,
// so callers had no way to distinguish e.g. a 409 (key already active on
// another device — the reactivation case) from a 400 (malformed key) or
// a 404 (unknown key). Every existing catch-block that only reads
// `err.message` keeps working unchanged; new callers can also read
// `err.status` and `err.body`.
export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
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
      const errBody = await res.json().catch(() => ({}));
      throw new ApiError(
        errBody.message || `Request to ${path} failed (${res.status})`,
        res.status,
        errBody
      );
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
 *
 * Throws ApiError on failure — callers that need to distinguish a 409
 * (key already active on another device) from other failures should
 * check `err.status === 409` and offer the reactivation flow instead of
 * just displaying `err.message`.
 */
export async function activateLicense(licenseKey) {
  const deviceId = await getDeviceId();
  const result = await callApi('/api/license/activate', { deviceId, licenseKey });
  const status = { status: 'paid', daysLeft: null, isOwner: false };
  await writeCache(status);
  return { ...result, ...status };
}

/**
 * Moves an already-activated license key to THIS device (self-service
 * device swap). Call this after activateLicense() throws an ApiError with
 * status 409 — that's the server's signal the key is bound elsewhere.
 *
 * Resolves to { reactivated: true, swapConsumed, swapsRemaining?, message }
 * on success (swapsRemaining is only present when a swap was actually
 * consumed — omitted on the idempotent same-device case).
 *
 * Throws ApiError on failure. Callers should branch on `err.status`:
 *   403 - institutional key, manual-only (message already points to
 *         hetsak@gmail.com — display as-is, no retry)
 *   429 - swap-limit lockout (message already includes the retry date —
 *         display as-is, no retry)
 *   400 - key was never activated in the first place (shouldn't normally
 *         happen if this is only called after a 409, but handle it —
 *         message directs the user back to Activate)
 *   404 - unknown key
 *   5xx / network - transient, safe to offer a retry
 */
export async function reactivateLicense(licenseKey) {
  const deviceId = await getDeviceId();
  const result = await callApi('/api/reactivate', { deviceId, licenseKey });
  // Both success shapes (swap consumed or idempotent same-device) carry
  // reactivated:true — either way the device is now correctly licensed.
  const status = { status: 'paid', daysLeft: null, isOwner: false };
  await writeCache(status);
  return result;
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
