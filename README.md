# Audio Vocabulary Sprint v3.4

Structure:
- `index.html` — page structure only
- `css/style.css` — styles
- `data/vocabulary.js` — built-in 3453-word base vocabulary
- `js/app.js` — learning logic, scheduling, local storage, import, GitHub sync

Persistence contract:
- Existing localStorage key is intentionally unchanged: `audio_vocab_sprint_universal_v3`
- GitHub `progress.json` remains the learning archive.
- v3.4 adds `state.customWords` for permanently imported word lists.
- Older v3.3 saves are migrated automatically with `customWords: []`.
- Existing `mastered`, `debts`, `seen`, `highestDebt`, `lastReviewedDate`, `queue`, and `voiceIndex` are preserved.

Deployment:
Copy this folder's contents to the repository root, replacing the old single `index.html`.
