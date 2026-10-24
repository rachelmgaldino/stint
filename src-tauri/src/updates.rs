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

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{ipc::Channel, AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

const REPO: &str = "rachelmgaldino/stint";

/// The update found by the last check, kept until it is installed, and which
/// test build that check was for (None for the released version).
#[derive(Default)]
pub struct Pending(Mutex<(Option<Update>, Option<u32>)>);

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
    let mut builder = app.updater_builder();
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
    *pending.0.lock().unwrap() = (update, test);
    Ok(found)
}

#[derive(Serialize)]
pub struct TestBuild {
    pr: u32,
    title: String,
    version: String,
    /// When it was published, as an RFC 3339 time.
    built: String,
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

/// The open pull requests' test builds that can update Stint, newest first.
/// Builds from before test builds were signed have no latest.json and are left out.
#[tauri::command]
pub async fn update_test_builds() -> Result<Vec<TestBuild>, String> {
    let releases: Vec<Release> = reqwest::Client::new()
        .get(format!("https://api.github.com/repos/{REPO}/releases?per_page=50"))
        .header("User-Agent", "Stint")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
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
            });
            Some(TestBuild { pr, title, version: version.unwrap_or_default(), built: r.published_at? })
        })
        .collect();
    builds.sort_by(|a, b| b.built.cmp(&a.built));
    Ok(builds)
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
    let (kept, test) = std::mem::take(&mut *pending.0.lock().unwrap());
    // A failed install used up the found update, so look again for a retry.
    let update = match kept {
        Some(u) => u,
        None => find(&app, test).await?.ok_or("No update to install")?,
    };
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
