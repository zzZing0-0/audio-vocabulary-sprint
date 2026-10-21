# Zing GitHub Sync Provider — v0.9.4

## Purpose
Use a dedicated **private** GitHub repository as the first cloud transport for Zing.

Default data object:

`zing/sync-bundle.json`

The existing local-first IndexedDB database remains usable offline.

## Runtime configuration

```ts
{
  owner: "your-github-user",
  repo: "zing-data",
  branch: "main",
  path: "zing/sync-bundle.json",
  token: "<runtime-only credential>"
}
```

The provider does **not** persist the token. Do not hard-code a PAT in the source,
commit it, place it in localStorage, or publish it in a GitHub Pages bundle.

## First sync
If the remote bundle does not exist, the provider creates it from local Zing data.
If it exists, Zing merges remote data locally first and then writes the merged
canonical bundle back to GitHub.

## Concurrency
GitHub Contents API SHA preconditions are used when updating an existing bundle.
If another device writes between read and write, GitHub rejects the stale write
instead of silently overwriting it. A later release can retry by re-pulling and
re-merging.

## Attachments
v0.9.4 synchronizes structured Zing records only. Binary image/audio upload is
intentionally deferred to a separate attachment provider.
