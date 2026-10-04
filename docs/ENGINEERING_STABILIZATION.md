# Engineering stabilization plan

Baseline entering stabilization: v4.1.2, commit `4cf8339` (Lookup-modal initialization bug fixed).

## Phase 1 — safety net and handoff map (this patch)
- Add one-command static/test/browser checks.
- Add architecture map and regression checklist.
- Add CI gate.
- Preserve runtime behavior.

## Phase 2 — initialization boundaries
- Inventory top-level side effects in `app.js` and secondary-page scripts.
- Move startup calls behind one explicit bootstrap boundary where practical.
- Add a targeted browser test for every moved boundary.

## Phase 3 — reduce `app.js` coupling in small patches
Candidate extractions, one at a time: feedback audio; dissolve/celebration effects; home search; import/settings UI. Each extraction must be behavior-preserving and include its own test.

## Phase 4 — scheduler testability
Separate pure learning-state transitions from DOM/audio feedback while preserving the deliberate stress-click behavior. Do not change queue/debt semantics as part of extraction.

## Phase 5 — sync hardening review
Review only after the study path is protected. Keep sync semantics unchanged unless a concrete bug is demonstrated.

## Deferred feature
Temporary shuffle within the same Active/Mastered sorting tier remains deferred until stabilization is complete.

### Phase 1 hardening notes
- Browser regression cases are isolated and aggregate failures; one failing case must not hide later failures.
- Build identity (`package.json`, `app-build`, `CURRENT_BUILD`) is a guarded invariant because drift can trigger reload loops and invalidate browser tests.
- Browser assertions must follow the existing scheduler semantics. In particular, PASS masters only when the pre-judgment debt is <= 1; higher debt is reduced by one.
