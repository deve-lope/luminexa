# Luminexa — Agent playbook (Auto / mixed models)

How to start work for the next ~2 weeks without rediscovering product rules from chat history. **This pack is the source of truth** — not prior transcripts.

---

## Start every task

1. **Read** [`AGENTS.md`](../AGENTS.md) (stack, ports, high-risk modules, definition of done).
2. **Open** the relevant `.cursor/rules/*.mdc` if your change touches those globs (rules auto-attach when files match):
   - Capacity / bookings → `booking-capacity.mdc`
   - Find / discover / ZIP miles → `location-search.mdc`
   - Branches / service area settings → `provider-locations.mdc`
3. **Read** the matching section in [`docs/PRODUCT_RULES.md`](PRODUCT_RULES.md) before changing behavior.
4. **Implement small diffs** — match existing patterns; no drive-by refactors; no parallel systems.
5. **Run focused tests** from [`docs/TEST_STRATEGY.md`](TEST_STRATEGY.md) (e.g. `jobs.tests.test_bookings`, `businesses.tests.test_location_radius`).
6. **Do not commit** unless the user explicitly asks.

---

## Choosing what to read

| Task smells like… | Read first |
|--------------------|------------|
| Slot full after one booking, chairs/workers, FK vs OneToOne | PRODUCT_RULES § Capacity + `booking-capacity.mdc` |
| Provider missing from Find at X miles | PRODUCT_RULES § Search + `location-search.mdc` + `location.py` |
| Second shop address / branch | PRODUCT_RULES § Locations + `provider-locations.mdc` |
| Adding tests | TEST_STRATEGY templates only — do not invent conflicting rules |
| Android / Play Store | PLAY_STORE_RELEASE.md + `storeLinks.js` (install = Play listing, not PWA) |

---

## Implementation norms

- Prefer the smallest change that satisfies PRODUCT_RULES.
- Touch high-risk modules carefully (`AGENTS.md` list): `booking_services.py`, slot capacity helpers, `location.py`, discover API, provider/customer location UIs.
- Do **not** “simplify” dual-radius, capacity remaining seats, or multi-location any-branch match.
- Do **not** recreate migrations `businesses.0016`, `businesses.0017`, `jobs.0025`.
- New tests: name them after the product rule; put them in the existing focused suites when possible.

---

## Definition of done (agent)

- [ ] Behavior matches `docs/PRODUCT_RULES.md`
- [ ] Related focused tests pass (or new cases from TEST_STRATEGY added)
- [ ] No unrelated file churn
- [ ] No commit unless requested
- [ ] Short summary of what changed and how to verify

---

## If product intent is unclear

Stop and ask the user. Do not guess a simpler search or booking model. The shipped truths in PRODUCT_RULES were verified in code; treat contradictions as bugs to investigate, not invitations to redesign.
