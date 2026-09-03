import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { ParsedLog, BufferStats } from '../types/log';
import { parseLogLine, formatBytes } from '../utils/ansi';
import { exportLogsToFile, copyLogsToClipboard } from '../utils/export';

// 默认最大内存占用空间：20 MB (避免写磁盘磨损，同时防止内存无限制溢出)
export const MAX_BUFFER_BYTES = 20 * 1024 * 1024;

// 默认视图呈现条数：最新 500 条 (防止成千上万个 DOM 节点导致页面卡顿)
export const DEFAULT_DISPLAY_LIMIT = 500;

export interface UseLogBufferReturn {
  rawLogs: string[];
  visibleLogs: ParsedLog[];
  allLogs: ParsedLog[];
  stats: BufferStats;
  displayLimit: number;
  setDisplayLimit: (limit: number) => void;
  filterLevel: string;
  setFilterLevel: (level: string) => void;
  filterKeyword: string;
  setFilterKeyword: (kw: string) => void;
  autoScroll: boolean;
  setAutoScroll: (auto: boolean) => void;
  copied: boolean;
  exported: boolean;
  addLog: (raw: string) => void;
  clearLogs: () => void;
  exportLogs: () => boolean;
  copyLogs: (onlyVisible?: boolean) => Promise<boolean>;
}

export function useLogBuffer(
  maxBytes: number = MAX_BUFFER_BYTES,
  initialDisplayLimit: number = DEFAULT_DISPLAY_LIMIT
): UseLogBufferReturn {
  const [logs, setLogs] = useState<ParsedLog[]>([]);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [droppedCount, setDroppedCount] = useState<number>(0);
  const [displayLimit, setDisplayLimit] = useState<number>(initialDisplayLimit);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterKeyword, setFilterKeyword] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [exported, setExported] = useState<boolean>(false);

  // 使用 Ref 避免在 listener 内部捕获陈旧的 state
  const logsRef = useRef<ParsedLog[]>(logs);
  logsRef.current = logs;

  const totalBytesRef = useRef<number>(totalBytes);
  totalBytesRef.current = totalBytes;

  const addLog = useCallback(
    (raw: string) => {
      const parsed = parseLogLine(raw);
      const incomingBytes = parsed.byteSize;

      setLogs((prev) => {
        let currentBytes = (totalBytesRef.current ?? 0) + incomingBytes;
        let dropped = 0;
        let startIndex = 0;

        // FIFO 队列逐出机制：当总内存超过 20MB 时，从队首移除旧日志
        while (currentBytes > maxBytes && startIndex < prev.length) {
          currentBytes -= prev[startIndex].byteSize;
          startIndex++;
          dropped++;
        }

        if (dropped > 0) {
          setDroppedCount((d) => d + dropped);
        }
        setTotalBytes(Math.max(0, currentBytes));

        const nextLogs = startIndex > 0 ? prev.slice(startIndex) : [...prev];
        nextLogs.push(parsed);
        return nextLogs;
      });
    },
    [maxBytes]
  );

  const clearLogs = useCallback(() => {
    console.log('[LogBuffer] 用户清空全部内存日志');
    setLogs([]);
    setTotalBytes(0);
    setDroppedCount(0);
  }, []);

  const exportLogs = useCallback(() => {
    const currentLogs = logsRef.current || [];
    const success = exportLogsToFile(currentLogs);
    if (success) {
      setExported(true);
      setTimeout(() => setExported(false), 2000);
    }
    return success;
  }, []);

  const copyLogs = useCallback(
    async (onlyVisible = false) => {
      const currentLogs = logsRef.current || [];
      const targetLogs = onlyVisible ? currentLogs.slice(-displayLimit) : currentLogs;
      const success = await copyLogsToClipboard(targetLogs);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      return success;
    },
    [displayLimit]
  );

  // 监听 Tauri 后端推送的 'log-message'
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        console.log('[useLogBuffer] 正在注册 Tauri "log-message" 实时日志监听器...');
        unlisten = await listen<string>('log-message', (event) => {
          const raw = String(event.payload);
          addLog(raw);
        });
        console.log('[useLogBuffer] "log-message" 监听器注册就绪');
      } catch (err) {
        console.warn('[useLogBuffer] Tauri 事件监听不可用 (Web 预览环境可忽略):', err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [addLog]);

  // 过滤逻辑 (按等级与关键词)
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterLevel !== 'all') {
        if (filterLevel === 'error' && log.level !== 'error' && log.level !== 'fatal') return false;
        if (filterLevel === 'warn' && log.level !== 'warn') return false;
        if (filterLevel === 'info' && log.level !== 'info') return false;
        if (filterLevel === 'debug' && log.level !== 'debug' && log.level !== 'trace') return false;
      }
      if (filterKeyword) {
        const lowerKw = filterKeyword.toLowerCase();
        return log.raw.toLowerCase().includes(lowerKw);
      }
      return true;
    });
  }, [logs, filterLevel, filterKeyword]);

  // 视图渲染切片：看板仅渲染最新 N 条，保障 DOM 渲染性能与 60fps 流畅度
  const visibleLogs = useMemo(() => {
    if (displayLimit <= 0 || filteredLogs.length <= displayLimit) {
      return filteredLogs;
    }
    return filteredLogs.slice(-displayLimit);
  }, [filteredLogs, displayLimit]);

  const rawLogs = useMemo(() => logs.map((l) => l.raw), [logs]);

  const stats: BufferStats = useMemo(() => {
    return {
      totalCount: logs.length,
      totalBytes,
      maxBytes,
      formattedSize: formatBytes(totalBytes),
      formattedMaxSize: formatBytes(maxBytes),
      displayLimit,
      renderedCount: visibleLogs.length,
      droppedCount,
    };
  }, [logs.length, totalBytes, maxBytes, displayLimit, visibleLogs.length, droppedCount]);

  return {
    rawLogs,
    visibleLogs,
    allLogs: logs,
    stats,
    displayLimit,
    setDisplayLimit,
    filterLevel,
    setFilterLevel,
    filterKeyword,
    setFilterKeyword,
    autoScroll,
    setAutoScroll,
    copied,
    exported,
    addLog,
    clearLogs,
    exportLogs,
    copyLogs,
  };
}
