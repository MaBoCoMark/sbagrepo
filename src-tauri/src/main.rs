// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;
use tauri::{AppHandle, Emitter, State};
use serde::{Deserialize, Serialize};

#[derive(Default)]
pub struct AppState {
    // Normal process child handle for graceful termination
    child_process: Arc<TokioMutex<Option<tokio::process::Child>>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DefaultPaths {
    #[serde(rename = "binaryPath")]
    pub binary_path: String,
    #[serde(rename = "configPath")]
    pub config_path: String,
    pub os: String,
    pub arch: String,
}

/// Helper to resolve binary path from explicit parameter or platform defaults
fn resolve_binary(binary_path: Option<String>) -> Result<PathBuf, String> {
    if let Some(path_str) = binary_path {
        let trimmed = path_str.trim();
        if !trimmed.is_empty() {
            let path = PathBuf::from(trimmed);
            if path.exists() {
                return Ok(path);
            }
        }
    }

    // Default sidecar search paths
    #[cfg(target_os = "macos")]
    let default_names = vec![
        "src-tauri/binaries/sing-box-aarch64-apple-darwin",
        "binaries/sing-box-aarch64-apple-darwin",
        "sing-box-aarch64-apple-darwin",
        "sing-box",
        "/usr/local/bin/sing-box",
        "/opt/homebrew/bin/sing-box",
    ];

    #[cfg(target_os = "windows")]
    let default_names = vec![
        "src-tauri/binaries/sing-box-x86_64-pc-windows-msvc.exe",
        "binaries/sing-box-x86_64-pc-windows-msvc.exe",
        "sing-box-x86_64-pc-windows-msvc.exe",
        "sing-box.exe",
    ];

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let default_names = vec![
        "src-tauri/binaries/sing-box-aarch64-apple-darwin",
        "sing-box",
    ];

    for candidate in default_names {
        let p = PathBuf::from(candidate);
        if p.exists() {
            return Ok(p);
        }
    }

    // Fallback: return the first standard sidecar name for the platform
    #[cfg(target_os = "windows")]
    return Ok(PathBuf::from("src-tauri/binaries/sing-box-x86_64-pc-windows-msvc.exe"));

    #[cfg(not(target_os = "windows"))]
    return Ok(PathBuf::from("src-tauri/binaries/sing-box-aarch64-apple-darwin"));
}

/// Helper to resolve config file path
fn resolve_config(config_path: Option<String>) -> Result<PathBuf, String> {
    if let Some(path_str) = config_path {
        let trimmed = path_str.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }

    let default_candidates = ["config.json", "src/assets/sample-config.json"];
    for cand in default_candidates {
        let p = PathBuf::from(cand);
        if p.exists() {
            return Ok(p);
        }
    }

    Ok(PathBuf::from("config.json"))
}

// ==========================================
// 按钮 1：语法检查 (Check)
// ==========================================
#[tauri::command]
fn check_config(
    binary_path: Option<String>,
    config_path: Option<String>,
) -> Result<String, String> {
    let bin = resolve_binary(binary_path)?;
    let cfg = resolve_config(config_path)?;

    if !bin.exists() {
        return Err(format!(
            "❌ 找不到 sing-box 二进制文件:\n{}\n请检查 src-tauri/binaries/ 目录或在输入框中指定路径。",
            bin.display()
        ));
    }

    if !cfg.exists() {
        return Err(format!(
            "❌ 找不到配置文件:\n{}\n请确认 config.json 文件存在。",
            cfg.display()
        ));
    }

    let output = Command::new(&bin)
        .args(["check", "-c", cfg.to_str().unwrap_or("config.json")])
        .output()
        .map_err(|e| format!("无法执行 '{}': {}", bin.display(), e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            Ok(format!("✅ 配置语法检查通过！[{}]", cfg.display()))
        } else {
            Ok(format!("✅ 配置语法检查通过！\n{}", stdout))
        }
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
        let out_msg = String::from_utf8_lossy(&output.stdout).to_string();
        let details = if !err_msg.is_empty() { err_msg } else { out_msg };
        Err(format!("❌ 配置语法错误 (Exit code {:?}):\n{}", output.status.code(), details))
    }
}

// ==========================================
// 按钮 2：普通启动 (Direct Run - 无需管理员，适合 Mixed/SOCKS 模式)
// ==========================================
#[tauri::command]
async fn start_normal(
    app: AppHandle,
    state: State<'_, AppState>,
    binary_path: Option<String>,
    config_path: Option<String>,
) -> Result<(), String> {
    let bin = resolve_binary(binary_path)?;
    let cfg = resolve_config(config_path)?;

    if !bin.exists() {
        return Err(format!(
            "❌ 找不到 sing-box 二进制文件: {}\n请先放置到 src-tauri/binaries/ 目录",
            bin.display()
        ));
    }

    if !cfg.exists() {
        return Err(format!("❌ 找不到配置文件: {}", cfg.display()));
    }

    // 终止之前可能还在运行的旧普通子进程
    {
        let mut child_guard = state.child_process.lock().await;
        if let Some(mut existing) = child_guard.take() {
            let _ = existing.kill().await;
        }
    }

    use std::process::Stdio;
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::process::Command as TokioCommand;

    let mut command = TokioCommand::new(&bin);
    command
        .args(["run", "-c", cfg.to_str().unwrap_or("config.json")])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| format!("启动进程失败 ({}): {}", bin.display(), e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // 存储当前正在运行的子进程句柄
    {
        let mut child_guard = state.child_process.lock().await;
        *child_guard = Some(child);
    }

    let _ = app.emit("process-status", "running");
    let _ = app.emit("log-message", format!("[SYSTEM] sing-box 已在普通模式启动 ({})", bin.display()));

    // 异步管道 1：读取 stdout 流并推送到前端
    let app_clone_out = app.clone();
    if let Some(stdout) = stdout {
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_clone_out.emit("log-message", line);
            }
        });
    }

    // 异步管道 2：读取 stderr 流并推送到前端 (sing-box 多数日志默认输出至 stderr)
    let app_clone_err = app.clone();
    if let Some(stderr) = stderr {
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_clone_err.emit("log-message", line);
            }
        });
    }

    // 监控进程退出状态
    let app_clone_exit = app.clone();
    let child_holder = state.child_process.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            let mut guard = child_holder.lock().await;
            if let Some(ref mut child) = *guard {
                if let Ok(Some(status)) = child.try_wait() {
                    let _ = app_clone_exit.emit("log-message", format!("[SYSTEM] sing-box 进程退出，状态码: {:?}", status.code()));
                    let _ = app_clone_exit.emit("process-status", "stopped");
                    *guard = None;
                    break;
                }
            } else {
                break;
            }
        }
    });

    Ok(())
}

// ==========================================
// 按钮 3：管理员提权启动 (Admin/Sudo Run - TUN 模式必须)
// ==========================================
#[tauri::command]
fn start_admin(
    app: AppHandle,
    binary_path: Option<String>,
    config_path: Option<String>,
) -> Result<String, String> {
    let bin = resolve_binary(binary_path)?;
    let cfg = resolve_config(config_path)?;

    if !bin.exists() {
        return Err(format!("❌ 找不到 sing-box 二进制文件: {}", bin.display()));
    }
    if !cfg.exists() {
        return Err(format!("❌ 找不到配置文件: {}", cfg.display()));
    }

    let bin_abs = fs::canonicalize(&bin).unwrap_or(bin);
    let cfg_abs = fs::canonicalize(&cfg).unwrap_or(cfg);

    #[cfg(target_os = "macos")]
    {
        // macOS 弹原生 Touch ID / 密码提权窗口并后台运行
        let script = format!(
            "do shell script \"'{}' run -c '{}' > /dev/null 2>&1 &\" with administrator privileges",
            bin_abs.display(),
            cfg_abs.display()
        );
        let output = Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| format!("执行 osascript 失败: {}", e))?;

        if output.status.success() {
            let _ = app.emit("process-status", "elevated");
            let _ = app.emit("log-message", "[ADMIN] macOS 管理员权限提权成功，sing-box (TUN 模式) 已在后台启动");
            Ok("macOS 管理员权限启动成功 (已通过 Touch ID / 密码认证)".to_string())
        } else {
            let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
            Err(format!("macOS 提权授权被拒绝或取消: {}", err_msg.trim()))
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows 弹 UAC 授权框 (RunAs)
        let bin_str = bin_abs.to_string_lossy().to_string();
        let cfg_str = cfg_abs.to_string_lossy().to_string();
        let args = format!("run -c '{}'", cfg_str);

        let status = Command::new("powershell")
            .args([
                "-WindowStyle", "Hidden",
                "-Command",
                &format!("Start-Process -FilePath '{}' -ArgumentList \"{}\" -Verb RunAs", bin_str, args),
            ])
            .status()
            .map_err(|e| format!("PowerShell 执行失败: {}", e))?;

        if status.success() {
            let _ = app.emit("process-status", "elevated");
            let _ = app.emit("log-message", "[ADMIN] Windows UAC 提权成功，sing-box (TUN 模式) 已在后台启动");
            Ok("Windows UAC 提权启动成功 (已在管理员特权下启动)".to_string())
        } else {
            Err("Windows UAC 提权被拒绝或取消".to_string())
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Err("管理员启动命令仅支持 macOS 与 Windows 平台。".to_string())
    }
}

// ==========================================
// 按钮 4：终止进程 (Stop Process)
// ==========================================
#[tauri::command]
async fn stop_process(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut stopped_normal = false;

    // 1. 杀死由普通模式启动的子进程句柄
    {
        let mut guard = state.child_process.lock().await;
        if let Some(mut child) = guard.take() {
            let _ = child.kill().await;
            stopped_normal = true;
        }
    }

    // 2. 针对提权启动或孤儿进程，执行跨平台终止命令
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("pkill")
            .args(["-SIGINT", "sing-box"])
            .output();
        // 如果依然存在则强制 kill
        let _ = Command::new("pkill")
            .args(["-9", "sing-box"])
            .output();
    }

    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "sing-box.exe", "/T"])
            .output();
    }

    let _ = app.emit("process-status", "stopped");
    let _ = app.emit("log-message", "[SYSTEM] 已发送终止信号，sing-box 进程已停止。");

    if stopped_normal {
        Ok("已终止普通启动的 sing-box 进程及相关后台实例。".to_string())
    } else {
        Ok("已发送全局进程终止指令 (sing-box 实例已关闭)。".to_string())
    }
}

// ==========================================
// 辅助命令：获取平台默认路径
// ==========================================
#[tauri::command]
fn get_default_paths() -> DefaultPaths {
    #[cfg(target_os = "macos")]
    {
        DefaultPaths {
            binary_path: "src-tauri/binaries/sing-box-aarch64-apple-darwin".to_string(),
            config_path: "config.json".to_string(),
            os: "macos".to_string(),
            arch: "aarch64".to_string(),
        }
    }

    #[cfg(target_os = "windows")]
    {
        DefaultPaths {
            binary_path: "src-tauri/binaries/sing-box-x86_64-pc-windows-msvc.exe".to_string(),
            config_path: "config.json".to_string(),
            os: "windows".to_string(),
            arch: "x86_64".to_string(),
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        DefaultPaths {
            binary_path: "src-tauri/binaries/sing-box-aarch64-apple-darwin".to_string(),
            config_path: "config.json".to_string(),
            os: "linux".to_string(),
            arch: "x86_64".to_string(),
        }
    }
}

// ==========================================
// 辅助命令：读取本地配置文件
// ==========================================
#[tauri::command]
fn read_config_file(path: Option<String>) -> Result<String, String> {
    let p = resolve_config(path)?;
    fs::read_to_string(&p)
        .map_err(|e| format!("无法读取配置文件 '{}': {}", p.display(), e))
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            check_config,
            start_normal,
            start_admin,
            stop_process,
            get_default_paths,
            read_config_file
        ])
        .run(tauri::generate_context!())
        .expect("运行 Tauri 应用程序时发生错误");
}
