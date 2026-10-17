# Stint

A focus timer for Windows, modelled on the features of the Session app: pick
what you're working on, run a timer, reflect when it ends, and look back over
your day.

Built with [Tauri 2](https://tauri.app) (Rust shell) and React + TypeScript.
Everything is stored locally in SQLite.

## Phase 1 features

- Focus and break timers with custom lengths, presets and a duration slider
- Add or remove time while a timer runs (±1 and ±5 minutes)
- Pause and resume; a focus session keeps counting into overtime until you finish it
- A focus goal and a category (editable, with colours) for each session
- A reflection after each session: what you got done and how it went
- Today view with total focused time and the session log
- Notification and chime when time is up
- Tray icon: hover for the time left; closing the window keeps the timer running
- Light, dark or match-Windows theme
- Space starts, pauses and resumes the timer

## Install on Windows

Each push builds an installer in GitHub Actions. Open the latest run of the
**Build** workflow, download the `stint-windows-installer` artifact, unzip it
and run the `.exe` (or the `.msi`). Windows SmartScreen may warn because the
installer is not code-signed; choose "More info" then "Run anyway".

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

1. Timer, focus goal, reflection, dark mode (this release)
2. Full history and analytics
3. App and website blocking
4. Global hotkeys, Do Not Disturb, calendar, Slack and music
