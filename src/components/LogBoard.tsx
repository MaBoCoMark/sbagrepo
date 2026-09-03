import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, TextInput, Text, Label, CounterLabel } from '@primer/react';
import {
  TrashIcon,
  CopyIcon,
  CheckIcon,
  SearchIcon,
  TerminalIcon,
  SyncIcon,
} from '@primer/octicons-react';
import { LogEntry } from '../types';

interface LogBoardProps {
  logs: LogEntry[];
  onClearLogs: () => void;
  isRunning: boolean;
}

export const LogBoard: React.FC<LogBoardProps> = ({
  logs,
  onClearLogs,
  isRunning,
}) => {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [filterText, setFilterText] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [copied, setCopied] = useState<boolean>(false);

  // Auto-scroll to bottom whenever logs update if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleCopyLogs = async () => {
    const text = logs.map((l) => l.raw).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  const filteredLogs = logs.filter((entry) => {
    if (levelFilter !== 'ALL' && entry.level.toUpperCase() !== levelFilter) {
      return false;
    }
    if (filterText.trim()) {
      return entry.raw.toLowerCase().includes(filterText.toLowerCase());
    }
    return true;
  });

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return '#f85149'; // Primer red
      case 'warn':
        return '#d29922'; // Primer yellow
      case 'info':
        return '#58a6ff'; // Primer blue
      case 'debug':
      case 'trace':
        return '#a371f7'; // Primer purple
      default:
        return 'inherit';
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '520px',
        border: '1px solid',
        borderColor: 'border.default',
        borderRadius: 2,
        overflow: 'hidden',
        bg: 'canvas.inset',
      }}
    >
      {/* Top Toolbar */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          p: 2,
          px: 3,
          bg: 'canvas.subtle',
          borderBottom: '1px solid',
          borderColor: 'border.default',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TerminalIcon size={16} />
          <Text sx={{ fontWeight: 'semibold', fontSize: 1 }}>实时日志看板 (Live Logs)</Text>
          <CounterLabel>{logs.length}</CounterLabel>
          {isRunning && (
            <Label variant="success" size="small">
              Streaming
            </Label>
          )}
        </Box>

        {/* Action controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Level selector */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {['ALL', 'INFO', 'WARN', 'ERROR'].map((lvl) => (
              <Button
                key={lvl}
                size="small"
                variant={levelFilter === lvl ? 'primary' : 'invisible'}
                onClick={() => setLevelFilter(lvl)}
              >
                {lvl}
              </Button>
            ))}
          </Box>

          {/* Filter Search Input */}
          <TextInput
            size="small"
            leadingVisual={SearchIcon}
            placeholder="过滤日志关键字..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            sx={{ width: 180 }}
          />

          {/* Auto Scroll toggle */}
          <Button
            size="small"
            variant={autoScroll ? 'default' : 'invisible'}
            onClick={() => setAutoScroll(!autoScroll)}
          >
            {autoScroll ? '锁定底部: 开' : '锁定底部: 关'}
          </Button>

          {/* Copy logs */}
          <Button
            size="small"
            leadingVisual={copied ? CheckIcon : CopyIcon}
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
          >
            {copied ? '已复制' : '复制'}
          </Button>

          {/* Clear logs */}
          <Button
            size="small"
            variant="danger"
            leadingVisual={TrashIcon}
            onClick={onClearLogs}
            disabled={logs.length === 0}
          >
            清空
          </Button>
        </Box>
      </Box>

      {/* Terminal Display Container (id="logs" provided as in reference architecture) */}
      <Box
        ref={logContainerRef}
        id="logs"
        className="selectable-text"
        sx={{
          flexGrow: 1,
          p: 3,
          overflowY: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          fontSize: 0,
          lineHeight: 1.6,
          color: 'fg.default',
          bg: '#0d1117', // Terminal dark background
          colorScheme: 'dark',
        }}
      >
        {filteredLogs.length === 0 ? (
          <Box sx={{ color: '#8b949e', textAlign: 'center', py: 8 }}>
            <TerminalIcon size={32} />
            <Text sx={{ display: 'block', mt: 2, fontSize: 1 }}>
              {logs.length === 0
                ? '暂无日志输出。点击「普通启动」或「管理员提权启动」运行 sing-box。'
                : '没有匹配过滤条件的日志。'}
            </Text>
          </Box>
        ) : (
          filteredLogs.map((entry) => (
            <Box
              key={entry.id}
              sx={{
                display: 'flex',
                gap: 2,
                wordBreak: 'break-all',
                '&:hover': { bg: 'rgba(255, 255, 255, 0.05)' },
              }}
            >
              <Text sx={{ color: '#8b949e', flexShrink: 0 }}>[{entry.timestamp}]</Text>
              <Text
                sx={{
                  color: getLevelColor(entry.level),
                  fontWeight: entry.level === 'error' || entry.level === 'warn' ? 'bold' : 'normal',
                }}
              >
                {entry.raw}
              </Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};
