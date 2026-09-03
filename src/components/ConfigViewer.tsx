import React from 'react';
import { Heading, Text, Button, Banner } from '@primer/react';
import { SyncIcon, FileCodeIcon } from '@primer/octicons-react';

interface ConfigViewerProps {
  configPath: string;
  configContent: string;
  onReload: () => void;
  isLoading: boolean;
}

export const ConfigViewer: React.FC<ConfigViewerProps> = ({
  configPath,
  configContent,
  onReload,
  isLoading,
}) => {
  let formattedJson = configContent;
  try {
    if (configContent.trim()) {
      formattedJson = JSON.stringify(JSON.parse(configContent), null, 2);
    }
  } catch {
    formattedJson = configContent;
  }

  const lineCount = formattedJson ? formattedJson.split('\n').length : 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        backgroundColor: 'var(--bg-subtle, #f6f8fa)',
        borderRadius: '8px',
        border: '1px solid var(--border-default, #d0d7de)',
        padding: '20px',
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
          <FileCodeIcon size={18} fill="var(--fg-muted, #656d76)" />
          <Heading as="h2" style={{ fontSize: '16px', margin: 0, fontWeight: 600 }}>
            配置文件查看器 (Config Viewer)
          </Heading>
          <Text as="span" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)' }}>
            ({lineCount} 行 · {configPath})
          </Text>
        </div>

        <Button
          variant="default"
          size="small"
          leadingVisual={SyncIcon}
          onClick={onReload}
          loading={isLoading}
        >
          重新加载
        </Button>
      </div>

      <Banner
        variant="info"
        title="只读模式提示"
        description="当前 MVP 版本暂不支持在软件内直接编辑配置文件。请使用第三方专业编辑器（如 VS Code、Sublime Text）修改您的 config.json，保存后点击右上角【重新加载】。"
      />

      <div
        style={{
          position: 'relative',
          borderRadius: '6px',
          border: '1px solid var(--border-muted, #d8dee4)',
          backgroundColor: 'var(--bg-inset, #0d1117)',
          maxHeight: '380px',
          overflow: 'auto',
        }}
      >
        <pre
          style={{
            margin: 0,
            padding: '16px',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            fontSize: '13px',
            lineHeight: 1.6,
            color: 'var(--fg-default, #e6edf3)',
            whiteSpace: 'pre',
            wordBreak: 'normal',
          }}
        >
          <code>{formattedJson || '// 配置文件为空或未加载'}</code>
        </pre>
      </div>
    </div>
  );
};
