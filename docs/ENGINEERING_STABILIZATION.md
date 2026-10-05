# Engineering stabilization status — v4.4.2

v4.1.4 is the behavior baseline. v4.4.2 is an engineering release: no intended learning-rule, sync-semantic, or persisted-schema change.

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

## v4.4.2 stabilization close-out

v4.4.2 is the final planned broad stabilization pass before normal feature development resumes.

- `app.js` is now the home-screen orchestration shell rather than the owner of every UI concern. Pronunciation editing, word metadata UI (tags/confusables), and judgment audiovisual feedback have explicit modules.
- Judgment feedback is intentionally state-free with respect to learning maps. `scheduler.js` remains the owner of PASS/AGAIN learning transitions.
- GitHub sync merge semantics were not rewritten. They are protected by contract tests for independent edits, same-word conflicts, device-local session fields, daily-stat deltas, tag sets, and note conflicts.
- Browser regression covers real user behavior for judgments, reusable dictionary navigation, note persistence, tag editing, confusable links, and soft removal metadata preservation.
- Version changes remain automated with `npm run version:set -- x.y.z`; deployed version numbers are never reused.

Future work should prefer local feature patches plus matching tests. Do not start another broad refactor unless a concrete recurring failure demonstrates that a boundary is still wrong.
