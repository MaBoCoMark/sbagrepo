// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

pub struct AppState {
    pub child_pid: Mutex<Option<u32>>,
}

// 按钮 1：语法检查 (Check)
#[tauri::command]
fn check_config(binary_path: String, config_path: String) -> Result<String, String> {
    let output = Command::new(&binary_path)
        .args(["check", "-c", &config_path])
        .output()
        .map_err(|e| format!("无法执行检查命令: {}", e))?;

    if output.status.success() {
        Ok("✅ 配置语法检查通过！".to_string())
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
        let out_msg = String::from_utf8_lossy(&output.stdout).to_string();
        let full_msg = if !err_msg.trim().is_empty() {
            err_msg
        } else {
            out_msg
        };
        Err(format!("❌ 配置错误:\n{}", full_msg))
    }
}

// 按钮 2：普通启动 (Direct Run - 无需管理员，适合 Mixed/SOCKS 模式)
#[tauri::command]
fn start_normal(
    app: AppHandle,
    state: State<'_, AppState>,
    binary_path: String,
    config_path: String,
) -> Result<(), String> {
    use std::process::Stdio;
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::process::Command as TokioCommand;

    let mut child = TokioCommand::new(&binary_path)
        .args(["run", "-c", &config_path])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动子进程失败: {}", e))?;

    if let Some(pid) = child.id() {
        if let Ok(mut pid_guard) = state.child_pid.lock() {
            *pid_guard = Some(pid);
        }
    }

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    if let Some(stdout) = stdout {
        let app_clone = app.clone();
        tauri::async_runtime::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_clone.emit("log-message", line);
            }
        });
    }

    if let Some(stderr) = stderr {
        let app_clone = app.clone();
        tauri::async_runtime::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_clone.emit("log-message", line);
            }
        });
    }

    tauri::async_runtime::spawn(async move {
        let _ = child.wait().await;
    });

    Ok(())
}

// 按钮 3：管理员提权启动 (Admin/Sudo Run - TUN 模式必须)
#[tauri::command]
fn start_admin(binary_path: String, config_path: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        // macOS 弹原生密码/指纹提权窗口
        let script = format!(
            "do shell script \"'{}' run -c '{}' > /dev/null 2>&1 &\" with administrator privileges",
            binary_path, config_path
        );
        let output = Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            Ok("macOS 管理员权限启动成功".to_string())
        } else {
            Err("授权失败或用户取消".to_string())
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows 弹 UAC 授权框 (RunAs)
        let args = format!("run -c '{}'", config_path);
        let status = Command::new("powershell")
            .args([
                "-Command",
                &format!("Start-Process '{}' -ArgumentList \"{}\" -Verb RunAs", binary_path, args)
            ])
            .status()
            .map_err(|e| e.to_string())?;

        if status.success() {
            Ok("Windows UAC 提权启动成功".to_string())
        } else {
            Err("提权启动被拒绝".to_string())
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (binary_path, config_path);
        Err("当前操作系统不支持提权启动，仅支持 macOS 与 Windows".to_string())
    }
}

// 按钮 4：终止进程 (Stop)
#[tauri::command]
fn stop_process(state: State<'_, AppState>) -> Result<String, String> {
    if let Ok(mut pid_guard) = state.child_pid.lock() {
        if let Some(pid) = *pid_guard {
            #[cfg(target_os = "windows")]
            {
                let _ = Command::new("taskkill")
                    .args(["/F", "/PID", &pid.to_string()])
                    .output();
            }
            #[cfg(not(target_os = "windows"))]
            {
                let _ = Command::new("kill")
                    .args(["-9", &pid.to_string()])
                    .output();
            }
            *pid_guard = None;
        }
    }

    // 终止可能由提权或外部启动的 sing-box 进程
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "sing-box.exe"])
            .output();
        let _ = Command::new("taskkill")
            .args(["/F", "/IM", "sing-box-x86_64-pc-windows-msvc.exe"])
            .output();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("pkill")
            .args(["-f", "sing-box"])
            .output();
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = Command::new("pkill")
            .args(["-f", "sing-box"])
            .output();
    }

    Ok("进程已终止".to_string())
}

// 辅助命令：读取配置文件
#[tauri::command]
fn read_config_file(config_path: String) -> Result<String, String> {
    std::fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            child_pid: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            check_config,
            start_normal,
            start_admin,
            stop_process,
            read_config_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running singbox desktop application");
}
