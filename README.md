# Stint

A focus timer for Windows, modelled on the features of the Session app: pick
what you're working on, run a timer, reflect when it ends, and look back over
your day.

Built with [Tauri 2](https://tauri.app) (Rust shell) and React + TypeScript.
Everything is stored locally in SQLite.

## Features

- Two-pane desktop layout: the timer on the left, your day on the right
- Drag the dial to set a session's length, or to change the time left while it runs
- Pause and resume; a focus session keeps counting into overtime until you finish it
- A category and an intention for each session, and daily goal dots
- A reflection after each session: what you got done and how it went
- Day timeline with a week strip, daily totals and rating counts
- Click a session to edit or delete it; add a session you forgot to time with +
- Notification and chime when time is up
- Tray icon: hover for the time left; closing the window keeps the timer running
- Light, dark or match-Windows theme
- Space starts, pauses and resumes the timer; arrow keys adjust the dial

## Install on Windows

Each push builds an installer in GitHub Actions. Open the latest run of the
**Build** workflow, download the `stint-windows-installer` artifact, unzip it
and run the `.exe` (or the `.msi`). Windows SmartScreen may warn because the
installer is not code-signed; choose "More info" then "Run anyway".

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
2. Full history and analytics
3. App and website blocking
4. Global hotkeys, Do Not Disturb, calendar, Slack and music
