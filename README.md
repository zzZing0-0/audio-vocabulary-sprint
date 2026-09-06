# Audio Vocabulary Sprint v3.4.1

## Structure
- `index.html` — page structure
- `css/style.css` — visual styles
- `data/vocabulary.js` — built-in 3453-word base vocabulary
- `js/storage.js` — state initialization, migration, localStorage, combined word bank
- `js/scheduler.js` — PASS / AGAIN, debt, daily eligibility, queue scheduling
- `js/app.js` — UI, speech, dictionary links, Mastered/Active panels, word-list import
- `js/github-sync.js` — GitHub progress.json upload/download and token handling

## Persistence
- localStorage key remains `audio_vocab_sprint_universal_v3`
- existing Mastered / debt / seen / peak / review-date data is preserved
- imported TXT lists are permanently stored in `state.customWords`
- `state.customWords` syncs with GitHub `progress.json`
- older saves without `customWords` migrate automatically

## Word-list import
UTF-8 `.txt`, one word or phrase per line.
Empty lines, `vc_vocabulary`, standalone `a`, `an`, `the`, and case-insensitive duplicates are ignored.

## Lists
- Active / 钉子户: Top 10 shown first, remainder collapsed
- Mastered: Top 10 by historical peak shown first, remainder collapsed

## v3.5 Notes
- Each word can store a free-text note in `state.notes`.
- Note input appears after Reveal and saves on blur/change or PASS/AGAIN.
- Notes sync inside GitHub `progress.json`.
- Old saves without `notes` migrate automatically to `{}`.

## v3.5.1
- Fix: Note input now reliably renders after Reveal.

## v3.5.2
- Fix deployment cache issue: local CSS/JS asset URLs now include a version query string.
- This forces browsers/GitHub Pages to fetch the new `app.js` instead of reusing an older cached module.

## v3.6 Context pronunciation
Reveal now provides four reference links:
- Longman: dictionary pronunciation/definition
- Cambridge: dictionary pronunciation/Chinese support
- YouGlish: current word in real YouTube speech contexts
- PlayPhrase: current word in movie/TV phrase contexts
The current word is URL-encoded into both context-search links automatically.
