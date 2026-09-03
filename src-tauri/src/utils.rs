/// 字符串与系统工具函数模块

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
}
