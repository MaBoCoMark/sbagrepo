/// 字符串与系统工具函数模块
use tauri::{AppHandle, Emitter, Manager};
use crate::state::AppState;

/// 统一日志分发：将日志存入 20MB 后端内存环形缓冲区，并实时派发 `log-message` 事件给前端
pub fn emit_log(app: &AppHandle, message: impl Into<String>) {
    let msg = message.into();
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut buf) = state.log_buffer.lock() {
            buf.push(msg.clone());
        }
    }
    let _ = app.emit("log-message", msg);
}

/// 清除日志中的 ANSI 控制字符与转义序列 (包括终端色彩序列如 \x1b[36m 以及孤立的 [36m, [0m, [38;5;32m 等)
pub fn clean_ansi(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '\x1b' && i + 1 < chars.len() && chars[i + 1] == '[' {
            // 标准 ANSI 转义序列: \x1b[...<字母>
            i += 2;
            while i < chars.len() && !chars[i].is_ascii_alphabetic() {
                i += 1;
            }
            if i < chars.len() {
                i += 1; // 跳过终结字母 (如 'm', 'H', 'J' 等)
            }
        } else if chars[i] == '[' {
            // 孤立终端 SGR 颜色序列: [36m 或 [38;5;32m
            let mut j = i + 1;
            let mut is_ansi_color = false;
            while j < chars.len() {
                if chars[j].is_ascii_digit() || chars[j] == ';' {
                    j += 1;
                } else if chars[j] == 'm' {
                    is_ansi_color = true;
                    j += 1;
                    break;
                } else {
                    break;
                }
            }
            if is_ansi_color {
                i = j; // 跳过此颜色标记
            } else {
                out.push(chars[i]);
                i += 1;
            }
        } else {
            out.push(chars[i]);
            i += 1;
        }
    }
    out
}

/// 零依赖 Base64 解码器
pub fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    // 自动剥离可能的 data URL 前缀，如 data:application/octet-stream;base64,
    let content = if let Some(idx) = input.find(";base64,") {
        &input[idx + 8..]
    } else {
        input
    };

    let clean: String = content.chars().filter(|c| !c.is_whitespace()).collect();
    let mut out = Vec::new();
    let chars: Vec<char> = clean.chars().collect();
    let mut i = 0;

    if chars.is_empty() {
        return Ok(out);
    }
    if chars.len() % 4 != 0 {
        return Err(format!("Base64 内容长度非 4 的倍数 (当前长度: {})", chars.len()));
    }

    while i < chars.len() {
        let b0 = decode_b64_char(chars[i])?;
        let b1 = decode_b64_char(chars[i + 1])?;
        let b2 = if chars[i + 2] == '=' {
            None
        } else {
            Some(decode_b64_char(chars[i + 2])?)
        };
        let b3 = if chars[i + 3] == '=' {
            None
        } else {
            Some(decode_b64_char(chars[i + 3])?)
        };

        out.push((b0 << 2) | (b1 >> 4));
        if let Some(c2) = b2 {
            out.push(((b1 & 0x0f) << 4) | (c2 >> 2));
            if let Some(c3) = b3 {
                out.push(((c2 & 0x03) << 6) | c3);
            }
        }
        i += 4;
    }

    Ok(out)
}

fn decode_b64_char(c: char) -> Result<u8, String> {
    match c {
        'A'..='Z' => Ok(c as u8 - b'A'),
        'a'..='z' => Ok(c as u8 - b'a' + 26),
        '0'..='9' => Ok(c as u8 - b'0' + 52),
        '+' => Ok(62),
        '/' => Ok(63),
        _ => Err(format!("非法 Base64 字符: '{}'", c)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_ansi() {
        let dirty = "[36mINFO[0m[0024] [[38;5;32m1580955111[0m 428ms] outbound/vless[XF-🇭🇰 香港 02 [V]]: outbound connection to www.google.com:80";
        let cleaned = clean_ansi(dirty);
        assert_eq!(
            cleaned,
            "INFO[0024] [1580955111 428ms] outbound/vless[XF-🇭🇰 香港 02 [V]]: outbound connection to www.google.com:80"
        );
    }

    #[test]
    fn test_base64_decode() {
        let decoded = base64_decode("aGVsbG8=").unwrap();
        assert_eq!(String::from_utf8(decoded).unwrap(), "hello");
    }
}
