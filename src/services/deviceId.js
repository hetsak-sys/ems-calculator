import { Device } from '@capacitor/device';

// In-memory cache so repeated calls in the same session don't hit the
// native bridge more than once. This is NOT persistent storage — that's
// handled by LicenseManager.js, which caches the license *status*, not
// the ID itself (the ID is cheap to re-fetch; the network call isn't).
let cachedDeviceId = null;

/**
 * Returns a stable hardware identifier for this device.
 *
 * On Android, Device.getId() returns { identifier } which maps to
 * Settings.Secure.ANDROID_ID. Important properties for licensing:
 *  - Persists across app reinstalls and app-data clears (unlike anything
 *    stored in Preferences/localStorage, which is exactly why we can't
 *    use those alone to gate the trial).
 *  - Does NOT require Google Play Services or the Advertising ID API,
 *    so it works on Huawei/AOSP devices and doesn't trigger Play Services
 *    consent dialogs.
 *  - Changes on factory reset. That's an accepted edge case (see note in
 *    LicenseManager: re-activation with the same license key is allowed,
 *    so a legitimate paid user who factory-resets just re-enters their key).
 *
 * Caveat to flag honestly: ANDROID_ID can differ across users/profiles on
 * the same physical device (multi-user Android), and in rare OEM cases
 * can be regenerated after an OTA update. There's no perfect hardware ID
 * on Android post-8.0 — ANDROID_ID is the standard pragmatic choice used
 * by most commercial Android licensing schemes, but it's not cryptographically
 * unspoofable. That's fine for your threat model (deterring casual reuse,
 * not stopping a determined cracker), just don't oversell it as unbeatable.
 */
export async function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;
  const info = await Device.getId();
  cachedDeviceId = info.identifier;
  return cachedDeviceId;
}
