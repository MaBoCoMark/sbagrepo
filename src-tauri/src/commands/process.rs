use std::process::Command;
use tauri::{AppHandle, Emitter, Manager, State};
use crate::paths::{resolve_binary, resolve_config};
use crate::state::AppState;
use crate::utils::clean_ansi;

/// 普通启动 (Direct Run - 无需管理员，适合 Mixed/SOCKS 模式)
#[tauri::command]
pub async fn start_normal(
    app: AppHandle,
    state: State<'_, AppState>,
    binary_path: String,
    config_path: String,
) -> Result<(), String> {
    use std::process::Stdio;
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::process::Command as TokioCommand;

    println!(
        "[singbox-desktop][start_normal] 请求启动: binary_path=\"{}\", config_path=\"{}\"",
        binary_path, config_path
    );

    let resolved_binary = match resolve_binary(&binary_path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[singbox-desktop][start_normal] 错误: {}", e);
            let _ = app.emit("log-message", format!("[ERROR][start_normal] {}", e));
            return Err(e);
        }
    };

    let resolved_config = match resolve_config(&config_path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[singbox-desktop][start_normal] 错误: {}", e);
            let _ = app.emit("log-message", format!("[ERROR][start_normal] {}", e));
            return Err(e);
        }
    };

    println!(
        "[singbox-desktop][start_normal] 启动子进程: {} run -c {}",
        resolved_binary.display(),
        resolved_config.display()
    );
    let _ = app.emit(
        "log-message",
        format!(
            "[INFO] 启动 sing-box: {} run -c {}",
            resolved_binary.display(),
            resolved_config.display()
        ),
    );

    let mut cmd = TokioCommand::new(&resolved_binary);
    cmd.args(["run", "-c"])
        .arg(&resolved_config)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Windows 下隐藏控制台黑框
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            let err_msg = format!(
                "启动子进程失败！\n执行路径: {}\n错误原因: {}\n请检查可执行文件权限或操作系统限制。",
                resolved_binary.display(),
                e
            );
            eprintln!("[singbox-desktop][start_normal] 错误: {}", err_msg);
            let _ = app.emit("log-message", format!("[ERROR] {}", err_msg));
            return Err(err_msg);
        }
    };

    if let Some(pid) = child.id() {
        println!("[singbox-desktop][start_normal] 子进程拉起成功，PID: {}", pid);
        let _ = app.emit("log-message", format!("[INFO] sing-box 运行中 (PID: {})", pid));
        if let Ok(mut pid_guard) = state.child_pid.lock() {
            *pid_guard = Some(pid);
        }
    }

    // 监听 stdout 日志，自动清洗 ANSI 颜色/控制转义码
    let stdout = child.stdout.take();
    if let Some(stdout) = stdout {
        let app_clone = app.clone();
        tauri::async_runtime::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let cleaned = clean_ansi(&line);
                println!("[sing-box][stdout] {}", cleaned);
                let _ = app_clone.emit("log-message", cleaned);
            }
        });
    }

    // 监听 stderr 日志，自动清洗 ANSI 颜色/控制转义码
    let stderr = child.stderr.take();
    if let Some(stderr) = stderr {
        let app_clone = app.clone();
        tauri::async_runtime::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let cleaned = clean_ansi(&line);
                eprintln!("[sing-box][stderr] {}", cleaned);
                let _ = app_clone.emit("log-message", cleaned);
            }
        });
    }

    // 监听进程退出并自动清理 PID
    let app_clone2 = app.clone();
    tauri::async_runtime::spawn(async move {
        let exit_res = child.wait().await;
        
        // 进程退出后，重置 AppState 中的 child_pid
        if let Some(state) = app_clone2.try_state::<AppState>() {
            if let Ok(mut pid_guard) = state.child_pid.lock() {
                *pid_guard = None;
            }
        }

        match exit_res {
            Ok(status) => {
                let msg = format!("[singbox-desktop] sing-box 进程已退出，状态: {}", status);
                println!("{}", msg);
                let _ = app_clone2.emit("log-message", &msg);
                let _ = app_clone2.emit("process-stopped", ());
            }
            Err(e) => {
                let msg = format!("[singbox-desktop] 等待 sing-box 进程退出异常: {}", e);
                eprintln!("{}", msg);
                let _ = app_clone2.emit("log-message", &msg);
                let _ = app_clone2.emit("process-stopped", ());
            }
        }
    });

    Ok(())
}

/// 管理员提权启动 (Admin/Sudo Run - TUN 模式必须)
#[tauri::command]
pub fn start_admin(
    app: AppHandle,
    binary_path: String,
    config_path: String,
) -> Result<String, String> {
    println!(
        "[singbox-desktop][start_admin] 请求管理员提权启动: binary_path=\"{}\", config_path=\"{}\"",
        binary_path, config_path
    );

    let resolved_binary = match resolve_binary(&binary_path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[singbox-desktop][start_admin] 错误: {}", e);
            let _ = app.emit("log-message", format!("[ERROR][start_admin] {}", e));
            return Err(e);
        }
    };

    let resolved_config = match resolve_config(&config_path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[singbox-desktop][start_admin] 错误: {}", e);
            let _ = app.emit("log-message", format!("[ERROR][start_admin] {}", e));
            return Err(e);
        }
    };

    let bin_str = resolved_binary.to_string_lossy();
    let cfg_str = resolved_config.to_string_lossy();

    println!(
        "[singbox-desktop][start_admin] 准备提权拉起: {} run -c {}",
        bin_str, cfg_str
    );
    let _ = app.emit(
        "log-message",
        format!("[INFO] 正在申请管理员权限拉起: {} run -c {}", bin_str, cfg_str),
    );

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "do shell script \"'{}' run -c '{}' > /dev/null 2>&1 &\" with administrator privileges",
            bin_str, cfg_str
        );
        println!("[singbox-desktop][start_admin] 执行 AppleScript 提权...");
        let output = Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| {
                let err_msg = format!("执行 osascript 失败: {}", e);
                eprintln!("[singbox-desktop][start_admin] 错误: {}", err_msg);
                let _ = app.emit("log-message", format!("[ERROR] {}", err_msg));
                err_msg
            })?;

        if output.status.success() {
            let msg = "macOS 管理员权限启动成功".to_string();
            println!("[singbox-desktop][start_admin] 成功: {}", msg);
            let _ = app.emit("log-message", format!("[SUCCESS] {}", msg));
            Ok(msg)
        } else {
            let err = String::from_utf8_lossy(&output.stderr).to_string();
            let msg = format!("授权失败或用户取消: {}", err.trim());
            eprintln!("[singbox-desktop][start_admin] 错误: {}", msg);
            let _ = app.emit("log-message", format!("[ERROR] {}", msg));
            Err(msg)
        }
    }

    #[cfg(target_os = "windows")]
    {
        let args = format!("run -c '{}'", cfg_str);
        println!("[singbox-desktop][start_admin] 启动 PowerShell UAC 提权...");
        let status = Command::new("powershell")
            .args([
                "-Command",
                &format!("Start-Process '{}' -ArgumentList \"{}\" -Verb RunAs", bin_str, args)
            ])
            .status()
            .map_err(|e| {
                let err_msg = format!("启动 PowerShell 提权失败: {}", e);
                eprintln!("[singbox-desktop][start_admin] 错误: {}", err_msg);
                let _ = app.emit("log-message", format!("[ERROR] {}", err_msg));
                err_msg
            })?;

        if status.success() {
            let msg = "Windows UAC 提权启动成功".to_string();
            println!("[singbox-desktop][start_admin] 成功: {}", msg);
            let _ = app.emit("log-message", format!("[SUCCESS] {}", msg));
            Ok(msg)
        } else {
            let msg = "提权启动被拒绝或用户取消".to_string();
            eprintln!("[singbox-desktop][start_admin] 错误: {}", msg);
            let _ = app.emit("log-message", format!("[ERROR] {}", msg));
            Err(msg)
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let msg = "当前操作系统暂不支持提权启动，仅支持 macOS 与 Windows".to_string();
        eprintln!("[singbox-desktop][start_admin] 错误: {}", msg);
        let _ = app.emit("log-message", format!("[ERROR] {}", msg));
        Err(msg)
    }
}

/// 终止进程 (Stop)
#[tauri::command]
pub fn stop_process(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    println!("[singbox-desktop][stop_process] 收到终止进程请求");
    let mut killed_child = false;

    if let Ok(mut pid_guard) = state.child_pid.lock() {
        if let Some(pid) = *pid_guard {
            println!("[singbox-desktop][stop_process] 终止子进程 PID: {}", pid);
            #[cfg(target_os = "windows")]
            {
                let res = Command::new("taskkill")
                    .args(["/F", "/PID", &pid.to_string()])
                    .output();
                println!("[singbox-desktop][stop_process] taskkill 结果: {:?}", res);
            }
            #[cfg(not(target_os = "windows"))]
            {
                let res = Command::new("kill")
                    .args(["-9", &pid.to_string()])
                    .output();
                println!("[singbox-desktop][stop_process] kill 结果: {:?}", res);
            }
            *pid_guard = None;
            killed_child = true;
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
    #[cfg(not(target_os = "windows"))]
    {
        let _ = Command::new("pkill")
            .args(["-f", "sing-box"])
            .output();
    }

    let msg = if killed_child {
        "sing-box 进程已终止。".to_string()
    } else {
        "已终止所有 sing-box 相关进程。".to_string()
    };
    println!("[singbox-desktop][stop_process] {}", msg);
    let _ = app.emit("log-message", format!("[INFO] {}", msg));
    let _ = app.emit("process-stopped", ());
    Ok(msg)
}
