# Audio Vocabulary Sprint

## Maintainer quick start (v4.1.3 engineering stabilization)

This is a static Local-first app. Before changing code, read `docs/ARCHITECTURE.md` and `docs/REGRESSION_CHECKLIST.md`. The stabilization roadmap is in `docs/ENGINEERING_STABILIZATION.md`.

Run `npm run check:all` before release. It checks JavaScript syntax/static references, protected invariants, and—when Chrome/Chromium is available—a real browser smoke test of the core judgment flow.

**Known-good stabilization baseline:** v4.1.2 commit `4cf8339`. Do not modify scheduler, sync, and UI architecture in one patch. Every future refactor/extraction should add a targeted test in the same patch.

---

## v4.1.2 stable release

- Stable 4.0 baseline after the 3.x feature-completion and QA cycle.
- No learning-rule or sync-schema change from the validated v3.33.9 baseline; this release formalizes that state as v4.1.2.

## v4.1.2
- 词库新增「易混词」，位于「已掌握」之后、「笔记」之前。
- 页面列出所有至少存在一个有效易混词关联的单词，并展示其关联词；两者均可进入查询页。
- 复用现有 `linkedWords`，不新增同步字段，不改变学习调度或同步算法。

## v4.1.2 information architecture
- Main study page keeps only the learning workflow, a vocabulary search box, and three navigation entries: 词库 / 学习记录 / 设置.
- 词库 groups 学习中（钉子户）, 已掌握, 易混词, 笔记, 已移除.
- 设置 groups GitHub 同步, 导入新词表, and the destructive 清空词库 action.
- 查询词条 is no longer a main navigation item; search is available directly from the study page and opens the existing lookup detail page.
- No learning scheduler, GitHub merge, token persistence, or state schema changes in this release.

## Learning rules
- A new word starts conceptually at debt = 1 when first judged. PASS reduces debt by 1; AGAIN increases debt by 1. debt = 0 means 已掌握.
- A learning word is judged at most once per local calendar day.
- `highestDebt` preserves the historical peak debt.
- Removing a word excludes it from the learning queue without deleting its debt, mastery, notes, or links; it can be restored.
- TXT/CSV imports add custom vocabulary. Re-importing an active word increases debt; re-importing a mastered word reactivates it at debt = 1.
- Built-in words cannot be permanently deleted; custom words may be permanently deleted from 已移除.

## Sync rules
- Opening the app does not automatically sync or write GitHub.
- Manual sync first reads and previews 本机同步前 / GitHub 当前 / 合并后 counts. Nothing is written until confirmation.
- Incompatible same-word changes require an explicit user choice before confirmation.
- `current`, `queue`, and `queueDate` are device-local scheduler position and are not merged across devices.

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

## v3.26
- Fixed IPA maintenance so `customWords` come directly from cloud `progress.json`.
- Removed the need for a local private-data repo or local `progress.json`.
- Normal daily study remains: study → GitHub Sync upload → done.
- Terminal maintenance is only needed when newly imported vocabulary needs IPA.


## v3.26 Removed words
- Reveal now includes `移出词库`.
- Removed words are stored in `state.removedWords` and sync inside GitHub `progress.json`.
- Removal excludes a word from the effective learning bank and future queues without deleting its debt, Mastered, peak, review-date, or Note history.
- Added `removed.html` to view every removed word and restore it.
- Active/Mastered pages also support removing words.
- Restoring preserves the word's prior learning state.
- IPA maintenance reads cloud `removedWords` and excludes them from the combined vocabulary, so newly removed custom words are not fetched unnecessarily.


## v3.26
- `移出词库` is now included in the one-step Undo system.
- Undo restores `removedWords`, queue/current word, seen/debt/Mastered/peak/review state from the pre-removal snapshot.
- Removal feedback no longer overwrites the listening hint for the next word.
- Added a top-right transient notice that disappears automatically after 5 seconds.


## v3.26 Simplified study UI
- Voice switching moved beside the speaker: `‹` = previous voice, `›` = next voice.
- Tapping the speaker repeats the current pronunciation.
- Removed the separate `切换语音` study button.
- Before Reveal, the study area shows only `显示答案`.
- After Reveal, `显示答案` disappears and only `PASS` / `AGAIN` remain.
- PASS / AGAIN cannot be submitted before Reveal.

## v3.26 UI polish
- Removed-page historical states are fully localized: 已掌握 / 学习中 / 未学习.
- Note disclosure uses a thin `#dcc8f8` outline and a direction triangle (`◀` closed, `▼` open).
- Debt badge and Undo share the same top position and control height.
- Rainbow progress now fills the exact mastered percentage, including progress below 10%.
- The rainbow remains mapped across the full track and is revealed by clipping, with lower opacity for a softer look.

## v3.26 UI/message polish
- Note disclosure arrow is now `▶` when closed and `▼` when open.
- `移出词库` moved beneath `撤回` in the card's top-right corner, with pale-pink `#fbd5e4` warning styling.
- Native browser `alert()` / `confirm()` dialogs were removed from the main app, sync workflow, and list pages.
- Destructive/overwrite actions now use a five-second two-click confirmation window.
- Operation feedback uses one unified pale-blue top-left toast that disappears after five seconds.
- User-facing operation messages were normalized to Chinese terminology where applicable.

## v3.26 UI polish
- Unified operation toast moved to the top-right.
- Toast uses the same pale-blue family as the debt badge and shows a visible `5 → 4 → 3 → 2 → 1` countdown.
- Undo button background changed to `#fbf6d5`.
- PASS / AGAIN text colors now match their border colors exactly.

## v3.26 behavior polish
- Ordinary five-second operation notices no longer show a countdown number.
- Only second-click confirmation notices count down, and the number replaces the value inside `（5 秒内再次点击确认）` as `5 → 4 → 3 → 2 → 1`.
- Undo is completely hidden while unavailable.
- Top-right actions no longer reserve an empty slot; whichever action is visible occupies the top position.
- `显示答案` text now matches its purple border color exactly.

## v3.26
- Main study UI localized to `查看答案` / `通过` / `再来一次` / `笔记`.
- PASS / AGAIN result badges localized to `通过` / `再来一次`.
- `debt` remains unchanged.
- Primary study buttons get a subtle border-colored glow on mouse hover.
- Hover styling applies only to fine-pointer devices, so touch behavior is unchanged.
## v3.26
- Fixed `查看答案` hover glow being visually overridden by existing action-button CSS.
- Added a higher-specificity purple radiating glow for mouse/fine-pointer hover.

## v3.26
- `重新加入` renamed to `重新学习`.
- `移出词库` renamed to `删除` for a more compact UI.
- Header status labels now use traffic-light dots:
  - green = 已掌握
  - yellow = 学习中
  - red = 未学习

## v3.26
- Header status rows are left-aligned so the three traffic-light dots share one vertical line.
- `debt: N` and `首次出现` are separate top-left pills.
- Undo/Delete are compact outline buttons, laid out horizontally at the top-right with no reserved empty slot.
- Undo uses a warm yellow outline/text; Delete uses a soft pink outline/text.

## v3.26
- Hardened IPA rendering for Safari/macOS without altering the IPA database:
  explicit LTR/bidi isolation, stable IPA-capable font fallback, and safer shaping.
- Judgment feedback now visualizes the debt arithmetic instead of repeating button labels:
  - `再来一次`: `+1` falls onto the debt badge, then the number increments.
  - `通过`: `−1` drops away from the debt badge, then the number decrements.
- Passing `debt: 1` visibly resolves to `debt: 0` before the word leaves the screen.

## v3.26
- Before `查看答案`, the pronunciation controls (`‹  🔊  ›`) are enlarged.
- Mobile receives the strongest enlargement for easier one-handed tapping.
- After reveal, the pronunciation controls smoothly shrink back to the existing compact layout.
- The same transition runs in reverse when the next unrevealed word appears.

## v3.26
- Mobile pre-reveal pronunciation controls moved significantly lower into the one-handed thumb reach zone.
- Pre-reveal speaker enlarged again (164px on mobile) and side arrows enlarged proportionally.
- Post-reveal layout remains unchanged and compact.

## v3.26
- Fixed repeated taps on `通过` / `再来一次` applying multiple debt changes during the animation delay.
- The first judgment now locks the word until the next card appears.
- Judgment buttons are disabled during the debt animation; extra taps are ignored at both UI and logic layers.
- Undo immediately clears the judgment lock.

## v3.26
- Restores playful rapid tapping without corrupting learning state.
- The first `通过` / `再来一次` tap commits exactly one debt change.
- Repeated taps on that same button replay the `−1` / `+1` visual and sound only; debt does not change again.
- Every extra tap keeps the judged word on screen a little longer.
- The opposite judgment button is disabled after the first choice, so the committed judgment cannot flip accidentally.
- AGAIN particle dissolve is deferred until the final idle timeout, so it runs only once after the user stops tapping.

## v3.26
- AGAIN dissolve is finer, denser, and spreads farther before fading.
- Particle sampling is tighter and fragments are smaller for a more "魂飞魄散" effect.
- After the user stops rapid tapping, the app now waits for the full dissolve to finish before showing/speaking the next word.
- Judgment controls freeze during the final dissolve so the transition cannot restart mid-animation.

## v3.26
- AGAIN particle dissolve now starts immediately on the tap, together with the sound.
- Rapid repeated AGAIN taps each launch another particle burst and replay the sound, while the actual debt still changes only once.
- The next word waits until the last particle burst is fully gone.
- Particle engine optimized for repeated tapping:
  - word shape is rasterized/cached only once per word;
  - all bursts share one requestAnimationFrame render loop;
  - canvas DPR is capped for this effect;
  - per-burst and total particle counts are bounded;
  - dead particles are compacted in-place instead of creating a new render loop per tap.

## v3.26
- Fixed a single-tap AGAIN race: the particle engine used to hide the old word,
  then `reveal()` rebuilt a fresh visible word on top of the particles.
- The first AGAIN now rebuilds the answer first and immediately dissolves that exact
  visible word, so single-tap and rapid-tap behavior match.
- Mobile post-reveal listening/answer content is shifted lower; desktop placement is unchanged.

## v3.26
- Added a home-screen freshness check for iOS/Safari standalone launches:
  - on `pageshow` and when the app returns to the foreground, it fetches a cache-busted `index.html`;
  - if the published `app-build` is newer, it force-reloads that build;
  - offline/network failures never block study.
- Added web-app metadata/manifest for home-screen standalone use.
- Removed the pre/post reveal speaker/arrow size animation.
- Mobile only: before reveal, the upper `‹` / `›` controls are hidden and duplicated beside `查看答案` as purple outline buttons.
- After reveal, mobile returns to the existing upper `‹ 🔊 ›` layout.
- Desktop pronunciation controls and layout remain unchanged.

## v3.26
- Home screen reordered around study priority:
  1. learning card
  2. traffic-light progress bar
  3. app name/version + status legend
- Removed the red flag marker.
- Progress bar now uses the same semantic colors as the status legend:
  - green = 已掌握
  - yellow = 学习中
  - red = 未学习

## v3.26
- Adopted the approved preview layout: top traffic progress + horizontal status legend.
- Removed the in-card ellipsis menu and utility row.
- Moved Rules/Progress, Sync, Import, Reset Progress, and version into a quiet website-style footer separated by ｜.
- Renamed 重置本机 to 重置进度.
- Removed the bottom app-name/status block.

## v3.26
- Simplified AGAIN debt feedback color: +1 now stays blue (#47719a).
- Removed the brown intermediate visual, so debt 1 → debt 2 reads as gray initial state → blue final state.

## v3.26
- Debt number updates earlier after +1/−1: 240ms instead of 430ms.
- Repeated-tap impact starts earlier as well.
- Removed the `offsetWidth` forced reflow used to restart the debt impact animation.
- Debt impact now uses Web Animations API for smoother repeated taps.

## v3.26
- Importer now skips any line containing Chinese characters.
- Phrases remain valid: one line equals one vocabulary entry.
- Duplicates inside the same TXT are deduplicated and do not stack debt.
- Existing Unseen words remain Unseen with conceptual debt 1; importing them does not increase debt.
- Existing Active words receive debt +1 when re-imported.
- Existing Mastered words are reactivated at debt 1 when re-imported.
- Import toast reports new entries, unseen duplicates, Active debt increases, reactivated Mastered entries, invalid lines, and in-file duplicates.


## v3.29.3 CSV / Eudic import
- The vocabulary importer accepts both TXT and CSV.
- Eudic-style CSV columns `单词,音标` are recognized directly.
- `英:` and `美:` IPA values map to the existing UK/US chips; an unlabelled IPA maps to the generic chip.
- Imported IPA is saved in `state.customPronunciations`, synced privately through `progress.json`, and takes priority over the static Wiktionary pronunciation database.
- The pronunciation updater skips Wiktionary requests for cloud words that already have imported IPA.
- Existing v3.26 duplicate/debt semantics remain unchanged.


## v3.29.3
- Added `lookup.html`: exact case-insensitive word/phrase lookup with learning status, debt, peak, source, IPA, TTS, dictionary/context links, and editable Note.
- Lookup is read-only for learning evidence: listening and dictionary use never change debt or Mastered state.
- Missing valid English entries can be added directly to `customWords` as Unseen (conceptual debt 1); removed entries can be restored without losing history.
- Added `notes.html`: lists every non-empty Note with status, direct editing/deletion, and links into Lookup.
- Added Lookup and Notes entries under Rules / Progress.

## v3.29.3
- Mobile Lookup search button uses a compact 🔍 icon while desktop keeps “查询”.
- Historical note: this version placed 查询词条 in the footer and 重置进度 in 规则 / 进度; v4.1.2 later replaces that navigation with 词库 / 学习记录 / 设置.
- Active and Mastered word names link directly to Lookup.
- Notes sort removed entries after all current-library entries.
- Notes, Active, Mastered, and Removed lists paginate at 20 entries per page.


## v3.29.3
- Moved Reset Progress to the end of the Rules / Progress explanation so destructive action is only reached after scrolling through the information.
- Expanded all 20-item paginators with First, Previous, direct page jump, Next, and Last controls.
- Direct page jump accepts a page number and clamps it to the valid range.

## v3.29.3
- Lookup submit uses 🔍 on both desktop and mobile.
- Pagination jump uses ➡️ on both desktop and mobile.
- Footer “查询词条” is plain text, consistent with the other footer links.
- Reset is a full-width entry-style “🔄 重置进度” button after the rule text.

## v3.29.3
- Fixed iOS/PWA stale secondary-page caching that could keep old blank mobile controls.
- Query and pagination jump labels are direct text nodes with explicit iOS text color.
- Secondary-page links are build-cache-busted.
- Secondary pages now carry build metadata and freshness checks.


## v4.1.2
- 学习记录支持每天最多 3 条链接笔记，月历显示链接数量，日详情可添加/删除。
- 学习记录页底部加入 Zing Calendar 友情链接。
- GitHub 同步改为单一“同步”操作，使用设备本地同步基线进行三方合并，减少跨设备覆盖风险。
- 使用喇叭 emoji SVG favicon，替代浏览器默认字母图标。


## v4.1.2
- Adds real PNG app icons / Apple touch icon for home-screen installation.
- Adds one-click restore of the latest pre-sync local backup.
- Treats learned→unseen cross-device regressions as conflicts instead of silently accepting them.


### v4.1.2
- Sync preview now shows only absolute counts for Local / GitHub / Merged; removed ambiguous change labels.
- Mobile learning-history month cells use fixed date/indicator/total rows; link notes are shown as a small dot below the date.
- Lookup prefix suggestions use a classic vertical search suggestion list, one result per row.


## v4.1.2
- 首页搜索框移至学习进度条下方；桌面端靠右，移动端铺满。
- 学习记录在月/年切换旁显示当前期间的完成、新词、复习总量，直接汇总 `dailyStats`。

## v4.1.2
- Added manual pronunciation correction UI on the study answer and lookup detail views.
- Manual pronunciation metadata uses the existing `state.customPronunciations` syncable state.
- Each word is limited to three fixed IPA fields: UK, US, and optional generic IPA override; no unbounded pronunciation list is created.
- Regional IPA takes display priority. Clearing manual correction restores the public pronunciation database without modifying it.


### v4.1.2
Pronunciation layers are separated: manual override > imported Eudic > Wiktionary. Clearing a manual correction now reveals the imported Eudic pronunciation when present, otherwise the original Wiktionary pronunciation. Existing v3.32.2 manual entries are migrated automatically by `source: "manual"`.


## v4.1.2
- 易混词页新增整组朗读 `< ▶️ >`：依次朗读主词和其易混词，左右箭头与主页共享 voiceIndex。
- 页头新增“朗读设置”，可自定义组内单词之间的停顿时间；该偏好仅本机保存，不进入学习/同步数据。


### v4.1.2
- 易混词页改为页头仅显示一个全局 Voice。
- 每组仅保留 ‹ ▶️ ›；左右切换全局 Voice 后立即用新 Voice 重新朗读当前组。
- 移除每行重复 Voice 文本，并让朗读语言跟随所选 voice.lang。

### v4.1.2
- 易混词朗读控制改为统一 SVG 图标按钮，避免 emoji/字体造成的错位。
- 学习中、已掌握新增连续播放弹窗：支持跨分页从任意词开始、从头、上一个/下一个、停止/继续、全局 Voice 切换、每词 1–5 次循环和 0–5000 ms 停顿。
- 连续播放器的位置与朗读偏好仅保存在本机，不写入学习进度。

### v4.1.2
- Mobile continuous-player dialog now opens near the top of the viewport instead of bottom/vertical centering.
- Added viewport-aware max height and internal scrolling so playback settings remain reachable on smaller phones.


## v4.1.2
- Added custom colored tags. Words can have multiple tags.
- Added Library → Tags for create/edit/delete/browse.
- Added tag editing on revealed words and Lookup.
- Tags and word-tag relations participate in GitHub sync; tags never affect scheduler state.


### v4.1.2
- 标签颜色固定为 15 色预设色板，不提供任意颜色选择。
- 背词主页标签收纳到左上角状态徽章区域，并以“＋”进入管理。
- Lookup 返回按钮优先回到实际进入 Lookup 前的页面，直接打开时回退到背词主页。

- v4.1.2: compact Lookup tags into inline chips and prevent mobile home tag controls from wrapping into the speaker area.
