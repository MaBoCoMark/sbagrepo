pub mod commands;
pub mod paths;
pub mod state;
pub mod utils;

use state::AppState;
use std::sync::Mutex;

/// 启动 sing-box Desktop 后端服务
pub fn run() {
    let cwd = std::env::current_dir()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|_| "未知".to_string());
    println!("==================================================");
    println!("  sing-box Desktop 后端服务启动");
    println!("  当前工作目录 (CWD): {}", cwd);
    println!("==================================================");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            child_pid: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            commands::check_config,
            commands::start_normal,
            commands::start_admin,
            commands::stop_process,
            commands::read_config_file,
            commands::detect_environment
        ])
        .run(tauri::generate_context!())
        .expect("error while running singbox desktop application");
}
