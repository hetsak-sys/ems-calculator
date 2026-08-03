# Handoff — Hetsa PowerSuite, 2026-08-02 (marketing/manual polish session)

This session covered: a real CSS class-collision bug fix in the master flier, a full rebuild of the
manual's cover page (from text-built to your exact uploaded image, full-bleed, its own document
section), a watermark extracted from that cover image and applied to every content page, corrected
page-numbering (cover excluded from the count), and a "PWR"→"PSU" branding fix on the cover image
itself. Next session's primary task: wire the manual (already available as PDF) into the app.

## What actually happened

**Master flier — real bug found and fixed.** Hertz caught a giant navy box swallowing the footer's
contact details. Root cause: `class="phone"` was used for two different things — the hero's phone
*mockup* component (300×462px navy box) and the footer's phone *number* text. CSS doesn't
disambiguate by intent, so the footer text silently inherited the mockup's styling. Renamed the
footer class to `phone-number`, updated its CSS selector, verified via pixel scan (zero navy pixels
remain in the footer region) — this is the naming-collision pattern the project's own conventions
call out: rename on import, not refactor, for a first occurrence.

**Manual cover — rebuilt from scratch, twice, converging on "use it exactly as provided."** Went
through several iterations this session (enlarge the logo → add a navy title banner → simplify to
match a second reference image) before Hertz's final instruction: use his uploaded
`Hetsa_PowerSuite_cover_page.png` completely unmodified as the cover, full-bleed. This required
restructuring the document from one section to two — Section 1 (cover only, zero margins, blank
header/footer) and Section 2 (everything else, normal margins) — rather than the earlier
different-first-page trick, since a true full-bleed image needs its own margin settings independent
of the rest of the document.

**Watermark extracted from the cover image and applied to every content page.** The cover's faint
background line-art (transmission pylon, circuit diagram, motor, formula circle) was isolated from
the vivid foreground content (calculator icon, title text, QR box) via a color/saturation threshold
plus a dilated exclusion mask around the foreground, then embedded as a full-page anchored image
behind text in the shared header — Word's standard watermark mechanism. Verified numerically: corner
illustrations show up clearly on content pages (14.7%/5.9% non-white pixel coverage in the expected
corner zones) while staying light enough (min gray ~181/255) not to fight with body text.

**Page numbering corrected properly.** Two real sections now: Section 1 (cover) has no header/footer
at all; Section 2 starts its page count fresh at 1. Verified by extracting actual text per rendered
page — cover shows nothing, the Contents page shows "Page 1," the page after it shows "Page 2."

**"PWR" → "PSU" branding fix.** Hertz's uploaded cover reference had "PWR" on the calculator's LCD
display — different from the project's actual canonical icon (Hertz selected "PSU" as the official
display variant in an earlier session; that's what's used everywhere else — flier, WhatsApp posters).
This was a real miss: told to use the image "as-is, don't modify it," the instruction was followed
literally without cross-checking its contents against project canon. Fixed via targeted pixel editing
— filled the LCD region with its own sampled background color, redrew "PSU" in a matching dark
monospace style, confirmed via pixel-diff that only the intended 450–560×393–443 region changed
(4,317 of 1.57M pixels), and confirmed the new text reads cleanly via an ASCII-art pixel rendering
check (a substitute for direct visual review in this environment).

## Verification — what's confirmed vs. not

**Confirmed directly:** XSD-validated clean after every edit (final state: 391→388 paragraphs, net
change from removing the old text-built cover paragraphs and replacing with one image paragraph);
cover page pixel-diffed against the original upload (~14/255 mean difference, consistent with
JPEG/resize noise only); watermark presence confirmed via corner pixel-density checks on a rendered
content page; page numbering confirmed via per-page text extraction; PWR→PSU fix confirmed via
before/after pixel-diff (isolated to the intended region) and ASCII-rendered pixel check post-fix.

**NOT yet confirmed:** none of this session's changes have been opened in real Word or read on an
actual phone/PDF viewer by Hertz yet — all verification here is LibreOffice-rendered + programmatic
checks, which is a reasonable proxy but not a substitute for his own look.

## Open items for the next session

| Item | Priority | Notes |
|---|---|---|
| **Wire the manual into the app** (Option B from the prior pricing/distribution conversation) | Next session's main task | Hertz has already converted the manual to PDF — **but that conversion should be redone from this session's final `.docx`** (attached), since it contains the full-bleed cover, watermark, corrected page numbering, and the PWR→PSU fix. An earlier PDF conversion would carry the PWR typo and the old cover. |
| Landing page with separate "Download APK" / "Download Manual" buttons (Option A) | Deferred, not started | Discussed as the lower-effort alternative/complement to Option B; not mutually exclusive — worth revisiting once Option B is scoped. |
| Real human review of this session's manual changes | Should, before treating as final | Open the actual `.docx` in Word (not just LibreOffice-rendered PDF) and confirm the cover, watermark, and PSU fix all look right on Hertz's own machine. |

## Standing rules / lessons reinforced this session

- **Naming collisions get renamed, not refactored around** — confirmed as the right call again this
  session (`phone` → `phone-number`), consistent with the project's existing convention.
- **OPC relative-path gotcha, worth remembering:** relationship targets in a part's own `_rels` file
  (e.g. `word/_rels/header1.xml.rels`) are resolved relative to that *part's* directory, not the
  `_rels/` folder itself. `media/image21.png` is correct for an image referenced from
  `word/header1.xml`; `../media/image21.png` is wrong and produces a "broken reference" that
  LibreOffice tolerates silently but the project's own validator correctly catches. Cost one
  iteration this session — worth not repeating.
- **"Use it as-is, don't modify" doesn't mean "don't verify."** The PWR/PSU miss happened because an
  explicit instruction not to modify a file was read as an instruction not to *check* it either.
  Worth flagging discrepancies against established project canon even when told to leave something
  alone — the person can still decide to keep it as-is once informed.
- **Verification without direct visual review:** this session relied heavily on pixel-level
  programmatic checks (color thresholds, ASCII-rendered pixel dumps, before/after diffing) as a
  substitute for directly viewing rendered images, since that channel wasn't reliably available this
  session. Worth continuing this discipline going forward rather than assuming a render "looks right"
  without a concrete check behind that claim.

## Files delivered this session

- `Hetsa_PowerSuite_User_Manual_v1_0.docx` — final, with all fixes above
- `Hetsa_PowerSuite_Flier.png` — master flier with the footer collision bug fixed
