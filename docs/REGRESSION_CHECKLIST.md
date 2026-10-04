# Regression checklist

## Automated gate
Run:

```bash
npm run check:all
```

This performs JS syntax/static integrity checks, invariant tests, and a real headless-browser study-flow smoke test.

## Manual release smoke test
- Fresh/reloaded home page has no app-owned uncaught exception in Console.
- Reveal a word; PASS changes debt/mastery once and advances.
- Reveal a word; AGAIN plays feedback, changes debt once, and advances.
- Stress-click the same judgment during feedback: feedback repeats, learning data changes only once.
- Undo restores the prior learning state.
- Search → Lookup modal → linked/confusable word → modal Back → close; underlying page state remains.
- Active/Mastered/Confusable/Tags/Notes/Removed pages open.
- GitHub sync preview opens without changing device-local `current/queue/queueDate/voiceIndex` semantics.

## Stop-the-line failures
Do not release when any of these occur: uncaught startup exception; debt becomes null/NaN; judgment changes data more than once; judgment cannot advance; sync unexpectedly regresses learned words; local state key/schema is changed without migration.
