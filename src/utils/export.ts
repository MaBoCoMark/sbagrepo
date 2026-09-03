import { ParsedLog } from '../types/log';

/**
 * 导出日志为本地 .log 文本文件
 * 使用纯内存 Blob 下载，不产生常驻磁盘写入磨损
 */
export function exportLogsToFile(
  logs: (ParsedLog | string)[],
  filenamePrefix = 'sing-box-logs'
): boolean {
  try {
    const text = logs
      .map((item) => (typeof item === 'string' ? item : item.raw))
      .join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
      now.getHours()
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `${filenamePrefix}_${timestamp}.log`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`[LogExport] 成功导出 ${logs.length} 条日志至 ${filename}`);
    return true;
  } catch (err) {
    console.error('[LogExport] 导出日志文件失败:', err);
    return false;
  }
}

/**
 * 复制日志文本到系统剪贴板
 */
export async function copyLogsToClipboard(logs: (ParsedLog | string)[]): Promise<boolean> {
  try {
    const text = logs
      .map((item) => (typeof item === 'string' ? item : item.raw))
      .join('\n');

    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch (err) {
    console.error('[LogExport] 复制到剪贴板失败:', err);
    return false;
  }
}
