# Audio Vocabulary Sprint — Architecture Map

This file is the first stop for a new maintainer or a new GPT session.

## Product invariant
The app is audio-first: hear a word → reveal → judge PASS / AGAIN. A judgment mutates learning data exactly once. During the short feedback window the same judgment button may be clicked repeatedly for sound/animation, but those extra clicks must never mutate debt/statistics again. After feedback, the app advances to another eligible word.

## Runtime shape
This is a static, dependency-free site. `index.html` loads scripts in this order:

1. `data/vocabulary.js` — built-in vocabulary.
2. `js/storage.js` — state migration, storage helpers, vocabulary/tag/link helpers.
3. `js/scheduler.js` — queue, PASS/AGAIN, undo, daily judgment statistics, next-word transition.
4. `js/app.js` — rendering, TTS, audio feedback, particle effects, search/import/settings UI.
5. `js/github-sync.js` — GitHub three-way merge/sync.
6. `js/lookup-modal.js` — reusable Lookup modal.

Because these are classic scripts, functions are shared through the page global scope. **Load order is therefore a real dependency.** Do not move script tags or top-level initialization casually.

## High-risk boundaries

### Judgment path
`reveal()` → `pass()` / `again()` → `revealThenNext()` → `scheduleJudgmentExit()` → `next()`.

Important: `scheduler.js` calls visual/audio helpers defined later by `app.js`. This is safe only after full page initialization. A top-level exception in `app.js` can leave those helpers/constants in the temporal dead zone and make scheduler failures look unrelated.

### Persistence
Primary localStorage key: `audio_vocab_sprint_universal_v3`. Do not rename it without an explicit migration.

Learning state includes debt/mastery/seen/history. `current`, `queue`, `queueDate`, and `voiceIndex` are intentionally device-local during GitHub merge. TTS blocked-voice preferences are also device-local.

### Sync
`js/github-sync.js` contains conflict-sensitive three-way merge logic. Do not modify it during unrelated UI work. Same-word conflicting learning changes require explicit conflict handling; same-day stats merge by relative deltas; word tags merge as sets.

### Lookup
Normal in-app Lookup uses `js/lookup-modal.js`. `lookup.html` remains for direct/compatibility access. The old home-return restoration path was removed; **do not reintroduce `restoreHomeAfterLookup`**.

## Secondary pages
- `active.html`, `mastered.html`, `removed.html`, `confusable.html` → mostly `js/list-pages.js`
- `history.html` → `js/history.js`
- `notes.html` → `js/notes.js`
- `tags.html` → `js/tags.js`
- `lookup.html` → `js/lookup.js`

## Change discipline
1. Start from a known-good commit and keep each patch narrow.
2. Do not combine scheduler, sync, and UI refactors in one patch.
3. Every extracted/refactored module must receive a targeted automated test in the same patch.
4. Run `npm run check:all` before release.
5. If multiple unrelated features fail at once, inspect the **first uncaught browser exception** before modifying downstream code.
