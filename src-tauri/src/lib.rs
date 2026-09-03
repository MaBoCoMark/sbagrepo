pub mod commands;
pub mod paths;
pub mod state;
pub mod tray;
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
            is_admin: Mutex::new(false),
            manual_stop: Mutex::new(false),
            mitm_ctx: Mutex::new(None),
            mitm_listener: Mutex::new(None),
            mitm_port: Mutex::new(None),
            tray_mode: Mutex::new("stopped".to_string()),
            tray_port: Mutex::new("-".to_string()),
            tray_type: Mutex::new("Mixed".to_string()),
        })
        .setup(|app| {
            tray::setup_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::check_config,
            commands::start_normal,
            commands::start_admin,
            commands::stop_process,
            commands::update_tray_info,
            commands::read_config_file,
            commands::import_config_file,
            commands::check_binary_status,
            commands::import_binary_file,
            commands::save_runtime_override,
            commands::detect_environment,
            commands::sniff_mitm_port,
            commands::toggle_mitm_listener,
            commands::get_mitm_status,
            commands::import_ca_cert,
            commands::get_ca_cert_info,
            commands::delete_ca_cert
        ])
        .run(tauri::generate_context!())
        .expect("error while running singbox desktop application");
}
