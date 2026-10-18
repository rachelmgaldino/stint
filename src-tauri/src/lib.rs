use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};
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
        .invoke_handler(tauri::generate_handler![set_tray_tooltip])
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "Open Stint", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
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
