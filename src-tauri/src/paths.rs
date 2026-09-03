use std::path::{Path, PathBuf};

/// 智能解析 sing-box 可执行文件路径
pub fn resolve_binary(input: &str) -> Result<PathBuf, String> {
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
pub fn resolve_config(input: &str) -> Result<PathBuf, String> {
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
