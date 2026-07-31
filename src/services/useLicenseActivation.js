import { useState, useCallback } from 'react'
import { activateLicense, reactivateLicense, formatLicenseSuffix, buildFullLicenseKey } from './LicenseManager'

/**
 * Shared state machine for license activation + self-service reactivation
 * (device swap). Used by BOTH LicenseGate.jsx (the blocking gate screen,
 * only reachable once status is 'trial_expired') and Settings.jsx (the
 * proactive "activate early" card, reachable any time during an active
 * trial). The two screens keep entirely separate visual chrome — only
 * this logic is shared — so a fix here (like the 409 handling this hook
 * exists to add) can't silently drift between two independent copies,
 * which is what would have happened had each screen kept its own inline
 * activateLicense() call and error handling.
 *
 * Phases:
 *   idle               - nothing in flight, ready for input
 *   activating         - POST /api/license/activate in flight
 *   reactivate_confirm - activate hit a 409 (key valid, bound to another
 *                        device) — offering the swap
 *   reactivate_working - POST /api/reactivate in flight
 *   reactivate_blocked - swap rejected for a non-retryable reason
 *                        (institutional-403 or lockout-429) — message is
 *                        already human-readable from the server, just
 *                        display it, no retry offered
 *   reactivate_failed  - swap failed for a retryable reason (network/5xx,
 *                        or the edge-case 400/404) — safe to offer retry
 *   success            - activation or reactivation succeeded; caller's
 *                        onSuccess has already been invoked
 *
 * onSuccess is called after EITHER a clean activation OR a successful
 * reactivation — callers decide what "now unlocked" means for them.
 * LicenseGate re-runs checkLicenseStatus and swaps its own outer phase;
 * Settings reloads the page (LicenseGate only checks status once on
 * mount, so it won't otherwise notice the cache changed underneath it).
 */
export function useLicenseActivation({ onSuccess } = {}) {
  const [keyInput, setKeyInputRaw] = useState('')
  const [phase, setPhase] = useState('idle')
  const [errorMessage, setErrorMessage] = useState(null)
  const [reactivateKeySuffix, setReactivateKeySuffix] = useState('')
  const [reactivateMessage, setReactivateMessage] = useState('')

  const setKeyInput = useCallback((raw) => {
    setKeyInputRaw(formatLicenseSuffix(raw))
  }, [])

  const handleActivate = useCallback(async () => {
    setPhase('activating')
    setErrorMessage(null)
    try {
      await activateLicense(buildFullLicenseKey(keyInput))
      setPhase('success')
      await onSuccess?.()
    } catch (err) {
      if (err.status === 409) {
        setReactivateKeySuffix(keyInput)
        setReactivateMessage('')
        setPhase('reactivate_confirm')
      } else {
        setErrorMessage(err.message || 'Activation failed. Check the key and try again.')
        setPhase('idle')
      }
    }
  }, [keyInput, onSuccess])

  const handleReactivateConfirm = useCallback(async () => {
    setPhase('reactivate_working')
    try {
      await reactivateLicense(buildFullLicenseKey(reactivateKeySuffix))
      setPhase('success')
      await onSuccess?.()
    } catch (err) {
      if (err.status === 403 || err.status === 429 || err.status === 400) {
        setReactivateMessage(err.message || 'This license can\u2019t be moved automatically.')
        setPhase('reactivate_blocked')
      } else {
        setReactivateMessage(err.message || 'Something went wrong. Check your connection and try again.')
        setPhase('reactivate_failed')
      }
    }
  }, [reactivateKeySuffix, onSuccess])

  const handleReactivateBack = useCallback(() => {
    setErrorMessage(null)
    setReactivateMessage('')
    setPhase('idle')
  }, [])

  return {
    keyInput,
    setKeyInput,
    phase,
    errorMessage,
    reactivateKeySuffix,
    reactivateMessage,
    handleActivate,
    handleReactivateConfirm,
    handleReactivateBack,
  }
}
