use tauri::{AppHandle, Emitter};
use crate::paths::resolve_config;

/// 读取配置文件内容
#[tauri::command]
pub fn read_config_file(app: AppHandle, config_path: String) -> Result<String, String> {
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
