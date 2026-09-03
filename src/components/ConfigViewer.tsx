import React from 'react';
import { Heading, Text, Button, Banner } from '@primer/react';
import { SyncIcon, FileCodeIcon } from '@primer/octicons-react';

interface ConfigViewerProps {
  configPath?: string;
  configContent: string;
  onReload: () => void;
  isLoading: boolean;
}

export const ConfigViewer: React.FC<ConfigViewerProps> = ({
  configPath: _configPath,
  configContent,
  onReload,
  isLoading,
}) => {
  let formattedJson = configContent;
  const trimmed = (configContent || '').trim();

  if (!trimmed) {
    formattedJson = '{\n}\n';
  } else {
    try {
      formattedJson = JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      formattedJson = trimmed;
    }
  }

  const lineCount = formattedJson ? formattedJson.split('\n').length : 1;
  const isDefaultEmpty = !trimmed || trimmed === '{}' || trimmed === '{\n}';

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
            ({lineCount} 行 · 应用标准存储区 config.json)
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

      {isDefaultEmpty ? (
        <Banner
          variant="info"
          title="当前配置为空白默认文件"
          description="应用检测到当前配置存储区为空，已自动生成空白 JSON ({})。您可以通过上方【导入配置文件】功能直接上传完整的 sing-box 配置文件覆盖此处。"
        />
      ) : (
        <Banner
          variant="info"
          title="只读模式提示"
          description="当前版本直接查看应用专属目录下的固定 config.json 文件。如需更换配置，直接点击上方【导入配置文件】上传新配置即可覆盖。"
        />
      )}

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
          <code>{formattedJson}</code>
        </pre>
      </div>
    </div>
  );
};
