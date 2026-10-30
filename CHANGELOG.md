# Changelog

## 2026-10-30

Releases now ship batches of a tested commit. GitHub kept only one pending run per concurrency group, so merging several PRs at once could lose a version label, leave merged code unreleased or publish an empty version (v1.4.8). A non-atomic push could also leave an orphan tag that blocked every later release. Each run now waits its turn, ships everything new since the last version from the exact commit it tested, and pushes main and the tag together or not at all.
