# Handoff — Hetsa PowerSuite, 2026-08-01 (session 2)

This session covered: sign-off on the manual's three Typical Workflows sequences (two corrected
against real field logic), a deep-dive teaching pass on how the Renewable Energy module actually
works (confirmed against the real engine files, not guessed from the UI), a genuine product-shape
fix — Renewable Energy's Array and Battery tabs restructured from datasheet-first to sizing-first,
matching the rest of PowerSuite's established pattern — a systemic PDF export bug found and fixed
(not just patched for the one tab it was first spotted on), a full module-by-module triage confirming
the rest of the app already follows the sizing-first pattern, and one flagged-but-undecided roadmap
item logged. Verified starting HEAD: **`1f74e99`** (unchanged — nothing has been pushed yet; all
deliverables below are for Hertz to apply locally, per no-push-access).

## What actually happened

**Typical Workflows — signed off, two of three corrected against real field logic.** Workflow A
(motor feeder) had voltage-drop and protection-sizing in the wrong order — corrected to Motor FLA →
Cable Sizing → **Voltage Drop check → Breaker/Protection sizing**, since protection should follow the
cable that's actually viable for the run, not the reverse. Workflow B (generator) was corrected to
clarify that "Load Schedule" isn't a separate screen but a tab inside Power Systems → Generator.
Workflow C (solar) needed the most rework — see below.

**Renewable Energy — how it actually works, taught from the real engine files, not the UI alone.**
Hertz's screenshots plus a direct read of `pvArraySizing.js`, `batterySizing.js`,
`gridTieCompliance.js`, and `hybridSizing.js` confirmed the real dependency map: Array is fully
independent; Battery's bank-sizing math is independent of Array (only its charge-controller sub-block
optionally pulls Array's current/Vmp as a prefill); Grid-Tie genuinely needs Array's Wp (the DC:AC
ratio can't exist without both numbers); Hybrid needs its own real low-sun-day production figure plus
a generator result carried over from Power Systems — and, corrected from an earlier guess, **Hybrid
never touches Array's numbers at all.** This full breakdown — every field, every tab, what's a real
"known value" a tech must supply vs. a chemistry/derate default — is captured for folding into the
manual once Workflow C's new structure is finalized.

**The real finding — Array and Battery were built backwards from how a tech actually works.** Hertz
pushed back correctly on the initial "just add a manual callout" offer: the module needed the
sizing-first *code* fix, not a documentation workaround. Both tabs were requiring full panel/inverter
or battery/charge-controller datasheet fields before showing the load-only sizing result, even though
`requiredArrayPowerWp()` and `offGridBatteryBankSizing()` need nothing from those fields — inconsistent
with Motor→FLA, Cable→Sizing, and Generator Sizing, which all lead with a load-only answer.

**Restructured and delivered, per Hertz's confirmed choices** (collapse the datasheet sections,
auto-populate the target into them): both tabs now lead with a "sizing from load" primary section —
Required Wp / Required Ah, prominent, load-only. Array's primary section also now surfaces Grid-Tie's
recommended-inverter-AC figure directly, since it's derivable from the same load-only Wp with zero
extra input. Full datasheet/compatibility-check fields moved behind a collapsed **"Verify a specific
product (optional)"** toggle per tab, defaulting closed, restating the load-only target at the top as
a reminder. Zero engine changes — confirmed directly by reading the engines before touching anything
(`panel.wattage` isn't even consumed by `designStringConfiguration()`, it's UI-only) — this was a pure
`RenewableEnergyCalculator.jsx` reorder. 484/484 tests still passing, clean build.
**Confirmed on-device by Hertz**: both toggles collapse/expand correctly; target-restatement banners
render without clipping.

**A real, systemic PDF export bug found via Hertz's own on-device exports — fixed generally, not
patched narrowly.** The Battery & Charge Controller PDF had "Controller type" overlapping its own
sentence-length recommendation text. Root cause: `pdfExport.js`'s `drawTable()` drew every row value
with a single unwrapped, right-aligned `doc.text()` call — fine for short numbers, but any
sentence-length value ran past the margin and collided with its label. This is the *same bug class* as
the 2026-07-27 title/standard/notes wrap fix — just never applied to table rows. Checking rather than
assuming it was isolated: **Grid-Tie's "Assessment" row had the identical latent bug**, visible in
Hertz's own attached PDF (the word "Assessment" trailing after the sentence instead of appearing
before it). Fixed generally in `pdfExport.js` — long values now wrap onto their own line beneath the
label instead of overlapping it; short values are unaffected (no regression). Three regression tests
added reproducing the exact failing PDF. 487/487 passing (484 + 3 new). Regenerated the exact failing
Battery PDF with the fix and visually confirmed the overlap is gone via `pdftoppm` inspection before
delivering. **Confirmed by Hertz: "the pdf output is now corrected."**

**Full module-by-module triage completed**, checking every calculator against the same
datasheet-first anti-pattern found in Renewable Energy. Confirmed already correctly sizing-first:
Motor, Cable, Generator Sizing, Installation Design, Power Quality (Harmonics/Battery-UPS/Lighting —
Hertz specifically flagged this one for a recheck; confirmed already load-only, no restructure
needed). Confirmed as a different, legitimate tool category (not the same anti-pattern, no
restructure applies): Overhead Reticulation's Clearances/Fittings/Pole Planting, Earthing's four tabs,
Contactor/OLR, Protection/Protection Coordination — these are inherently lookup/compliance/coordination
tools, not "how big do I need" questions. One real open item surfaced: **no tab anywhere in PowerSuite
answers "given this load, what kVA transformer do I need"** — Power Systems → Transformer is a
parameters calculator for an already-chosen transformer, not a sizing tool, and no load→transformer
sizing tool exists elsewhere either. Logged to `roadmap.md` §5.7 as flagged-but-undecided per Hertz's
instruction — not run through the §5.1 scoping checklist, not to be built from that entry alone.

**`roadmap.md` updated in the same session as the work it documents** (per [DOC-3]) — new §5.7 (the
transformer-sizing gap) and new §6 (full record of the Renewable Energy restructure + PDF fix +
triage result), both appended to the copy in this session's outputs.

**Standing instruction corrected**: Hertz flagged that the APK-publish step (copy the built APK into
`public/hetsa-powersuite.apk`, then commit/push so GitHub Actions actually redeploys the live download
link) was missing from the PowerShell build sequence given at end of sessions. Fixed going forward —
see build steps below and updated standing memory.

## Verification — what's confirmed vs. not

**Confirmed directly:** Renewable Energy toggle collapse/expand on-device; target-restatement banner
rendering on-device (no clipping); PDF overlap fix via pdftoppm visual inspection of the exact
regenerated failing PDF, and Hertz's own confirmation after reviewing corrected output; 487/487 tests
passing; clean `npm run build` with both fixes applied together.

**NOT yet confirmed:**
- The restructured Array/Battery tabs' Save-to-history and PDF export **on the actual device**, after
  rebuild — the build/tests passing is not the same as Hertz's own eyes on the real exported PDF from
  those two specific tabs post-restructure (Battery/Grid-Tie PDFs specifically need re-export and
  re-check now that the row-wrap fix is in).
- Workflow C (solar) hasn't been finalized into manual text yet — corrected structure (C1 off-grid/
  hybrid path, C2 grid-tied path) was proposed but the manual itself hasn't been updated.
- The "How the Four Tabs Connect" teaching content from the deep-dive hasn't been folded into the
  manual — it exists only in this conversation so far.
- §5.7's transformer-sizing gap has not been run through the §5.1 three-question checklist — Hertz
  hasn't yet confirmed whether it's a real gap or an intentional scope boundary.

## Open items for the next session

| Item | Priority | Notes |
|---|---|---|
| **Rebuild, then re-verify Array/Battery Save-to-history + PDF export on-device** | Should — before this work is fully closed | Toggles/banners already confirmed; export path specifically still needs eyes-on after rebuild |
| **Finalize Workflow C (solar) into the manual**, reflecting the corrected two-path structure (C1 off-grid/hybrid, C2 grid-tied) and the new "Verify a specific product" tab structure | Should | Manual text not yet written — only scoped in conversation |
| **Fold the "How the Four Tabs Connect" explainer into the manual** | Should | Full field-by-field breakdown exists in this session's conversation, not yet in `docs/` |
| **Run §5.7 (load→transformer sizing gap) through the §5.1 checklist** | Depends on Hertz — is this a real gap or intentional? | Not to be built from the roadmap entry alone |
| Typical Workflows chapter — final sign-off pending A/B/C write-up | Carried from prior session | A and B corrected this session; C corrected but not yet drafted into manual text |
| Maturity labeling section | Carried from prior session, still open | Drafted from `debt.md`, needs Hertz's own judgment |
| Pricing | Deferred to a dedicated new chat, by Hertz's own choice | Unchanged from prior handoff |

## Standing rules followed this session

- Full-file rewrites delivered for both code changes (`RenewableEnergyCalculator.jsx`,
  `pdfExport.js` + its test file) — no targeted patches for non-trivial changes.
- Session bootstrap done properly: fresh clone, HEAD (`1f74e99`) and test count (484) independently
  verified against the prior handoff *before* any engine file was read or any code touched.
- [AI-15] respected: the sizing-first restructure was scoped via the three-question checklist and
  Hertz's explicit confirmation on collapse behavior + auto-populate *before* any code was written,
  not decided unilaterally.
- Confirmed rather than assumed at every claimed fact: engine dependency map confirmed by reading the
  actual files (not re-guessed from screenshots a second time); "zero engine changes needed" claim
  confirmed by checking `panel.wattage` usage directly, not asserted from memory; PDF fix confirmed by
  regenerating the actual failing PDF and visually inspecting it, not just by tests passing.
- Bug found via the triage (Grid-Tie's Assessment row) was fixed proactively in the same general fix,
  not left for Hertz to report separately later.
- `roadmap.md` updated in the same session as the work, not deferred ([DOC-3]).
- Doc updated to reflect an item Hertz explicitly wanted flagged, not silently omitted or decided for
  him ([AI-15] — options logged, not a unilateral build decision).

## Exact PowerShell build sequence for this session's changes

Apply `RenewableEnergyCalculator.jsx` (full replacement) → `src/components/`
Apply `pdfExport.js` (full replacement) → `src/lib/`
Apply `pdfExport.test.mjs` (full replacement) → `src/lib/`
Apply `roadmap.md` (full replacement) → `docs/`

```powershell
git status
# confirm android/local.properties still untracked
npm install
npm run build
npx cap sync android
cd android
.\gradlew assembleRelease
cd ..
```

**Then — the step flagged this session as easy to miss:**

```powershell
copy android\app\build\outputs\apk\release\app-release.apk public\hetsa-powersuite.apk
git add -A
git commit -m "Renewable Energy sizing-first restructure; pdfExport row-wrap fix; roadmap update"
git push origin main
```

The `public/hetsa-powersuite.apk` copy is what `npm run build` bundles into `dist/`, which is what
the GitHub Actions deploy workflow publishes to the live download link
(`hetsak-sys.github.io/hetsa-powersuite/hetsa-powersuite.apk`) on every push to `main`. A rebuild
without this copy-and-push step never reaches that link, even though the release APK on the
reference device would be current.

**Before `git add -A`**: delete any fresh-clone test folders from inside the repo root — standing
reminder, unchanged.

## On-device verification checklist for next session

1. Confirm Array/Battery tabs' Save-to-history entries still capture correctly post-restructure
2. Re-export Battery & Charge Controller PDF, Grid-Tie PDF — confirm both render cleanly now
3. Spot-check one more long-value PDF export from a different module if convenient (not required —
   the fix is general, but an independent confirmation outside Renewable Energy would be a bonus, not
   a blocker)
