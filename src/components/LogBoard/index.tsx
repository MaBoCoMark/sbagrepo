import React, { useEffect, useRef } from 'react';
import { Text } from '@primer/react';
import { TerminalIcon } from '@primer/octicons-react';
import { LogToolbar } from './LogToolbar';
import { LogStatusBar } from './LogStatusBar';
import { LogLine } from './LogLine';
import { useLogBuffer, UseLogBufferReturn } from '../../hooks/useLogBuffer';

export interface LogBoardProps {
  logs?: string[];
  setLogs?: React.Dispatch<React.SetStateAction<string[]>>;
  buffer?: UseLogBufferReturn;
}

export const LogBoard: React.FC<LogBoardProps> = ({
  setLogs: legacySetLogs,
  buffer: externalBuffer,
}) => {
  const internalBuffer = useLogBuffer();
  const logBuffer = externalBuffer || internalBuffer;

  const {
    visibleLogs,
    rawLogs,
    stats,
    displayLimit,
    setDisplayLimit,
    filterLevel,
    setFilterLevel,
    autoScroll,
    setAutoScroll,
    copied,
    exported,
    clearLogs,
    exportLogs,
    copyLogs,
  } = logBuffer;

  const containerRef = useRef<HTMLDivElement | null>(null);

  // 同步外部 legacy logs 状态 (向后兼容)
  useEffect(() => {
    if (legacySetLogs) {
      legacySetLogs(rawLogs);
    }
  }, [rawLogs, legacySetLogs]);

  // 自动平滑滚动到底部
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [visibleLogs, autoScroll]);

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
      {/* 顶部操作工具栏 */}
      <LogToolbar
        totalCount={stats.totalCount}
        displayLimit={displayLimit}
        onDisplayLimitChange={setDisplayLimit}
        filterLevel={filterLevel}
        onFilterLevelChange={setFilterLevel}
        autoScroll={autoScroll}
        onAutoScrollChange={setAutoScroll}
        onCopy={() => copyLogs(false)}
        copied={copied}
        onExport={exportLogs}
        exported={exported}
        onClear={clearLogs}
      />

      {/* 内存与缓冲区容量状态指示条 */}
      <LogStatusBar stats={stats} />

      {/* 日志终端视口容器 */}
      <div
        id="logs"
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: '420px',
          maxHeight: 'calc(100vh - 240px)',
          overflowY: 'auto',
          backgroundColor: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
        }}
      >
        {visibleLogs.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: '300px',
              color: '#8b949e',
              gap: '12px',
            }}
          >
            <TerminalIcon size={36} fill="#8b949e" />
            <Text as="p" style={{ fontSize: '13px', margin: 0, textAlign: 'center' }}>
              {stats.totalCount > 0
                ? '当前筛选条件下暂无匹配日志。'
                : '暂无日志输出。启动 sing-box 后，实时输出日志将流式展示在此处。'}
            </Text>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {visibleLogs.map((item, idx) => {
              // 计算全局行号
              const globalIndex =
                displayLimit > 0 && stats.totalCount > displayLimit
                  ? stats.totalCount - visibleLogs.length + idx + 1
                  : idx + 1;
              return <LogLine key={item.id} log={item} lineNumber={globalIndex} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
};
