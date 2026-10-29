// The floating timer: a small frameless, see-through window that shows the
// running session while the main window is minimized or in the tray. The
// window is always its full open size and never moves on its own, so the
// bubble stays put; at rest it lets clicks through to the apps underneath,
// and while the pointer is on the bubble it shows the category and a shelf of
// buttons around it. In the pill style the window hangs from the top of the
// screen instead, with a small pill in its top middle, and only slides sideways.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
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
const OPEN: (f64, f64) = (300.0, 340.0);
const REST: (f64, f64) = (112.0, 112.0);
const SHIFT: (f64, f64) = (94.0, 114.0);
// The bubble inside the resting spot.
const BUBBLE: (f64, f64, f64) = (10.0, 10.0, 92.0);
// Room kept beside and under the resting spot in the default corner, so the
// category and buttons fit centred on the bubble.
const ROOM: (f64, f64) = (46.0, 66.0);
// The pill style: logical size of its window, and the resting pill inside it
// (x, y, width, height), centred across the window and 9px below its top.
// The 9px gap stays the same at every size; the rest grows with it.
// The width is its widest usual size; the page sends the real one
// (float_pill_width), since the pill hugs the time and the pin.
// They must match the pill layout in src/float.css.
const PILL_OPEN: (f64, f64) = (280.0, 132.0);
const PILL: (f64, f64, f64, f64) = (74.0, 9.0, 132.0, 32.0);
// How close (logical px) the pill's centre must come to the middle of the
// screen while dragged to snap onto it.
const SNAP: f64 = 24.0;
// The open card's width (.float-pill.open in src/float.css), which the pill
// grows into from its centre: keeping all of it on the screen keeps the
// buttons in reach at either end of a drag.
const PILL_CARD: f64 = 180.0;
// The sizes the pill's handle allows (src/components/FloatPill.tsx, SCALE).
// Every pill number above is at size 1 and grows with it.
const PILL_SIZES: (f64, f64) = (0.8, 1.5);
// How often the pointer is checked, and how many checks off the timer close it.
const TICK: Duration = Duration::from_millis(50);
const LEAVE_TICKS: u32 = 7;
// The pill closes sooner: it shrinks back quickly, so a long wait reads as lag.
const PILL_LEAVE_TICKS: u32 = 3;
// How often the bubble follows the pointer while it is being dragged.
const DRAG_TICK: Duration = Duration::from_millis(8);

/// The state, and whether the bubble is being dragged (read by the drag
/// loop's own thread, which never takes the lock).
#[derive(Default)]
pub struct Float(Mutex<Inner>, AtomicBool);

/// How the floating timer looks: a round bubble anywhere on the screen, or a
/// pill hanging from the top of it.
#[derive(Default, Clone, Copy, PartialEq)]
enum Style {
    #[default]
    Bubble,
    Pill,
}

impl Style {
    /// Anything the page sends other than "pill" means the bubble.
    fn parse(s: &str) -> Self {
        if s == "pill" {
            Style::Pill
        } else {
            Style::Bubble
        }
    }
}

/// A side of the screen the pill can be docked to.
#[derive(Clone, Copy, PartialEq)]
enum Edge {
    Left,
    Right,
}

/// Where the pill was left: its centre across the screen in physical pixels,
/// and whether it was snapped onto the middle of that screen or docked to
/// one of its sides.
#[derive(Clone, Copy)]
struct PillSpot {
    cx: i32,
    centered: bool,
    edge: Option<Edge>,
}

#[derive(Default)]
struct Inner {
    /// A session or break is running and the floating timer is switched on.
    active: bool,
    /// The main window is minimized or hidden in the tray.
    away: bool,
    on_top: bool,
    style: Style,
    /// Showing the category and buttons (pointer on it) rather than resting.
    open: bool,
    /// Checks in a row with the pointer off the open timer.
    off_ticks: u32,
    /// Where the resting spot's top-left corner is, in physical pixels.
    rest: Option<(i32, i32)>,
    /// Where the pill was left; none means centred on the main screen.
    pill: Option<PillSpot>,
    loaded: bool,
    /// While dragging: where the pointer holds the window, in logical pixels
    /// from its top-left corner.
    grab: Option<(f64, f64)>,
    /// The edges last sent to the page.
    edges: Option<Opened>,
    /// The drag cue last sent to the page (pill only).
    cue: Option<Dragging>,
    /// Which way the card last opened from the pill, as sent to the page.
    anchor: Option<&'static str>,
    /// The resting pill's width as the page measured it (logical px), since
    /// it hugs the time and the pin; none means PILL's width.
    pill_w: Option<f64>,
    /// How big the pill is drawn, from its handle; none means 1.
    pill_size: Option<f64>,
}

/// How much of the open window runs off the screen on each side, in logical
/// pixels, so the category and buttons can move to stay in sight.
#[derive(Clone, PartialEq, serde::Serialize)]
struct Opened {
    open: bool,
    left: f64,
    right: f64,
    top: f64,
    bottom: f64,
}

/// Whether the pill is being dragged and whether it sits snapped on the
/// middle of the screen or docked to a side, so the page can show a cue
/// while it is.
#[derive(Clone, Copy, PartialEq, serde::Serialize)]
struct Dragging {
    dragging: bool,
    snapped: bool,
}

fn saved_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("float.json"))
}

/// Reads float.json once: the bubble's spot as x and y, the pill's as
/// pill.cx, pill.centered, pill.edge and pill.size. Older files have only x
/// and y.
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
        if let Some(cx) = v["pill"]["cx"].as_i64() {
            let centered = v["pill"]["centered"].as_bool().unwrap_or(false);
            let edge = match v["pill"]["edge"].as_str() {
                Some("left") => Some(Edge::Left),
                Some("right") => Some(Edge::Right),
                _ => None,
            };
            s.pill = Some(PillSpot { cx: cx as i32, centered, edge });
        }
        if let Some(size) = v["pill"]["size"].as_f64() {
            s.pill_size = Some(size.clamp(PILL_SIZES.0, PILL_SIZES.1));
        }
    }
}

/// Writes both styles' spots (and the pill's size) to float.json, so
/// changing one keeps the other.
/// With neither left, the file goes.
fn save<R: Runtime>(app: &AppHandle<R>, s: &Inner) {
    // Not read yet: writing now would drop what the file holds.
    if !s.loaded {
        return;
    }
    let Some(path) = saved_path(app) else { return };
    let mut v = serde_json::Map::new();
    if let Some((x, y)) = s.rest {
        v.insert("x".into(), x.into());
        v.insert("y".into(), y.into());
    }
    let mut pill = serde_json::Map::new();
    if let Some(p) = s.pill {
        pill.insert("cx".into(), p.cx.into());
        pill.insert("centered".into(), p.centered.into());
        if let Some(edge) = p.edge {
            let side = if edge == Edge::Left { "left" } else { "right" };
            pill.insert("edge".into(), side.into());
        }
    }
    if let Some(size) = s.pill_size.filter(|k| *k != 1.0) {
        pill.insert("size".into(), size.into());
    }
    if !pill.is_empty() {
        v.insert("pill".into(), serde_json::Value::Object(pill));
    }
    if v.is_empty() {
        let _ = std::fs::remove_file(path);
        return;
    }
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let _ = std::fs::write(path, serde_json::Value::Object(v).to_string());
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

/// The monitor under the point, counting its taskbar too, since the pointer
/// can slip onto it while dragging the pill along the top.
fn monitor_under<R: Runtime>(app: &AppHandle<R>, x: i32, y: i32) -> Option<Monitor> {
    monitor_at(app, x, y).or_else(|| {
        app.available_monitors().ok()?.into_iter().find(|m| {
            let (p, size) = (m.position(), m.size());
            x >= p.x && x < p.x + size.width as i32 && y >= p.y && y < p.y + size.height as i32
        })
    })
}

/// The monitor whose work area spans the point across, the main one first
/// when several do (monitors stacked on top of each other).
fn monitor_across<R: Runtime>(app: &AppHandle<R>, x: i32) -> Option<Monitor> {
    let holds = |m: &Monitor| {
        let (mx, _, mw, _) = area(m);
        x >= mx && x < mx + mw
    };
    if let Some(m) = app.primary_monitor().ok().flatten().filter(holds) {
        return Some(m);
    }
    app.available_monitors().ok()?.into_iter().find(holds)
}

/// The middle of a monitor's work area across, in whole physical pixels.
fn middle(m: &Monitor) -> i32 {
    let (mx, _, mw, _) = area(m);
    mx + mw / 2
}

/// How big the pill is drawn (1 is normal).
fn pill_size(s: &Inner) -> f64 {
    s.pill_size.unwrap_or(1.0)
}

/// The window's logical size in the current style, the pill's grown with it.
fn window_size(s: &Inner) -> (f64, f64) {
    match s.style {
        Style::Bubble => OPEN,
        Style::Pill => (PILL_OPEN.0 * pill_size(s), PILL_OPEN.1 * pill_size(s)),
    }
}

/// From the window's left edge to the pill's centre, in physical pixels, at
/// the screen's scaling and the pill's size. Rounded the same way as the
/// window's width, so with an even width the pill's centre is the window's
/// exact middle.
fn pill_offset(scale: f64, size: f64) -> i32 {
    ((PILL.0 + PILL.2 / 2.0) * size * scale).round() as i32
}

/// How far the pill keeps from the sides of the screen, in physical pixels:
/// the same 9px as from the top, whatever its size.
fn pill_margin(m: &Monitor) -> i32 {
    (PILL.1 * m.scale_factor()).round() as i32
}

/// The pill's centre docked to a side: its resting edge 9px in from it.
fn docked(m: &Monitor, s: &Inner, edge: Edge) -> i32 {
    let (mx, _, mw, _) = area(m);
    let half = (s.pill_w.unwrap_or(PILL.2) * pill_size(s) / 2.0 * m.scale_factor()).round() as i32;
    let inset = pill_margin(m) + half;
    match edge {
        Edge::Left => mx + inset,
        Edge::Right => mx + mw - inset,
    }
}

/// Keeps the resting pill on the monitor, at least 9px in from either side.
fn clamp_pill(m: &Monitor, s: &Inner, cx: i32) -> i32 {
    cx.min(docked(m, s, Edge::Right)).max(docked(m, s, Edge::Left))
}

/// Which way the card opens from the pill there: from its centre, or from
/// its left or right edge when a centred card would come closer than 9px to
/// that side of the screen.
fn anchor(m: &Monitor, s: &Inner, cx: i32) -> &'static str {
    let (mx, _, mw, _) = area(m);
    let half = (PILL_CARD * pill_size(s) / 2.0 * m.scale_factor()).round() as i32;
    let margin = pill_margin(m);
    if cx - half < mx + margin {
        "left"
    } else if cx + half > mx + mw - margin {
        "right"
    } else {
        "center"
    }
}

/// Tells the page which way the card opens, if that changed (or always,
/// when the window has just been placed).
fn send_anchor<R: Runtime>(app: &AppHandle<R>, s: &mut Inner, anchor: &'static str, always: bool) {
    if !always && s.anchor == Some(anchor) {
        return;
    }
    s.anchor = Some(anchor);
    let _ = app.emit_to(LABEL, "float-anchor", anchor);
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

/// The pill window's top-left corner, and which way its card opens: on the
/// top of the work area of the monitor it was left on, at its saved spot or,
/// if it was snapped there, on that monitor's exact middle or 9px from its
/// side (which follow a resolution, scaling or size change). Nothing saved,
/// or a monitor that's gone, means centred on the main screen.
fn pill_window<R: Runtime>(app: &AppHandle<R>, s: &Inner) -> Option<(i32, i32, &'static str)> {
    let saved = s.pill.and_then(|p| monitor_across(app, p.cx).map(|m| (m, p)));
    let (m, cx) = match saved {
        Some((m, p)) => {
            let cx = match (p.centered, p.edge) {
                (true, _) => middle(&m),
                (false, Some(edge)) => docked(&m, s, edge),
                (false, None) => clamp_pill(&m, s, p.cx),
            };
            (m, cx)
        }
        None => {
            let m = app.primary_monitor().ok().flatten()?;
            let cx = middle(&m);
            (m, cx)
        }
    };
    Some((cx - pill_offset(m.scale_factor(), pill_size(s)), area(&m).1, anchor(&m, s, cx)))
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

/// Opens the timer when the pointer comes onto the bubble (or the pill), and
/// closes it a moment after the pointer leaves the window. The window lets
/// clicks through while resting, so the page itself can't see the pointer
/// arrive.
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
        let (ow, oh) = window_size(&s);
        let inside = px >= 0.0 && py >= 0.0 && px < ow && py < oh;
        s.off_ticks = if inside { 0 } else { s.off_ticks + 1 };
        let leave = if s.style == Style::Pill { PILL_LEAVE_TICKS } else { LEAVE_TICKS };
        if s.off_ticks >= leave {
            close_shelf(&w, &mut s);
        }
        return;
    }
    let on = match s.style {
        Style::Bubble => {
            let r = BUBBLE.2 / 2.0;
            let (cx, cy) = (SHIFT.0 + BUBBLE.0 + r, SHIFT.1 + BUBBLE.1 + r);
            (px - cx).hypot(py - cy) <= r
        }
        Style::Pill => {
            // Centred on the window like the pill, however wide it is now,
            // all grown by the pill's size.
            let k = pill_size(&s);
            let w = s.pill_w.unwrap_or(PILL.2);
            let x = PILL.0 + (PILL.2 - w) / 2.0;
            px >= x * k && py >= PILL.1 && px < (x + w) * k && py < PILL.1 + PILL.3 * k
        }
    };
    if on {
        open_shelf(app, &w, &mut s);
    }
}

fn open_shelf<R: Runtime>(app: &AppHandle<R>, w: &WebviewWindow<R>, s: &mut Inner) {
    s.open = true;
    s.off_ticks = 0;
    let _ = w.set_ignore_cursor_events(false);
    send_edges(app, w, s);
}

/// Tells the page how much of the open window is off the screen, if that
/// changed. The pill's page doesn't use the edges, so it always gets zeros.
fn send_edges<R: Runtime>(app: &AppHandle<R>, w: &WebviewWindow<R>, s: &mut Inner) {
    let mut opened = Opened { open: true, left: 0.0, right: 0.0, top: 0.0, bottom: 0.0 };
    if let (Style::Bubble, Ok(at)) = (s.style, w.outer_position()) {
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
    if s.edges.as_ref() == Some(&opened) {
        return;
    }
    s.edges = Some(opened.clone());
    let _ = app.emit_to(LABEL, "float-open", opened);
}

fn close_shelf<R: Runtime>(w: &WebviewWindow<R>, s: &mut Inner) {
    if !s.open {
        return;
    }
    s.open = false;
    s.edges = None;
    let _ = w.set_ignore_cursor_events(true);
    let _ = w.app_handle().emit_to(LABEL, "float-open", Opened { open: false, left: 0.0, right: 0.0, top: 0.0, bottom: 0.0 });
    save(w.app_handle(), s);
}

/// Tells the page whether the pill is being dragged and snapped to the
/// middle, if either changed.
fn send_cue<R: Runtime>(app: &AppHandle<R>, s: &mut Inner, cue: Dragging) {
    if s.cue == Some(cue) {
        return;
    }
    s.cue = Some(cue);
    let _ = app.emit_to(LABEL, "float-drag", cue);
}

/// Whether the pill sits snapped on the middle or docked to a side (on the
/// middle when nothing is saved).
fn pill_snapped(s: &Inner) -> bool {
    s.pill.is_none_or(|p| p.centered || p.edge.is_some())
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

/// Sizes the window for the style and puts it around the resting spot (the
/// bubble) or on the top of the screen (the pill).
fn place<R: Runtime>(app: &AppHandle<R>, w: &WebviewWindow<R>, s: &mut Inner) {
    let (ow, oh) = window_size(s);
    let _ = w.set_size(LogicalSize::new(ow, oh));
    match s.style {
        Style::Bubble => {
            if let Some(rest) = rest_spot(app, s) {
                let (x, y) = window_at(rest, w.scale_factor().unwrap_or(1.0));
                let _ = w.set_position(PhysicalPosition::new(x, y));
                s.rest = Some(rest);
            }
        }
        Style::Pill => {
            if let Some((x, y, anchor)) = pill_window(app, s) {
                let _ = w.set_position(PhysicalPosition::new(x, y));
                send_anchor(app, s, anchor, true);
            }
        }
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

/// The page says the bubble was pressed: the window follows the pointer until
/// it is let go. Stint moves the window itself rather than leaving the drag to
/// Windows, which won't let a window's top edge past the top of the screen and
/// so kept the bubble (sitting lower in the window) from reaching the top.
/// The pill only slides sideways along the top of the screen.
#[tauri::command]
pub fn float_drag(app: AppHandle, float: State<Float>, start: bool) {
    let mut s = float.0.lock().unwrap();
    if !start {
        end_drag(&app, &float.1, &mut s);
        return;
    }
    let Some(w) = app.get_webview_window(LABEL) else { return };
    let (Ok(p), Ok(at)) = (app.cursor_position(), w.outer_position()) else { return };
    let scale = w.scale_factor().unwrap_or(1.0);
    s.grab = Some(((p.x - at.x as f64) / scale, (p.y - at.y as f64) / scale));
    if s.style == Style::Pill {
        let snapped = pill_snapped(&s);
        send_cue(&app, &mut s, Dragging { dragging: true, snapped });
    }
    if float.1.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        while app.state::<Float>().1.load(Ordering::SeqCst) {
            std::thread::sleep(DRAG_TICK);
            let handle = app.clone();
            if app.run_on_main_thread(move || follow(&handle)).is_err() {
                return;
            }
        }
    });
}

/// The pointer let go: stops following it and keeps the new spot.
fn end_drag<R: Runtime>(app: &AppHandle<R>, dragging: &AtomicBool, s: &mut Inner) {
    s.grab = None;
    dragging.store(false, Ordering::SeqCst);
    save(app, s);
    if s.style == Style::Pill {
        let snapped = pill_snapped(s);
        send_cue(app, s, Dragging { dragging: false, snapped });
    }
}

/// Moves the window with the pointer, keeping the whole bubble on the screen
/// the pointer is on. The category and buttons move around it as it nears an
/// edge.
fn follow<R: Runtime>(app: &AppHandle<R>) {
    let float = app.state::<Float>();
    let Ok(mut s) = float.0.try_lock() else { return };
    let Some(grab) = s.grab else { return };
    let Some(w) = app.get_webview_window(LABEL) else { return };
    let Ok(p) = app.cursor_position() else { return };
    let scale = w.scale_factor().unwrap_or(1.0);
    if s.style == Style::Pill {
        follow_pill(app, &w, &mut s, (p.x, p.y), grab.0 * scale);
        return;
    }
    let mut x = (p.x - grab.0 * scale).round() as i32;
    let mut y = (p.y - grab.1 * scale).round() as i32;
    if let Some(m) = monitor_at(app, p.x as i32, p.y as i32) {
        let (mx, my, mw, mh) = area(&m);
        let size = (BUBBLE.2 * scale) as i32;
        let (bx, by) = (((SHIFT.0 + BUBBLE.0) * scale) as i32, ((SHIFT.1 + BUBBLE.1) * scale) as i32);
        x = x.clamp(mx - bx, mx + mw - bx - size);
        y = y.clamp(my - by, my + mh - by - size);
    }
    if w.outer_position().ok().map(|at| (at.x, at.y)) != Some((x, y)) {
        let _ = w.set_position(PhysicalPosition::new(x, y));
    }
    s.rest = Some((x + (SHIFT.0 * scale) as i32, y + (SHIFT.1 * scale) as i32));
    if s.open {
        send_edges(app, &w, &mut s);
    }
}

/// Slides the pill window sideways with the pointer, `grab_x` physical pixels
/// right of the window's left edge. It sits on the top of the work area of
/// the monitor under the pointer, so dragging across docks it to the next
/// monitor's top; the resting pill stays 9px in from the monitor's sides, and
/// it snaps onto the exact middle, or onto a side 9px in, when its centre
/// comes within SNAP of that spot.
fn follow_pill<R: Runtime>(app: &AppHandle<R>, w: &WebviewWindow<R>, s: &mut Inner, p: (f64, f64), grab_x: f64) {
    let Some(m) = monitor_under(app, p.0 as i32, p.1 as i32) else { return };
    let scale = m.scale_factor();
    let k = pill_size(s);
    let (_, top, _, _) = area(&m);
    let cx = (p.0 - grab_x).round() as i32 + pill_offset(scale, k);
    let snap = (SNAP * k * scale).round() as i32;
    let (left, right, mid) = (docked(&m, s, Edge::Left), docked(&m, s, Edge::Right), middle(&m));
    let (cx, centered, edge) = if (cx - mid).abs() <= snap {
        (mid, true, None)
    } else if cx <= left + snap {
        (left, false, Some(Edge::Left))
    } else if cx >= right - snap {
        (right, false, Some(Edge::Right))
    } else {
        (cx, false, None)
    };
    let (x, y) = (cx - pill_offset(scale, k), top);
    if w.outer_position().ok().map(|at| (at.x, at.y)) != Some((x, y)) {
        let _ = w.set_position(PhysicalPosition::new(x, y));
    }
    s.pill = Some(PillSpot { cx, centered, edge });
    if s.open {
        send_edges(app, w, s);
    }
    let opens = anchor(&m, s, cx);
    send_anchor(app, s, opens, false);
    send_cue(app, s, Dragging { dragging: true, snapped: centered || edge.is_some() });
}

/// Called when the floating window moves: a drag moves the bubble's home.
/// The pill's spot is kept by its drag loop instead, since a move event only
/// gives the window's corner, not whether the pill was snapped.
pub fn moved<R: Runtime>(app: &AppHandle<R>, x: i32, y: i32) {
    let float = app.state::<Float>();
    // Busy means this is our own move (placing it), not a drag.
    let Ok(mut s) = float.0.try_lock() else { return };
    if s.style == Style::Pill {
        return;
    }
    let Some(w) = app.get_webview_window(LABEL) else { return };
    let scale = w.scale_factor().unwrap_or(1.0);
    s.rest = Some((x + (SHIFT.0 * scale) as i32, y + (SHIFT.1 * scale) as i32));
}

/// The main window says whether a session runs (and the feature is on),
/// whether the timer stays above other apps, and which style it has. A new
/// style closes the shelf and re-places the window right away.
#[tauri::command]
pub fn float_config(app: AppHandle, float: State<Float>, active: bool, on_top: bool, style: String) {
    let mut s = float.0.lock().unwrap();
    let style = Style::parse(&style);
    let changed = s.style != style;
    if changed && s.grab.is_some() {
        end_drag(&app, &float.1, &mut s);
    }
    s.style = style;
    s.active = active;
    s.on_top = on_top;
    apply(&app, &mut s);
    if !changed {
        return;
    }
    if let Some(w) = app.get_webview_window(LABEL) {
        if w.is_visible().unwrap_or(false) {
            close_shelf(&w, &mut s);
            place(&app, &w, &mut s);
        }
    }
}

/// The page says how wide the resting pill is now, so only the pill itself
/// opens it (it changes with the pin and with a longer time, like 1:12:40).
/// A pill docked to a side is placed again, so it keeps its 9px from it.
#[tauri::command]
pub fn float_pill_width(app: AppHandle, float: State<Float>, width: f64) {
    let mut s = float.0.lock().unwrap();
    let width = width.clamp(32.0, PILL_CARD);
    if s.pill_w == Some(width) {
        return;
    }
    s.pill_w = Some(width);
    if s.style != Style::Pill || s.grab.is_some() {
        return;
    }
    if let Some(w) = app.get_webview_window(LABEL) {
        if w.is_visible().unwrap_or(false) {
            place(&app, &w, &mut s);
        }
    }
}

/// The pill's size: with one, the handle under the card set it, so it's kept
/// and the window grows or shrinks around the pill's centre (staying exactly
/// on the middle of the screen if it was there); without, the page is asking
/// what it is when it starts. Either way it answers with the size.
#[tauri::command]
pub fn float_pill_size(app: AppHandle, float: State<Float>, size: Option<f64>) -> f64 {
    let mut s = float.0.lock().unwrap();
    load(&app, &mut s);
    let Some(size) = size else { return pill_size(&s) };
    let size = (size.clamp(PILL_SIZES.0, PILL_SIZES.1) * 100.0).round() / 100.0;
    if size == pill_size(&s) {
        return size;
    }
    s.pill_size = Some(size);
    save(&app, &s);
    if s.style == Style::Pill {
        if let Some(w) = app.get_webview_window(LABEL) {
            if w.is_visible().unwrap_or(false) {
                place(&app, &w, &mut s);
            }
        }
    }
    size
}

/// Forgets where the timer was dragged in the current style and puts it back
/// (the bubble in the corner, the pill centred on the main screen). The other
/// style's spot stays saved.
#[tauri::command]
pub fn float_reset(app: AppHandle, float: State<Float>) {
    let mut s = float.0.lock().unwrap();
    load(&app, &mut s);
    match s.style {
        Style::Bubble => s.rest = None,
        Style::Pill => s.pill = None,
    }
    save(&app, &s);
    if let Some(w) = app.get_webview_window(LABEL) {
        place(&app, &w, &mut s);
    }
}
