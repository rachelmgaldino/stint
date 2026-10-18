# Stint

A focus timer for Windows, modelled on the features of the Session app: pick
what you're working on, run a timer, reflect when it ends, and look back over
your day.

Built with [Tauri 2](https://tauri.app) (Rust shell) and React + TypeScript.
Everything is stored locally in SQLite.

## Features

- Two-pane desktop layout: the timer on the left, your day on the right
- Drag the dial to set a session's length, or to change the time left while it runs
- Pause and resume; sessions and breaks keep counting into overtime until you end them
- A category and an intention for each session, and daily goal dots
- A reflection after each session: what you got done and how it went (can be
  turned off, with a default mood)
- Day timeline with a week strip, daily totals and rating counts
- Click a session to edit or delete it; add a session you forgot to time with +
- Analytics by day, week or month: total and average focus, breaks, focus/break
  ratio, rating counts, most focused and most distracted category, focus by day,
  category and intention breakdowns with change from the previous period, and
  the session list with notes, a notes-only toggle and a category filter
- A mini timer bar along the bottom while you're on other screens
- Notifications when a session's time is up or a break is over, even while
  Stint is in the tray
- Google Calendar: add your sessions to a calendar you pick, and see your
  calendars' events beside your sessions (click one to set up a session for it)
- Tray icon: hover for the time left; closing the window keeps the timer running
- Light, dark or match-Windows theme
- Space starts, pauses and resumes the timer; arrow keys adjust the dial

## Install on Windows

Each push builds an installer in GitHub Actions. Open the latest run of the
**Build** workflow, download the `stint-windows-installer` artifact, unzip it
and run the `.exe` (or the `.msi`). Windows SmartScreen may warn because the
installer is not code-signed; choose "More info" then "Run anyway".

## Google Calendar setup

Stint signs in to Google with an OAuth client that you own, so no third party
is involved. You do this once.

1. Go to <https://console.cloud.google.com/>, and create a project (any name,
   for example "Stint").
2. **APIs & Services → Library**: search for **Google Calendar API** and click
   **Enable**.
3. **APIs & Services → OAuth consent screen** (also called **Google Auth
   Platform**): choose **External**, fill in the app name and your email, and
   add yourself under **Test users** (or **Audience**).
4. On the same screen, click **Publish app** so its status is **In
   production**. Google doesn't need to verify it for your own use; you'll see
   an "unverified app" warning when you sign in, which you can pass with
   **Advanced → Go to Stint**. Without this step Google signs you out every 7
   days.
5. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   application type **Desktop app**. Copy the **Client ID** and **Client
   secret**.
6. In Stint, open **Settings → Calendar**, paste both and click **Connect**.
   Your browser opens to sign in; when it says Stint is connected, go back to
   the app and pick the calendar for your sessions.

Stint only asks to read your calendar list and to manage events. The sign-in is
kept in Windows Credential Manager; **Disconnect** removes it and revokes it at
Google.

## Updating

Run a newer installer over the installed app. It updates in place and keeps
your sessions, which live in your user folder (see below).

## Develop

Requirements: Node.js 22+, Rust (stable), and on Windows the WebView2 runtime
(already present on Windows 10/11).

```sh
npm install
npm run tauri dev     # desktop app with hot reload
npm run dev           # just the UI in a browser, data kept in localStorage
npm test              # timer logic tests
npm run tauri build   # installer in src-tauri/target/release/bundle
```

## Where data lives

`%APPDATA%\com.rachelmgaldino.stint\stint.db` on Windows. The schema is defined
by the migrations in `src-tauri/src/lib.rs`.

## Roadmap

1. Timer, focus goal, reflection, dark mode, desktop layout (done)
2. Full history and analytics (done)
3. App and website blocking
4. Global hotkeys, Do Not Disturb, Slack and music (Google Calendar done)
