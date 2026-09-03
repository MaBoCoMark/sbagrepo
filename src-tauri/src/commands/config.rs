use serde::Serialize;
use tauri::{AppHandle, Emitter};
use crate::paths::{
    get_app_binary_path, get_app_config_file_path, get_app_runtime_config_path,
    get_platform_binary_name, resolve_binary, resolve_config,
};
use crate::utils::base64_decode;

#[derive(Serialize)]
pub struct BinaryStatusInfo {
    pub imported: bool,
    pub binary_name: String,
    pub binary_path: String,
    pub file_size: u64,
}

/// 读取配置文件内容
/// 若配置文件不存在，自动在 Tauri 的 app_config_dir 创建合法的空 JSON "{}" 并返回
#[tauri::command]
pub fn read_config_file(app: AppHandle, config_path: Option<String>) -> Result<String, String> {
    let resolved = if let Some(path_str) = config_path.as_deref().filter(|s| !s.trim().is_empty()) {
        println!("[singbox-desktop][read_config_file] 指定路径读取: \"{}\"", path_str);
        match resolve_config(path_str, Some(&app)) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("[singbox-desktop][read_config_file] 错误: {}", e);
                let _ = app.emit("log-message", format!("[ERROR][read_config] {}", e));
                return Err(e);
            }
        }
    } else {
        // 使用 Tauri 跨平台标准应用配置目录 (app_config_dir/config.json)
        let default_cfg = get_app_config_file_path(&app)?;
        println!(
            "[singbox-desktop][read_config_file] 使用应用标准配置目录读取: {:?}",
            default_cfg
        );

        // 如果文件不存在或内容为空，生成空 JSON "{}"
        if !default_cfg.exists() {
            println!("[singbox-desktop][read_config_file] 配置文件不存在，初始化空 JSON {{}}");
            if let Err(e) = std::fs::write(&default_cfg, "{}\n") {
                return Err(format!("创建默认空白配置文件失败: {}", e));
            }
            return Ok("{}\n".to_string());
        }
        default_cfg
    };

    match std::fs::read_to_string(&resolved) {
        Ok(content) => {
            let trimmed = content.trim();
            if trimmed.is_empty() {
                // 内容为空，填充空 JSON
                let _ = std::fs::write(&resolved, "{}\n");
                return Ok("{}\n".to_string());
            }
            println!(
                "[singbox-desktop][read_config_file] 成功读取配置文件 ({} 字节)",
                content.len()
            );
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

/// 导入新的配置文件
/// 验证文件为有效文本且为完整的 JSON 格式，之后覆盖存储至 app_config_dir/config.json
#[tauri::command]
pub fn import_config_file(app: AppHandle, content: String) -> Result<String, String> {
    println!("[singbox-desktop][import_config_file] 收到用户上传的配置文件，大小: {} 字节", content.len());

    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err("导入内容为空！请提供有效的 JSON 配置内容。".to_string());
    }

    // 严格校验是否为合法的完整 JSON 格式
    let parsed: serde_json::Value = match serde_json::from_str(trimmed) {
        Ok(val) => val,
        Err(e) => {
            let err_msg = format!("所上传文件不是有效的 JSON 格式！解析错误: {}", e);
            eprintln!("[singbox-desktop][import_config_file] 校验失败: {}", err_msg);
            let _ = app.emit("log-message", format!("[ERROR][import_config] {}", err_msg));
            return Err(err_msg);
        }
    };

    // 格式化美化 JSON
    let formatted = serde_json::to_string_pretty(&parsed)
        .map_err(|e| format!("格式化 JSON 失败: {}", e))?;

    // 获取固定存储位置 app_config_dir/config.json
    let target_path = get_app_config_file_path(&app)?;
    if let Some(parent) = target_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    std::fs::write(&target_path, &formatted)
        .map_err(|e| format!("写入配置文件失败 ({:?}): {}", target_path, e))?;

    // 清理旧的 runtime_config.json 临时覆盖文件
    if let Ok(runtime_path) = get_app_runtime_config_path(&app) {
        if runtime_path.exists() {
            let _ = std::fs::remove_file(runtime_path);
        }
    }

    let success_msg = format!("配置文件导入成功，已持久化至应用配置区: {:?}", target_path);
    println!("[singbox-desktop][import_config_file] {}", success_msg);
    let _ = app.emit("log-message", format!("[SUCCESS] {}", success_msg));

    Ok(formatted)
}

/// 检查 sing-box 可执行内核是否已导入
#[tauri::command]
pub fn check_binary_status(app: AppHandle) -> Result<BinaryStatusInfo, String> {
    let expected_name = get_platform_binary_name().to_string();
    let binary_path = match get_app_binary_path(&app) {
        Ok(p) => p,
        Err(_) => std::path::PathBuf::from(&expected_name),
    };

    if binary_path.is_file() {
        let size = std::fs::metadata(&binary_path)
            .map(|m| m.len())
            .unwrap_or(0);
        return Ok(BinaryStatusInfo {
            imported: true,
            binary_name: expected_name,
            binary_path: binary_path.to_string_lossy().to_string(),
            file_size: size,
        });
    }

    // 尝试后备检查系统或预设目录
    if let Ok(fallback) = resolve_binary(&expected_name, Some(&app)) {
        if fallback.is_file() {
            let size = std::fs::metadata(&fallback)
                .map(|m| m.len())
                .unwrap_or(0);
            return Ok(BinaryStatusInfo {
                imported: true,
                binary_name: expected_name,
                binary_path: fallback.to_string_lossy().to_string(),
                file_size: size,
            });
        }
    }

    Ok(BinaryStatusInfo {
        imported: false,
        binary_name: expected_name,
        binary_path: binary_path.to_string_lossy().to_string(),
        file_size: 0,
    })
}

/// 导入 sing-box 内核可执行文件
#[tauri::command]
pub fn import_binary_file(app: AppHandle, base64_content: String) -> Result<BinaryStatusInfo, String> {
    println!("[singbox-desktop][import_binary_file] 收到二进制内核上传请求");

    let bytes = base64_decode(&base64_content)
        .map_err(|e| format!("Base64 数据解码失败: {}", e))?;

    if bytes.is_empty() {
        return Err("上传的二进制文件内容为空！".to_string());
    }

    let target_path = get_app_binary_path(&app)?;
    if let Some(parent) = target_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    std::fs::write(&target_path, &bytes)
        .map_err(|e| format!("写入可执行文件失败 ({:?}): {}", target_path, e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&target_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        let _ = std::fs::set_permissions(&target_path, perms);
    }

    let msg = format!(
        "sing-box 内核导入成功！存放路径: {:?} (大小: {} 字节)",
        target_path,
        bytes.len()
    );
    println!("[singbox-desktop][import_binary_file] {}", msg);
    let _ = app.emit("log-message", format!("[SUCCESS] {}", msg));

    check_binary_status(app)
}

/// 保存运行时端口与日志级别临时覆盖配置 (生成 runtime_config.json，完全不触碰原文件)
#[tauri::command]
pub fn save_runtime_override(
    app: AppHandle,
    override_port: Option<u16>,
    override_log_level: Option<String>,
) -> Result<String, String> {
    let base_cfg_path = get_app_config_file_path(&app)?;
    let runtime_cfg_path = get_app_runtime_config_path(&app)?;

    if override_port.is_none() && override_log_level.is_none() {
        // 无覆盖，若存在 runtime_config.json 则清理
        if runtime_cfg_path.exists() {
            let _ = std::fs::remove_file(&runtime_cfg_path);
        }
        return Ok("已还原为原始配置".to_string());
    }

    let content = if base_cfg_path.is_file() {
        std::fs::read_to_string(&base_cfg_path).unwrap_or_else(|_| "{}".to_string())
    } else {
        "{}".to_string()
    };

    let mut parsed: serde_json::Value = serde_json::from_str(&content).unwrap_or(serde_json::json!({}));

    // 覆盖监听端口
    if let Some(port) = override_port {
        if let Some(inbounds) = parsed.get_mut("inbounds").and_then(|v| v.as_array_mut()) {
            let target_idx = inbounds
                .iter()
                .position(|ib| ib.get("tag").and_then(|t| t.as_str()) == Some("mixed-in"))
                .unwrap_or(0);

            if let Some(ib) = inbounds.get_mut(target_idx) {
                ib["listen_port"] = serde_json::json!(port);
            }
        } else {
            // 无 inbounds 数组时创建默认 mixed-in
            parsed["inbounds"] = serde_json::json!([
                {
                    "type": "mixed",
                    "tag": "mixed-in",
                    "listen": "127.0.0.1",
                    "listen_port": port
                }
            ]);
        }
    }

    // 覆盖日志级别
    if let Some(ref level) = override_log_level {
        let level_str = level.to_lowercase();
        if parsed.get("log").is_none() {
            parsed["log"] = serde_json::json!({ "level": level_str });
        } else if let Some(log_obj) = parsed.get_mut("log").and_then(|v| v.as_object_mut()) {
            log_obj.insert("level".to_string(), serde_json::json!(level_str));
        }
    }

    let formatted = serde_json::to_string_pretty(&parsed)
        .map_err(|e| format!("序列化运行时配置失败: {}", e))?;

    std::fs::write(&runtime_cfg_path, &formatted)
        .map_err(|e| format!("写入运行时覆盖配置失败: {}", e))?;

    println!(
        "[singbox-desktop][save_runtime_override] 临时配置已写入 {:?} (Port: {:?}, LogLevel: {:?})",
        runtime_cfg_path, override_port, override_log_level
    );

    Ok(runtime_cfg_path.to_string_lossy().to_string())
}
