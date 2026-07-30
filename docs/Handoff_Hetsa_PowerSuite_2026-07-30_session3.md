Handoff — Hetsa PowerSuite, 2026-07-30 (third session, same day)

This session built, deployed, and verified the server-side half of self-service
license reactivation (Option B). It touches **two separate repos** — this is
the most important thing for a fresh session to know before doing anything.

## Repos touched this session

| Repo | Local path (per this session) | What changed |
|---|---|---|
| `hetsak-sys/hetsa-license-server` | `D:\Projects\Hetsa PowerSuite credentials\hetsa-license-server` | New endpoint, schema migration, key-gen flag |
| `hetsak-sys/ems-calculator` (Hetsa PowerSuite app) | `D:\Projects\Hetsa PowerSuite` | Docs-only update to reflect the above |

**A mix-up happened mid-session:** the delivered license-server files were
initially copied into the *PowerSuite app repo* by mistake (similar folder
names — `Hetsa PowerSuite` vs `Hetsa PowerSuite credentials\hetsa-license-server`).
Caught before anything was committed; PowerSuite's `package.json` was
`git restore`d and the four misplaced files deleted. No bad commit ever
landed. Flagging this only so a fresh session double-checks `git remote -v`
before trusting which repo it's in — this project now has two active repos
with easily-confused local folder names.

## What was built (hetsa-license-server)

**Self-service license reactivation (device swap), Option B, approved 2026-07-29:**

- `src/reactivation.js` — new pure swap-eligibility engine (rolling 30-day
  window, retry-date math, lockout message). 14/14 tests passing
  (`src/reactivation.test.js`), engine-first per convention.
- `src/db.js` — schema migration, both idempotent (`IF NOT EXISTS`):
  - `licenses.license_type` column, `CHECK IN ('standard','institutional')`,
    defaults `'standard'` — no backfill needed for existing rows.
  - New `device_swaps` audit table (append-only: license_key, old_device_id,
    new_device_id, swapped_at) + index for the rolling-window query.
- `src/server.js` — new `POST /api/reactivate { deviceId, licenseKey }`.
  `deviceId` here is the NEW device; the old one is read off the license row
  itself. Rules: institutional keys always rejected (manual-only, directs to
  `hetsak@gmail.com`); a key never activated points the caller at
  `/api/license/activate` instead; same-device re-call is idempotent, no
  swap consumed; otherwise 2 swaps per rolling 30 days, enforced via
  `evaluateSwapEligibility()`.
- `scripts/generate-keys.js` — now supports `npm run generate-keys -- N --institutional`.
- `package.json` — added a real `test` script (`node --test src/*.test.js`);
  this repo had none before.

**Why "trial keys get 0 swaps" needed no code:** trial devices carry no
license_key at all (trial state lives only in `devices.trial_start`), so a
trial has nothing to pass to `/api/reactivate` in the first place. True by
construction, not a separate rule — this was a real gap between the original
spec's wording and the actual schema, resolved via Option A+C from the
mid-session scoping discussion (see conversation for the options table if
ever revisited).

## Verification — not just built, actually run

- Local Postgres 16 stood up in a sandbox; `ensureSchema()` run against it;
  schema confirmed column-by-column (`\d licenses`, `\d device_swaps`)
  before anything was declared done.
- Live server booted locally against that Postgres; every branch of
  `/api/reactivate` exercised via curl: success, idempotent same-device,
  institutional 403, unused-key 400, unknown-key 404, malformed-key 400,
  missing-deviceId 400, and driven all the way to an actual 429 lockout
  (retry date confirmed correct: 30 days after the OLDEST swap in the
  window, not the newest). Regression-checked `/api/verify`,
  `/api/license/activate`, `/api/trial/register` still behave identically
  post-migration.
- **Then independently re-verified against the real production Neon DB and
  the real deployed Render endpoint** (not just the sandbox): Hertz ran the
  schema check directly in the Neon SQL editor (`information_schema.columns`/
  `.tables` — `license_type` present defaulting to `'standard'`,
  `device_swaps` exists) and exercised the live
  `https://hetsa-license-server.onrender.com/api/reactivate` endpoint with a
  disposable throwaway key (`HETSA-GX2G-ZPLD-2JPV`, since deleted): activate
  → reactivate to a different device returned exactly
  `{"reactivated":true,"swapConsumed":true,"swapsRemaining":1,...}`.
  Test rows cleaned up afterward (device_swaps deleted before
  licenses/devices, respecting the FK).

**Pushed and independently confirmed:**
- `hetsa-license-server`: commit `7c0d37c`, confirmed via `git log origin/main -1`.
- `ems-calculator` (PowerSuite docs update to `Hetsa_PowerSuite_Project_Knowledge.md`
  §6/§7): commit `2372bc5`, confirmed via `git log origin/main -1`. 484/484
  tests unchanged (docs-only).

## What's NOT done — still open

- **Android app-side "Move my license to this device" UI** — not started.
  This is the natural next piece: needs to call `/api/reactivate`, surface
  `swapsRemaining` and the lockout message, and handle the institutional
  manual-only case distinctly from a generic error. Likely trigger point:
  when `/api/license/activate` returns 409 (already-activated-elsewhere),
  offer this flow instead of a dead-end error. Has NOT yet been through the
  §5.1 three-question scoping checklist (priority/depth/new-vs-extension) —
  do that first, and read `LicenseGate.jsx`/`LicenseManager.js` fresh rather
  than assume their current shape.
- Stay-wire tables (BS 183 / ASTM A475) — still source-blocked, unchanged.
- HAIOS v2.2 re-sync across Hertz's other Claude Projects — still not
  confirmed, unchanged.

## Standing rules (unchanged, plus one reinforced)
- Session bootstrap: fresh clone outside repo tree → `git log` + test suite
  → confirm HEAD/count → then build. This session is the reason why:
  **always run `git remote -v` before copying delivered files in, especially
  now that two repos with similar local folder names are both active.**
- `assembleRelease` only for the Android APK, never `assembleDebug`.
- Engine-first with tests; full file rewrites over patches for non-trivial
  changes; doc updates same session as the work ([DOC-3]).
- Hard-to-reverse decisions (schema changes) get options + a recommendation,
  never a unilateral call — the `license_type` column addition this session
  followed that path explicitly before any code was written.
