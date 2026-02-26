#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .unwrap_or_else(|err| {
            eprintln!("Fatal: failed to start Kata Cloud Agents: {err}");
            std::process::exit(1);
        });
}
