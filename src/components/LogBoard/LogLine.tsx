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

  // 颜色映射 (适配白底终端风格，保障可读性与 WCAG 2.1 高对比度)
  let levelColor = '#0969da'; // INFO 亮蓝
  let levelBg = 'rgba(9, 105, 218, 0.1)';
  let levelBorder = 'rgba(9, 105, 218, 0.25)';
  let rowBg = 'transparent';
  let textColor = '#1f2328';

  if (isError) {
    levelColor = '#cf222e'; // ERROR 危险红
    levelBg = 'rgba(207, 34, 46, 0.1)';
    levelBorder = 'rgba(207, 34, 46, 0.25)';
    rowBg = 'rgba(207, 34, 46, 0.04)';
    textColor = '#cf222e';
  } else if (isWarn) {
    levelColor = '#9a6700'; // WARN 警告橙黄
    levelBg = 'rgba(217, 153, 0, 0.12)';
    levelBorder = 'rgba(217, 153, 0, 0.3)';
    rowBg = 'rgba(217, 153, 0, 0.04)';
    textColor = '#7d4e00';
  } else if (isSuccess) {
    levelColor = '#1a7f37'; // SUCCESS 成功绿
    levelBg = 'rgba(26, 127, 55, 0.1)';
    levelBorder = 'rgba(26, 127, 55, 0.25)';
    textColor = '#1a7f37';
  } else if (isDebug) {
    levelColor = '#57606a'; // DEBUG 沉着灰
    levelBg = 'rgba(87, 96, 106, 0.1)';
    levelBorder = 'rgba(87, 96, 106, 0.25)';
    textColor = '#57606a';
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '8px',
        padding: '3px 6px',
        borderRadius: '4px',
        backgroundColor: rowBg,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
        fontSize: '12px',
        lineHeight: 1.6,
        wordBreak: 'break-all',
        whiteSpace: 'pre-wrap',
        borderLeft: isError
          ? '3px solid #cf222e'
          : isWarn
          ? '3px solid #d29922'
          : '3px solid transparent',
      }}
    >
      {/* 行号 */}
      <span
        style={{
          userSelect: 'none',
          color: '#8c959f',
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
            <span style={{ color: '#57606a', marginRight: '6px' }}>[{log.tag}]</span>
            {log.timing && (
              <span
                style={{
                  color: '#8250df',
                  marginRight: '8px',
                  backgroundColor: 'rgba(130, 80, 223, 0.1)',
                  padding: '1px 4px',
                  borderRadius: '3px',
                }}
              >
                [{log.timing}]
              </span>
            )}
            <span style={{ color: textColor }}>{log.message}</span>
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
            <span style={{ color: textColor }}>{log.message || log.raw}</span>
          </>
        )}
      </div>
    </div>
  );
};
