# Regression checklist — v4.4.2

Automated gate: `npm run check:all`.

The browser suite must protect startup, AGAIN stress-click single mutation, PASS mastery at debt 1, PASS decrement at debt >1, and dictionary navigation that leaves the app URL unchanged while reusing one external tab.

Before production release, manually smoke-test: reveal/PASS/AGAIN; Lookup open/back/close; one secondary library page; search; GitHub sync preview without committing an unintended merge; visible footer version. Manual smoke is a final sanity check, not a replacement for automated tests.

### v4.4.2 protected interactions
- Note edits persist without changing learning state.
- Tag edits persist without changing debt/mastery.
- Confusable links remain bidirectional and metadata-only.
- Soft removal preserves notes and linked-word metadata.
- Sync merge invariants are covered by `tests/sync-contract.test.mjs` without changing production merge semantics.
