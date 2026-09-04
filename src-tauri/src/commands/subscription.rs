use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::AppHandle;
use crate::paths::{get_app_subscription_dir, get_app_subscriptions_file_path};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BackendFetchResponse {
    pub body: String,
    pub headers: HashMap<String, String>,
    pub status: u16,
    pub user_info_header: Option<String>,
}

/// 读取持久化的所有订阅元数据配置 (subscriptions.json)
#[tauri::command]
pub fn load_subscriptions(app: AppHandle) -> Result<String, String> {
    let meta_file = get_app_subscriptions_file_path(&app)?;
    if !meta_file.exists() {
        let default_content = "[]".to_string();
        let _ = std::fs::write(&meta_file, &default_content);
        return Ok(default_content);
    }
    std::fs::read_to_string(&meta_file)
        .map_err(|e| format!("读取订阅元数据文件失败: {}", e))
}

/// 保存持久化订阅元数据配置 (subscriptions.json)
#[tauri::command]
pub fn save_subscription_metadata(app: AppHandle, metadata_json: String) -> Result<(), String> {
    let meta_file = get_app_subscriptions_file_path(&app)?;
    std::fs::write(&meta_file, metadata_json)
        .map_err(|e| format!("写入订阅元数据文件失败: {}", e))
}

/// 保存单个订阅文件至 subscription/<filename>
#[tauri::command]
pub fn save_subscription_file(
    app: AppHandle,
    filename: String,
    content: String,
) -> Result<String, String> {
    let sub_dir = get_app_subscription_dir(&app)?;
    let target_path = sub_dir.join(&filename);
    std::fs::write(&target_path, content)
        .map_err(|e| format!("保存订阅文件 ({:?}) 失败: {}", target_path, e))?;
    Ok(target_path.display().to_string())
}

/// 读取单个订阅文件 subscription/<filename>
#[tauri::command]
pub fn read_subscription_file(app: AppHandle, filename: String) -> Result<String, String> {
    let sub_dir = get_app_subscription_dir(&app)?;
    let target_path = sub_dir.join(&filename);
    if !target_path.exists() {
        return Err(format!("订阅文件不存在: {:?}", target_path));
    }
    std::fs::read_to_string(&target_path)
        .map_err(|e| format!("读取订阅文件失败: {}", e))
}

/// 删除单个订阅文件 subscription/<filename>
#[tauri::command]
pub fn delete_subscription_file(app: AppHandle, filename: String) -> Result<(), String> {
    let sub_dir = get_app_subscription_dir(&app)?;
    let target_path = sub_dir.join(&filename);
    if target_path.exists() {
        let _ = std::fs::remove_file(&target_path);
    }
    Ok(())
}

/// 发起订阅网络请求并提取响应头与正文
#[tauri::command]
pub fn fetch_subscription_url(
    _app: AppHandle,
    url: String,
    user_agent: String,
) -> Result<BackendFetchResponse, String> {
    // 使用 curl 执行 HTTP 请求以确保无跨域限制且支持重定向和响应头提取
    let output = std::process::Command::new("curl")
        .arg("-sSL")
        .arg("-i")
        .arg("--max-time")
        .arg("15")
        .arg("-A")
        .arg(&user_agent)
        .arg(&url)
        .output()
        .map_err(|e| format!("执行 curl 获取订阅失败: {}", e))?;

    let raw_resp = String::from_utf8_lossy(&output.stdout).to_string();
    if raw_resp.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("网络请求返回为空: {}", stderr));
    }

    // 解析 HTTP 响应头与正文
    let mut headers = HashMap::new();
    let mut user_info_header = None;
    let mut status: u16 = 200;

    let parts: Vec<&str> = raw_resp.split("\r\n\r\n").collect();
    let (header_part, body) = if parts.len() >= 2 {
        (parts[parts.len() - 2], parts[parts.len() - 1].to_string())
    } else {
        let alt_parts: Vec<&str> = raw_resp.split("\n\n").collect();
        if alt_parts.len() >= 2 {
            (alt_parts[alt_parts.len() - 2], alt_parts[alt_parts.len() - 1].to_string())
        } else {
            ("", raw_resp.clone())
        }
    };

    for line in header_part.lines() {
        if line.starts_with("HTTP/") {
            if let Some(code_str) = line.split_whitespace().nth(1) {
                if let Ok(c) = code_str.parse::<u16>() {
                    status = c;
                }
            }
        } else if let Some(colon_idx) = line.find(':') {
            let key = line[..colon_idx].trim().to_lowercase();
            let val = line[colon_idx + 1..].trim().to_string();
            if key == "subscription-userinfo" {
                user_info_header = Some(val.clone());
            }
            headers.insert(key, val);
        }
    }

    if status >= 400 {
        return Err(format!("目标服务器返回 HTTP 错误码: {}", status));
    }

    Ok(BackendFetchResponse {
        body,
        headers,
        status,
        user_info_header,
    })
}
