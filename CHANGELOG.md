# Changelog

## 2026-10-30

The title bar now takes the color of the page under it. It belongs to Windows, so a page theme can't reach it, and it sat white or gray above a plum app. The page reads `--ground` and `--ink` and asks Windows to paint the bar. They're read from `.shell`, not the root, because focus sessions turn only the shell to night. The buttons use the window's dark mode attribute instead of Tauri's `set_theme`, which may also change the page's `prefers-color-scheme`: a session's night could then stick after it ended. Keeping the Windows bar also keeps snap layouts and dragging, which a custom bar would have to rebuild.

Releases now ship batches of a tested commit. GitHub kept only one pending run per concurrency group, so merging several PRs at once could lose a version label, leave merged code unreleased or publish an empty version (v1.4.8). A non-atomic push could also leave an orphan tag that blocked every later release. Each run now waits its turn, ships everything since the last published version from the exact commit it tested, and pushes main and the tag together or not at all. A run stops with an error if it can't find its own PR. A release now stays a draft until both of its files are uploaded, and an older version published late never takes Latest.
