pub mod commands;
pub mod paths;
pub mod state;
pub mod tray;
pub mod utils;

use state::AppState;
use std::sync::atomic::Ordering;
use std::sync::Mutex;
use tauri::Manager;

/// 启动 sing-box Desktop 后端服务
pub fn run() {
    let cwd = std::env::current_dir()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|_| "未知".to_string());
    println!("==================================================");
    println!("  sing-box Desktop 后端服务启动");
    println!("  当前工作目录 (CWD): {}", cwd);
    println!("==================================================");

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            child_pid: Mutex::new(None),
            is_admin: Mutex::new(false),
            manual_stop: Mutex::new(false),
            mitm_ctx: Mutex::new(None),
            mitm_port: Mutex::new(None),
            mitm_shutdown: Mutex::new(None),
            is_quitting: std::sync::atomic::AtomicBool::new(false),
            log_buffer: Mutex::new(state::LogBuffer::new(20 * 1024 * 1024)),
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
            commands::get_process_status,
            commands::get_memory_logs,
            commands::clear_memory_logs,
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
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building singbox desktop application");

    // 核心生命周期控制：点击主窗口红叉仅彻底关闭/销毁该窗口，不导致应用进程退出
    // 应用常驻后台并保持托盘，仅当用户从托盘点击“退出程序”时放行 ExitRequested
    app.run(|app_handle, event| {
        if let tauri::RunEvent::ExitRequested { api, .. } = event {
            let is_quitting = app_handle
                .try_state::<AppState>()
                .map(|s| s.is_quitting.load(Ordering::SeqCst))
                .unwrap_or(false);
            if !is_quitting {
                api.prevent_exit();
            }
        }
    });
}
