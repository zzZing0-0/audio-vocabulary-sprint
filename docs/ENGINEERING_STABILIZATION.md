# Engineering stabilization status — v4.2.0

v4.1.4 is the behavior baseline. v4.2.0 is an engineering release: no intended learning-rule, sync-semantic, or persisted-schema change.

## Completed
- Centralized fresh-build detection in `runtime.js`; removed per-page refresh implementations that previously caused reload loops when versions drifted.
- Added `state-core.js`; one canonical storage-key definition and one state-shape normalization boundary are shared by main and secondary pages.
- Added automated `version:set`; deployed version identifiers are no longer meant to be edited by hand.
- Extracted home search and data I/O from `app.js`, reducing unrelated change blast radius.
- Kept scheduler and GitHub sync semantics untouched.
- Added architecture-boundary tests in addition to behavior/invariant tests.
- Browser regression remains isolated per case and includes real dictionary-link navigation/reuse behavior.

## Deliberately not rewritten
- Scheduler internals: semantics are stable and protected; a pure-state rewrite would add migration risk without a current product need.
- GitHub three-way merge: high-risk and currently working; no speculative refactor.
- `list-pages.js`: still a larger secondary-page module, but its responsibilities are cohesive enough that splitting it now would create more churn than safety.

## Release gate
A release is acceptable only when `npm run check:all` is green on a machine with Chrome/Chromium. Static/Node checks must never be treated as a substitute for browser regression.

## Deferred product feature
Temporary shuffle within the same Active/Mastered sorting tier remains deferred until this engineering release is production-verified.
