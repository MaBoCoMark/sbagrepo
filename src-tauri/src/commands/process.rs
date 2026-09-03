use std::process::Command;
use tauri::{AppHandle, Emitter, Manager, State};
use crate::paths::{resolve_binary, resolve_config};
use crate::state::AppState;
use crate::utils::clean_ansi;

/// 检查给定 PID 的进程是否在系统中存活
pub fn is_pid_alive(pid: u32) -> bool {
    #[cfg(target_os = "windows")]
    {
        let out = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", pid), "/NH"])
            .output();
        if let Ok(out) = out {
            let s = String::from_utf8_lossy(&out.stdout);
            return s.contains(&pid.to_string());
        }
        false
    }
    #[cfg(not(target_os = "windows"))]
    {
        // kill -0 仅检测进程是否存在与权限，不发送实际终止信号
        let status = Command::new("kill")
            .args(["-0", &pid.to_string()])
            .status();
        status.map(|s| s.success()).unwrap_or(false)
    }
}

/// 启动针对独立 PID 的常驻健康监视协程 (用于管理提权或后台进程)
pub fn spawn_process_monitor(app: AppHandle, pid: u32, mode: &'static str) {
    tauri::async_runtime::spawn(async move {
        println!(
            "[singbox-desktop][monitor] 启动常驻进程健康监测协程: PID={}, 模式={}",
            pid, mode
        );

        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;

            let Some(state) = app.try_state::<AppState>() else {
                break;
            };

            let current_pid = state.child_pid.lock().ok().and_then(|g| *g);
            // 若 PID 已被清理或已切换，结束此监视协程
            if current_pid != Some(pid) {
                println!(
                    "[singbox-desktop][monitor] PID 已变更或已主动停止，退出监视: 当前={:?}, 目标={}",
                    current_pid, pid
                );
                break;
            }

            // 检测进程是否依然存活
            if !is_pid_alive(pid) {
                println!(
                    "[singbox-desktop][monitor] 检测到 sing-box 内核已终止运行 (PID: {})",
                    pid
                );
                let is_manual = state.manual_stop.lock().ok().map(|g| *g).unwrap_or(false);

                // 重置状态
                if let Ok(mut pid_guard) = state.child_pid.lock() {
                    *pid_guard = None;
                }
                if let Ok(mut admin_guard) = state.is_admin.lock() {
                    *admin_guard = false;
                }
                if let Ok(mut m) = state.tray_mode.lock() {
                    *m = "stopped".to_string();
                }

                let p = state
                    .tray_port
                    .lock()
                    .map(|g| g.clone())
                    .unwrap_or_else(|_| "-".to_string());
                let t = state
                    .tray_type
                    .lock()
                    .map(|g| g.clone())
                    .unwrap_or_else(|_| "Mixed".to_string());
                crate::tray::update_tray_menu_state(&app, "stopped", &p, &t);

                let _ = app.emit("process-stopped", ());

                // 若非用户主动点击终止，则判定为内核意外退出，触发强提醒
                if !is_manual {
                    let msg = format!(
                        "sing-box 内核进程 (PID: {}, 模式: {}) 意外终止！请检查日志排查崩溃原因。",
                        pid, mode
                    );
                    eprintln!("[singbox-desktop][UNEXPECTED_EXIT] {}", msg);
                    let _ = app.emit(
                        "log-message",
                        format!("[ERROR][UNEXPECTED_EXIT] {}", msg),
                    );
                    let _ = app.emit(
                        "process-unexpected-exit",
                        serde_json::json!({
                            "code": null,
                            "message": msg,
                            "mode": mode,
                        }),
                    );
                    // 唤醒并聚焦前台窗口，确保用户能立即看到 GUI 强提醒弹窗
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
                break;
            }
        }
    });
}

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

    // 重置停止标记，标记为非主动终止状态
    if let Ok(mut manual_guard) = state.manual_stop.lock() {
        *manual_guard = false;
    }
    if let Ok(mut admin_guard) = state.is_admin.lock() {
        *admin_guard = false;
    }

    let resolved_binary = match resolve_binary(&binary_path, Some(&app)) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[singbox-desktop][start_normal] 错误: {}", e);
            let _ = app.emit("log-message", format!("[ERROR][start_normal] {}", e));
            return Err(e);
        }
    };

    let resolved_config = match resolve_config(&config_path, Some(&app)) {
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
        if let Ok(mut m) = state.tray_mode.lock() {
            *m = "normal".to_string();
        }
        let p = state
            .tray_port
            .lock()
            .map(|g| g.clone())
            .unwrap_or_else(|_| "-".to_string());
        let t = state
            .tray_type
            .lock()
            .map(|g| g.clone())
            .unwrap_or_else(|_| "Mixed".to_string());
        crate::tray::update_tray_menu_state(&app, "normal", &p, &t);
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

    // 监听进程退出并自动清理 PID，同时判断是否为意外退出
    let app_clone2 = app.clone();
    tauri::async_runtime::spawn(async move {
        let exit_res = child.wait().await;

        let is_manual = if let Some(state) = app_clone2.try_state::<AppState>() {
            if let Ok(mut pid_guard) = state.child_pid.lock() {
                *pid_guard = None;
            }
            if let Ok(mut m) = state.tray_mode.lock() {
                *m = "stopped".to_string();
            }
            let p = state
                .tray_port
                .lock()
                .map(|g| g.clone())
                .unwrap_or_else(|_| "-".to_string());
            let t = state
                .tray_type
                .lock()
                .map(|g| g.clone())
                .unwrap_or_else(|_| "Mixed".to_string());
            crate::tray::update_tray_menu_state(&app_clone2, "stopped", &p, &t);
            state.manual_stop.lock().map(|g| *g).unwrap_or(false)
        } else {
            false
        };

        match &exit_res {
            Ok(status) => {
                let msg = format!("[singbox-desktop] sing-box 进程已退出，状态: {}", status);
                println!("{}", msg);
                let _ = app_clone2.emit("log-message", &msg);
            }
            Err(e) => {
                let msg = format!("[singbox-desktop] 等待 sing-box 进程退出异常: {}", e);
                eprintln!("{}", msg);
                let _ = app_clone2.emit("log-message", &msg);
            }
        }

        let _ = app_clone2.emit("process-stopped", ());

        // 如果并非用户主动终止，触发意外退出告警与强提醒
        if !is_manual {
            let (code, detail) = match &exit_res {
                Ok(status) => (
                    status.code(),
                    format!("sing-box 内核进程异常终止退出 (状态码/状态: {})", status),
                ),
                Err(e) => (None, format!("等待 sing-box 进程退出时发生异常: {}", e)),
            };
            eprintln!("[singbox-desktop][UNEXPECTED_EXIT] {}", detail);
            let _ = app_clone2.emit(
                "log-message",
                format!("[ERROR][UNEXPECTED_EXIT] {}", detail),
            );
            let _ = app_clone2.emit(
                "process-unexpected-exit",
                serde_json::json!({
                    "code": code,
                    "message": detail,
                    "mode": "normal"
                }),
            );
            if let Some(window) = app_clone2.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }
    });

    Ok(())
}

/// 管理员提权启动 (Admin/Sudo Run - TUN 模式必须)
#[tauri::command]
pub fn start_admin(
    app: AppHandle,
    state: State<'_, AppState>,
    binary_path: String,
    config_path: String,
) -> Result<String, String> {
    println!(
        "[singbox-desktop][start_admin] 请求管理员提权启动: binary_path=\"{}\", config_path=\"{}\"",
        binary_path, config_path
    );

    let resolved_binary = match resolve_binary(&binary_path, Some(&app)) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[singbox-desktop][start_admin] 错误: {}", e);
            let _ = app.emit("log-message", format!("[ERROR][start_admin] {}", e));
            return Err(e);
        }
    };

    let resolved_config = match resolve_config(&config_path, Some(&app)) {
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
            "do shell script \"'{}' run -c '{}' > /dev/null 2>&1 & echo $!\" with administrator privileges",
            bin_str, cfg_str
        );
        println!("[singbox-desktop][start_admin] 执行 AppleScript 提权并捕获子进程 PID...");
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
            let out_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let pid = out_str.parse::<u32>().ok();
            if let Some(pid) = pid {
                println!("[singbox-desktop][start_admin] macOS 提权子进程 PID: {}", pid);
                if let Ok(mut pid_guard) = state.child_pid.lock() {
                    *pid_guard = Some(pid);
                }
                if let Ok(mut admin_guard) = state.is_admin.lock() {
                    *admin_guard = true;
                }
                if let Ok(mut manual_guard) = state.manual_stop.lock() {
                    *manual_guard = false;
                }
                if let Ok(mut m) = state.tray_mode.lock() {
                    *m = "admin".to_string();
                }
                let p = state
                    .tray_port
                    .lock()
                    .map(|g| g.clone())
                    .unwrap_or_else(|_| "-".to_string());
                let t = state
                    .tray_type
                    .lock()
                    .map(|g| g.clone())
                    .unwrap_or_else(|_| "Mixed".to_string());
                crate::tray::update_tray_menu_state(&app, "admin", &p, &t);

                spawn_process_monitor(app.clone(), pid, "admin");
            }

            let msg = if let Some(pid) = pid {
                format!("macOS 管理员权限启动成功 (PID: {})", pid)
            } else {
                "macOS 管理员权限启动成功".to_string()
            };
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
        let ps_cmd = format!(
            "$p = Start-Process -FilePath '{}' -ArgumentList 'run -c \"{}\"' -Verb RunAs -PassThru; if ($p) {{ Write-Output $p.Id }}",
            bin_str, cfg_str
        );
        println!("[singbox-desktop][start_admin] 启动 PowerShell UAC 提权并捕获 PID...");
        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &ps_cmd])
            .output()
            .map_err(|e| {
                let err_msg = format!("启动 PowerShell 提权失败: {}", e);
                eprintln!("[singbox-desktop][start_admin] 错误: {}", err_msg);
                let _ = app.emit("log-message", format!("[ERROR] {}", err_msg));
                err_msg
            })?;

        if output.status.success() {
            let out_str = String::from_utf8_lossy(&output.stdout);
            let pid = out_str.lines().find_map(|l| l.trim().parse::<u32>().ok());
            if let Some(pid) = pid {
                println!("[singbox-desktop][start_admin] Windows 提权子进程 PID: {}", pid);
                if let Ok(mut pid_guard) = state.child_pid.lock() {
                    *pid_guard = Some(pid);
                }
                if let Ok(mut admin_guard) = state.is_admin.lock() {
                    *admin_guard = true;
                }
                if let Ok(mut manual_guard) = state.manual_stop.lock() {
                    *manual_guard = false;
                }
                if let Ok(mut m) = state.tray_mode.lock() {
                    *m = "admin".to_string();
                }
                let p = state
                    .tray_port
                    .lock()
                    .map(|g| g.clone())
                    .unwrap_or_else(|_| "-".to_string());
                let t = state
                    .tray_type
                    .lock()
                    .map(|g| g.clone())
                    .unwrap_or_else(|_| "Mixed".to_string());
                crate::tray::update_tray_menu_state(&app, "admin", &p, &t);

                spawn_process_monitor(app.clone(), pid, "admin");
            }

            let msg = if let Some(pid) = pid {
                format!("Windows UAC 提权启动成功 (PID: {})", pid)
            } else {
                "Windows UAC 提权启动成功".to_string()
            };
            println!("[singbox-desktop][start_admin] 成功: {}", msg);
            let _ = app.emit("log-message", format!("[SUCCESS] {}", msg));
            Ok(msg)
        } else {
            let err = String::from_utf8_lossy(&output.stderr).to_string();
            let msg = format!("提权启动被拒绝或用户取消: {}", err.trim());
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

/// 底层实际执行终止进程的核心函数 (支持直接由后端内部调用与 Tauri Command 调用)
pub fn do_stop_process(app: &AppHandle, state: &AppState) -> Result<String, String> {
    println!("[singbox-desktop][stop_process] 收到终止进程请求");

    // 1. 明确标记为用户主动发起的正常终止，防止触发意外退出监控告警
    if let Ok(mut manual_guard) = state.manual_stop.lock() {
        *manual_guard = true;
    }

    // 2. 仅获取并清理本程序实例管理的 PID
    let pid_opt = if let Ok(mut pid_guard) = state.child_pid.lock() {
        pid_guard.take()
    } else {
        None
    };

    let is_admin = state
        .is_admin
        .lock()
        .map(|mut g| {
            let val = *g;
            *g = false;
            val
        })
        .unwrap_or(false);

    let msg = if let Some(pid) = pid_opt {
        println!(
            "[singbox-desktop][stop_process] 仅精准终止本应用实例启动的子进程 PID: {}",
            pid
        );

        #[cfg(target_os = "windows")]
        {
            let res = Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .output();
            println!("[singbox-desktop][stop_process] taskkill PID: {} 结果: {:?}", pid, res);
        }

        #[cfg(not(target_os = "windows"))]
        {
            let res = Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output();
            println!("[singbox-desktop][stop_process] kill -9 PID: {} 结果: {:?}", pid, res);

            // 若普通权限 kill 失败且该进程是以管理员模式拉起的，尝试在 macOS 上提权 kill 指定 PID
            if is_admin {
                #[cfg(target_os = "macos")]
                {
                    let script = format!(
                        "do shell script \"kill -9 {}\" with administrator privileges",
                        pid
                    );
                    let _ = Command::new("osascript").args(["-e", &script]).output();
                }
            }
        }

        format!("已成功终止本应用管理的 sing-box 进程 (PID: {})。", pid)
    } else {
        "当前未检测到由本程序实例启动的运行中 sing-box 进程。".to_string()
    };

    // 重要安全原则：严禁在此处调用 taskkill /IM sing-box.exe 或 pkill -f sing-box，
    // 以绝对杜绝误杀用户本地运行的其他 sing-box 实例或桌面多开实例！

    if let Ok(mut m) = state.tray_mode.lock() {
        *m = "stopped".to_string();
    }
    let p = state
        .tray_port
        .lock()
        .map(|g| g.clone())
        .unwrap_or_else(|_| "-".to_string());
    let t = state
        .tray_type
        .lock()
        .map(|g| g.clone())
        .unwrap_or_else(|_| "Mixed".to_string());
    crate::tray::update_tray_menu_state(app, "stopped", &p, &t);

    println!("[singbox-desktop][stop_process] {}", msg);
    let _ = app.emit("log-message", format!("[INFO] {}", msg));
    let _ = app.emit("process-stopped", ());
    Ok(msg)
}

/// 精准终止本程序启动的子进程 (Stop - 严格按 PID 终止，禁止全局滥杀外部进程)
#[tauri::command]
pub fn stop_process(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    do_stop_process(&app, &state)
}

/// 接收前端状态同步并刷新托盘菜单展示信息
#[tauri::command]
pub fn update_tray_info(
    app: AppHandle,
    state: State<'_, AppState>,
    mode: Option<String>,
    port: Option<String>,
    proxy_type: Option<String>,
) -> Result<(), String> {
    if let Some(m) = mode {
        if let Ok(mut lock) = state.tray_mode.lock() {
            *lock = m;
        }
    }
    if let Some(p) = port {
        if let Ok(mut lock) = state.tray_port.lock() {
            *lock = p;
        }
    }
    if let Some(t) = proxy_type {
        if let Ok(mut lock) = state.tray_type.lock() {
            *lock = t;
        }
    }

    let m = state
        .tray_mode
        .lock()
        .map(|g| g.clone())
        .unwrap_or_else(|_| "stopped".to_string());
    let p = state
        .tray_port
        .lock()
        .map(|g| g.clone())
        .unwrap_or_else(|_| "-".to_string());
    let t = state
        .tray_type
        .lock()
        .map(|g| g.clone())
        .unwrap_or_else(|_| "Mixed".to_string());

    crate::tray::update_tray_menu_state(&app, &m, &p, &t);
    Ok(())
}
