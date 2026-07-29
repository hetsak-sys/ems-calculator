# Self-Service License Reactivation — Options for Decision [AI-15]

Status: **DRAFT — decision owed by Hertz. No code has been built.** This is the
deferred "self-service reactivation for customers who reinstall or change
devices" item. Licensing architecture is [AI-15] tier (hard to reverse once
customers depend on it), so this document presents options and a recommendation;
it does not make the call.

## The problem

Device binding uses `ANDROID_ID`, which Android scopes to **device + signing
certificate**. A factory reset or a new/replacement phone produces a new
`ANDROID_ID`, so the license server sees an unknown device and (correctly,
per the fail-closed design) refuses activation. Today the only path is manual
intervention against the Neon database. In the SA/Lesotho field-technician
market, device churn (damage, theft, second-hand replacement) is a normal event
for exactly the paying customers this app targets — reactivation friction lands
on legitimate users, not abusers.

Non-negotiables carried over from the existing licensing design (knowledge doc
§2): server-side clock authority, fail-closed on first contact, no offline
grace, no bypass mode.

## Options

### A — Status quo: manual swap by Hertz
Admin releases the old device binding directly in the database on request.
- **For:** zero new attack surface, zero build cost.
- **Against:** does not scale past a handful of customers; support turnaround
  becomes the product experience; every swap is founder time.

### B — Self-service swap with cooldown (recommended)
New server endpoint (e.g. `POST /reactivate`): customer enters their license
key in the app on the new device; the server releases the previous binding,
binds the new `ANDROID_ID`, and records the swap in an audit table. Abuse is
bounded by a **cooldown** (e.g. max 2 swaps per rolling 30 days per key;
configurable per license tier) rather than by identity proof.
- **For:** standard commercial practice for device-bound perpetual licenses;
  scales with zero support involvement in the normal case; audit trail makes
  abuse patterns visible before they're a revenue problem; all fail-closed
  principles preserved (the swap itself is a server-authorised, server-timed
  event).
- **Against:** a shared key can be ping-ponged between two users within the
  cooldown budget — mitigated but not eliminated. Requires a schema addition
  (swap history table) — a real migration on Neon, hence this document.
- **Sub-decisions if chosen:** cooldown numbers per tier; whether **trial keys
  get zero swaps** (recommended — trials stay hard device-locked, only paid
  licenses earn swaps); what the lockout message says when the cooldown is
  exhausted (should direct to a human channel, not dead-end).

### C — Multi-seat allowance (2 concurrent devices per key)
- **For:** simplest customer experience; no swap flow at all.
- **Against:** effectively invites key-sharing in a sharing-prone, once-off-
  priced market — halves the realistic revenue per license. Better kept as a
  deliberately priced institutional/B2B feature (N seats per site license)
  than a default.

### D — Email-verified swap (token sent to purchase email)
- **For:** anchors the swap to an identity, closing option B's ping-pong gap.
- **Against:** requires reliable email capture at point of sale (not currently
  guaranteed for all sales channels), plus outbound email infrastructure on the
  Render free tier (deliverability, sender reputation). Heavier than the
  problem currently justifies.

## Recommendation

**Option B**, with trial keys excluded from swapping, a per-tier cooldown, and
an audit table from day one. Revisit toward D (email verification layered on
top of B) only if the audit trail actually shows swap abuse. Option C's
mechanics belong in institutional licensing as a priced feature, not in the
individual license.

Rough build shape when approved (separate repo `hetsak-sys/hetsa-license-server`):
1. Schema migration: `device_swaps` table (key, old_device, new_device,
   timestamp) — migration script reviewed before running against Neon [AI-15].
2. `POST /reactivate` endpoint: validate key → check cooldown against swap
   history (server clock) → release old binding → bind new → log.
3. App side: on "device not recognised" response, offer a "Move my license to
   this device" action that calls the endpoint — full file rewrites, comma-safe
   inputs n/a (key entry is alphanumeric), fail-closed error paths.
4. Tests server-side for cooldown boundaries; on-device verification of the
   full swap round-trip on the reference device (which is safe to test with,
   since release-signed reinstalls keep the same `ANDROID_ID`; the *new-device*
   path needs a second test device or an emulator with a distinct ID —
   verification plan to be written when the build is scoped).

**Decision needed from Hertz:** pick an option (or amend B's parameters), then
a dedicated build session against the license-server repo.
