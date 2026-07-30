Handoff — Hetsa PowerSuite, 2026-07-30 (second session, same day)

Base: same as this morning's handoff — fresh clone of `origin/main` @ `f49e051`,
484/484 tests, clean build. **No code was written or changed this session either.**
This was a second documentation-only session: a scope decision on Overhead
Reticulation, made explicit and recorded in the canonical docs. Changes are
DELIVERED AS FILES, NOT PUSHED (Claude has no push access) — Hertz commits.

## Apply & commit
Copy the two delivered files over the repo root (paths preserved), then:
```powershell
git status          # expect exactly: 2 modified, listed below
npm test            # expect 484/484 — unchanged, no code touched this session
npm run build        # expect clean
git add -A
git commit -m "docs: cap Overhead Reticulation scope at 33kV for design-grade calc, retire Sag & Tension"
git push origin main
git log origin/main -1   # independent push verification, per standing rule
```

## Changed files
- `docs/roadmap.md` — §5.6.3 gets a new **"Scope decision (2026-07-30)"** block
  right after the module charter, explaining the cap and why it doesn't touch
  shipped data. §5.6.3a (Sag & Tension) is retitled **"RETIRED 2026-07-30"** and
  kept verbatim below as a historical scoping record, with an explicit
  "do not build this" note at the top — the prior scoping work (sourcing,
  open items, IEC 60826 review) is preserved, not deleted, in case a future
  *separate* product decision ever revisits it. The wishlist-triage line and
  the "what a fresh session should do" checklist are both updated to match.
- `docs/debt.md` — two new dated sections: one closing all three open Sag &
  Tension blockers (conductor mechanical data sourcing, IEC 60826
  synthesis question, SANS 10280-1 unreviewed pages) as **"closed by scope
  decision, not by completion"** — an important distinction, logged
  honestly rather than presented as resolved work. A second entry marks
  this morning's IEC 60826 finding as superseded by the retirement (same
  day). A new standing preventive item is added: check any future Overhead
  Reticulation feature against "does this need iterative/mechanical calc
  above 33kV?" before building, since this exact module drifted into
  design-grade territory once already (three Sag & Tension deferrals) before
  being caught.

## What actually happened this session (2026-07-30, second pass)

**The decision:** Hertz raised removing Overhead Reticulation from PowerSuite
entirely, on the grounds that it's drifted toward line-design work rather
than field-technician tooling. Two options were discussed:

1. Full removal of the module.
2. Cap scope at 33kV, keep what's already shipped and verified.

Before recommending, the actual engine was checked sub-tab by sub-tab for what
genuinely extends past 33kV, rather than assuming. Finding: almost nothing
does. Conductor Sizing is ampacity-keyed, not voltage-banded. Pole Planting,
Construction, Faults & Maintenance, and Fittings & Structures are all
clause-anchored procedural/reference content, not voltage-tiered at all. Pole
Spacing was already 22kV-only. The **only** sub-tab with real content above
33kV is Clearances (`SANS10280_CLEARANCE_TABLE`, verified on-device up to
765kV AC / 533kV DC) — and that's a completed, primary-sourced, tested
reference table, not a design calculation.

The one piece that *was* genuinely design-grade — iterative mechanical
solving, wind/ice loading physics, insulator catenary geometry — is Sag &
Tension, which had been deferred three times and was scoped (but not built)
as of this morning's earlier session.

**Decision made: Option 2, cap at 33kV, with a clarification.** The cap is on
*calculation depth* (no new iterative/mechanical design work above 33kV),
not on retaining existing verified *reference* data. Concretely:
- Sag & Tension is retired from the roadmap — will not be built.
- The Clearances table's existing >33kV rows stay exactly as they are;
  discarding verified, tested, on-device-confirmed data to satisfy a scope
  cap that's really about calculation depth would be pure waste.
- Any future feature proposal for this module gets checked against the new
  standing rule in `debt.md` before being built.

This required no code changes — it's a roadmap/debt-register correction
plus a formal charter clarification, done the same way a scope-boundary
decision from three sessions ago (Sag & Tension's original deferral) was
handled: recorded explicitly rather than left as an implicit assumption.

## Open items for the next session (regenerated from `debt.md`, unchanged from this morning except Sag & Tension items closed)

| Item | Priority | Notes |
|---|---|---|
| **Overhead Reticulation §§1–3, 5–7 on-device verification** | Should — pre-existing, unrelated to today | Checklist at `docs/on_device_checklist_overhead_reticulation.md`. §4 (Clearances) already verified 2026-07-29. Sections: Conductor Sizing, Pole Spacing, Pole Planting, Fittings & Structures, Construction, Faults & Maintenance. Unaffected by today's scope decision — all of this content is ≤33kV or voltage-agnostic already. |
| **License reactivation build** | Next deliberate session | Spec fully locked (Option B) — separate repo `hetsak-sys/hetsa-license-server`. No code built yet. |
| **Stay-wire tables** | Source-blocked | BS 183 / ASTM A475 still not accessible. Nothing fabricated. |
| **HAIOS v2.2 re-sync across other Claude Projects** | Admin | This project's attachment is current. Others not yet confirmed. |
| ~~Sag & Tension (conductor mechanical data, IEC 60826 synthesis question, unreviewed SANS pages)~~ | — | **Closed by scope decision (2026-07-30) — not by completion.** See `debt.md`/`roadmap.md`. Do not resume without a fresh, separate product decision from Hertz. |

## Standing rules (unchanged, plus one addition)
- Session bootstrap: fresh clone outside repo tree → `git log` + `npm test` →
  confirm HEAD and count → then build. Never trust handoff alone.
- `assembleRelease` only, never `assembleDebug`.
- Delete any fresh-clone test folders from inside the repo root before
  `git add -A` — they cause gitlink commits every time.
- Full file rewrites over patches. Engine-first with tests. Sources
  clause-cited, [AI-18] flags on uncertainty.
- **New (2026-07-30): Overhead Reticulation is capped at 33kV for any
  design-grade/iterative calculation.** Reference/lookup data may continue
  above 33kV where already sourced (e.g. Clearances). Before adding any new
  feature to this module, check whether it needs mechanical/iterative
  calculation above 33kV — if yes, stop and get an explicit decision from
  Hertz before building, per [AI-15]. This module has drifted into
  design-grade scope once already (Sag & Tension, three deferrals) before
  being caught; the check exists to prevent a repeat.
- Doc updates same session as the work ([DOC-3]) — done this session for
  both files before handoff.
