import { LogLevel, ParsedLog } from '../types/log';

/**
 * 清除字符串中的所有 ANSI 转义字符序列和孤立的终端颜色标记 (如 [36m, [0m, [38;5;32m 等)
 */
export function stripAnsi(str: string): string {
  if (!str) return '';
  return str
    // 匹配完整 ANSI 转义序列 (\x1B[... 或 \u001b[...)
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
    // 匹配由于终端截断导致的孤立 SGR 色彩序列 (例如 [36m, [0m, [38;5;32m)
    .replace(/(?:\[\d+(?:;\d+)*m)/g, '');
}

/**
 * 计算字符串的 UTF-8 字节占用大小
 */
export function calculateStringBytes(str: string): number {
  if (typeof Blob !== 'undefined') {
    return new Blob([str]).size;
  }
  // 简易 UTF-8 估算后备
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * 将字节数格式化为易读的字符串 (例如 1.25 MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = (bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2);
  return `${val} ${units[index]}`;
}

let logCounter = 0;

/**
 * 解析并结构化单行日志
 */
export function parseLogLine(raw: string, index?: number): ParsedLog {
  const clean = stripAnsi(raw).trim();
  const byteSize = calculateStringBytes(clean) + 1; // +1 表示换行符
  const id = `log-${Date.now()}-${index ?? ++logCounter}-${Math.random().toString(36).substring(2, 6)}`;
  const timestamp = Date.now();

  // 1. sing-box 标准输出格式: LEVEL[tag] [timing] message
  // 例如: INFO[0024] [1580955111 428ms] outbound/vless[...]: outbound connection
  const singboxMatch = clean.match(/^([A-Z]+)\[(\d+)\](?:\s+\[([^\]]+)\])?\s*(.*)$/);
  if (singboxMatch) {
    const rawLevel = singboxMatch[1].toUpperCase();
    let level: LogLevel = 'unknown';
    if (rawLevel === 'INFO') level = 'info';
    else if (rawLevel === 'WARN' || rawLevel === 'WARNING') level = 'warn';
    else if (rawLevel === 'ERROR') level = 'error';
    else if (rawLevel === 'FATAL') level = 'fatal';
    else if (rawLevel === 'DEBUG') level = 'debug';
    else if (rawLevel === 'TRACE') level = 'trace';

    return {
      id,
      raw: clean,
      level,
      tag: singboxMatch[2],
      timing: singboxMatch[3],
      message: singboxMatch[4] || '',
      byteSize,
      timestamp,
    };
  }

  // 2. 自定义系统消息格式: [LEVEL] message
  // 例如: [INFO] 启动 sing-box: ...
  const bracketMatch = clean.match(/^\[([A-Z]+)\]\s*(.*)$/);
  if (bracketMatch) {
    const rawLevel = bracketMatch[1].toUpperCase();
    let level: LogLevel = 'unknown';
    if (rawLevel === 'INFO') level = 'info';
    else if (rawLevel === 'WARN' || rawLevel === 'WARNING') level = 'warn';
    else if (rawLevel === 'ERROR') level = 'error';
    else if (rawLevel === 'FATAL') level = 'fatal';
    else if (rawLevel === 'SUCCESS') level = 'success';
    else if (rawLevel === 'DEBUG') level = 'debug';

    return {
      id,
      raw: clean,
      level,
      message: bracketMatch[2] || '',
      byteSize,
      timestamp,
    };
  }

  // 3. 通用关键字推断
  let level: LogLevel = 'unknown';
  if (clean.includes('ERROR') || clean.includes('error') || clean.includes('FATAL')) {
    level = 'error';
  } else if (clean.includes('WARN') || clean.includes('warn')) {
    level = 'warn';
  } else if (clean.includes('INFO') || clean.includes('info')) {
    level = 'info';
  } else if (clean.includes('SUCCESS') || clean.includes('✅')) {
    level = 'success';
  } else if (clean.includes('DEBUG')) {
    level = 'debug';
  }

  return {
    id,
    raw: clean,
    level,
    message: clean,
    byteSize,
    timestamp,
  };
}
