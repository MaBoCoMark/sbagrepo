import React from 'react';
import { Heading, Button } from '@primer/react';
import {
  TerminalIcon,
  TrashIcon,
  CopyIcon,
  DownloadIcon,
} from '@primer/octicons-react';

interface LogToolbarProps {
  totalCount: number;
  displayLimit: number;
  onDisplayLimitChange: (limit: number) => void;
  filterLevel: string;
  onFilterLevelChange: (level: string) => void;
  autoScroll: boolean;
  onAutoScrollChange: (auto: boolean) => void;
  onCopy: () => void;
  copied: boolean;
  onExport: () => void;
  exported: boolean;
  onClear: () => void;
}

export const LogToolbar: React.FC<LogToolbarProps> = ({
  totalCount,
  displayLimit,
  onDisplayLimitChange,
  filterLevel,
  onFilterLevelChange,
  autoScroll,
  onAutoScrollChange,
  onCopy,
  copied,
  onExport,
  exported,
  onClear,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <TerminalIcon size={18} fill="var(--fg-muted, #656d76)" />
        <Heading as="h2" style={{ fontSize: '16px', margin: 0, fontWeight: 600 }}>
          实时日志看板 (Live Logs)
        </Heading>
      </div>

      {/* 控制操作区 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* 日志级别筛选 */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: 'var(--fg-muted, #656d76)',
          }}
        >
          级别:
          <select
            value={filterLevel}
            onChange={(e: any) => onFilterLevelChange(e.target.value)}
            style={{
              fontSize: '12px',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid var(--border-default, #d0d7de)',
              backgroundColor: 'var(--bg-canvas, #ffffff)',
              color: 'var(--fg-default, #1f2328)',
              cursor: 'pointer',
            }}
          >
            <option value="all">全部级别</option>
            <option value="info">INFO</option>
            <option value="warn">WARN</option>
            <option value="error">ERROR / FATAL</option>
            <option value="debug">DEBUG</option>
          </select>
        </label>

        {/* 视图显示条数限制 */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: 'var(--fg-muted, #656d76)',
          }}
        >
          显示条数:
          <select
            value={displayLimit}
            onChange={(e: any) => onDisplayLimitChange(Number(e.target.value))}
            style={{
              fontSize: '12px',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid var(--border-default, #d0d7de)',
              backgroundColor: 'var(--bg-canvas, #ffffff)',
              color: 'var(--fg-default, #1f2328)',
              cursor: 'pointer',
            }}
          >
            <option value={200}>最新 200 条</option>
            <option value={500}>最新 500 条 (推荐)</option>
            <option value={1000}>最新 1000 条</option>
            <option value={2000}>最新 2000 条</option>
            <option value={0}>全部显示 (不限)</option>
          </select>
        </label>

        {/* 自动滚动 */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--fg-muted, #656d76)',
            cursor: 'pointer',
            userSelect: 'none',
            marginLeft: '4px',
          }}
        >
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e: any) => onAutoScrollChange(e.target.checked)}
          />
          自动滚动
        </label>

        {/* 导出日志 (保存到文件) */}
        <Button
          variant="default"
          size="small"
          leadingVisual={DownloadIcon}
          onClick={onExport}
          disabled={totalCount === 0}
          title="将当前内存中保存的全部日志 (最多20MB) 导出为本地文件"
        >
          {exported ? '已导出！' : '导出日志'}
        </Button>

        {/* 复制日志 */}
        <Button
          variant="default"
          size="small"
          leadingVisual={CopyIcon}
          onClick={onCopy}
          disabled={totalCount === 0}
        >
          {copied ? '已复制！' : '复制日志'}
        </Button>

        {/* 清空日志 */}
        <Button
          variant="default"
          size="small"
          leadingVisual={TrashIcon}
          onClick={onClear}
          disabled={totalCount === 0}
        >
          清空日志
        </Button>
      </div>
    </div>
  );
};
