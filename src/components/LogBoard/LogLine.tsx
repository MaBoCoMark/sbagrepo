import React from 'react';
import { ParsedLog } from '../../types/log';

export interface LogLineProps {
  key?: string | number;
  log: ParsedLog;
  lineNumber: number;
}

export const LogLine: React.FC<LogLineProps> = ({ log, lineNumber }) => {
  const isError = log.level === 'error' || log.level === 'fatal';
  const isWarn = log.level === 'warn';
  const isSuccess = log.level === 'success';
  const isDebug = log.level === 'debug' || log.level === 'trace';

  // 颜色映射 (适配暗色终端风格)
  let levelColor = '#58a6ff'; // INFO 亮蓝
  let levelBg = 'rgba(56, 139, 253, 0.15)';
  let levelBorder = 'rgba(56, 139, 253, 0.3)';
  let rowBg = 'transparent';
  let textColor = '#e6edf3';

  if (isError) {
    levelColor = '#f85149'; // ERROR 危险红
    levelBg = 'rgba(248, 81, 73, 0.2)';
    levelBorder = 'rgba(248, 81, 73, 0.4)';
    rowBg = 'rgba(248, 81, 73, 0.08)';
    textColor = '#ff7b72';
  } else if (isWarn) {
    levelColor = '#d29922'; // WARN 警告橙黄
    levelBg = 'rgba(210, 153, 34, 0.2)';
    levelBorder = 'rgba(210, 153, 34, 0.4)';
    rowBg = 'rgba(210, 153, 34, 0.06)';
    textColor = '#e3b341';
  } else if (isSuccess) {
    levelColor = '#3fb950'; // SUCCESS 成功绿
    levelBg = 'rgba(63, 185, 80, 0.15)';
    levelBorder = 'rgba(63, 185, 80, 0.3)';
    textColor = '#56d364';
  } else if (isDebug) {
    levelColor = '#8b949e'; // DEBUG 沉着灰
    levelBg = 'rgba(139, 148, 158, 0.15)';
    levelBorder = 'rgba(139, 148, 158, 0.3)';
    textColor = '#8b949e';
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '8px',
        padding: '2px 6px',
        borderRadius: '4px',
        backgroundColor: rowBg,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
        fontSize: '12px',
        lineHeight: 1.6,
        wordBreak: 'break-all',
        whiteSpace: 'pre-wrap',
        borderLeft: isError ? '3px solid #f85149' : isWarn ? '3px solid #d29922' : '3px solid transparent',
      }}
    >
      {/* 行号 */}
      <span
        style={{
          userSelect: 'none',
          color: '#484f58',
          minWidth: '40px',
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {lineNumber}
      </span>

      {/* 日志内容区域 */}
      <div style={{ display: 'inline', flex: 1, color: textColor }}>
        {log.tag ? (
          // sing-box 标准输出格式: INFO[0024] [timing] message
          <>
            <span
              style={{
                display: 'inline-block',
                padding: '0 5px',
                borderRadius: '3px',
                backgroundColor: levelBg,
                color: levelColor,
                border: `1px solid ${levelBorder}`,
                fontWeight: 600,
                fontSize: '11px',
                marginRight: '6px',
                userSelect: 'none',
              }}
            >
              {log.level.toUpperCase()}
            </span>
            <span style={{ color: '#7d8590', marginRight: '6px' }}>[{log.tag}]</span>
            {log.timing && (
              <span
                style={{
                  color: '#a371f7',
                  marginRight: '8px',
                  backgroundColor: 'rgba(163, 113, 247, 0.1)',
                  padding: '1px 4px',
                  borderRadius: '3px',
                }}
              >
                [{log.timing}]
              </span>
            )}
            <span>{log.message}</span>
          </>
        ) : (
          // 非 sing-box 标准单行文本
          <>
            {log.level !== 'unknown' && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '0 5px',
                  borderRadius: '3px',
                  backgroundColor: levelBg,
                  color: levelColor,
                  border: `1px solid ${levelBorder}`,
                  fontWeight: 600,
                  fontSize: '11px',
                  marginRight: '6px',
                  userSelect: 'none',
                }}
              >
                {log.level.toUpperCase()}
              </span>
            )}
            <span>{log.message || log.raw}</span>
          </>
        )}
      </div>
    </div>
  );
};
