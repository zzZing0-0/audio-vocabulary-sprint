# Audio Vocabulary Sprint v3.24

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

## v3.6.1
- Note placeholder is now generic.
- Sync modal shows this browser/device's last successful sync time and whether it was an upload or download.
- The timestamp updates only after a successful GitHub sync.

## v3.7
- Main subtitle now shows only the version number.
- Last successful sync time is shown in its own status row above the upload/download buttons.
- New-word debt baseline is now conceptually 1:
  - first PASS: 1 → 0 → Mastered
  - first AGAIN: 1 → 2
  - later PASS: debt −1, at most once per local calendar day
  - later AGAIN: debt +1
- The baseline debt is not persisted before the user judges the word, so merely opening/closing the page cannot create artificial debt.

## v3.8
- Added RhymeZone similar-sound lookup.
- Moved debt badge to the card top-left.
- Renamed Mastered UI entry to 已掌握.
- Moved 钉子户 and 已掌握 full lists to active.html and mastered.html; main page no longer renders those lists.
- Added lightweight PASS confetti celebration.
- Preserved localStorage key and learning-state schema.


## v3.14 Local IPA database
- `data/pronunciations.json` is a static local IPA database built from English Wiktionary.
- IPA appears only after Reveal, preserving the audio-first task.
- Explicit UK/US labels are shown only when Wiktionary explicitly supports them.
- If neither regional label exists but an unlabelled IPA exists, the UI shows `IPA`.
- Missing entries occupy no UI space.
- Formal IPA is preserved as stored, including symbols such as `/ɹ/`.


### Updating IPA after importing another word list
Web TXT imports are persistent `state.customWords` and are uploaded inside the private GitHub `progress.json`.

The IPA updater does **not** require any local copy of `progress.json`.
By default it directly reads the latest private GitHub file through the GitHub Contents API, then merges:

1. `data/vocabulary.js` (`BASE_WORDS`)
2. cloud `progress.json → state.customWords`

It requests only pronunciation entries not already stored in `data/pronunciations.json`, plus transient failures.

Recommended on macOS:

```bash
caffeinate -i python3 tools/update_pronunciations.py
```

Authentication:
- If `GITHUB_TOKEN` exists in the Terminal environment, the script uses it.
- Otherwise the script securely prompts for the fine-grained token with hidden input.
- The token is never saved to project files or `pronunciations.json`.
- The token only needs access to the private `audio-vocabulary-sprint-data` repository.

For BASE_WORDS only:

```bash
python3 tools/update_pronunciations.py --base-only
```

Use `--retry-missing` only when you intentionally want to retry genuine no-IPA/missing-page entries.

## v3.24
- Fixed IPA maintenance so `customWords` come directly from cloud `progress.json`.
- Removed the need for a local private-data repo or local `progress.json`.
- Normal daily study remains: study → GitHub Sync upload → done.
- Terminal maintenance is only needed when newly imported vocabulary needs IPA.


## v3.24 Removed words
- Reveal now includes `移出词库`.
- Removed words are stored in `state.removedWords` and sync inside GitHub `progress.json`.
- Removal excludes a word from the effective learning bank and future queues without deleting its debt, Mastered, peak, review-date, or Note history.
- Added `removed.html` to view every removed word and restore it.
- Active/Mastered pages also support removing words.
- Restoring preserves the word's prior learning state.
- IPA maintenance reads cloud `removedWords` and excludes them from the combined vocabulary, so newly removed custom words are not fetched unnecessarily.


## v3.24
- `移出词库` is now included in the one-step Undo system.
- Undo restores `removedWords`, queue/current word, seen/debt/Mastered/peak/review state from the pre-removal snapshot.
- Removal feedback no longer overwrites the listening hint for the next word.
- Added a top-right transient notice that disappears automatically after 5 seconds.


## v3.24 Simplified study UI
- Voice switching moved beside the speaker: `‹` = previous voice, `›` = next voice.
- Tapping the speaker repeats the current pronunciation.
- Removed the separate `切换语音` study button.
- Before Reveal, the study area shows only `显示答案`.
- After Reveal, `显示答案` disappears and only `PASS` / `AGAIN` remain.
- PASS / AGAIN cannot be submitted before Reveal.

## v3.24 UI polish
- Removed-page historical states are fully localized: 已掌握 / 学习中 / 未学习.
- Note disclosure uses a thin `#dcc8f8` outline and a direction triangle (`◀` closed, `▼` open).
- Debt badge and Undo share the same top position and control height.
- Rainbow progress now fills the exact mastered percentage, including progress below 10%.
- The rainbow remains mapped across the full track and is revealed by clipping, with lower opacity for a softer look.

## v3.24 UI/message polish
- Note disclosure arrow is now `▶` when closed and `▼` when open.
- `移出词库` moved beneath `撤回` in the card's top-right corner, with pale-pink `#fbd5e4` warning styling.
- Native browser `alert()` / `confirm()` dialogs were removed from the main app, sync workflow, and list pages.
- Destructive/overwrite actions now use a five-second two-click confirmation window.
- Operation feedback uses one unified pale-blue top-left toast that disappears after five seconds.
- User-facing operation messages were normalized to Chinese terminology where applicable.

## v3.24 UI polish
- Unified operation toast moved to the top-right.
- Toast uses the same pale-blue family as the debt badge and shows a visible `5 → 4 → 3 → 2 → 1` countdown.
- Undo button background changed to `#fbf6d5`.
- PASS / AGAIN text colors now match their border colors exactly.

## v3.24 behavior polish
- Ordinary five-second operation notices no longer show a countdown number.
- Only second-click confirmation notices count down, and the number replaces the value inside `（5 秒内再次点击确认）` as `5 → 4 → 3 → 2 → 1`.
- Undo is completely hidden while unavailable.
- Top-right actions no longer reserve an empty slot; whichever action is visible occupies the top position.
- `显示答案` text now matches its purple border color exactly.

## v3.24
- Main study UI localized to `查看答案` / `通过` / `再来一次` / `笔记`.
- PASS / AGAIN result badges localized to `通过` / `再来一次`.
- `debt` remains unchanged.
- Primary study buttons get a subtle border-colored glow on mouse hover.
- Hover styling applies only to fine-pointer devices, so touch behavior is unchanged.
## v3.24
- Fixed `查看答案` hover glow being visually overridden by existing action-button CSS.
- Added a higher-specificity purple radiating glow for mouse/fine-pointer hover.

## v3.24
- `重新加入` renamed to `重新学习`.
- `移出词库` renamed to `删除` for a more compact UI.
- Header status labels now use traffic-light dots:
  - green = 已掌握
  - yellow = 学习中
  - red = 未学习

## v3.24
- Header status rows are left-aligned so the three traffic-light dots share one vertical line.
- `debt: N` and `首次出现` are separate top-left pills.
- Undo/Delete are compact outline buttons, laid out horizontally at the top-right with no reserved empty slot.
- Undo uses a warm yellow outline/text; Delete uses a soft pink outline/text.

## v3.24
- Hardened IPA rendering for Safari/macOS without altering the IPA database:
  explicit LTR/bidi isolation, stable IPA-capable font fallback, and safer shaping.
- Judgment feedback now visualizes the debt arithmetic instead of repeating button labels:
  - `再来一次`: `+1` falls onto the debt badge, then the number increments.
  - `通过`: `−1` drops away from the debt badge, then the number decrements.
- Passing `debt: 1` visibly resolves to `debt: 0` before the word leaves the screen.

## v3.24
- Before `查看答案`, the pronunciation controls (`‹  🔊  ›`) are enlarged.
- Mobile receives the strongest enlargement for easier one-handed tapping.
- After reveal, the pronunciation controls smoothly shrink back to the existing compact layout.
- The same transition runs in reverse when the next unrevealed word appears.

## v3.24
- Mobile pre-reveal pronunciation controls moved significantly lower into the one-handed thumb reach zone.
- Pre-reveal speaker enlarged again (164px on mobile) and side arrows enlarged proportionally.
- Post-reveal layout remains unchanged and compact.

## v3.24
- Fixed repeated taps on `通过` / `再来一次` applying multiple debt changes during the animation delay.
- The first judgment now locks the word until the next card appears.
- Judgment buttons are disabled during the debt animation; extra taps are ignored at both UI and logic layers.
- Undo immediately clears the judgment lock.

## v3.24
- Restores playful rapid tapping without corrupting learning state.
- The first `通过` / `再来一次` tap commits exactly one debt change.
- Repeated taps on that same button replay the `−1` / `+1` visual and sound only; debt does not change again.
- Every extra tap keeps the judged word on screen a little longer.
- The opposite judgment button is disabled after the first choice, so the committed judgment cannot flip accidentally.
- AGAIN particle dissolve is deferred until the final idle timeout, so it runs only once after the user stops tapping.

## v3.24
- AGAIN dissolve is finer, denser, and spreads farther before fading.
- Particle sampling is tighter and fragments are smaller for a more "魂飞魄散" effect.
- After the user stops rapid tapping, the app now waits for the full dissolve to finish before showing/speaking the next word.
- Judgment controls freeze during the final dissolve so the transition cannot restart mid-animation.

## v3.24
- AGAIN particle dissolve now starts immediately on the tap, together with the sound.
- Rapid repeated AGAIN taps each launch another particle burst and replay the sound, while the actual debt still changes only once.
- The next word waits until the last particle burst is fully gone.
- Particle engine optimized for repeated tapping:
  - word shape is rasterized/cached only once per word;
  - all bursts share one requestAnimationFrame render loop;
  - canvas DPR is capped for this effect;
  - per-burst and total particle counts are bounded;
  - dead particles are compacted in-place instead of creating a new render loop per tap.

## v3.24
- Fixed a single-tap AGAIN race: the particle engine used to hide the old word,
  then `reveal()` rebuilt a fresh visible word on top of the particles.
- The first AGAIN now rebuilds the answer first and immediately dissolves that exact
  visible word, so single-tap and rapid-tap behavior match.
- Mobile post-reveal listening/answer content is shifted lower; desktop placement is unchanged.

## v3.24
- Added a home-screen freshness check for iOS/Safari standalone launches:
  - on `pageshow` and when the app returns to the foreground, it fetches a cache-busted `index.html`;
  - if the published `app-build` is newer, it force-reloads that build;
  - offline/network failures never block study.
- Added web-app metadata/manifest for home-screen standalone use.
- Removed the pre/post reveal speaker/arrow size animation.
- Mobile only: before reveal, the upper `‹` / `›` controls are hidden and duplicated beside `查看答案` as purple outline buttons.
- After reveal, mobile returns to the existing upper `‹ 🔊 ›` layout.
- Desktop pronunciation controls and layout remain unchanged.

## v3.24
- Home screen reordered around study priority:
  1. learning card
  2. traffic-light progress bar
  3. app name/version + status legend
- Removed the red flag marker.
- Progress bar now uses the same semantic colors as the status legend:
  - green = 已掌握
  - yellow = 学习中
  - red = 未学习
