// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use serde::Serialize;

pub struct AppState {
    pub child_pid: Mutex<Option<u32>>,
}

/// 智能解析 sing-box 可执行文件路径
fn resolve_binary(input: &str) -> Result<PathBuf, String> {
    let trimmed = input.trim();
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut attempted_paths: Vec<PathBuf> = Vec::new();

    let mut check_candidate = |p: PathBuf| -> Option<PathBuf> {
        let abs = if p.is_relative() {
            cwd.join(&p)
        } else {
            p.clone()
        };
        if !attempted_paths.contains(&abs) {
            attempted_paths.push(abs.clone());
        }
        if abs.is_file() {
            Some(abs)
        } else if p.is_file() {
            Some(p)
        } else {
            None
        }
    };

    if !trimmed.is_empty() {
        let input_path = PathBuf::from(trimmed);

        // 1. 直接检查原始路径或相对于 CWD 的路径
        if let Some(found) = check_candidate(input_path.clone()) {
            return post_process_binary(found);
        }

        // 2. 如果输入以 "src-tauri/" 开头，而当前工作目录已经在 src-tauri 内，尝试剥离前缀
        if let Ok(stripped) = input_path.strip_prefix("src-tauri") {
            if let Some(found) = check_candidate(stripped.to_path_buf()) {
                return post_process_binary(found);
            }
        }

        // 3. 如果当前目录是 src-tauri，且输入是相对于项目根目录的路径，尝试在父目录找
        let parent_candidate = Path::new("..").join(&input_path);
        if let Some(found) = check_candidate(parent_candidate) {
            return post_process_binary(found);
        }

        // 4. 尝试相对于当前可执行文件所在目录查找 (打包或 target 目录)
        if let Ok(current_exe) = std::env::current_exe() {
            if let Some(exe_dir) = current_exe.parent() {
                if let Some(found) = check_candidate(exe_dir.join(&input_path)) {
                    return post_process_binary(found);
                }
                if let Some(found) = check_candidate(exe_dir.join("../Resources").join(&input_path)) {
                    return post_process_binary(found);
                }
            }
        }
    }

    // 5. 查找标准命名候选文件
    let candidate_names = [
        "sing-box",
        "sing-box.exe",
        "sing-box-aarch64-apple-darwin",
        "sing-box-x86_64-pc-windows-msvc.exe",
        "sing-box-x86_64-apple-darwin",
        "sing-box-x86_64-unknown-linux-gnu",
        "sing-box-aarch64-unknown-linux-gnu",
    ];

    let mut search_dirs: Vec<PathBuf> = vec![
        cwd.clone(),
        cwd.join("binaries"),
        cwd.join("src-tauri").join("binaries"),
    ];

    if let Some(parent) = cwd.parent() {
        search_dirs.push(parent.to_path_buf());
        search_dirs.push(parent.join("binaries"));
        search_dirs.push(parent.join("src-tauri").join("binaries"));
    }

    // macOS 常见路径 (特别是 Homebrew)
    #[cfg(target_os = "macos")]
    {
        search_dirs.push(PathBuf::from("/opt/homebrew/bin"));
        search_dirs.push(PathBuf::from("/usr/local/bin"));
        search_dirs.push(PathBuf::from("/usr/bin"));
    }

    // Linux 常见路径
    #[cfg(target_os = "linux")]
    {
        search_dirs.push(PathBuf::from("/usr/local/bin"));
        search_dirs.push(PathBuf::from("/usr/bin"));
        search_dirs.push(PathBuf::from("/bin"));
    }

    // Windows 常见路径
    #[cfg(target_os = "windows")]
    {
        search_dirs.push(PathBuf::from("C:\\Program Files\\sing-box"));
        search_dirs.push(PathBuf::from("C:\\ProgramData\\chocolatey\\bin"));
        search_dirs.push(PathBuf::from("C:\\scoop\\shims"));
    }

    // 用户家目录路径
    if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        let home_path = PathBuf::from(home);
        search_dirs.push(home_path.join(".cargo").join("bin"));
        search_dirs.push(home_path.join(".local").join("bin"));
        search_dirs.push(home_path.join("bin"));
        search_dirs.push(home_path.join("go").join("bin"));
        search_dirs.push(home_path.join("scoop").join("shims"));
    }

    for dir in &search_dirs {
        for name in &candidate_names {
            let candidate = dir.join(name);
            if let Some(found) = check_candidate(candidate) {
                return post_process_binary(found);
            }
        }
    }

    // 6. 检查系统环境变量 PATH
    if let Some(path_env) = std::env::var_os("PATH") {
        for split_dir in std::env::split_paths(&path_env) {
            for name in &candidate_names {
                let candidate = split_dir.join(name);
                if candidate.is_file() {
                    return post_process_binary(candidate);
                }
            }
        }
    }

    let attempted_str = attempted_paths
        .iter()
        .take(8)
        .map(|p| format!("  • {}", p.display()))
        .collect::<Vec<_>>()
        .join("\n");

    let err_msg = format!(
        "无法找到 sing-box 可执行文件！(No such file or directory)\n\
        输入路径: \"{}\"\n\
        当前工作目录: \"{}\"\n\
        已尝试查找位置:\n{}\n\
        \n\
        排查建议:\n\
        1. 请确认已下载安装 sing-box，并在上方输入框中填写其绝对路径（例如 macOS 通常为 /opt/homebrew/bin/sing-box，Windows 如 C:\\Program Files\\sing-box\\sing-box.exe）；\n\
        2. 若使用 Sidecar，请确保可执行文件存放于 binaries/ 或 src-tauri/binaries/ 目录下；\n\
        3. Unix 系统请确保该文件具有可执行权限 (chmod +x <路径>)。",
        input,
        cwd.display(),
        if attempted_str.is_empty() { "  • (无有效候选路径)".to_string() } else { attempted_str }
    );

    Err(err_msg)
}

fn post_process_binary(path: PathBuf) -> Result<PathBuf, String> {
    let final_path = path.canonicalize().unwrap_or(path);

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = std::fs::metadata(&final_path) {
            let mut perms = metadata.permissions();
            let mode = perms.mode();
            if mode & 0o111 == 0 {
                println!("[singbox-desktop] 自动为可执行文件赋予执行权限 (+x): {:?}", final_path);
                perms.set_mode(mode | 0o755);
                let _ = std::fs::set_permissions(&final_path, perms);
            }
        }
    }

    Ok(final_path)
}

/// 智能解析配置文件路径
fn resolve_config(input: &str) -> Result<PathBuf, String> {
    let trimmed = input.trim();
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut attempted_paths: Vec<PathBuf> = Vec::new();

    let mut check_candidate = |p: PathBuf| -> Option<PathBuf> {
        let abs = if p.is_relative() {
            cwd.join(&p)
        } else {
            p.clone()
        };
        if !attempted_paths.contains(&abs) {
            attempted_paths.push(abs.clone());
        }
        if abs.is_file() {
            Some(abs)
        } else if p.is_file() {
            Some(p)
        } else {
            None
        }
    };

    let target_name = if trimmed.is_empty() {
        "config.json"
    } else {
        trimmed
    };
    let input_path = PathBuf::from(target_name);

    // 1. 直接检查原始路径或相对于 CWD 的路径
    if let Some(found) = check_candidate(input_path.clone()) {
        return Ok(found.canonicalize().unwrap_or(found));
    }

    // 2. 如果当前在 src-tauri 内，检查父目录 (项目根目录)
    let parent_candidate = Path::new("..").join(&input_path);
    if let Some(found) = check_candidate(parent_candidate) {
        return Ok(found.canonicalize().unwrap_or(found));
    }

    // 3. 如果当前在根目录，检查 src-tauri 子目录
    let src_tauri_candidate = Path::new("src-tauri").join(&input_path);
    if let Some(found) = check_candidate(src_tauri_candidate) {
        return Ok(found.canonicalize().unwrap_or(found));
    }

    // 4. 检查当前可执行文件同级目录
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            if let Some(found) = check_candidate(exe_dir.join(&input_path)) {
                return Ok(found.canonicalize().unwrap_or(found));
            }
        }
    }

    let attempted_str = attempted_paths
        .iter()
        .map(|p| format!("  • {}", p.display()))
        .collect::<Vec<_>>()
        .join("\n");

    let err_msg = format!(
        "无法找到配置文件！(No such file or directory)\n\
        输入路径: \"{}\"\n\
        当前工作目录: \"{}\"\n\
        已尝试查找位置:\n{}\n\
        \n\
        排查建议:\n\
        1. 请确认配置文件是否存在，并在输入框中填入正确的绝对路径或有效相对路径；\n\
        2. 请确认项目根目录下是否存在 config.json。",
        input,
        cwd.display(),
        attempted_str
    );

    Err(err_msg)
}

#[derive(Serialize)]
pub struct EnvDetectionResult {
    pub binary_path: String,
    pub config_path: String,
    pub binary_found: bool,
    pub config_found: bool,
    pub cwd: String,
}

// 环境自动探测命令
#[tauri::command]
fn detect_environment(default_binary: String, default_config: String) -> EnvDetectionResult {
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

// 按钮 1：语法检查 (Check)
#[tauri::command]
fn check_config(
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
        let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
        let out_msg = String::from_utf8_lossy(&output.stdout).to_string();
        let full_msg = if !err_msg.trim().is_empty() {
            err_msg
        } else {
            out_msg
        };
        let formatted_err = format!("❌ 配置错误:\n{}", full_msg.trim());
        eprintln!("[singbox-desktop][check_config] 配置校验失败:\n{}", formatted_err);
        let _ = app.emit("log-message", format!("[ERROR] {}", formatted_err));
        Err(formatted_err)
    }
}

// 按钮 2：普通启动 (Direct Run - 无需管理员，适合 Mixed/SOCKS 模式)
#[tauri::command]
async fn start_normal( // 👈 关键点：必须是 async fn！
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

    // 监听 stdout 日志
    let stdout = child.stdout.take();
    if let Some(stdout) = stdout {
        let app_clone = app.clone();
        tauri::async_runtime::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                println!("[sing-box][stdout] {}", line);
                let _ = app_clone.emit("log-message", line);
            }
        });
    }

    // 监听 stderr 日志
    let stderr = child.stderr.take();
    if let Some(stderr) = stderr {
        let app_clone = app.clone();
        tauri::async_runtime::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                eprintln!("[sing-box][stderr] {}", line);
                let _ = app_clone.emit("log-message", line);
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

// 按钮 3：管理员提权启动 (Admin/Sudo Run - TUN 模式必须)
#[tauri::command]
fn start_admin(
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

// 按钮 4：终止进程 (Stop)
#[tauri::command]
fn stop_process(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
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

// 辅助命令：读取配置文件
#[tauri::command]
fn read_config_file(app: AppHandle, config_path: String) -> Result<String, String> {
    println!("[singbox-desktop][read_config_file] 请求读取配置文件: \"{}\"", config_path);

    let resolved = match resolve_config(&config_path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[singbox-desktop][read_config_file] 错误: {}", e);
            let _ = app.emit("log-message", format!("[ERROR][read_config] {}", e));
            return Err(e);
        }
    };

    println!("[singbox-desktop][read_config_file] 已解析配置文件绝对路径: {:?}", resolved);

    match std::fs::read_to_string(&resolved) {
        Ok(content) => {
            println!("[singbox-desktop][read_config_file] 成功读取配置文件 ({} 字节)", content.len());
            Ok(content)
        }
        Err(e) => {
            let err_msg = format!("读取配置文件失败 (路径: {:?}): {}", resolved, e);
            eprintln!("[singbox-desktop][read_config_file] 错误: {}", err_msg);
            let _ = app.emit("log-message", format!("[ERROR] {}", err_msg));
            Err(err_msg)
        }
    }
}

fn main() {
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
            check_config,
            start_normal,
            start_admin,
            stop_process,
            read_config_file,
            detect_environment
        ])
        .run(tauri::generate_context!())
        .expect("error while running singbox desktop application");
}
