// The floating timer: a small frameless, see-through window that shows the
// running session while the main window is minimized or in the tray. The
// window is always its full open size and never moves on its own, so the
// bubble stays put; at rest it lets clicks through to the apps underneath,
// and while the pointer is on the bubble it shows the category and a shelf of
// buttons around it.

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, Monitor, PhysicalPosition, Runtime, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

pub const LABEL: &str = "float";

// Logical size of the window, of the resting bubble's old window (the saved
// spot is that window's top-left corner, the bubble 10px in), and where that
// resting spot sits inside the window. They match the layout in src/float.css.
const OPEN: (f64, f64) = (300.0, 272.0);
const REST: (f64, f64) = (112.0, 112.0);
const SHIFT: (f64, f64) = (94.0, 80.0);
// The bubble inside the resting spot.
const BUBBLE: (f64, f64, f64) = (10.0, 10.0, 92.0);
// Room kept beside and under the resting spot in the default corner, so the
// category and buttons fit centred on the bubble.
const ROOM: (f64, f64) = (46.0, 66.0);
// How often the pointer is checked, and how many checks off the timer close it.
const TICK: Duration = Duration::from_millis(50);
const LEAVE_TICKS: u32 = 7;

#[derive(Default)]
pub struct Float(Mutex<Inner>);

#[derive(Default)]
struct Inner {
    /// A session or break is running and the floating timer is switched on.
    active: bool,
    /// The main window is minimized or hidden in the tray.
    away: bool,
    on_top: bool,
    /// Showing the category and buttons (pointer on it) rather than resting.
    open: bool,
    /// Checks in a row with the pointer off the open timer.
    off_ticks: u32,
    /// Where the resting spot's top-left corner is, in physical pixels.
    rest: Option<(i32, i32)>,
    loaded: bool,
}

/// How much of the open window runs off the screen on each side, in logical
/// pixels, so the category and buttons can move to stay in sight.
#[derive(Clone, serde::Serialize)]
struct Opened {
    open: bool,
    left: f64,
    right: f64,
    top: f64,
    bottom: f64,
}

fn saved_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("float.json"))
}

fn load<R: Runtime>(app: &AppHandle<R>, s: &mut Inner) {
    if s.loaded {
        return;
    }
    s.loaded = true;
    let Some(text) = saved_path(app).and_then(|p| std::fs::read_to_string(p).ok()) else {
        return;
    };
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
        if let (Some(x), Some(y)) = (v["x"].as_i64(), v["y"].as_i64()) {
            s.rest = Some((x as i32, y as i32));
        }
    }
}

fn save<R: Runtime>(app: &AppHandle<R>, rest: Option<(i32, i32)>) {
    let Some(path) = saved_path(app) else { return };
    match rest {
        Some((x, y)) => {
            if let Some(dir) = path.parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            let _ = std::fs::write(path, serde_json::json!({ "x": x, "y": y }).to_string());
        }
        None => {
            let _ = std::fs::remove_file(path);
        }
    }
}

/// The work area (screen minus taskbar) of a monitor, as x, y, width, height.
fn area(m: &Monitor) -> (i32, i32, i32, i32) {
    let a = m.work_area();
    (a.position.x, a.position.y, a.size.width as i32, a.size.height as i32)
}

/// The monitor holding the point, if any is plugged in there.
fn monitor_at<R: Runtime>(app: &AppHandle<R>, x: i32, y: i32) -> Option<Monitor> {
    app.available_monitors().ok()?.into_iter().find(|m| {
        let (mx, my, w, h) = area(m);
        x >= mx && x < mx + w && y >= my && y < my + h
    })
}

/// Where the resting spot goes: where it was left, if that spot is still on
/// a screen, otherwise the bottom-right corner of the main screen.
fn rest_spot<R: Runtime>(app: &AppHandle<R>, s: &Inner) -> Option<(i32, i32)> {
    if let Some((x, y)) = s.rest {
        let scale = app.primary_monitor().ok().flatten().map(|m| m.scale_factor()).unwrap_or(1.0);
        let half = (REST.0 * scale / 2.0) as i32;
        if monitor_at(app, x + half, y + half).is_some() {
            return Some((x, y));
        }
    }
    let m = app.primary_monitor().ok().flatten()?;
    let scale = m.scale_factor();
    let (mx, my, w, h) = area(&m);
    let x = mx + w - ((REST.0 + ROOM.0) * scale) as i32;
    let y = my + h - ((REST.1 + ROOM.1) * scale) as i32;
    Some((x, y))
}

/// The window's top-left corner for a resting spot.
fn window_at(rest: (i32, i32), scale: f64) -> (i32, i32) {
    (rest.0 - (SHIFT.0 * scale) as i32, rest.1 - (SHIFT.1 * scale) as i32)
}

/// Makes the (hidden) window when Stint starts, and the loop that watches the
/// pointer. Making the window later, from a window event or a command, can
/// lock up on Windows.
pub fn create<R: Runtime>(app: &AppHandle<R>) {
    let _ = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("index.html".into()))
        .title("Stint")
        .inner_size(OPEN.0, OPEN.1)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .skip_taskbar(true)
        .always_on_top(true)
        .focused(false)
        .visible(false)
        .build();
    // The check itself runs on the main thread, like everything else that
    // takes the lock. Run from this thread, it held the lock while asking the
    // main thread for the pointer and window position, and the main thread
    // waited for that same lock when Stint came back (Open Stint, a click on
    // the window): each waited for the other and Stint froze.
    let app = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(TICK);
        let handle = app.clone();
        if app.run_on_main_thread(move || watch(&handle)).is_err() {
            return;
        }
    });
}

/// Opens the timer when the pointer comes onto the bubble, and closes it a
/// moment after the pointer leaves the window. The window lets clicks through
/// while resting, so the page itself can't see the pointer arrive.
fn watch<R: Runtime>(app: &AppHandle<R>) {
    let float = app.state::<Float>();
    let Ok(mut s) = float.0.try_lock() else { return };
    if !(s.active && s.away) {
        return;
    }
    let Some(w) = app.get_webview_window(LABEL) else { return };
    let (Ok(p), Ok(at)) = (app.cursor_position(), w.outer_position()) else { return };
    let scale = w.scale_factor().unwrap_or(1.0);
    let (px, py) = ((p.x - at.x as f64) / scale, (p.y - at.y as f64) / scale);
    if s.open {
        let inside = px >= 0.0 && py >= 0.0 && px < OPEN.0 && py < OPEN.1;
        s.off_ticks = if inside { 0 } else { s.off_ticks + 1 };
        if s.off_ticks >= LEAVE_TICKS {
            close_shelf(&w, &mut s);
        }
        return;
    }
    let r = BUBBLE.2 / 2.0;
    let (cx, cy) = (SHIFT.0 + BUBBLE.0 + r, SHIFT.1 + BUBBLE.1 + r);
    if (px - cx).hypot(py - cy) <= r {
        open_shelf(app, &w, &mut s);
    }
}

fn open_shelf<R: Runtime>(app: &AppHandle<R>, w: &WebviewWindow<R>, s: &mut Inner) {
    s.open = true;
    s.off_ticks = 0;
    let _ = w.set_ignore_cursor_events(false);
    let mut opened = Opened { open: true, left: 0.0, right: 0.0, top: 0.0, bottom: 0.0 };
    if let Ok(at) = w.outer_position() {
        let scale = w.scale_factor().unwrap_or(1.0);
        let r = ((SHIFT.0 + BUBBLE.0 + BUBBLE.2 / 2.0) * scale) as i32;
        let b = ((SHIFT.1 + BUBBLE.1 + BUBBLE.2 / 2.0) * scale) as i32;
        if let Some(m) = monitor_at(app, at.x + r, at.y + b) {
            let (mx, my, mw, mh) = area(&m);
            let (ow, oh) = (OPEN.0 * scale, OPEN.1 * scale);
            let (x, y) = (at.x as f64, at.y as f64);
            opened.left = (mx as f64 - x).max(0.0) / scale;
            opened.top = (my as f64 - y).max(0.0) / scale;
            opened.right = (x + ow - (mx + mw) as f64).max(0.0) / scale;
            opened.bottom = (y + oh - (my + mh) as f64).max(0.0) / scale;
        }
    }
    let _ = app.emit_to(LABEL, "float-open", opened);
}

fn close_shelf<R: Runtime>(w: &WebviewWindow<R>, s: &mut Inner) {
    if !s.open {
        return;
    }
    s.open = false;
    let _ = w.set_ignore_cursor_events(true);
    let _ = w.app_handle().emit_to(LABEL, "float-open", Opened { open: false, left: 0.0, right: 0.0, top: 0.0, bottom: 0.0 });
    save(w.app_handle(), s.rest);
}

/// Shows or hides the floating timer to match the current state.
fn apply<R: Runtime>(app: &AppHandle<R>, s: &mut Inner) {
    load(app, s);
    if !(s.active && s.away) {
        if let Some(w) = app.get_webview_window(LABEL) {
            close_shelf(&w, s);
            let _ = w.hide();
        }
        return;
    }
    let Some(w) = app.get_webview_window(LABEL) else { return };
    let _ = w.set_always_on_top(s.on_top);
    if w.is_visible().unwrap_or(false) {
        return;
    }
    s.open = false;
    place(app, &w, s);
    let _ = w.set_ignore_cursor_events(true);
    let _ = w.show();
}

/// Puts the window around the resting spot.
fn place<R: Runtime>(app: &AppHandle<R>, w: &WebviewWindow<R>, s: &mut Inner) {
    let _ = w.set_size(LogicalSize::new(OPEN.0, OPEN.1));
    if let Some(rest) = rest_spot(app, s) {
        let (x, y) = window_at(rest, w.scale_factor().unwrap_or(1.0));
        let _ = w.set_position(PhysicalPosition::new(x, y));
        s.rest = Some(rest);
    }
}

/// Called when the main window is minimized, hidden or brought back.
pub fn set_away<R: Runtime>(app: &AppHandle<R>, away: bool) {
    let float = app.state::<Float>();
    let mut s = float.0.lock().unwrap();
    if s.away == away {
        return;
    }
    s.away = away;
    apply(app, &mut s);
}

/// Called when the floating window moves: a drag moves the bubble's home.
pub fn moved<R: Runtime>(app: &AppHandle<R>, x: i32, y: i32) {
    let float = app.state::<Float>();
    // Busy means this is our own move (placing it), not a drag.
    let Ok(mut s) = float.0.try_lock() else { return };
    let Some(w) = app.get_webview_window(LABEL) else { return };
    let scale = w.scale_factor().unwrap_or(1.0);
    s.rest = Some((x + (SHIFT.0 * scale) as i32, y + (SHIFT.1 * scale) as i32));
}

/// The main window says whether a session runs (and the feature is on) and
/// whether the timer stays above other apps.
#[tauri::command]
pub fn float_config(app: AppHandle, float: State<Float>, active: bool, on_top: bool) {
    let mut s = float.0.lock().unwrap();
    s.active = active;
    s.on_top = on_top;
    apply(&app, &mut s);
}

/// Forgets where the bubble was dragged and puts it back in the corner.
#[tauri::command]
pub fn float_reset(app: AppHandle, float: State<Float>) {
    let mut s = float.0.lock().unwrap();
    load(&app, &mut s);
    s.rest = None;
    save(&app, None);
    if let Some(w) = app.get_webview_window(LABEL) {
        place(&app, &w, &mut s);
    }
}
