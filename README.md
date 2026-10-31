# Stint

A focus timer for Windows that ties every session to what you meant to do, asks how it went, and shows where your day actually went.

![Stint's timer on desktop and phone: a lavender window with a "What are we working on?" form, recent tasks and the next calendar event on the left, a flower-shaped dial reading 25:00 with the mascot Pip in the middle and a Timer or Flow switch under it, and a timeline of today's sessions and calendar events along the bottom. A phone-sized version of the same screen sits on the right with a bottom tab bar.](screenshots/preview.png)

**[Live demo](https://rachelmgaldino.github.io/stint/)** (the web build, with sample sessions and a pretend calendar, kept in your browser)

## Overview

I plan my day in focus sessions: say what I'm about to do, run a timer, note how it went, and look back at where the time went. The app I used for this has no Windows version, and my working machine runs Windows, so I built my own as a native desktop app. It keeps the habit I already had and adds a layout and look of its own.

## Features

- Drag a dot around the dial to set a session of up to 3 hours, or to change the time left while it runs
- Flow mode for focus that counts up with no time limit
- An intention and a category for each session, with recent tasks to pick from and a daily goal drawn in each look's own style
- Next task switches tasks inside a session, from the app or the floating pill, and Split does it afterwards, so the day shows the real time per task
- Sessions and breaks keep counting into overtime until you end them, so stopping is always a choice
- Short and long breaks: the long one comes once enough focus has piled up today
- Reminders: a heads-up before the end, a presence sound during focus, and nudges when a session, a break or a pause runs too long
- A floating timer, as a round bubble or a pill at the top of the screen, while Stint is minimized or in the tray
- A short reflection afterwards (what got done, how it felt), which can be switched off
- Add or edit past sessions and breaks by hand, and move the start of a running session if you started the timer late
- Analytics by day, week and month: a timeline of the day with notes and breaks, focus by category and task, and change from the previous period
- Export a day as a CSV, or copy a short summary
- Two-way link with Google Calendar: sessions from the categories you choose are written to a calendar you pick, and your calendar's events show beside your sessions, where a past one can count as focus
- Updates itself: Settings checks GitHub for a newer version and Update now installs it and restarts, with a quiet check when it opens and every six hours
- Four looks (Lavender with Pip, Mochi the cat, Notebook with Memo the sticky note, Riso with a mushroom by day and a ghost by night), each with light, dark and match-Windows themes, in English or Portuguese (Brazil)
- Mascots warm up after an hour of focus and overheat after two, as a nudge to take a break
- A Size setting from 70% to 150%, also on Ctrl +, Ctrl - and Ctrl 0

![The timer in all four looks: Lavender in its dark plum theme, Mochi with a cat in the dial on sage-green paper, Notebook with a sticky note on a ruled page and a doodled dial, and Riso with a mushroom on a pink and blue print.](screenshots/looks.png)

![The Analytics Day view: tiles for time focused, how the sessions felt and the day's rhythm; a vertical timeline of sessions, calendar events with a Count as focus button, tasks switched with Next task, and the breaks and free gaps between them; and a side column with this week's totals and where the time went by category and task.](screenshots/analytics-day.png)

## How it works

**A desktop app, not a website.** A focus timer has to keep time while its window is hidden and notify you when it's done. Browsers throttle timers in background tabs, so a web page can be late to tell you a session is over, and it stops entirely once the tab is closed. Stint is a [Tauri 2](https://tauri.app) app: a Rust process owns the windows, the tray icon and the alarms, and the interface is React running in the system's WebView. It uses the WebView2 runtime that already ships with Windows instead of bundling a whole browser the way Electron apps do.

**Time comes from the wall clock, not from ticks.** The timer state (`src/timer.ts`) stores when a session started and how long it was paused, and computes what's left from `Date.now()`. A hidden window, a laptop going to sleep or a slow frame can't make it lose time. The alarms (the end of a session or break, the heads-up, the nudges and the presence sound) are scheduled in Rust (`src-tauri/src/lib.rs`) in short naps against the wall clock, so a laptop that sleeps through the end still notifies the moment it wakes, even with the window closed to the tray.

**A floating timer that stays out of the way.** While Stint is minimized or in the tray, a second frameless, see-through window (`src-tauri/src/float.rs`) shows the running session as a bubble, or as a pill at the top of the screen. The window keeps one size and never moves on its own, so the bubble stays put when its buttons open. At rest it lets clicks through to the apps underneath, and Rust checks the pointer every 50ms to open it once the pointer reaches the bubble. The pill snaps to the middle of the screen or docks to a side with a fixed 9px gap.

**One session, several tasks.** Next task closes the task you're on and starts another while the timer keeps going. Each task is saved as its own record, linked to the others by the session's start (`partOf`, handled in `src/tasks.ts`), so the day shows the exact time per task while session counts, ratings and the Google Calendar event still treat them as one session. Split does the same afterwards, for a saved session where the switch wasn't marked.

**Google sign-in without a server.** Calendar access uses OAuth for installed apps: Stint opens a one-time loopback port on `127.0.0.1`, sends you to Google with a PKCE challenge, and catches the redirect itself (`src-tauri/src/google.rs`). The refresh token goes into Windows Credential Manager, never into the app's database or the interface. The UI asks Rust to make Calendar requests on its behalf and never sees a token, and those requests can only reach Calendar endpoints. Each person supplies their own Google OAuth client, so there's no shared secret in the repository and no third party in the middle.

**Updates that can't be swapped.** Stint updates itself from GitHub Releases with Tauri's updater (`src-tauri/src/updates.rs`). The Release workflow, which runs each time a pull request is merged, signs the installer with a private key kept only in GitHub Actions secrets and publishes a `latest.json` next to it; the app holds the matching public key and refuses any installer whose signature doesn't match. By default it only looks at the latest published release. Turning on "Test builds" also offers the pre-release built for each open pull request: those are signed the same way, carry a version like `1.4.4-pr.49.120` (newer than the release they were built on, older than the one that ships them), and turning the switch off offers the release again to go back.

**Your data stays on your machine.** Sessions, categories and settings live in a local SQLite file, with the schema in versioned migrations. There's no account and no sync service. Events Stint writes to Google are tagged with a private property, so when it reads your calendar back it skips its own sessions instead of showing them twice. A session counted from an event remembers that event, so it stops showing and sync doesn't add a second copy.

**One interface, three places.** The same React code runs as the desktop app, as `npm run dev` in a browser (with data in localStorage instead of SQLite), and as the public demo on GitHub Pages. Below 640px it switches to a phone layout with a bottom tab bar and bottom sheets, which is what the demo shows on a phone.

## Tech

- **Desktop shell:** Tauri 2 and Rust (tray, notifications, single instance, floating window, save dialog, signed self-updates, OAuth with `reqwest`, `keyring`, `sha2`)
- **Interface:** React 19 and TypeScript, built with Vite; plain CSS with custom properties for the four looks and their themes
- **Data:** SQLite through `tauri-plugin-sql`
- **Tests:** Vitest for timer, dial, date, analytics, calendar, alarm, break, task, report and update logic; Rust unit tests for PKCE and the OAuth redirect parser
- **CI:** GitHub Actions tests and builds the Windows installer on every push to main and every pull request, attaches a test installer to pull requests from this repo, publishes a versioned GitHub Release (with a version bump) of everything merged since the last one each time a pull request is merged, and deploys the web demo to GitHub Pages

## Running it locally

### Prerequisites

- Node.js 22.12 or newer, on an even-numbered release (22, 24, 26)
- Rust (stable), only for the desktop app
- On Windows, the WebView2 runtime (already present on Windows 10 and 11)

```bash
git clone https://github.com/rachelmgaldino/stint.git
cd stint
npm install
npm run dev           # the interface in a browser, data kept in localStorage
npm run tauri dev     # the desktop app with hot reload
npm test              # unit tests
npm run tauri build   # Windows installer in src-tauri/target/release/bundle
```

To try it without building, download the `.exe` from the [latest release](https://github.com/rachelmgaldino/stint/releases/latest) and run it. It isn't code-signed, so SmartScreen will ask you to confirm. Data lives in `%APPDATA%\com.rachelmgaldino.stint\stint.db` and survives updates.

### Google Calendar

Optional. You need your own OAuth client: in Google Cloud Console, enable the Google Calendar API, set up the consent screen as External and publish it, then create an OAuth client of type **Desktop app**. Paste its client ID and secret into **Settings, Google Calendar** and click **Connect**. Stint asks only to read your calendar list and manage events; **Disconnect** deletes the stored token and revokes it at Google.

### Updates

Every merged pull request ends up in a release: a patch version by default, or minor or major when the PR has that label (`no release` skips it). Pull requests merged close together go out as one release, and the highest label among them sets the version. Releases are signed so installed copies can update themselves. The Release workflow needs two repository secrets, `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and stops before bumping the version if the key is missing. The public half is `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`. Pull request builds use the same secrets to sign their test builds; without them a test build still installs by hand but isn't offered in the app. A fork needs its own key pair (`npx tauri signer generate`) and its own endpoint.

## What I'd improve

- [ ] No blocking of distracting apps or websites during a session yet. It's the feature I'd add next
- [ ] No global hotkey: Space and the arrow keys only work while the window has focus
- [ ] If a calendar write fails (for example, Google revoked the sign-in), it's only logged, and new events are retried on the next sync. The app should say so and offer to reconnect
- [ ] The installer isn't code-signed, so every new version triggers a SmartScreen warning
- [ ] Windows only. The phone layout exists, but there's no iPhone build yet

AI disclosure: Stint was built with Claude Code. I set the product direction and design, and reviewed, tested and merged every change; Claude drafted much of the implementation.

## Contact

**Rachel Galdino**
- Email: [rachel.galdino@proton.me](mailto:rachel.galdino@proton.me)
- LinkedIn: [linkedin.com/in/rachel-galdino](https://www.linkedin.com/in/rachel-galdino/)
- GitHub: [github.com/rachelmgaldino](https://github.com/rachelmgaldino)
