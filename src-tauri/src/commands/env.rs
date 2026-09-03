use serde::Serialize;
use crate::paths::{resolve_binary, resolve_config};

#[derive(Serialize)]
pub struct EnvDetectionResult {
    pub binary_path: String,
    pub config_path: String,
    pub binary_found: bool,
    pub config_found: bool,
    pub cwd: String,
}

/// 环境与文件路径自动探测命令
#[tauri::command]
pub fn detect_environment(default_binary: String, default_config: String) -> EnvDetectionResult {
    let cwd = std::env::current_dir()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|_| ".".to_string());

    let (bin_path, bin_found) = match resolve_binary(&default_binary) {
        Ok(p) => (p.display().to_string(), true),
        Err(_) => (default_binary, false),
    };

    let (cfg_path, cfg_found) = match resolve_config(&default_config) {
        Ok(p) => (p.display().to_string(), true),
        Err(_) => (default_config, false),
    };

    println!(
        "[singbox-desktop][detect_environment] CWD={}, Binary=\"{}\" (found={}), Config=\"{}\" (found={})",
        cwd, bin_path, bin_found, cfg_path, cfg_found
    );

    EnvDetectionResult {
        binary_path: bin_path,
        config_path: cfg_path,
        binary_found: bin_found,
        config_found: cfg_found,
        cwd,
    }
}
