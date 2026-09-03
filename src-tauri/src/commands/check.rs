use std::process::Command;
use tauri::{AppHandle, Emitter};
use crate::paths::{resolve_binary, resolve_config};
use crate::utils::clean_ansi;

/// 语法检查 (Check)
#[tauri::command]
pub fn check_config(
    app: AppHandle,
    binary_path: String,
    config_path: String,
) -> Result<String, String> {
    println!(
        "[singbox-desktop][check_config] 请求检查配置: binary_path=\"{}\", config_path=\"{}\"",
        binary_path, config_path
    );

    let resolved_binary = match resolve_binary(&binary_path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[singbox-desktop][check_config] 错误: {}", e);
            let _ = app.emit("log-message", format!("[ERROR][check_config] {}", e));
            return Err(e);
        }
    };

    let resolved_config = match resolve_config(&config_path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[singbox-desktop][check_config] 错误: {}", e);
            let _ = app.emit("log-message", format!("[ERROR][check_config] {}", e));
            return Err(e);
        }
    };

    println!(
        "[singbox-desktop][check_config] 正在执行: {} check -c {}",
        resolved_binary.display(),
        resolved_config.display()
    );
    let _ = app.emit(
        "log-message",
        format!(
            "[INFO] 执行语法检查: {} check -c {}",
            resolved_binary.display(),
            resolved_config.display()
        ),
    );

    let output = match Command::new(&resolved_binary)
        .args(["check", "-c"])
        .arg(&resolved_config)
        .output()
    {
        Ok(out) => out,
        Err(e) => {
            let err_msg = format!(
                "无法执行检查命令！\n执行路径: {}\n错误原因: {}\n请检查该文件是否损坏或受权限限制。",
                resolved_binary.display(),
                e
            );
            eprintln!("[singbox-desktop][check_config] 错误: {}", err_msg);
            let _ = app.emit("log-message", format!("[ERROR] {}", err_msg));
            return Err(err_msg);
        }
    };

    if output.status.success() {
        let msg = "✅ 配置语法检查通过！".to_string();
        println!("[singbox-desktop][check_config] 成功: {}", msg);
        let _ = app.emit("log-message", format!("[SUCCESS] {}", msg));
        Ok(msg)
    } else {
        let stderr_raw = String::from_utf8_lossy(&output.stderr);
        let stdout_raw = String::from_utf8_lossy(&output.stdout);
        let raw_msg = if !stderr_raw.trim().is_empty() {
            stderr_raw
        } else {
            stdout_raw
        };
        let cleaned_msg = clean_ansi(raw_msg.trim());
        let formatted_err = format!("❌ 配置错误:\n{}", cleaned_msg);
        eprintln!("[singbox-desktop][check_config] 配置校验失败:\n{}", formatted_err);
        let _ = app.emit("log-message", format!("[ERROR] {}", formatted_err));
        Err(formatted_err)
    }
}
