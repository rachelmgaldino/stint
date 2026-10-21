//! Updates from GitHub Releases. The updater reads latest.json from the latest
//! published release (pre-releases such as the pr-N test builds never count),
//! checks the installer's signature against the public key in tauri.conf.json,
//! and runs it. On Windows the installer closes Stint, upgrades it in place and
//! opens it again.

use serde::Serialize;
use std::sync::Mutex;
use tauri::{ipc::Channel, AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

/// The update found by the last check, kept until it is installed.
#[derive(Default)]
pub struct Pending(Mutex<Option<Update>>);

#[derive(Serialize)]
pub struct Found {
    version: String,
    notes: String,
}

/// Looks for a newer version. Returns None when Stint is up to date.
#[tauri::command]
pub async fn update_check(app: AppHandle, pending: State<'_, Pending>) -> Result<Option<Found>, String> {
    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    let found = update.as_ref().map(|u| Found {
        version: u.version.clone(),
        notes: u.body.clone().unwrap_or_default(),
    });
    *pending.0.lock().unwrap() = update;
    Ok(found)
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
    let kept = pending.0.lock().unwrap().take();
    // A failed install used up the found update, so look again for a retry.
    let update = match kept {
        Some(u) => u,
        None => app
            .updater()
            .map_err(|e| e.to_string())?
            .check()
            .await
            .map_err(|e| e.to_string())?
            .ok_or("No update to install")?,
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
