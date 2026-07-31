import React, { useCallback, useEffect, useState } from 'react'
import { checkLicenseStatus, LICENSE_PREFIX } from '../services/LicenseManager'
import { useLicenseActivation } from '../services/useLicenseActivation'

function GateShell({ theme: T, children }) {
  return (
    <div
      className="flex flex-col items-center justify-center h-screen px-6 text-center"
      style={{ backgroundColor: T.appBg, color: T.textPrimary }}
    >
      <div
        className="font-black tracking-tight mb-1"
        style={{ fontSize: '20px', color: T.accent, fontFamily: "'Rajdhani', 'Share Tech Mono', monospace" }}
      >
        PowerSuite
      </div>
      <div className="w-full max-w-sm mt-4">{children}</div>
    </div>
  )
}

function Spinner({ color }) {
  return (
    <div
      style={{
        width: '28px', height: '28px', borderRadius: '50%',
        border: `3px solid ${color}33`, borderTopColor: color,
        animation: 'hetsa-spin 0.8s linear infinite', margin: '0 auto',
      }}
    />
  )
}

function LoadingScreen({ theme: T }) {
  return (
    <GateShell theme={T}>
      <style>{`@keyframes hetsa-spin { to { transform: rotate(360deg); } }`}</style>
      <Spinner color={T.accent} />
      <div className="text-sm mt-4" style={{ color: T.textMuted }}>
        Checking license…
      </div>
    </GateShell>
  )
}

function ConnectToActivateScreen({ theme: T, onRetry, retrying }) {
  return (
    <GateShell theme={T}>
      <style>{`@keyframes hetsa-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: T.cardBg, border: `1px solid ${T.border}` }}
      >
        {retrying ? (
          <>
            <Spinner color={T.accent} />
            <div className="text-sm mt-4" style={{ color: T.textSub }}>
              Connecting to activate your trial — this can take up to a
              minute on first launch.
            </div>
          </>
        ) : (
          <>
            <div className="text-2xl mb-2">📡</div>
            <div className="text-sm font-semibold mb-1" style={{ color: T.textPrimary }}>
              Couldn't reach the license server
            </div>
            <div className="text-xs mb-4" style={{ color: T.textMuted }}>
              This device hasn't activated a trial yet, so a first
              connection is needed before the app can be used. Check your
              connection and try again.
            </div>
            <button
              onClick={onRetry}
              className="w-full py-2.5 rounded-xl font-semibold text-sm"
              style={{ backgroundColor: T.btnEquals.bg, color: T.btnEquals.text, border: `1px solid ${T.btnEquals.border}` }}
            >
              Retry
            </button>
          </>
        )}
      </div>
    </GateShell>
  )
}

function ActivationScreen({ theme: T, keyInput, onKeyChange, onActivate, activating, error }) {
  return (
    <GateShell theme={T}>
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: T.cardBg, border: `1px solid ${T.border}` }}
      >
        <div className="text-sm font-semibold mb-1" style={{ color: T.textPrimary }}>
          Trial expired
        </div>
        <div className="text-xs mb-4" style={{ color: T.textMuted }}>
          Enter your license key to unlock PowerSuite.
        </div>

        <div
          className="flex rounded-xl mb-3 overflow-hidden"
          style={{ border: `1px solid ${T.inputBorder}`, backgroundColor: T.inputBg }}
        >
          <div
            className="flex items-center px-3 font-mono tracking-wider text-sm font-bold"
            style={{ color: T.textMuted, backgroundColor: T.surface2Bg, borderRight: `1px solid ${T.inputBorder}` }}
          >
            {LICENSE_PREFIX.replace('-', '')}
          </div>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="XXXX-XXXX-XXXX"
            value={keyInput}
            onChange={(e) => onKeyChange(e.target.value)}
            className="flex-1 text-center px-3 py-2.5 font-mono tracking-wider text-sm"
            style={{ backgroundColor: 'transparent', color: T.textPrimary, minWidth: 0 }}
          />
        </div>

        {error && (
          <div
            className="text-xs rounded-lg px-3 py-2 mb-3 text-left"
            style={{ backgroundColor: T.btnDanger.bg, color: T.btnDanger.text, border: `1px solid ${T.btnDanger.border}` }}
          >
            {error}
          </div>
        )}

        <button
          onClick={onActivate}
          disabled={activating || keyInput.replace(/-/g, '').length < 12}
          className="w-full py-2.5 rounded-xl font-semibold text-sm"
          style={{
            backgroundColor: T.btnEquals.bg,
            color: T.btnEquals.text,
            border: `1px solid ${T.btnEquals.border}`,
            opacity: activating || keyInput.replace(/-/g, '').length < 12 ? 0.5 : 1,
          }}
        >
          {activating ? 'Activating…' : 'Activate'}
        </button>

        <div className="text-[11px] mt-4" style={{ color: T.textMuted }}>
          Don't have a key? Contact your supplier or PowerSuite sales
          to purchase a once-off unlock.
        </div>
      </div>
    </GateShell>
  )
}

// Shown after activateLicense() throws a 409 — the key is already bound
// to a different device. Four sub-states within this one screen:
//   confirm  → offer the swap, or let the user back out to try a
//              different key
//   working  → swap in flight
//   blocked  → server rejected the swap for a reason a retry can't fix
//              (institutional-403 or lockout-429) — message is already
//              human-readable from the server, just display it, no retry
//   failed   → transient failure (network/5xx) — offer Try Again
function ReactivationScreen({ theme: T, keyDisplay, phase, onConfirm, onBack, message }) {
  const isTerminal = phase === 'blocked'
  const isWorking = phase === 'working'

  return (
    <GateShell theme={T}>
      <style>{`@keyframes hetsa-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: T.cardBg, border: `1px solid ${T.border}` }}
      >
        {isWorking ? (
          <>
            <Spinner color={T.accent} />
            <div className="text-sm mt-4" style={{ color: T.textSub }}>
              Moving license to this device…
            </div>
          </>
        ) : (
          <>
            <div className="text-2xl mb-2">{isTerminal || phase === 'failed' ? '⚠️' : '📱'}</div>

            {phase === 'confirm' && (
              <>
                <div className="text-sm font-semibold mb-1" style={{ color: T.textPrimary }}>
                  Key already in use
                </div>
                <div className="text-xs mb-4" style={{ color: T.textMuted }}>
                  <span className="font-mono">{LICENSE_PREFIX}{keyDisplay}</span> is already
                  active on another device. You can move it to this device
                  instead — this uses one of your limited device swaps.
                </div>
              </>
            )}

            {(isTerminal || phase === 'failed') && (
              <div className="text-xs mb-4 text-left" style={{ color: T.textPrimary }}>
                {message}
              </div>
            )}

            {phase === 'confirm' && (
              <button
                onClick={onConfirm}
                className="w-full py-2.5 rounded-xl font-semibold text-sm mb-2"
                style={{ backgroundColor: T.btnEquals.bg, color: T.btnEquals.text, border: `1px solid ${T.btnEquals.border}` }}
              >
                Move license to this device
              </button>
            )}

            {phase === 'failed' && (
              <button
                onClick={onConfirm}
                className="w-full py-2.5 rounded-xl font-semibold text-sm mb-2"
                style={{ backgroundColor: T.btnEquals.bg, color: T.btnEquals.text, border: `1px solid ${T.btnEquals.border}` }}
              >
                Try again
              </button>
            )}

            <button
              onClick={onBack}
              className="w-full py-2.5 rounded-xl font-semibold text-sm"
              style={{ backgroundColor: T.btnDark.bg, color: T.btnDark.text, border: `1px solid ${T.btnDark.border}` }}
            >
              {phase === 'confirm' ? 'Use a different key' : 'Back'}
            </button>
          </>
        )}
      </div>
    </GateShell>
  )
}

function TrialBadge({ theme: T, daysLeft, offline }) {
  return (
    <div
      className="fixed z-40 px-3 py-1 rounded-full text-[11px] font-mono flex items-center gap-1.5"
      style={{
        top: 'calc(env(safe-area-inset-top) + 62px)',
        right: '10px',
        backgroundColor: T.accentDim,
        border: `1px solid ${T.accentBorder}`,
        color: T.accentText,
      }}
      title={offline ? 'Offline — showing last known trial status' : undefined}
    >
      {typeof daysLeft === 'number' ? `${daysLeft}d trial left` : 'Trial'}
      {offline && <span style={{ color: T.textMuted }}>· offline</span>}
    </div>
  )
}

/**
 * Wraps the whole app. Renders a blocking gate screen when licensing
 * requires it, otherwise passes children through untouched.
 *
 * Outer phase (this component's own state):
 *  - loading                 → brief splash while the first check resolves
 *  - paid / isOwner           → pass through silently
 *  - trial                    → pass through, small persistent days-left badge
 *  - trial_expired             → block, key-entry / reactivation screen
 *                                (which of the two shows is driven by
 *                                useLicenseActivation's own `phase`)
 *  - error AND no cache        → block, "connect to activate" screen (the
 *                                one automatic retry already happened
 *                                inside checkLicenseStatus by the time we
 *                                see this)
 *  - error/offline WITH a cache → never reaches this component as
 *    status:'error' at all — checkLicenseStatus itself returns the cached
 *    status with offline:true, so it's handled by the trial/paid branches
 *    above, unblocked, per existing fail-open logic.
 *
 * Inner phase (from useLicenseActivation, only relevant while the outer
 * phase is blocked_expired): idle/activating drive ActivationScreen;
 * reactivate_confirm/working/blocked/failed drive ReactivationScreen;
 * success triggers onSuccess below, which re-checks status and moves the
 * OUTER phase to 'ready' — the inner hook's 'success' phase is never
 * rendered directly by this component.
 */
export default function LicenseGate({ theme: T, themeMode, children }) {
  const [phase, setPhase] = useState('initial')
  const [checking, setChecking] = useState(true)
  const [licenseResult, setLicenseResult] = useState(null)

  const runCheck = useCallback(async (opts) => {
    setChecking(true)
    const result = await checkLicenseStatus(opts)
    setLicenseResult(result)
    setChecking(false)
    if (result.isOwner || result.status === 'paid' || result.status === 'trial') {
      setPhase('ready')
    } else if (result.status === 'trial_expired') {
      setPhase('blocked_expired')
    } else {
      // 'error' or the defensive 'not_registered' case (shouldn't normally
      // surface — checkLicenseStatus auto-registers — but treat the same way).
      setPhase('blocked_error')
    }
  }, [])

  const activation = useLicenseActivation({
    onSuccess: () => runCheck({ force: true }),
  })

  useEffect(() => {
    runCheck()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (phase === 'initial') {
    return <LoadingScreen theme={T} />
  }

  if (phase === 'blocked_error') {
    // checkLicenseStatus's own built-in retry already ran once before this
    // phase was ever set, so by default this shows the "still failing,
    // here's a manual retry" state. If the user taps Retry, `checking`
    // flips true again and we show the specific cold-start waiting copy
    // for that attempt instead.
    return (
      <ConnectToActivateScreen
        theme={T}
        onRetry={() => runCheck({ force: true })}
        retrying={checking}
      />
    )
  }

  if (phase === 'blocked_expired') {
    if (activation.phase === 'success') {
      // Activation or reactivation just succeeded — onSuccess (runCheck)
      // is in flight but hasn't resolved yet. Without this branch, the
      // render below would fall through to ActivationScreen for a brief
      // moment, flashing the re-enabled key-entry form. Show a settled
      // "done" state instead until the outer phase flips to 'ready'.
      return (
        <GateShell theme={T}>
          <style>{`@keyframes hetsa-spin { to { transform: rotate(360deg); } }`}</style>
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: T.cardBg, border: `1px solid ${T.border}` }}
          >
            <Spinner color={T.accent} />
            <div className="text-sm mt-4" style={{ color: T.textSub }}>
              Activated — unlocking PowerSuite…
            </div>
          </div>
        </GateShell>
      )
    }
    if (activation.phase.startsWith('reactivate_')) {
      const subPhase = activation.phase.replace('reactivate_', '') // confirm | working | blocked | failed
      return (
        <ReactivationScreen
          theme={T}
          keyDisplay={activation.reactivateKeySuffix}
          phase={subPhase}
          message={activation.reactivateMessage}
          onConfirm={activation.handleReactivateConfirm}
          onBack={activation.handleReactivateBack}
        />
      )
    }
    return (
      <ActivationScreen
        theme={T}
        keyInput={activation.keyInput}
        onKeyChange={activation.setKeyInput}
        onActivate={activation.handleActivate}
        activating={activation.phase === 'activating'}
        error={activation.errorMessage}
      />
    )
  }

  // ready: paid, trial, or owner build — render the real app.
  const showTrialBadge = licenseResult?.status === 'trial' && !licenseResult?.isOwner
  return (
    <>
      {children}
      {showTrialBadge && (
        <TrialBadge theme={T} daysLeft={licenseResult.daysLeft} offline={licenseResult.offline} />
      )}
    </>
  )
}
