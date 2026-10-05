# Audio Vocabulary Sprint — Architecture Map (v4.4.0)

Start here when handing the project to a new maintainer or GPT.

## Production architecture
The product is a **static GitHub Pages site**. There is no production Node server and no local backend. npm/Node exist only for engineering checks. `scripts/browser-smoke.mjs` temporarily starts an HTTP server solely as a browser-test fixture.

## Core product invariant
Study flow is hear → reveal → PASS / AGAIN. A judgment may mutate learning state **exactly once**. Repeated taps during the feedback window may replay sound/animation but must never mutate debt or statistics again.

## Shared boundaries introduced by stabilization
- `js/runtime.js` — the only fresh-build/reload checker. HTML pages must not implement their own `CURRENT_BUILD` logic.
- `js/state-core.js` — the canonical persisted-state key, safe shape normalization, and raw read/write boundary. Secondary pages no longer maintain independent state-shape copies.
- `js/storage.js` — vocabulary-domain helpers and migrations that require vocabulary context.
- `js/scheduler.js` — queue and learning transitions.
- `js/external-links.js` — external dictionary window ownership/reuse.
- `js/lookup-modal.js` — in-app Lookup modal/history only.
- `js/home-search.js` — home search UI.
- `js/data-io.js` — reset/import/export and vocabulary-file parsing.
- `js/app.js` — main study-page rendering, TTS and feedback UI; it no longer owns search or data-I/O code.
- `js/github-sync.js` — conflict-sensitive GitHub merge/sync. Do not edit during unrelated work.

## Main-page load order
`vocabulary.js` → `state-core.js` → `storage.js` → `scheduler.js` → `external-links.js` → `app.js` → `home-search.js` → `data-io.js` → `github-sync.js` → `lookup-modal.js` → `runtime.js`.

Classic scripts intentionally share the global scope, so load order remains an explicit contract and is tested.

## Persistence and sync invariants
Primary key remains `audio_vocab_sprint_universal_v3`. Never rename it without an explicit migration. `current`, `queue`, `queueDate`, and `voiceIndex` remain device-local during GitHub merge. Blocked TTS voices are device-local. Sync conflict semantics are unchanged in v4.4.0.

## Build/version invariant
`package.json` is the release-version source used by tooling. Run `npm run version:set -- X.Y.Z`; do not manually hunt through HTML/JS for version strings. The command updates cache-busting/build markers, and `check:static` rejects stale page versions. Every already-deployed code change gets a new patch/minor version; deployed version numbers are never reused.

## High-risk paths
Judgment: `reveal()` → `pass()/again()` → `revealThenNext()` → `scheduleJudgmentExit()` → `next()`.

Lookup: same-origin Lookup links are intercepted by `lookup-modal.js`; external dictionary links are intercepted by `external-links.js`. Do not merge these responsibilities.

Sync: `github-sync.js` is a protected boundary. Preserve three-way merge semantics unless fixing a demonstrated sync bug.

## Change discipline
Keep patches behavior-preserving and module-scoped. Every extracted/refactored boundary gets a targeted test. Run `npm run check:all` before deployment. If unrelated features fail together, inspect the first uncaught browser exception before editing downstream code.

## v4.4.0 UI boundaries
- `js/app.js`: home-screen orchestration and shared shell wiring.
- `js/pronunciation-ui.js`: pronunciation rendering/editor only.
- `js/word-metadata-ui.js`: per-word tags and confusable-word UI only.
- `js/judgment-feedback.js`: PASS/AGAIN audiovisual feedback only; it must not mutate learning maps.
- `js/scheduler.js`: learning transitions, judgment locking, undo and queue progression.
- `js/github-sync.js`: cloud merge/write behavior; session position remains device-local.

The order in `index.html` is a tested contract. If a new module needs another module's globals, document the dependency and extend the script-order contract test rather than relying on accidental placement.
