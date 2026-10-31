mod float;
mod google;
mod updates;

use std::sync::atomic::{AtomicU64, Ordering};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
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
    },
    Migration {
        version: 4,
        description: "remember the calendar event a session was made from",
        sql: "ALTER TABLE sessions ADD COLUMN from_event TEXT;",
        kind: MigrationKind::Up,
    },
    Migration {
        version: 5,
        description: "link the tasks of one session",
        sql: "ALTER TABLE sessions ADD COLUMN part_of INTEGER;",
        kind: MigrationKind::Up,
    }]
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
    float::set_away(app, false);
}

/// Brings Stint back from the floating timer.
#[tauri::command]
fn float_open(app: AppHandle) {
    show_main(&app);
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

/// Paints the main window's title bar, which the page can't reach. Colors are
/// Windows' 0x00bbggrr, and `dark` matches the caption buttons to the bar.
#[tauri::command]
fn set_title_bar(app: AppHandle, color: u32, text: u32, dark: bool) {
    #[cfg(windows)]
    if let Some(Ok(hwnd)) = app.get_webview_window("main").map(|w| w.hwnd()) {
        use windows::Win32::Graphics::Dwm::{
            DwmSetWindowAttribute, DWMWA_CAPTION_COLOR, DWMWA_TEXT_COLOR,
            DWMWA_USE_IMMERSIVE_DARK_MODE, DWMWINDOWATTRIBUTE,
        };
        let set = |attribute: DWMWINDOWATTRIBUTE, value: u32| {
            let value: *const u32 = &value;
            let _ = unsafe { DwmSetWindowAttribute(hwnd, attribute, value.cast(), 4) };
        };
        set(DWMWA_USE_IMMERSIVE_DARK_MODE, dark as u32);
        set(DWMWA_CAPTION_COLOR, color);
        set(DWMWA_TEXT_COLOR, text);
    }
    #[cfg(not(windows))]
    let _ = (app, color, text, dark);
}

/// Pending alarms by key ("end", "soon", "overflow", ...). Each schedule or
/// cancel of a key gives it a new generation, and a sleeping alarm only fires
/// if its generation is still the latest for that key.
#[derive(Default)]
struct Alarms {
    next: AtomicU64,
    live: Arc<Mutex<HashMap<String, u64>>>,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// Fires an alarm at `at_ms` (wall clock): shows the notification, if there
/// is one, and tells the window so it can play a sound. It runs here rather
/// than in the window because a hidden window's timers are throttled.
#[tauri::command]
fn schedule_alarm(
    app: AppHandle,
    alarms: State<Alarms>,
    key: String,
    at_ms: u64,
    title: Option<String>,
    body: Option<String>,
) {
    let generation = alarms.next.fetch_add(1, Ordering::SeqCst) + 1;
    alarms.live.lock().unwrap().insert(key.clone(), generation);
    let live = alarms.live.clone();
    std::thread::spawn(move || {
        let current = || live.lock().unwrap().get(&key) == Some(&generation);
        // Short naps against the wall clock, so a laptop that sleeps through
        // the end still notifies as soon as it wakes.
        loop {
            if !current() {
                return;
            }
            let now = now_ms();
            if now >= at_ms {
                break;
            }
            std::thread::sleep(Duration::from_millis((at_ms - now).min(1000)));
        }
        live.lock().unwrap().remove(&key);
        if let (Some(title), Some(body)) = (title, body) {
            let _ = app.notification().builder().title(&title).body(&body).show();
        }
        let _ = app.emit("alarm", key);
    });
}

/// Cancels one alarm, or all of them when no key is given.
#[tauri::command]
fn cancel_alarm(alarms: State<Alarms>, key: Option<String>) {
    let mut live = alarms.live.lock().unwrap();
    match key {
        Some(k) => {
            live.remove(&k);
        }
        None => live.clear(),
    }
}

#[tauri::command]
fn test_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Alarms::default())
        .manage(google::Google::default())
        .manage(updates::Pending::default())
        .manage(float::Float::default())
        .invoke_handler(tauri::generate_handler![
            set_tray_tooltip,
            set_tray_menu,
            set_title_bar,
            schedule_alarm,
            cancel_alarm,
            test_notification,
            save_report,
            google::google_connect,
            google::google_status,
            google::google_disconnect,
            google::google_request,
            updates::update_check,
            updates::update_install,
            updates::update_test_builds,
            updates::open_pull_request,
            float::float_config,
            float::float_reset,
            float::float_drag,
            float::float_pill_width,
            float::float_pill_size,
            float::float_card,
            float_open,
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
            float::create(app.handle());
            Ok(())
        })
        // Closing the window keeps the timer running in the tray; quit from
        // the tray menu. The floating timer shows while the window is away.
        .on_window_event(|window, event| {
            let app = window.app_handle();
            let main = window.label() == "main";
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = window.hide();
                    if main {
                        float::set_away(app, true);
                    }
                }
                WindowEvent::Resized(_) if main => {
                    if window.is_minimized().unwrap_or(false) {
                        float::set_away(app, true);
                    } else if window.is_visible().unwrap_or(false) {
                        float::set_away(app, false);
                    }
                }
                WindowEvent::Focused(true) if main => float::set_away(app, false),
                WindowEvent::Moved(p) if window.label() == float::LABEL => float::moved(app, p.x, p.y),
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Stint");
}
