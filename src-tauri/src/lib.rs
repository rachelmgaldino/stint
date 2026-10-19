mod google;

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_sql::{Migration, MigrationKind};

const TRAY_ID: &str = "main";

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create categories, sessions and settings",
        sql: "
            CREATE TABLE categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                color TEXT NOT NULL,
                archived INTEGER NOT NULL DEFAULT 0
            );
            INSERT INTO categories (name, color) VALUES
                ('Work', '#e8594f'), ('Study', '#4f8ee8'), ('Personal', '#52b788');
            CREATE TABLE sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL CHECK (kind IN ('focus', 'break')),
                intention TEXT NOT NULL DEFAULT '',
                category_id INTEGER REFERENCES categories(id),
                started_at INTEGER NOT NULL,
                ended_at INTEGER NOT NULL,
                planned_ms INTEGER NOT NULL,
                focused_ms INTEGER NOT NULL,
                reflection TEXT NOT NULL DEFAULT '',
                rating INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX sessions_started_at ON sessions(started_at);
            CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        ",
        kind: MigrationKind::Up,
    },
    Migration {
        version: 2,
        description: "remember the Google Calendar event made for a session",
        sql: "
            ALTER TABLE sessions ADD COLUMN google_event_id TEXT;
            ALTER TABLE sessions ADD COLUMN google_calendar_id TEXT;
        ",
        kind: MigrationKind::Up,
    },
    Migration {
        version: 3,
        description: "let categories be put in any order",
        sql: "
            ALTER TABLE categories ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
            UPDATE categories SET position = id;
        ",
        kind: MigrationKind::Up,
    }]
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[tauri::command]
fn set_tray_tooltip(app: AppHandle, text: String) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(text));
    }
}

fn tray_menu(app: &AppHandle, open: &str, quit: &str) -> tauri::Result<Menu<tauri::Wry>> {
    let open = MenuItem::with_id(app, "open", open, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", quit, true, None::<&str>)?;
    Menu::with_items(app, &[&open, &quit])
}

/// Renames the tray menu's items when the language changes.
#[tauri::command]
fn set_tray_menu(app: AppHandle, open: String, quit: String) {
    if let (Some(tray), Ok(menu)) = (app.tray_by_id(TRAY_ID), tray_menu(&app, &open, &quit)) {
        let _ = tray.set_menu(Some(menu));
    }
}

/// The one pending "time's up" alarm. Each schedule or cancel bumps the
/// generation, and a sleeping alarm only fires if it is still the latest.
#[derive(Default)]
struct Alarm(Arc<AtomicU64>);

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// Shows a notification at `at_ms` (wall clock). It runs here rather than in
/// the window because a hidden window's timers are throttled.
#[tauri::command]
fn schedule_alarm(app: AppHandle, alarm: State<Alarm>, at_ms: u64, title: String, body: String) {
    let generation = alarm.0.fetch_add(1, Ordering::SeqCst) + 1;
    let current = alarm.0.clone();
    std::thread::spawn(move || {
        // Short naps against the wall clock, so a laptop that sleeps through
        // the end still notifies as soon as it wakes.
        loop {
            if current.load(Ordering::SeqCst) != generation {
                return;
            }
            let now = now_ms();
            if now >= at_ms {
                break;
            }
            std::thread::sleep(Duration::from_millis((at_ms - now).min(1000)));
        }
        let _ = app.notification().builder().title(&title).body(&body).show();
        let _ = app.emit("alarm", ());
    });
}

#[tauri::command]
fn cancel_alarm(alarm: State<Alarm>) {
    alarm.0.fetch_add(1, Ordering::SeqCst);
}

#[tauri::command]
fn test_notification(app: AppHandle, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title("Stint")
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}

/// Asks where to save a report and writes it there. Returns false when the
/// save window is cancelled.
#[tauri::command]
async fn save_report(app: AppHandle, file_name: String, contents: String) -> Result<bool, String> {
    let Some(path) = app
        .dialog()
        .file()
        .set_file_name(file_name)
        .add_filter("CSV", &["csv"])
        .blocking_save_file()
    else {
        return Ok(false);
    };
    let path = path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(path, contents).map_err(|e| e.to_string())?;
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // A second launch brings the running window forward instead of
        // starting another timer.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:stint.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Alarm::default())
        .manage(google::Google::default())
        .invoke_handler(tauri::generate_handler![
            set_tray_tooltip,
            set_tray_menu,
            schedule_alarm,
            cancel_alarm,
            test_notification,
            save_report,
            google::google_connect,
            google::google_status,
            google::google_disconnect,
            google::google_request,
        ])
        .setup(|app| {
            let menu = tray_menu(app.handle(), "Open Stint", "Quit")?;
            TrayIconBuilder::with_id(TRAY_ID)
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Stint")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        // Closing the window keeps the timer running in the tray; quit from
        // the tray menu.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Stint");
}
