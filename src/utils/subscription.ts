import { SubscriptionUserInfo, UserAgentType, JsonPathMatch, ExportedPathEntry } from '../types/subscription';

export const UA_OPTIONS: Array<{
  id: UserAgentType;
  label: string;
  ua: string;
  format: 'json' | 'yaml';
}> = [
  {
    id: 'sing-box',
    label: 'Sing-Box',
    ua: 'SFI (sing-box 1.14.0; language en_US)',
    format: 'json',
  },
  {
    id: 'clash-verge',
    label: 'Clash Verge',
    ua: 'clash-verge/v2.4.7',
    format: 'yaml',
  },
];

/**
 * 解析订阅响应头中的 subscription-userinfo 字段
 * 示例: upload=179195782; download=5181888235; total=107374182400; expire=
 */
export function parseSubscriptionUserInfo(headerValue: string | null | undefined): SubscriptionUserInfo | null {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }

  const parts = headerValue.split(';').map((p) => p.trim());
  let upload: number | undefined;
  let download: number | undefined;
  let total: number | undefined;
  let expire: number | null = null;
  let hasAnyField = false;

  for (const part of parts) {
    if (!part) continue;
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;

    const key = part.slice(0, eqIdx).trim().toLowerCase();
    const val = part.slice(eqIdx + 1).trim();

    if (key === 'upload') {
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        upload = num;
        hasAnyField = true;
      }
    } else if (key === 'download') {
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        download = num;
        hasAnyField = true;
      }
    } else if (key === 'total') {
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        total = num;
        hasAnyField = true;
      }
    } else if (key === 'expire') {
      if (!val) {
        expire = null;
        hasAnyField = true;
      } else {
        const num = parseInt(val, 10);
        expire = !isNaN(num) && num > 0 ? num : null;
        hasAnyField = true;
      }
    }
  }

  if (!hasAnyField) {
    return null;
  }

  return { upload, download, total, expire };
}

/**
 * 将字节数格式化为人类可读的字符串 (B, KB, MB, GB, TB)
 */
export function formatBytes(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${val} ${sizes[i] || 'B'}`;
}

/**
 * 格式化到期时间戳或日期字符串
 */
export function formatExpireDate(expire: number | string | null | undefined): string {
  if (!expire) return '无期限';
  let timestamp: number;
  if (typeof expire === 'string') {
    timestamp = parseInt(expire, 10);
    if (isNaN(timestamp)) return '无期限';
  } else {
    timestamp = expire;
  }

  if (timestamp <= 0) return '无期限';

  // Unix 时间戳以秒计时转换为毫秒
  const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '无期限';

  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 获取当前时间格式化字符串 (YYYY-MM-DD HH:mm:ss)
 */
export function getCurrentFormattedTime(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 严格校验 JSON 格式并在语法错误时精准定位行列号与原因
 */
export function validateJson(rawText: string): {
  valid: true;
  parsed: any;
} | {
  valid: false;
  error: string;
  line: number;
  column: number;
} {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: '内容为空，非合法 JSON 格式',
      line: 1,
      column: 1,
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    return { valid: true, parsed };
  } catch (err: any) {
    const errMsg = err.message || String(err);
    let line = 1;
    let column = 1;

    // 匹配诸如 "line 4 column 2"
    const lineColMatch = errMsg.match(/line\s+(\d+)\s+column\s+(\d+)/i);
    if (lineColMatch) {
      line = parseInt(lineColMatch[1], 10);
      column = parseInt(lineColMatch[2], 10);
    } else {
      // 匹配诸如 "at position 123"
      const posMatch = errMsg.match(/position\s+(\d+)/i);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const prefix = trimmed.slice(0, pos);
        const lines = prefix.split('\n');
        line = lines.length;
        column = lines[lines.length - 1].length + 1;
      } else {
        // 匹配现代 V8 报错中的 snippet
        const snippetMatch = errMsg.match(/\.\.\."([\s\S]+?)"\s+is not valid JSON/);
        if (snippetMatch) {
          const snippet = snippetMatch[1];
          const idx = trimmed.indexOf(snippet);
          if (idx !== -1) {
            const prefix = trimmed.slice(0, idx + snippet.length);
            const lines = prefix.split('\n');
            line = lines.length;
            column = lines[lines.length - 1].length;
          }
        }
      }
    }

    return {
      valid: false,
      error: errMsg,
      line,
      column,
    };
  }
}

/**
 * 递归搜索 JSON 对象中的匹配关键字并生成对应的 JSONPath
 * 示例: 查找 "outbounds" 返回 $.outbounds, $.outbounds[0].outbounds 等
 */
export function searchJsonPaths(data: any, keyword: string, maxResults: number = 80): JsonPathMatch[] {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  const results: JsonPathMatch[] = [];
  const lowerKeyword = trimmed.toLowerCase();
  const visitedPaths = new Set<string>();

  function recordMatch(
    path: string,
    key: string,
    val: any,
    type: JsonPathMatch['type']
  ) {
    if (visitedPaths.has(path)) return;
    visitedPaths.add(path);

    let preview = '';
    if (val === null) {
      preview = 'null';
    } else if (Array.isArray(val)) {
      preview = `Array(${val.length})`;
    } else if (typeof val === 'object') {
      const keys = Object.keys(val);
      preview = `Object({${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}})`;
    } else {
      preview = String(val);
      if (preview.length > 60) {
        preview = preview.slice(0, 60) + '...';
      }
    }

    results.push({
      path,
      key,
      value: val,
      valuePreview: preview,
      type,
    });
  }

  function traverse(node: any, currentPath: string, currentKey: string) {
    if (results.length >= maxResults) return;

    const nodeType: JsonPathMatch['type'] =
      node === null
        ? 'null'
        : Array.isArray(node)
        ? 'array'
        : typeof node === 'object'
        ? 'object'
        : typeof node === 'string'
        ? 'string'
        : typeof node === 'number'
        ? 'number'
        : typeof node === 'boolean'
        ? 'boolean'
        : 'null';

    // 1. 检查当前节点的 key 是否包含关键字
    if (currentKey && currentKey.toLowerCase().includes(lowerKeyword)) {
      recordMatch(currentPath, currentKey, node, nodeType);
    }

    // 2. 检查基本类型的值是否包含关键字
    if (
      (nodeType === 'string' || nodeType === 'number') &&
      String(node).toLowerCase().includes(lowerKeyword)
    ) {
      recordMatch(currentPath, currentKey || '$', node, nodeType);
    }

    // 3. 递归遍历数组与对象子节点
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        if (results.length >= maxResults) break;
        traverse(node[i], `${currentPath}[${i}]`, `[${i}]`);
      }
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (results.length >= maxResults) break;
        traverse(v, `${currentPath}.${k}`, k);
      }
    }
  }

  traverse(data, '$', '');
  return results;
}

/**
 * 根据 JSONPath 路径安全获取对应的数据子节点
 * 支持 $.outbounds[0].server 这种格式
 */
export function getValueByPath(data: any, path: string): any {
  if (!path || path === '$' || path === '') return data;

  let cleanPath = path;
  if (cleanPath.startsWith('$.')) {
    cleanPath = cleanPath.slice(2);
  } else if (cleanPath.startsWith('$')) {
    cleanPath = cleanPath.slice(1);
  }

  if (!cleanPath) return data;

  const segments = cleanPath
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((s) => s.length > 0);

  let curr = data;
  for (const seg of segments) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[seg];
  }
  return curr;
}

/**
 * 创建导出路径条目摘要
 */
export function createExportEntry(data: any, path: string): ExportedPathEntry {
  const value = getValueByPath(data, path);
  let type = 'unknown';
  let itemCount: number | undefined;
  let preview = '';

  if (value === null) {
    type = 'null';
    preview = 'null';
  } else if (Array.isArray(value)) {
    type = 'array';
    itemCount = value.length;
    preview = `Array(${value.length} 项)`;
  } else if (typeof value === 'object') {
    type = 'object';
    const keys = Object.keys(value);
    itemCount = keys.length;
    preview = `Object(${keys.length} 个字段)`;
  } else {
    type = typeof value;
    preview = String(value);
  }

  return {
    path,
    type,
    itemCount,
    preview,
    extractedSnippet: value,
  };
}
