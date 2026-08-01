# Hetsa PowerSuite — User Manual Improvement Roadmap
## Response to the v1.1 manual critique — what to fix, in what order, and who does what

Six gaps were identified against the actual manual text (verified, not just asserted). This roadmap
splits them by **what can be drafted right now with no blockers** vs. **what needs something from
Hertz first** (mainly: a phone in hand), so the free work isn't stuck waiting behind the slow work.

---

## At a glance

| # | Gap | Owner | Blocked on | Effort |
|---|---|---|---|---|
| 1 | Cover/intro branding inconsistency | Claude drafts | Nothing | Trivial — one sentence |
| 2 | "Who Uses PowerSuite" expansion | Claude drafts | Hertz confirms segment list | Small |
| 3 | Offline capability underplayed | Claude drafts | Nothing | Small |
| 4 | No "Typical Workflows" chapter | Claude drafts | Hertz sanity-checks sequences | Medium |
| 5 | No maturity labeling (Available/Beta/Planned) | Claude drafts from `debt.md`/`roadmap.md` | Hertz makes the actual calls | Medium |
| 6 | Zero screenshots | **Hertz shoots** | Hertz has the reference device in hand | Largest single item |

**Sequencing logic:** 1–3 have no dependencies at all — do them first, same session, zero waiting.
4–5 need one round of Hertz's judgment but no device work — do them next. 6 is the long pole because
it requires Hertz's time on the actual phone, so it should start in parallel rather than be left last.

---

## Phase 1 — No-dependency text fixes (do immediately, one session)

### 1. Fix the cover/intro inconsistency
The cover page already says *"Engineering Field Platform for Electrical Technicians"* — that's the
right positioning. §1's opening sentence contradicts it: *"PowerSuite is an offline-first engineering
calculator app..."* This is a one-sentence fix, not a document-wide rebrand — don't touch the other 8
legitimate uses of "calculator" (Quick Math, the lightning-exposure calculator, etc.), those are
accurate and should stay.

**New §1 opening (drafted, ready to drop in):**
> PowerSuite is an offline-first engineering field platform for electrical technicians, engineers, and
> mine electrical staff working in South Africa and Lesotho. It replaces manual calculations,
> reference books, and error-prone spreadsheets with a single tool designed for real field conditions
> — including high-altitude sites, unreliable connectivity, and rugged daily use.

### 2. Expand "Who Uses PowerSuite"
Currently only "Who this manual is for" exists (2 lines, about the reader, not the market). Add a
short standalone section right after it in §1.

**Drafted section:**
> ## Who PowerSuite is for
> - Electrical technicians and engineers
> - Contractors and consulting engineers
> - Mine electrical staff
> - Utility and municipal electrical personnel
> - Solar/renewable installers
> - Training colleges and students
> - Inspectors and compliance assessors

*Hertz check needed:* confirm this list matches what you actually want to claim publicly — it's pulled
straight from `marketing_strategy.md` §2, so it should already be consistent with how you're
positioning the product elsewhere.

### 3. Reinforce offline capability
Currently stated once in §1 and never returned to, despite being the single strongest differentiator
per your own marketing doc. Fix: keep the §1 mention, add one line to the Home Screen section (§3) and
one to Licensing (§19) so it's reinforced at the two other points where a reader would naturally
wonder about it.

**§3 addition (end of Home Screen section):**
> Every module on this screen runs fully offline — the only feature on the entire phone that ever
> needs a connection is the license check itself, and only briefly.

**§19.1 addition (end of "How it works"):**
> Outside of that one-time trial registration and periodic license checks, PowerSuite never requires
> connectivity — every calculation, on every module, works with zero signal.

---

## Phase 2 — Needs one round of Hertz's judgment (draft ready, needs sign-off)

### 4. Typical Workflows chapter
New chapter, positioned after §3 (Home Screen) and before the module reference chapters begin at §4 —
so a first-time reader hits "how this actually gets used" before the module-by-module lookup material.

**Three workflows drafted from actual module capabilities (cross-checked against the module list, not
invented):**

**Workflow A — Sizing a motor feeder**
Motor FLA (§4) → Cable Sizing (§5) → Breaker/Protection sizing (§7) → Voltage Drop check (§5) →
Export PDF (§16)

**Workflow B — Generator/standby power design**
Load Schedule → Generator sizing (§8, the multi-load flow: loads → generator → transformer → fault
level) → Protection coordination check (§7) → Export PDF (§16)

**Workflow C — Solar installation**
PV Array sizing → Battery/off-grid sizing → Grid-Tie NRS 097-2 compliance check → Hybrid system design
(all §10) → Export PDF (§16)

*Hertz check needed:* confirm these three sequences reflect how the app is actually meant to be used
end-to-end — I built them from the module list and your own demo script in `marketing_strategy.md`
§7, but you're the one who knows if a tech would really move through the tabs in that exact order.

### 5. Feature maturity labeling + "What's Coming"
Add a short section (end of manual, before Support) distinguishing **Available now** from anything
less mature, plus a one-page roadmap teaser. Grounded in what's actually tracked in `debt.md` and
`roadmap.md` — not a generic template.

**What I can state with confidence from `debt.md` right now:**
- Everything shipped is "Available now" except one flagged item: **Duct Derating** (under Cable &
  Wiring → Underground Reticulation) reuses the direct-buried grouping table rather than a
  duct-bank-specific one — already flagged in-app (`factors.groupingReused: true`) and in the tab's
  info box, so this isn't new information, just surfaced at the manual level too.
- Protection's Arc Flash, PI/DAR, and TCC plot are verified on-device (2026-07-29) — no "beta" flag
  needed there despite Arc Flash being explicitly a screening estimate by design (that's a permanent
  scope statement, not a maturity flag).

*Hertz check needed:* this is the one section where I genuinely need your call, not just a
confirmation — you know better than `debt.md` alone whether anything else feels "not fully proven yet"
to you even if it's technically shipped and tested. A single line from you per module is enough.

**"What's Coming" — only include what's real.** Rather than inventing a roadmap, pull directly from
your own `roadmap.md` §5.6 (Sag & Tension sub-tab is the one concretely-deferred, named item there).
Don't pad this section with aspirational features that aren't actually planned — an inaccurate roadmap
undermines the same trust the rest of the manual is built on.

---

## Phase 3 — The long pole (starts now, finishes independently)

### 6. Screenshots (10–15 images)
This is the one item that needs Hertz's hands on the actual device, so it should kick off in parallel
with Phase 1/2 rather than wait for them. Shot list below is scoped to match what the critique asked
for, anchored to actual sections so each image has a clear home.

| # | Screen to capture | Manual section |
|---|---|---|
| 1 | Home screen (site summary + module grid) | §3 |
| 2 | Motor FLA result screen | §4 |
| 3 | Cable Sizing result screen | §5 |
| 4 | Earthing result screen | §6 |
| 5 | Protection → Coord. Study, TCC log-log plot | §7 |
| 6 | Power Systems → Generator multi-load flow | §8 |
| 7 | Renewable Energy → PV Array sizing result | §10 |
| 8 | Installation Design → DB sizing | §11 |
| 9 | Overhead Reticulation → any construction sub-tab | §12 |
| 10 | Quick Math → scientific calculator | §15 |
| 11 | PDF export screen / a sample exported PDF page | §16 |
| 12 | Settings → Site Profile | §18 |
| 13 | License activation screen | §19 |
| 14 | *(optional)* Formula Reference / saved formula | §14 |
| 15 | *(optional)* History screen | §17 |

**Once you've got these**, send them over and I'll handle placement, resizing, and captioning directly
in the `.docx` — that part doesn't need you again.

---

## Suggested execution order

1. **This session or next:** Phase 1 (all three, no dependencies) — I can do this immediately on your
   go-ahead, direct `.docx` edit.
2. **Same or next session:** Send me your one-line-per-module maturity check for Phase 2 item 5, and a
   thumbs-up/adjustment on the Phase 2 item 4 workflow sequences.
3. **Whenever you have the device free:** Work through the Phase 3 shot list — no rush, doesn't block
   anything else, just send screenshots whenever you have them and I'll insert them in a follow-up
   pass.

Nothing here needs to happen in a single sitting — Phases 1–3 are genuinely independent of each other,
so pick whichever's easiest to start with.
