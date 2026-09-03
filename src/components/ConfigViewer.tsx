import React, { useState } from 'react';
import { Box, Heading, Text, Button, Flash, Label } from '@primer/react';
import {
  CopyIcon,
  CheckIcon,
  FileCodeIcon,
  InfoIcon,
  AlertIcon,
} from '@primer/octicons-react';
import { ConfigMeta } from '../types';

interface ConfigViewerProps {
  rawJson: string;
  meta: ConfigMeta;
  configPath: string;
}

export const ConfigViewer: React.FC<ConfigViewerProps> = ({
  rawJson,
  meta,
  configPath,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy config to clipboard:', err);
    }
  };

  return (
    <Box>
      {/* Notice Banner explaining read-only policy as requested */}
      <Flash variant="default" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <InfoIcon size={16} />
        <Box sx={{ flexGrow: 1 }}>
          <Text sx={{ fontWeight: 'semibold', mr: 1 }}>第三方编辑器提示：</Text>
          <Text>
            当前版本为只读检查与状态监控面板，不支持在界面内直接写入保存。如需调整路由规则或节点，请使用{' '}
            <strong>VS Code、Cursor、Sublime Text 或 Notepad</strong> 等外部编辑器修改配置文件 (
            <code>{configPath}</code>) 后，点击上方的「重新加载配置」。
          </Text>
        </Box>
      </Flash>

      {/* Header bar of the viewer */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          bg: 'canvas.subtle',
          border: '1px solid',
          borderColor: 'border.default',
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FileCodeIcon size={16} />
          <Text sx={{ fontWeight: 'semibold', fontSize: 1 }}>{configPath}</Text>
          {meta.isValid ? (
            <Label variant="success" size="small">
              JSON 语法有效
            </Label>
          ) : (
            <Label variant="danger" size="small">
              语法解析错误
            </Label>
          )}
        </Box>

        <Button
          size="small"
          leadingVisual={copied ? CheckIcon : CopyIcon}
          onClick={handleCopy}
        >
          {copied ? '已复制！' : '复制 JSON'}
        </Button>
      </Box>

      {/* Syntax Error Box if any */}
      {!meta.isValid && meta.parseError && (
        <Box
          sx={{
            p: 3,
            bg: 'danger.subtle',
            borderLeft: '1px solid',
            borderRight: '1px solid',
            borderColor: 'danger.muted',
            color: 'danger.fg',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <AlertIcon size={16} />
          <Text sx={{ fontSize: 1, fontFamily: 'mono' }}>{meta.parseError}</Text>
        </Box>
      )}

      {/* Code Display Area */}
      <Box
        as="pre"
        className="selectable-text"
        sx={{
          m: 0,
          p: 3,
          maxHeight: '480px',
          overflowY: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          fontSize: 1,
          lineHeight: '1.5',
          bg: 'canvas.inset',
          color: 'fg.default',
          border: '1px solid',
          borderColor: 'border.default',
          borderTop: 'none',
          borderBottomLeftRadius: 2,
          borderBottomRightRadius: 2,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        <code>{rawJson || '// 配置文件为空或未读取到内容'}</code>
      </Box>
    </Box>
  );
};
