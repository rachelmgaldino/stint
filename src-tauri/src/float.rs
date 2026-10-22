// The floating timer: a small frameless, see-through window that shows the
// running session while the main window is minimized or in the tray. It
// rests as a round bubble and grows while the pointer is on it, to show the
// category above and a shelf of buttons below.

use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{
    AppHandle, LogicalSize, Manager, Monitor, PhysicalPosition, Runtime, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

pub const LABEL: &str = "float";

// Logical sizes of the window while resting and while open, and how far the
// window moves (up and left) when it opens so the bubble stays put. They match
// the layout in src/float.css.
const REST: (f64, f64) = (112.0, 112.0);
const OPEN: (f64, f64) = (220.0, 204.0);
const SHIFT: (f64, f64) = (54.0, 38.0);
// Space kept between the open window and the screen edges in the default corner.
const MARGIN: f64 = 16.0;

#[derive(Default)]
pub struct Float(Mutex<Inner>);

#[derive(Default)]
struct Inner {
    /// A session or break is running and the floating timer is switched on.
    active: bool,
    /// The main window is minimized or hidden in the tray.
    away: bool,
    on_top: bool,
    /// Open (pointer on it) rather than resting.
    open: bool,
    /// Where the resting window's top-left corner is, in physical pixels.
    rest: Option<(i32, i32)>,
    /// Where the window was put when it opened, to tell a drag from our own move.
    open_at: (i32, i32),
    loaded: bool,
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

/// Where the resting bubble goes: where it was left, if that spot is still on
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
    // Room for the open window's edges beside and under the bubble, so opening
    // it never runs off the screen.
    let side = (OPEN.0 - SHIFT.0 - REST.0) * scale;
    let below = (OPEN.1 - SHIFT.1 - REST.1) * scale;
    let x = mx + w - ((REST.0 + MARGIN) * scale + side) as i32;
    let y = my + h - ((REST.1 + MARGIN) * scale + below) as i32;
    Some((x, y))
}

/// Makes the (hidden) window when Stint starts. Making it later, from a window
/// event or a command, can lock up on Windows.
pub fn create<R: Runtime>(app: &AppHandle<R>) {
    let _ = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("index.html".into()))
        .title("Stint")
        .inner_size(REST.0, REST.1)
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
    let _ = w.set_size(LogicalSize::new(REST.0, REST.1));
    if let Some((x, y)) = rest_spot(app, s) {
        let _ = w.set_position(PhysicalPosition::new(x, y));
        s.rest = Some((x, y));
    }
    let _ = w.show();
}

fn close_shelf<R: Runtime>(w: &WebviewWindow<R>, s: &mut Inner) {
    if !s.open {
        return;
    }
    s.open = false;
    if let Some((x, y)) = s.rest {
        let _ = w.set_position(PhysicalPosition::new(x, y));
    }
    let _ = w.set_size(LogicalSize::new(REST.0, REST.1));
    save(w.app_handle(), s.rest);
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
    // Busy means this is our own move (opening, closing, placing), not a drag.
    let Ok(mut s) = float.0.try_lock() else { return };
    if s.open {
        let (ox, oy) = s.open_at;
        if (x, y) != (ox, oy) {
            if let Some((rx, ry)) = s.rest {
                s.rest = Some((rx + x - ox, ry + y - oy));
            }
            s.open_at = (x, y);
        }
    } else if s.rest.is_some() && s.rest != Some((x, y)) {
        s.rest = Some((x, y));
    }
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

/// Grows the window while the pointer is on the bubble, and shrinks it back.
#[tauri::command]
pub fn float_expand(app: AppHandle, float: State<Float>, open: bool) {
    let mut s = float.0.lock().unwrap();
    let Some(w) = app.get_webview_window(LABEL) else { return };
    if !open {
        close_shelf(&w, &mut s);
        return;
    }
    if s.open {
        return;
    }
    let Some((rx, ry)) = s.rest.or_else(|| w.outer_position().ok().map(|p| (p.x, p.y))) else {
        return;
    };
    let scale = w.scale_factor().unwrap_or(1.0);
    let (ow, oh) = ((OPEN.0 * scale) as i32, (OPEN.1 * scale) as i32);
    let mut x = rx - (SHIFT.0 * scale) as i32;
    let mut y = ry - (SHIFT.1 * scale) as i32;
    // Keep the open window on the bubble's screen.
    let half = (REST.0 * scale / 2.0) as i32;
    if let Some(m) = monitor_at(&app, rx + half, ry + half) {
        let (mx, my, mw, mh) = area(&m);
        x = x.clamp(mx, (mx + mw - ow).max(mx));
        y = y.clamp(my, (my + mh - oh).max(my));
    }
    s.rest = Some((rx, ry));
    s.open = true;
    s.open_at = (x, y);
    let _ = w.set_size(LogicalSize::new(OPEN.0, OPEN.1));
    let _ = w.set_position(PhysicalPosition::new(x, y));
}

/// Forgets where the bubble was dragged and puts it back in the corner.
#[tauri::command]
pub fn float_reset(app: AppHandle, float: State<Float>) {
    let mut s = float.0.lock().unwrap();
    load(&app, &mut s);
    s.rest = None;
    save(&app, None);
    if let Some(w) = app.get_webview_window(LABEL) {
        s.open = false;
        let _ = w.set_size(LogicalSize::new(REST.0, REST.1));
        if let Some((x, y)) = rest_spot(&app, &s) {
            let _ = w.set_position(PhysicalPosition::new(x, y));
            s.rest = Some((x, y));
        }
    }
}
