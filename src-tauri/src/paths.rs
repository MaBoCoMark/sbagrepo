use std::path::{Path, PathBuf};
use tauri::Manager;

/// 获取平台标准 sing-box 二进制文件名
pub fn get_platform_binary_name() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        #[cfg(target_arch = "aarch64")]
        return "sing-box-aarch64-apple-darwin";
        #[cfg(not(target_arch = "aarch64"))]
        return "sing-box-x86_64-apple-darwin";
    }
    #[cfg(target_os = "windows")]
    {
        return "sing-box-x86_64-pc-windows-msvc.exe";
    }
    #[cfg(target_os = "linux")]
    {
        #[cfg(target_arch = "aarch64")]
        return "sing-box-aarch64-unknown-linux-gnu";
        #[cfg(not(target_arch = "aarch64"))]
        return "sing-box-x86_64-unknown-linux-gnu";
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        return "sing-box";
    }
}

/// 获取跨平台统一的 Tauri 应用配置目录 (app_config_dir)
/// Windows: %APPDATA%\com.singbox.desktop\
/// macOS: ~/Library/Application Support/com.singbox.desktop/
/// Linux: ~/.config/com.singbox.desktop/
pub fn get_app_config_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("获取系统应用配置目录失败: {}", e))?;

    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("创建应用配置目录失败 ({:?}): {}", dir, e))?;
    }
    Ok(dir)
}

/// 获取固定位置的配置文件路径 (app_config_dir/config.json)
pub fn get_app_config_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = get_app_config_dir(app)?;
    Ok(config_dir.join("config.json"))
}

/// 获取临时运行时配置文件路径 (用于端口/日志临时覆盖，保证原始 config.json 纯净)
pub fn get_app_runtime_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = get_app_config_dir(app)?;
    Ok(config_dir.join("runtime_config.json"))
}

/// 获取用户导入的可执行文件存放路径
pub fn get_app_binary_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = get_app_config_dir(app)?;
    let binary_name = get_platform_binary_name();

    // 优先返回 binaries/ 子目录中的文件（如果存在）
    let in_binaries = config_dir.join("binaries").join(binary_name);
    if in_binaries.is_file() {
        return Ok(in_binaries);
    }

    // 根目录中的文件（如果存在）
    let in_root = config_dir.join(binary_name);
    if in_root.is_file() {
        return Ok(in_root);
    }

    // 默认存放到 binaries/ 子目录
    let binaries_dir = config_dir.join("binaries");
    if !binaries_dir.exists() {
        let _ = std::fs::create_dir_all(&binaries_dir);
    }
    Ok(binaries_dir.join(binary_name))
}

/// 获取 MITM CA 根证书存放路径 (app_config_dir/ca.crt)
pub fn get_app_ca_cert_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = get_app_config_dir(app)?;
    Ok(config_dir.join("ca.crt"))
}

/// 获取 MITM CA 私钥存放路径 (app_config_dir/ca.key)
pub fn get_app_ca_key_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_dir = get_app_config_dir(app)?;
    Ok(config_dir.join("ca.key"))
}

/// 智能解析 sing-box 可执行文件路径
pub fn resolve_binary(input: &str, app: Option<&tauri::AppHandle>) -> Result<PathBuf, String> {
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

    // 0. 优先在 Tauri 的 app_config_dir 区域中寻找用户导入的可执行文件
    if let Some(app_handle) = app {
        if let Ok(app_bin) = get_app_binary_path(app_handle) {
            if app_bin.is_file() {
                return post_process_binary(app_bin);
            }
        }
    }

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
        get_platform_binary_name(),
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

    let expected_name = get_platform_binary_name();
    let err_msg = format!(
        "无法找到 sing-box 可执行文件！(No such file or directory)\n\
        当前平台所需可执行文件: \"{}\"\n\
        当前工作目录: \"{}\"\n\
        已尝试查找位置:\n{}\n\
        \n\
        请使用上方【导入内核文件】功能直接上传适用于您平台的 {} 可执行程序。",
        expected_name,
        cwd.display(),
        if attempted_str.is_empty() { "  • (无有效候选路径)".to_string() } else { attempted_str },
        expected_name
    );

    Err(err_msg)
}

pub fn post_process_binary(path: PathBuf) -> Result<PathBuf, String> {
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
pub fn resolve_config(input: &str, app: Option<&tauri::AppHandle>) -> Result<PathBuf, String> {
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

    // 0. 如果有临时生成的运行时配置 (runtime_config.json)，在运行/检查时优先检测
    if let Some(app_handle) = app {
        if trimmed.is_empty() || trimmed == "config.json" {
            // 优先检查 runtime_config.json
            if let Ok(runtime_path) = get_app_runtime_config_path(app_handle) {
                if runtime_path.is_file() {
                    return Ok(runtime_path);
                }
            }
            // 其次检查 app_config_dir/config.json
            if let Ok(app_cfg) = get_app_config_file_path(app_handle) {
                if app_cfg.is_file() {
                    return Ok(app_cfg);
                }
            }
        }
    }

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
        建议使用【导入配置文件】功能上传您的 JSON 配置文件。",
        input,
        cwd.display(),
        attempted_str
    );

    Err(err_msg)
}
