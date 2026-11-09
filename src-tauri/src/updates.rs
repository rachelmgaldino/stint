//! Updates from GitHub Releases. The updater reads latest.json from the latest
//! published release, checks the installer's signature against the public key
//! in tauri.conf.json, and runs it. On Windows the installer closes Stint,
//! upgrades it in place and opens it again.
//!
//! With "Test builds" on in Settings, Stint can also install the "PR #N test"
//! pre-release of an open pull request. Those carry their own latest.json and a
//! version like 1.4.4-pr.49.120 (the next patch, the PR and the build), so a
//! test build counts as newer than the release it was built on and older than
//! the release that ships it.

use semver::Version;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{ipc::Channel, AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

const REPO: &str = "rachelmgaldino/stint";

/// How long an update request may wait to connect, or go without receiving
/// anything, before it fails. Without it a connection that stalls quietly keeps
/// the card on "Checking" or "Downloading" until Stint restarts; a slow download
/// that keeps receiving is never cut off.
const STALL: Duration = Duration::from_secs(30);

/// The update found by the last check, kept until it is installed.
#[derive(Default)]
pub struct Pending(Mutex<Option<Update>>);

#[derive(Serialize)]
pub struct Found {
    version: String,
    notes: String,
    /// The pull request of a test build, None for a released version.
    test: Option<u32>,
}

/// Looks for an update. With `test` it looks at that pull request's test build
/// and offers it whenever it differs from what is installed, so switching
/// between test builds works both ways. Without it, it looks at the latest
/// release: newer versions as usual, and from a test build, whatever the
/// release is, to go back to it.
async fn find(app: &AppHandle, test: Option<u32>) -> Result<Option<Update>, String> {
    // The update it finds downloads with these settings too.
    let mut builder = app
        .updater_builder()
        .configure_client(|client| client.connect_timeout(STALL).read_timeout(STALL));
    if let Some(pr) = test {
        let url = format!("https://github.com/{REPO}/releases/download/pr-{pr}/latest.json");
        builder = builder
            .endpoints(vec![url.parse().map_err(|e: url::ParseError| e.to_string())?])
            .map_err(|e| e.to_string())?
            .version_comparator(|current, remote| remote.version != current);
    } else {
        builder = builder.version_comparator(|current, remote| {
            if current.pre.is_empty() {
                remote.version > current
            } else {
                remote.version != current
            }
        });
    }
    builder
        .build()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())
}

/// Looks for a version to install. Returns None when there is nothing to offer.
#[tauri::command]
pub async fn update_check(
    app: AppHandle,
    pending: State<'_, Pending>,
    test: Option<u32>,
) -> Result<Option<Found>, String> {
    let update = find(&app, test).await?;
    let found = update.as_ref().map(|u| Found {
        version: u.version.clone(),
        notes: u.body.clone().unwrap_or_default(),
        test,
    });
    *pending.0.lock().unwrap() = update;
    Ok(found)
}

/// What the Test builds list shows, and what a check needs from the same request.
#[derive(Serialize)]
pub struct TestBuilds {
    /// The newest release, None before the first.
    release: Option<String>,
    /// Newest first.
    builds: Vec<TestBuild>,
    /// Whether a release's notes list the pull request of the installed test build.
    released: bool,
}

#[derive(Serialize)]
pub struct TestBuild {
    pr: u32,
    title: String,
    version: String,
    /// When it was published, as an RFC 3339 time.
    built: String,
    /// The newest release, when this build was made before it.
    before: Option<String>,
}

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    prerelease: bool,
    body: Option<String>,
    published_at: Option<String>,
    assets: Vec<Asset>,
}

#[derive(Deserialize)]
struct Asset {
    name: String,
}

/// Reads `path` from the repository's GitHub API, with the same timeouts as the updater.
async fn github<T: DeserializeOwned>(path: &str) -> Result<T, String> {
    reqwest::Client::builder()
        .connect_timeout(STALL)
        .read_timeout(STALL)
        .build()
        .map_err(|e| e.to_string())?
        .get(format!("https://api.github.com/repos/{REPO}/{path}"))
        .header("User-Agent", "Stint")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())
}

/// Whether release notes link pull request `pr`: ".../pull/87", not ".../pull/870".
fn links(notes: &str, pr: u32) -> bool {
    let link = format!("github.com/{REPO}/pull/{pr}");
    notes
        .match_indices(&link)
        .any(|(i, _)| !notes[i + link.len()..].starts_with(|c: char| c.is_ascii_digit()))
}

/// Whether the list shows a test build of `version`: None leaves it out,
/// Some holds its `before`. A build made before the newest release is left
/// out unless it is the installed one, which shows with that release.
fn listed(version: &str, newest: Option<&Version>, installed: &Version) -> Option<Option<String>> {
    let parsed = Version::parse(version).ok();
    match newest.filter(|n| parsed.as_ref().is_some_and(|v| v < *n)) {
        None => Some(None),
        Some(n) if parsed.as_ref() == Some(installed) => Some(Some(n.to_string())),
        Some(_) => None,
    }
}

/// The open pull requests' test builds that can update Stint, newest first.
/// Builds from before test builds were signed have no latest.json and are left
/// out, and so are builds older than the newest release: a test build is the
/// next patch after the release it was built on, so once a later release is out
/// it sorts below it, and installing it would take Stint back. It is offered
/// again once its pull request is pushed and rebuilt on the newest release.
/// The installed build stays listed even then, marked with that release, so
/// the list can say it waits for a new build.
#[tauri::command]
pub async fn update_test_builds(app: AppHandle) -> Result<TestBuilds, String> {
    let releases: Vec<Release> = github("releases?per_page=50").await?;
    let installed = &app.package_info().version;
    // A test build's version (1.10.7-pr.87.3) carries its pull request.
    let own: Option<u32> = installed
        .pre
        .as_str()
        .strip_prefix("pr.")
        .and_then(|p| p.split('.').next()?.parse().ok());
    // Release notes link the pull requests they ship (GitHub's generated notes).
    let released = own.is_some_and(|pr| {
        releases
            .iter()
            .any(|r| !r.prerelease && r.body.as_deref().is_some_and(|b| links(b, pr)))
    });
    let newest = releases
        .iter()
        .filter(|r| !r.prerelease)
        .filter_map(|r| Version::parse(r.tag_name.strip_prefix('v')?).ok())
        .max();
    let mut builds: Vec<TestBuild> = releases
        .into_iter()
        .filter(|r| r.prerelease && r.assets.iter().any(|a| a.name == "latest.json"))
        .filter_map(|r| {
            let pr = r.tag_name.strip_prefix("pr-")?.parse().ok()?;
            let body = r.body.unwrap_or_default();
            // build.yml writes "Test build of #N: <PR title>" as the first line.
            let first = body.lines().next().unwrap_or_default();
            let title = first.split_once(": ").map(|(_, t)| t.trim().to_string()).unwrap_or_default();
            let version = r.assets.iter().find_map(|a| {
                a.name.strip_suffix("-setup.exe")?.rsplit('_').nth(1).map(str::to_string)
            }).unwrap_or_default();
            let before = listed(&version, newest.as_ref(), installed)?;
            Some(TestBuild { pr, title, version, built: r.published_at?, before })
        })
        .collect();
    builds.sort_by(|a, b| b.built.cmp(&a.built));
    Ok(TestBuilds { release: newest.map(|n| n.to_string()), builds, released })
}

#[derive(Deserialize)]
struct Pull {
    state: String,
    merged_at: Option<String>,
}

/// How pull request `pr` stands on GitHub: "open", "merged", or "closed"
/// without merging. Asked only when its test build can't tell.
#[tauri::command]
pub async fn update_pull_state(pr: u32) -> Result<&'static str, String> {
    let pull: Pull = github(&format!("pulls/{pr}")).await?;
    Ok(match (pull.merged_at, pull.state.as_str()) {
        (Some(_), _) => "merged",
        (None, "open") => "open",
        _ => "closed",
    })
}

/// Opens a pull request's page on GitHub, from the test tag beside the name.
#[tauri::command]
pub fn open_pull_request(app: AppHandle, pr: u32) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(format!("https://github.com/{REPO}/pull/{pr}"), None::<&str>)
        .map_err(|e| e.to_string())
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "camelCase")]
pub enum Progress {
    /// How many bytes arrived so far, and of how many if the server said.
    Downloading { done: u64, total: Option<u64> },
    Installing,
}

/// Downloads and installs the update the last check found. On Windows this
/// does not return: the installer takes over and reopens Stint.
#[tauri::command]
pub async fn update_install(
    app: AppHandle,
    pending: State<'_, Pending>,
    progress: Channel<Progress>,
) -> Result<(), String> {
    // Used up even if the install fails: the app checks again before a retry.
    let update = pending.0.lock().unwrap().take().ok_or("No update to install")?;
    let mut done = 0u64;
    let installing = progress.clone();
    update
        .download_and_install(
            |chunk, total| {
                done += chunk as u64;
                let _ = progress.send(Progress::Downloading { done, total });
            },
            move || {
                let _ = installing.send(Progress::Installing);
            },
        )
        .await
        .map_err(|e| e.to_string())?;
    // Other systems install without quitting, so start the new version.
    app.restart();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn links_match_the_whole_pull_request_number() {
        // From v1.10.7's notes.
        let notes = "* fix(store): save sessions safely by @rachelmgaldino in https://github.com/rachelmgaldino/stint/pull/86\n";
        assert!(links(notes, 86));
        assert!(!links(notes, 8));
        assert!(!links("in https://github.com/rachelmgaldino/stint/pull/870\n", 87));
        assert!(!links("in https://github.com/someone/else/pull/86", 86));
    }

    #[test]
    fn lists_builds_on_the_newest_release_and_the_installed_one() {
        let newest = Version::parse("1.10.7").unwrap();
        let installed = Version::parse("1.10.7-pr.87.2").unwrap();
        // Made on 1.10.7: listed as usual.
        assert_eq!(listed("1.10.8-pr.88.1", Some(&newest), &installed), Some(None));
        // Made before 1.10.7 and installed: listed, waiting for a new build.
        assert_eq!(listed("1.10.7-pr.87.2", Some(&newest), &installed), Some(Some("1.10.7".to_string())));
        // Made before 1.10.7, not installed: left out.
        assert_eq!(listed("1.10.7-pr.86.1", Some(&newest), &installed), None);
        // No release yet, or no version to compare: listed.
        assert_eq!(listed("1.10.7-pr.86.1", None, &installed), Some(None));
        assert_eq!(listed("", Some(&newest), &installed), Some(None));
    }
}
