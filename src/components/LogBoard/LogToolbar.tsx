import React from 'react';
import { Heading, Button, FormControl, Select } from '@primer/react';
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
        padding: '12px 16px',
        backgroundColor: 'var(--bg-subtle, #f6f8fa)',
        borderRadius: '8px',
        border: '1px solid var(--border-default, #d0d7de)',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {/* 日志级别筛选 (使用 Primer 规范 FormControl + Select 组件) */}
        <div style={{ minWidth: '130px' }}>
          <FormControl>
            <FormControl.Label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fg-muted, #656d76)' }}>
              级别
            </FormControl.Label>
            <Select
              size="small"
              value={filterLevel}
              onChange={(e: any) => onFilterLevelChange(e.target.value)}
            >
              <Select.Option value="all">全部级别</Select.Option>
              <Select.Option value="info">INFO</Select.Option>
              <Select.Option value="warn">WARN</Select.Option>
              <Select.Option value="error">ERROR / FATAL</Select.Option>
              <Select.Option value="debug">DEBUG</Select.Option>
            </Select>
          </FormControl>
        </div>

        {/* 视图显示条数限制 (使用 Primer 规范 FormControl + Select 组件) */}
        <div style={{ minWidth: '150px' }}>
          <FormControl>
            <FormControl.Label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fg-muted, #656d76)' }}>
              显示条数
            </FormControl.Label>
            <Select
              size="small"
              value={displayLimit}
              onChange={(e: any) => onDisplayLimitChange(Number(e.target.value))}
            >
              <Select.Option value={200}>最新 200 条</Select.Option>
              <Select.Option value={500}>最新 500 条 (推荐)</Select.Option>
              <Select.Option value={1000}>最新 1000 条</Select.Option>
              <Select.Option value={2000}>最新 2000 条</Select.Option>
              <Select.Option value={0}>全部显示 (不限)</Select.Option>
            </Select>
          </FormControl>
        </div>

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
            marginTop: '16px',
          }}
        >
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e: any) => onAutoScrollChange(e.target.checked)}
          />
          自动滚动
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
          {/* 导出日志 (保存到文件) */}
          <Button
            variant="default"
            size="small"
            leadingVisual={DownloadIcon}
            onClick={onExport}
            disabled={totalCount === 0}
            title="将当前内存中保存的全部日志导出为本地文件"
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
    </div>
  );
};
