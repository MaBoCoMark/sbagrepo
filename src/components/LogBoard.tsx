import React, { useEffect, useRef, useState } from 'react';
import { Heading, Text, Button, Label } from '@primer/react';
import { TerminalIcon, TrashIcon, CopyIcon } from '@primer/octicons-react';
import { listen } from '@tauri-apps/api/event';

interface LogBoardProps {
  logs: string[];
  setLogs: React.Dispatch<React.SetStateAction<string[]>>;
}

export const LogBoard: React.FC<LogBoardProps> = ({ logs, setLogs }) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        unlisten = await listen<string>('log-message', (event) => {
          setLogs((prev) => [...prev, String(event.payload)]);
        });
      } catch (err) {
        console.warn('Tauri event listener not available in web preview:', err);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [setLogs]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleClear = () => {
    setLogs([]);
  };

  const handleCopy = () => {
    const text = logs.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const renderLogLine = (line: string, index: number) => {
    let color = 'var(--fg-default, #e6edf3)';
    if (line.includes('[ERROR]') || line.includes('FATAL') || line.includes('error')) {
      color = 'var(--color-danger, #f85149)';
    } else if (line.includes('[WARN]') || line.includes('warning')) {
      color = 'var(--color-warning, #d29922)';
    } else if (line.includes('[INFO]')) {
      color = 'var(--color-accent, #58a6ff)';
    } else if (line.includes('[DEBUG]')) {
      color = 'var(--fg-muted, #8b949e)';
    }

    return (
      <div
        key={index}
        style={{
          display: 'flex',
          gap: '12px',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          fontSize: '12px',
          lineHeight: 1.6,
        }}
      >
        <span
          style={{
            userSelect: 'none',
            color: 'var(--fg-muted, #484f58)',
            minWidth: '36px',
            textAlign: 'right',
          }}
        >
          {index + 1}
        </span>
        <span style={{ color, wordBreak: 'break-all' }}>{line}</span>
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        height: '100%',
        flex: 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TerminalIcon size={18} fill="var(--fg-muted, #656d76)" />
          <Heading as="h2" style={{ fontSize: '16px', margin: 0, fontWeight: 600 }}>
            实时日志看板 (Live Logs)
          </Heading>
          <Label variant="secondary" size="small">
            {logs.length} 条记录
          </Label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--fg-muted, #656d76)',
              cursor: 'pointer',
              userSelect: 'none',
              marginRight: '8px',
            }}
          >
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e: any) => setAutoScroll(e.target.checked)}
            />
            自动滚动到底部
          </label>

          <Button
            variant="default"
            size="small"
            leadingVisual={CopyIcon}
            onClick={handleCopy}
            disabled={logs.length === 0}
          >
            {copied ? '已复制！' : '复制日志'}
          </Button>

          <Button
            variant="default"
            size="small"
            leadingVisual={TrashIcon}
            onClick={handleClear}
            disabled={logs.length === 0}
          >
            清空日志
          </Button>
        </div>
      </div>

      <div
        id="logs"
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: '420px',
          maxHeight: 'calc(100vh - 220px)',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-inset, #0d1117)',
          border: '1px solid var(--border-muted, #30363d)',
          borderRadius: '8px',
          padding: '16px',
        }}
      >
        {logs.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: '300px',
              color: 'var(--fg-muted, #8b949e)',
              gap: '8px',
            }}
          >
            <TerminalIcon size={32} fill="var(--fg-muted, #8b949e)" />
            <Text as="p" style={{ fontSize: '13px', margin: 0 }}>
              暂无日志输出。启动 sing-box 后，实时输出日志将流式展示在此处。
            </Text>
          </div>
        ) : (
          logs.map((line, idx) => renderLogLine(line, idx))
        )}
      </div>
    </div>
  );
};
