# Zing Calendar architecture map

This file is the maintenance map for the post-v1.10 refactor. The goal is not to make every React concern a separate file; it is to keep business rules testable and make future edits easy to locate without reopening stable interaction code.

## Runtime shape

Zing Calendar is local-first. IndexedDB is the primary local data store. Private GitHub sync is the structured-data ledger, and private Backblaze B2 stores binary attachments. Vercel serves the UI/auth/API relay. Do not move structured data to a remote database merely to simplify UI code.

`App.tsx` is intentionally the composition/orchestration layer. It owns cross-feature React state, browser effects, modal/view coordination, IndexedDB hydration/persistence, sync/backup orchestration, attachment UI, and the continuous-calendar/Day Detail interaction state machine. A large line count alone is not a reason to split it further.

## Where business rules live

- `domain/task.ts` — task recurrence/materialization, date-task rules, overdue/deadline logic, sorting, task/Focus duration helpers.
- `domain/calendar.ts` — lunar/solar calendar annotations and anniversary occurrence/page rules.
- `domain/tags.ts` — tag invariants, scope/filtering, task-vs-journal fallback semantics.
- `domain/journal.ts` — journal defaults, mood/energy toggles, journal date ordering/maps.
- `domain/menstrual.ts` — menstrual period prediction, visual state and day-log patching.
- `domain/focus.ts` — direct Focus session timing, completion and history aggregation.
- `domain/environment.ts` — daily weather/thermal/location record rules and option management.
- `domain/search.ts` — search parsing, snippets, entity matching and result construction.
- `domain/statistics.ts` — statistics range boundaries and aggregate calculations.
- `domain/import.ts` — Dida/Forest/import parsing and normalization.
- `domain/backup.ts` — backup ZIP/JSON/CSV/filename helpers.
- `domain/preferences.ts` — environment defaults, system/import tags and preference normalization.
- `domain/settings.ts` — synchronized-settings normalization, word-clock conflict metadata and equality rules.
- `domain/sync.ts` — entity identity and deterministic structured-data diff planning.
- `hooks/useAppPreferences.ts` — scalar UI preferences backed by localStorage.
- `types.ts` — shared application data contracts.
- `db/calendar.ts` — IndexedDB persistence APIs.

## High-risk interaction invariants

Do not casually rewrite the mobile calendar/Day Detail state machine in `App.tsx`.

- `selectedDate` is the single selected-day state.
- `dayDetailOpen` controls whether Day Detail is open; persistent selection must not imply an open drawer.
- Tapping any calendar date always selects it and opens Day Detail.
- Closing Day Detail keeps the selected date.
- Mobile touch locking and bottom-navigation visibility depend on `dayDetailOpen`, not on `selectedDate`.
- Cached continuous-calendar JSX calls the current date-opening handler through its ref; avoid reintroducing a stale closure.
- Pending close timers must be cancelled before reopening Day Detail.

Focus also has a protected interaction invariant: the just-used Focus tag remains selected after finishing a session and after reopening Focus.

## Sync and storage boundaries

- Keep `/api/*` outside PWA caching.
- GitHub structured sync goes through `/api/github-sync`; the token remains device-owned.
- B2 attachment signing/access is a separate backend security boundary; do not restore the old GitHub binary fallback.
- Backup restore and remote sync can update settings outside `useAppPreferences`; preserve that cross-layer behavior when changing preferences. Shared settings normalization belongs in `domain/settings.ts`, while IndexedDB/GitHub side effects remain orchestration concerns.
- Sync diff identity/planning belongs in `domain/sync.ts`; persistence of tombstones/change rows remains in the orchestration/database boundary.

## Refactor completion rule

The v1.10 refactor deliberately stops before splitting orchestration merely to reduce `App.tsx` line count. v1.10.18 is the consolidated stabilization endpoint for this refactor line. New extraction is justified only when it creates a clear feature boundary, lowers change risk, or makes independently testable behavior explicit. Avoid a forest of tiny hooks/components with heavy parameter plumbing.

For future changes: edit the relevant domain module first when the change is a business rule; edit `App.tsx` when the change is cross-feature orchestration or UI state; add/update a targeted regression test for changed invariants; then run the full build and mobile regression suite.

## Data-safety regression tests

Sync and backup are treated as high-risk data-integrity surfaces. The Playwright suite includes isolated multi-device IndexedDB sync tests, GitHub proxy/provider integration tests with a fake cloud ledger, golden heterogeneous life-data fixtures, and full-backup validation/round-trip/restore tests. New changes to sync, tombstones, merge rules, backup manifests, restore parsing, or attachment backup handling should extend these tests rather than relying on manual observation.

## API security boundary (v1.10.20)

- `/api/github-sync` is a narrow GitHub relay, not a general proxy. It accepts only the Contents endpoint used by the sync bundle and Git Blob reads used for large bundles, rejects path traversal/extra query parameters, validates PUT bodies, caps request/token/path/body sizes, and rejects browser cross-site requests.
- `/api/b2-sign` signs only recognized immutable Zing attachment keys and GET/HEAD/PUT operations. Browser cross-site requests are rejected and signing failures never return server-secret/configuration details.
- The obsolete `/api/attachments` signer was removed; there must be one B2 signing surface.
- Long-lived B2 credentials remain server-only. GitHub tokens remain device-owned and are never logged by the relay.
- Deployment/session authentication remains an outer security boundary. These API checks are defense-in-depth and abuse-surface reduction; same-origin headers alone are not authentication.
- Any future API change must add/extend `security-api.spec.ts` and preserve normal GitHub/B2 regression coverage.

## Attachment lifecycle (v1.10.21)
- An attachment is **active** whenever at least one non-trashed Task/Journal reference remains.
- It is shown in the attachment **Recycle Bin** section only when references still exist but every remaining reference is trashed. Restoring any live reference makes it active again.
- A permanently deleted occurrence no longer keeps its attachment alive.
- A B2 object with no structured-data reference is an **orphan**. Orphan deletion is never automatic: Settings exposes an explicit one-click cleanup, with a pre-delete confirmation and a reminder to sync first.
- B2 garbage collection lists only allowlisted Zing attachment keys and deletes only keys absent from the client-supplied current reference set. Attachment metadata/reference rules must remain covered by regression tests.

### v1.10.22 — review-before-delete B2 orphan cleanup
- Settings places **清理 B2 孤儿附件** immediately above **清空所有数据**, keeping destructive maintenance actions together.
- B2 GC is now two-phase: `preview` lists currently unreferenced allowlisted attachment keys without deleting them; `delete` accepts the reviewed keys and re-computes orphan status before deletion.
- The preview obtains short-lived GET/HEAD URLs through the existing B2 signer so recognizable images can be viewed and audio can be played before deletion; unknown objects still expose their storage key and metadata when available.
- Delete-time revalidation prevents a file that regained a structured reference after preview from being removed.


### v1.10.22 overlay regression fix
- The orphan cleanup dialog reuses the validated `storage-browser-layer` overlay stacking model so its backdrop stays below the interactive dialog. A mobile Playwright regression test verifies that the dialog close control remains clickable.

### v1.10.23 Mobile presentation polish
- Encouragement-card actions use a full-width, right-aligned action row on mobile so Edit/Delete stay aligned across message lengths.
- Focus history treats the ordinary focus tag as the primary identity. Task/direct-focus origin is secondary metadata (`任务 · <title>` or `自由专注`) alongside duration.
- Presentation contracts are covered by a focused regression spec.
