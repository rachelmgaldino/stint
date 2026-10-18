//! Google Calendar access for an installed app: OAuth with a loopback
//! redirect and PKCE, the refresh token kept in the Windows credential store,
//! and a small proxy so the UI can call the Calendar API without ever seeing
//! a token.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const REVOKE_URL: &str = "https://oauth2.googleapis.com/revoke";
const API_BASE: &str = "https://www.googleapis.com/calendar/v3";
const SCOPES: &str = "https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events";
const KEYRING_SERVICE: &str = "com.rachelmgaldino.stint";
const KEYRING_USER: &str = "google";
const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(300);

#[derive(Serialize, Deserialize, Clone)]
struct Saved {
    client_id: String,
    client_secret: String,
    refresh_token: String,
}

struct Access {
    token: String,
    expires: Instant,
}

#[derive(Default)]
pub struct Google {
    access: Mutex<Option<Access>>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
    refresh_token: Option<String>,
}

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())
}

fn load_saved() -> Option<Saved> {
    let secret = entry().ok()?.get_password().ok()?;
    serde_json::from_str(&secret).ok()
}

fn random_url_safe(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    rand::thread_rng().fill_bytes(&mut buf);
    URL_SAFE_NO_PAD.encode(buf)
}

pub fn pkce_challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

pub fn auth_url(client_id: &str, redirect: &str, challenge: &str, state: &str) -> String {
    let mut u = url::Url::parse(AUTH_URL).unwrap();
    u.query_pairs_mut()
        .append_pair("client_id", client_id)
        .append_pair("redirect_uri", redirect)
        .append_pair("response_type", "code")
        .append_pair("scope", SCOPES)
        .append_pair("code_challenge", challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("state", state)
        .append_pair("access_type", "offline")
        .append_pair("prompt", "consent");
    u.into()
}

/// What the browser sent back to the loopback server.
#[derive(Debug, PartialEq)]
pub enum Callback {
    Code(String),
    Error(String),
    /// Some other request, such as the browser asking for a favicon.
    Other,
}

/// Reads the code from a request line like `GET /?code=…&state=… HTTP/1.1`.
pub fn parse_callback(request_line: &str, expected_state: &str) -> Callback {
    let Some(target) = request_line.split_whitespace().nth(1) else {
        return Callback::Other;
    };
    let Ok(u) = url::Url::parse(&format!("http://127.0.0.1{target}")) else {
        return Callback::Other;
    };
    if u.path() != "/" {
        return Callback::Other;
    }
    let mut code = None;
    let mut state = None;
    let mut error = None;
    for (k, v) in u.query_pairs() {
        match k.as_ref() {
            "code" => code = Some(v.into_owned()),
            "state" => state = Some(v.into_owned()),
            "error" => error = Some(v.into_owned()),
            _ => {}
        }
    }
    if let Some(e) = error {
        return Callback::Error(e);
    }
    match (code, state) {
        (Some(c), Some(s)) if s == expected_state => Callback::Code(c),
        (Some(_), _) => Callback::Error("the sign-in response didn't match this request".into()),
        _ => Callback::Other,
    }
}

fn respond(mut stream: TcpStream, message: &str) {
    let body = format!(
        "<!doctype html><meta charset=utf-8><title>Stint</title>\
         <body style=\"font-family:system-ui;padding:48px;text-align:center\">\
         <h2>{message}</h2><p>You can close this tab and go back to Stint.</p>"
    );
    let _ = write!(
        stream,
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
}

/// Waits for Google to redirect the browser back with a code.
fn wait_for_code(listener: TcpListener, state: &str) -> Result<String, String> {
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let deadline = Instant::now() + SIGN_IN_TIMEOUT;
    loop {
        if Instant::now() > deadline {
            return Err("Sign-in timed out. Try connecting again.".into());
        }
        match listener.accept() {
            Ok((mut stream, _)) => {
                let _ = stream.set_nonblocking(false);
                let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).unwrap_or(0);
                let request = String::from_utf8_lossy(&buf[..n]);
                let line = request.lines().next().unwrap_or("");
                match parse_callback(line, state) {
                    Callback::Code(code) => {
                        respond(stream, "Stint is connected to Google Calendar");
                        return Ok(code);
                    }
                    Callback::Error(e) => {
                        respond(stream, "Google sign-in didn't finish");
                        return Err(format!("Google sign-in failed: {e}"));
                    }
                    Callback::Other => {
                        let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
                    }
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(150));
            }
            Err(e) => return Err(e.to_string()),
        }
    }
}

async fn token_request(form: &[(&str, &str)]) -> Result<TokenResponse, String> {
    let res = reqwest::Client::new()
        .post(TOKEN_URL)
        .form(form)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(format!("Google refused the sign-in: {text}"));
    }
    res.json().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn google_connect(
    app: AppHandle,
    google: State<'_, Google>,
    client_id: String,
    client_secret: String,
) -> Result<(), String> {
    let client_id = client_id.trim().to_string();
    let client_secret = client_secret.trim().to_string();
    if client_id.is_empty() || client_secret.is_empty() {
        return Err("Paste both the client ID and the client secret.".into());
    }
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let redirect = format!("http://127.0.0.1:{}", listener.local_addr().map_err(|e| e.to_string())?.port());
    let verifier = random_url_safe(48);
    let state = random_url_safe(16);
    let url = auth_url(&client_id, &redirect, &pkce_challenge(&verifier), &state);
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())?;

    let code = tauri::async_runtime::spawn_blocking(move || wait_for_code(listener, &state))
        .await
        .map_err(|e| e.to_string())??;

    let t = token_request(&[
        ("code", code.as_str()),
        ("client_id", client_id.as_str()),
        ("client_secret", client_secret.as_str()),
        ("redirect_uri", redirect.as_str()),
        ("grant_type", "authorization_code"),
        ("code_verifier", verifier.as_str()),
    ])
    .await?;
    let refresh_token = t
        .refresh_token
        .ok_or("Google didn't return a refresh token. Remove Stint's access in your Google account and try again.")?;
    let saved = Saved { client_id, client_secret, refresh_token };
    entry()?
        .set_password(&serde_json::to_string(&saved).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    *google.access.lock().unwrap() = Some(Access {
        token: t.access_token,
        expires: Instant::now() + Duration::from_secs(t.expires_in.saturating_sub(60)),
    });
    Ok(())
}

#[tauri::command]
pub fn google_status() -> bool {
    load_saved().is_some()
}

#[tauri::command]
pub async fn google_disconnect(google: State<'_, Google>) -> Result<(), String> {
    if let Some(saved) = load_saved() {
        // Best effort: also remove Stint's access on Google's side.
        let _ = reqwest::Client::new()
            .post(REVOKE_URL)
            .form(&[("token", saved.refresh_token.as_str())])
            .send()
            .await;
    }
    *google.access.lock().unwrap() = None;
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

async fn access_token(google: &Google, force_refresh: bool) -> Result<String, String> {
    if !force_refresh {
        if let Some(a) = google.access.lock().unwrap().as_ref() {
            if a.expires > Instant::now() {
                return Ok(a.token.clone());
            }
        }
    }
    let saved = load_saved().ok_or("Google Calendar isn't connected.")?;
    let t = token_request(&[
        ("client_id", saved.client_id.as_str()),
        ("client_secret", saved.client_secret.as_str()),
        ("refresh_token", saved.refresh_token.as_str()),
        ("grant_type", "refresh_token"),
    ])
    .await?;
    let token = t.access_token.clone();
    *google.access.lock().unwrap() = Some(Access {
        token: t.access_token,
        expires: Instant::now() + Duration::from_secs(t.expires_in.saturating_sub(60)),
    });
    Ok(token)
}

/// Calls the Calendar API. `path` is relative to the v3 base, query included,
/// so the UI can only reach the calendar endpoints.
#[tauri::command]
pub async fn google_request(
    google: State<'_, Google>,
    method: String,
    path: String,
    body: Option<Value>,
) -> Result<Value, String> {
    if !path.starts_with('/') || path.contains("..") {
        return Err("bad path".into());
    }
    let method = reqwest::Method::from_bytes(method.as_bytes()).map_err(|e| e.to_string())?;
    let client = reqwest::Client::new();
    let mut retried = false;
    loop {
        let token = access_token(&google, retried).await?;
        let mut req = client.request(method.clone(), format!("{API_BASE}{path}")).bearer_auth(token);
        if let Some(b) = &body {
            req = req.json(b);
        }
        let res = req.send().await.map_err(|e| e.to_string())?;
        let status = res.status();
        if status == reqwest::StatusCode::UNAUTHORIZED && !retried {
            retried = true;
            continue;
        }
        let text = res.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(format!("Google Calendar returned {status}: {text}"));
        }
        return Ok(if text.is_empty() { Value::Null } else { serde_json::from_str(&text).unwrap_or(Value::Null) });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pkce_matches_the_rfc_example() {
        // RFC 7636, appendix B.
        assert_eq!(
            pkce_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn builds_the_consent_url() {
        let u = auth_url("abc.apps.googleusercontent.com", "http://127.0.0.1:5555", "xyz", "s1");
        assert!(u.starts_with(AUTH_URL));
        assert!(u.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A5555"));
        assert!(u.contains("code_challenge_method=S256"));
        assert!(u.contains("access_type=offline"));
    }

    #[test]
    fn parses_the_redirect() {
        assert_eq!(parse_callback("GET /?state=s1&code=4%2Fabc HTTP/1.1", "s1"), Callback::Code("4/abc".into()));
        assert_eq!(parse_callback("GET /?error=access_denied&state=s1 HTTP/1.1", "s1"), Callback::Error("access_denied".into()));
        assert!(matches!(parse_callback("GET /?code=x&state=other HTTP/1.1", "s1"), Callback::Error(_)));
        assert_eq!(parse_callback("GET /favicon.ico HTTP/1.1", "s1"), Callback::Other);
    }
}
