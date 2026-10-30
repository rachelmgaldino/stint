# Changelog

## 2026-10-30

- Events added from Stint are left untagged: Stint hides events it tagged, so a tagged meeting would vanish from your own timeline.
- Edits use PATCH instead of PUT: PUT replaces the whole event, which would wipe the description, location and reminders Stint doesn't manage.
- Events with guests, events organized by someone else, and repeating events stay read-only in Stint: the guest-notification and this-or-all-occurrences choices live in Google.
- New events get a client-made id, so retrying after a lost response can't create a duplicate.
- Stint waits for Google to finish creating a Meet link, because conferences are created in the background and can fail after the event is saved.
- The timeline returns to today whenever a session runs, because the slim bar always says Today.

Releases now ship batches of a tested commit. GitHub kept only one pending run per concurrency group, so merging several PRs at once could lose a version label, leave merged code unreleased or publish an empty version (v1.4.8). A non-atomic push could also leave an orphan tag that blocked every later release. Each run now waits its turn, ships everything since the last published version from the exact commit it tested, and pushes main and the tag together or not at all. A run stops with an error if it can't find its own PR. A release now stays a draft until both of its files are uploaded, and an older version published late never takes Latest.
