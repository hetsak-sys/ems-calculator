# Hetsa PowerSuite — Developer Quickref
## "How do I actually do X" — companion to `Hetsa_PowerSuite_Project_Knowledge.md`

**What this is:** the conventions doc owns *decisions and why*. This doc owns *day-to-day mechanics* —
the exact steps for things you'll do repeatedly. If the two ever disagree, the conventions doc wins;
fix this one to match.

**What this is not:** a record of what's been built or decided. Don't add "session log" content here —
that's `debt.md`/`roadmap.md`/the conventions doc's own update log. This file should look the same in
a year as it does today, mechanically, even as the product grows.

---

## 1. Session bootstrap (every session, no exceptions)

```powershell
# Fresh clone OUTSIDE the repo tree — never inside it
git clone https://github.com/hetsak-sys/ems-calculator.git <somewhere-else>
cd <cloned-folder>
git log -1                 # confirm HEAD matches the last handoff
npm install
npm test                   # confirm test count matches the last handoff
npm run build               # confirm clean
```

Never trust a handoff doc's claimed HEAD/test-count alone — verify it yourself first. If they don't
match, stop and reconcile before writing any code.

**Two repos exist for this project** — don't confuse them:

| Repo | What it is |
|---|---|
| `hetsak-sys/ems-calculator` | The PowerSuite Android app itself |
| `hetsak-sys/hetsa-license-server` | The separate license server (Node/Express + Neon Postgres, on Render) |

Run `git remote -v` before copying any delivered files in — a mix-up here has happened before.

---

## 2. Build & release (Android APK)

```powershell
git status                              # working tree must be clean first
# confirm local.properties is NOT tracked (git-ignored, holds keystore credentials)
npm install
npm run build
npx cap sync android
cd android
.\gradlew assembleRelease                # NEVER assembleDebug
```

**Why `assembleRelease` only:** Android scopes `ANDROID_ID` to device + signing certificate. A debug
build has a different certificate, so it looks like a brand-new device to the license server — it
would either fail to license at all, or (worse) silently consume a device slot that should belong to
the release build. If you need fast debug-build iteration, use a separate, never-licensed device for
it — never the reference device.

**Before `git add -A`:** delete any fresh-clone test folders (`powersuite-test`, `powersuite`, etc.)
if they ended up inside the repo root — they create embedded gitlink commits every time. Clone test
folders must live outside the repo tree entirely.

**Keystore:** `hetsa-powersuite-release.keystore` at `D:\Projects\ALL PROJECTS CREDENTIALS\`, alias
`hetsa-powersuite`. Credentials live in `android/local.properties` (git-ignored, never committed).

**Long-path deletion failures on Windows** (deeply nested Gradle build artifacts, >260 chars):
`Remove-Item -Recurse -Force` fails; `cmd /c rd /s /q "path"` succeeds.

---

## 3. License operations — the full playbook

Two systems are involved: the **app** (`LicenseGate.jsx` / `Settings.jsx` / `LicenseManager.js` /
`useLicenseActivation.js`) and the **server** (`hetsa-license-server`, Postgres on Neon, admin access
via the Neon SQL editor at your Render/Neon dashboard login).

### 3.1 Key formats and types

- Format: `HETSA-XXXX-XXXX-XXXX` for every key, standard or institutional — identical to the customer.
- `license_type` column (`'standard'` | `'institutional'`) is the only DB-level difference. It is
  invisible in the app UI.
- Generate keys via:
  ```powershell
  npm run generate-keys -- N                    # N standard keys
  npm run generate-keys -- N --institutional     # N institutional keys
  ```

### 3.2 Trial → first activation (standard flow, self-service, no action needed from you)

Customer installs the APK, gets a 90-day trial tracked server-side (not on-device). They enter a key
any time via Settings → License or at trial expiry. Nothing for you to do unless something breaks —
see §3.6 for error-response meanings.

### 3.3 Standard license — device swap (self-service, no action needed from you)

A standard customer who gets a new phone, or hits "already activated elsewhere," can self-serve via
the app's reactivation flow (`POST /api/reactivate`) — up to **2 swaps per rolling 30-day window per
key**. This is automatic; you're only involved if they exhaust the window and email you (see §3.6,
429 case) or if something looks wrong in the Neon `device_swaps` audit table.

To check a key's swap history yourself:
```sql
SELECT * FROM device_swaps WHERE license_key = 'HETSA-XXXX-XXXX-XXXX' ORDER BY swapped_at DESC;
```
*(Confirm this table/column naming against the actual `db.js` schema before relying on it blind —
written from the 2026-07-30 build session's description, not re-verified line-by-line here.)*

### 3.4 Institutional license — manual reassignment (the procedure you'll actually run)

**Why this is manual, not self-service:** institutional keys are deliberately rejected by
`/api/reactivate` (always returns 403, directing to `hetsak@gmail.com`) — a seat belongs to the
institution, not the individual holding it that year, so a self-service swap button would let any
current holder "steal" the seat without the institution's knowledge or consent.

**When this comes up:** a student graduates, an employee leaves a mine/contractor, or an institution
otherwise wants to move one of their seats to a new person's device.

**Procedure:**

1. **Confirm the request is legitimate and authorized.** Get it in writing (email is fine) from a
   known institutional contact — not from the individual holder themselves. Confirm: which license
   key, whose device it's currently on, who the seat is moving to. This is the actual security
   boundary of the institutional model — treat it with the same care as any account-access request.

2. **Look up the key's current binding** in the Neon SQL editor (`hetsa-license-db`):
   ```sql
   SELECT * FROM licenses WHERE license_key = 'HETSA-XXXX-XXXX-XXXX';
   SELECT * FROM devices WHERE license_key = 'HETSA-XXXX-XXXX-XXXX';
   ```
   Confirm `license_type = 'institutional'` and note the currently-bound `device_id`.

3. **Free the seat** by clearing the device binding so the key can be freshly activated on the new
   device. The exact statement depends on the real schema (verify against `db.js` first — don't run
   this from memory alone):
   ```sql
   -- Illustrative shape only — confirm actual column/table names in db.js before running:
   DELETE FROM devices WHERE license_key = 'HETSA-XXXX-XXXX-XXXX';
   -- or, if device binding lives on the licenses row itself:
   -- UPDATE licenses SET device_id = NULL WHERE license_key = 'HETSA-XXXX-XXXX-XXXX';
   ```

4. **Confirm to the institution** that the seat is free, and have the new holder activate the same
   key via Settings → License in the app (normal `/api/license/activate` flow — no code path
   difference from a first-time activation).

5. **Log the reassignment yourself.** There is currently no audit table for institutional
   reassignments (`device_swaps` only logs standard self-service swaps, since institutional requests
   never reach that code path). Keep a simple running log — a plain text file or spreadsheet is
   fine — per institution: license key, current holder, date of each reassignment, who authorized it.
   This is a real gap, not a style choice: without it, you have no record of an institution's seat
   history if a dispute ever comes up. Consider this the top candidate if institutional volume ever
   grows enough to justify building a real admin tool (see §3.7).

6. **Never do this from an individual's request alone**, even if they sound convincing — that's
   exactly the seat-theft scenario the manual-only rule exists to prevent.

### 3.5 Converting a key's type after issuance (standard ↔ institutional)

No tooling exists for this — a manual, one-off `UPDATE`:
```sql
UPDATE licenses SET license_type = 'institutional' WHERE license_key = 'HETSA-XXXX-XXXX-XXXX';
```
Confirm the real column/table name first. Flagged as a known gap in `debt.md` — not yet worth
building a script for at current volume.

### 3.6 What each error response means (for replying to a customer email)

| Response | Meaning | What to tell the customer |
|---|---|---|
| 200, `swapConsumed:false` | Same-device re-call, idempotent | Nothing wrong — it just re-confirmed |
| 200, `swapConsumed:true` | Standard swap succeeded | Working as intended |
| 400 | Key not yet activated | Point them to Settings → License → activate, not reactivate |
| 403 | Institutional key — manual-only | This is you — see §3.4 |
| 404 | Unknown key | Typo, or a key that was never generated — double-check with them |
| 429 | Standard key — swap-limit lockout (2 per rolling 30 days) | Message already states their retry date; nothing for you to do unless it's a genuine hardship case worth a manual override |
| Network/5xx | Render cold-start or genuine outage | Ask them to retry in ~60s; Render's free tier can take a moment to wake up |

### 3.7 If institutional volume grows: what a real fix looks like

Not built, not currently justified — but worth naming so it isn't reinvented from scratch later:
an `institutions` table linking one organization to N license keys, a lightweight admin view (even a
simple authenticated page, not a full portal) letting an institutional contact see their own seat
roster and trigger reassignment themselves without emailing you, and a `seat_swaps` audit table
mirroring `device_swaps` but scoped to institutional reassignments. This is a genuine new-domain
decision (§5.1 checklist applies) — don't start it opportunistically inside an unrelated session.

---

## 4. Recurring bug classes — check these on every new numeric input or module

- **Comma-decimal parsing:** every numeric field must be `type="text" inputMode="decimal"` (never
  `type="number"`) with comma-to-period normalization in its own `pf()`-style helper — check the
  helper's own implementation, not just whether fields call it. This has recurred multiple times
  across different modules; treat it as a standing checklist item, not a one-time fix.
- **[COD-14]:** every `calculate()` clears its previous result (`setResult(null)`) immediately after
  `setError('')`, before any early-return validation check.
- **PDF text sanitization:** any new PDF export must route through the shared `ResultCard` /
  `useResultCard` → `pdfExport.js` path (`sanitizeForPdf()`), never call jsPDF directly — otherwise
  Ω/φ/Φ/→/← silently render as wrong glyphs.
- **Unused-import sweep:** run an explicit grep for now-dead imports as the last step of any
  extraction/refactor — a green test suite and clean build won't catch these.

---

## 5. Windows/PowerShell gotchas

- `.env` writes: `Out-File -Encoding ascii -NoNewline` — PowerShell's default UTF-16 silently breaks
  Vite's `.env` parsing.
- After any scripted find-and-replace intended to fix stale doc text, verify the *specific lines
  changed* via `git diff` before committing — a `-replace` that matches zero occurrences still exits
  cleanly and `Set-Content` will still write the (unchanged) file back, and the commit will still
  "succeed." A clean shell exit is not evidence the edit happened.
- Full-file rewrites over patches for any non-trivial change — this avoids the above failure mode
  entirely, which is why it's the standing default.

---

## 6. Before calling anything "done"

1. Automated tests pass, build is clean.
2. Committed **and pushed** — `git push origin main` plus `git log origin/main -1` to independently
   confirm the push actually landed. "Committed" is not "done."
3. On-device verification against the relevant `docs/on_device_checklist_*.md`, on the real
   reference device, via a signed `assembleRelease` build — not the dev-server browser path alone.
4. Docs updated in the *same* session as the work, not deferred ([DOC-3]).

---

*Last updated: 2026-07-31. If a procedure here stops matching reality, fix this file the same session
you find the mismatch — don't let it drift the way the HAIOS master-copy sync problem did.*
