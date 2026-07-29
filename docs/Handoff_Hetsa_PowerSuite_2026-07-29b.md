Handoff — Hetsa PowerSuite, 2026-07-29 (later session — verification sweep)

Base: fresh clone of `origin/main` @ `5afcf9d`, independently verified (482/482,
clean build) before any change. This session's changes are DELIVERED AS FILES,
NOT PUSHED (Claude has no push access) — Hertz commits.

## Apply & commit
Copy the delivered files over the repo root (paths preserved), then:
```powershell
git status          # expect exactly: 5 modified + 2 new, listed below
npm test            # expect 484/484 (up from 482 — 2 new structural tests)
npm run build       # expect clean
git add -A
git commit -m "verify: Clearances on-device pass recorded; SANS 10280-1 Table E.1 structural integrity tests (765kV query resolved); Protection safety-critical verification checklist; register hygiene (stale Cable-PDF handoff item corrected); license reactivation options doc - 484 tests"
git push origin main
git log origin/main -1   # independent push verification, per standing rule
```

## Changed files
- `src/components/overheadReticulationEngine.js` — comment only: Table E.1
  internal decomposition documented (ground = max(5.5, safety+4.9); roads/rail
  = safety+6.1; bases are Table E.2's LV bare figures). No logic change.
- `src/components/overheadReticulationEngine.test.js` — +2 tests: full-table
  structural transcription-integrity check, and the 765kV 10.4m = 5.5+4.9
  decomposition. 484/484. (Targeted append, not full rewrite — verified via
  git diff per the scripted-edit rule; done in a Linux sandbox, so the
  PowerShell UTF-16 hazard doesn't apply.)
- `docs/on_device_checklist_protection.md` — NEW. Arc Flash (4 scenarios,
  category boundaries, comma-decimal, PDF disclaimer render), PI/DAR (5
  scenarios incl. 1.25/1.60/4.00 boundaries and the Dangerous path), TCC plot
  (chain the tests already assert: 0.183s/0.242s @ 2000A + screenshot), IDMT
  regression. Values independently hand-derived, not from app code.
- `docs/on_device_checklist_overhead_reticulation.md` — §4 marked VERIFIED
  2026-07-29 (attestation header + 14 boxes). §§1–3, 5–7 untouched, still owed.
- `docs/debt.md` — new session section: §4 verification closed (rest open);
  Arc Flash/PI-DAR/TCC formally registered (were handoff-only, [PRO-11]);
  stale-handoff Cable-PDF ghost corrected; 765kV query closed.
- `docs/roadmap.md` — §5.6.3 Clearances paragraph: verification + structural
  tests recorded.
- `docs/license_reactivation_options.md` — NEW, decision doc [AI-15]. Options
  A–D + recommendation (B: self-service swap, cooldown, trials excluded).
  NO code built.

## Key facts this session
1. **765kV ground clearance (10.4m) is correct** — decomposes as 5.5m safety
   (cross-validated vs retired ESKASABG3/Reg-15) + 4.9m base (Table E.2 LV
   bare). Whole table follows the same structure (±0.06m rounding); now
   test-locked. India's 15m etc. are different national design philosophies,
   not an error here. [AI-18]: decomposition is an observed data property used
   as an integrity check, not a formula the standard states.
2. **Cable PDF export was a bookkeeping ghost** — handoff carried it as open;
   debt.md shows it repaid + on-device confirmed 2026-07-27; code re-confirmed
   (10 ResultCard wirings). Lesson now in debt.md: regenerate handoff debt
   lists from the register, never copy from the prior handoff.
3. Clearances (§4) on-device verification is CLOSED per Hertz's run this day.

## Still owed / blocked (regenerated from debt.md, per the new rule)
- **Protection Arc Flash + PI/DAR + TCC** — run the new checklist on-device.
  Safety-critical; highest-priority open item. Same installed build works.
- **Overhead sub-tabs 1–3, 5–7** — run the existing checklist sections.
- **License reactivation** — Hertz decision on the options doc, then a
  dedicated build session against `hetsak-sys/hetsa-license-server`.
- **Sag & Tension** — binding boundary: dedicated scoping session; SANS
  10280-1 clause 4 / Annex A is the waiting primary input. Not touched.
- **Pole Spacing beyond 22kV** — possible via Annex A wind-force method;
  needs the SANS PDF in-session; separate scoping decision.
- **Stay-wire tables** — still source-blocked (BS 183/ASTM A475).
- **Hertz manual items:** re-attach current repo docs to the Claude Project
  (the attached overhead checklist + knowledge doc are stale vs repo); HAIOS
  v2.2 re-sync across other Projects still unconfirmed.
