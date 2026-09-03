import React from 'react';
import { Label } from '@primer/react';
import { BufferStats } from '../../types/log';

interface LogStatusBarProps {
  stats: BufferStats;
}

export const LogStatusBar: React.FC<LogStatusBarProps> = ({ stats }) => {
  const percentUsed = Math.min(100, Math.round((stats.totalBytes / stats.maxBytes) * 100));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '8px 12px',
        backgroundColor: 'var(--bg-subtle, #f6f8fa)',
        border: '1px solid var(--border-muted, #d8dee4)',
        borderRadius: '6px',
        fontSize: '12px',
        color: 'var(--fg-muted, #656d76)',
      }}
    >
      {/* 内存与队列状态 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <Label variant="secondary" size="small">
          内存 FIFO 循环队列
        </Label>

        <span>
          内存占用:{' '}
          <strong style={{ color: 'var(--fg-default, #1f2328)' }}>
            {stats.formattedSize}
          </strong>{' '}
          / {stats.formattedMaxSize} ({percentUsed}%)
        </span>

        {/* 简易内存使用量进度条 */}
        <div
          style={{
            width: '80px',
            height: '6px',
            backgroundColor: 'var(--border-muted, #d0d7de)',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${percentUsed}%`,
              height: '100%',
              backgroundColor:
                percentUsed > 85
                  ? 'var(--color-danger, #cf222e)'
                  : percentUsed > 60
                  ? 'var(--color-warning, #9a6700)'
                  : 'var(--color-accent, #0969da)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {stats.droppedCount > 0 && (
          <span style={{ color: 'var(--color-attention, #9a6700)' }}>
            (已 FIFO 滚动回收 {stats.droppedCount.toLocaleString()} 条超额旧记录)
          </span>
        )}
      </div>

      {/* 视图与条数限制 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>
          总计 <strong>{stats.totalCount.toLocaleString()}</strong> 条
        </span>
        <span>•</span>
        <span>
          看板渲染:{' '}
          <strong>
            {stats.displayLimit > 0
              ? `最新 ${stats.renderedCount.toLocaleString()} 条`
              : `全部 ${stats.renderedCount.toLocaleString()} 条`}
          </strong>
        </span>
      </div>
    </div>
  );
};
