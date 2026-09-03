import React from 'react';
import { Box, Button, TextInput, Text, Flash } from '@primer/react';
import {
  CheckIcon,
  PlayIcon,
  ShieldLockIcon,
  StopIcon,
  SyncIcon,
  FileDirectoryIcon,
  GearIcon,
} from '@primer/octicons-react';
import { ProcessStatus } from '../types';

interface ActionToolbarProps {
  status: ProcessStatus;
  binaryPath: string;
  configPath: string;
  onBinaryPathChange: (path: string) => void;
  onConfigPathChange: (path: string) => void;
  onCheckConfig: () => void;
  onStartNormal: () => void;
  onStartAdmin: () => void;
  onStopProcess: () => void;
  onReloadConfig: () => void;
  isActionLoading: boolean;
  actionMessage: { type: 'success' | 'danger' | 'warning' | 'info'; text: string } | null;
  onDismissMessage: () => void;
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  status,
  binaryPath,
  configPath,
  onBinaryPathChange,
  onConfigPathChange,
  onCheckConfig,
  onStartNormal,
  onStartAdmin,
  onStopProcess,
  onReloadConfig,
  isActionLoading,
  actionMessage,
  onDismissMessage,
}) => {
  const isRunning = status === 'running' || status === 'elevated';

  return (
    <Box sx={{ mb: 4 }}>
      {/* Primary Action Button Bar */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 2,
          p: 3,
          bg: 'canvas.default',
          border: '1px solid',
          borderColor: 'border.default',
          borderRadius: 2,
          mb: 3,
          boxShadow: 'shadow.subtle',
        }}
      >
        {/* Button 1: Check Config */}
        <Button
          variant="default"
          size="medium"
          leadingVisual={CheckIcon}
          onClick={onCheckConfig}
          disabled={isActionLoading || isRunning}
        >
          检查语法 (Check)
        </Button>

        {/* Button 2: Normal / Direct Run */}
        <Button
          variant="primary"
          size="medium"
          leadingVisual={PlayIcon}
          onClick={onStartNormal}
          disabled={isActionLoading || isRunning}
        >
          普通启动 (Direct Run)
        </Button>

        {/* Button 3: Admin / Elevated Run */}
        <Button
          variant="default"
          size="medium"
          leadingVisual={ShieldLockIcon}
          onClick={onStartAdmin}
          disabled={isActionLoading || isRunning}
        >
          管理员提权启动 (Admin/Sudo)
        </Button>

        {/* Button 4: Stop Process */}
        <Button
          variant="danger"
          size="medium"
          leadingVisual={StopIcon}
          onClick={onStopProcess}
          disabled={isActionLoading || !isRunning}
        >
          终止进程 (Stop)
        </Button>

        {/* Reload / Refresh config button */}
        <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
          <Button
            variant="invisible"
            size="medium"
            leadingVisual={SyncIcon}
            onClick={onReloadConfig}
            disabled={isActionLoading}
          >
            重新加载配置
          </Button>
        </Box>
      </Box>

      {/* Path Configuration Inputs */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: ['1fr', '1fr 1fr'],
          gap: 3,
          p: 3,
          bg: 'canvas.subtle',
          border: '1px solid',
          borderColor: 'border.subtle',
          borderRadius: 2,
          mb: 3,
        }}
      >
        <Box>
          <Text as="label" sx={{ display: 'block', fontSize: 1, fontWeight: 'semibold', mb: 1 }}>
            sing-box 二进制路径 (Sidecar Binary Path):
          </Text>
          <TextInput
            leadingVisual={GearIcon}
            value={binaryPath}
            onChange={(e) => onBinaryPathChange(e.target.value)}
            placeholder="src-tauri/binaries/sing-box-..."
            block
            size="small"
          />
        </Box>

        <Box>
          <Text as="label" sx={{ display: 'block', fontSize: 1, fontWeight: 'semibold', mb: 1 }}>
            配置文件路径 (Config Path):
          </Text>
          <TextInput
            leadingVisual={FileDirectoryIcon}
            value={configPath}
            onChange={(e) => onConfigPathChange(e.target.value)}
            placeholder="config.json"
            block
            size="small"
          />
        </Box>
      </Box>

      {/* Action Notification Banner */}
      {actionMessage && (
        <Flash
          variant={actionMessage.type}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            animation: 'fadeIn 0.2s',
          }}
        >
          <Box sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'mono', fontSize: 1 }}>
            {actionMessage.text}
          </Box>
          <Button variant="invisible" size="small" onClick={onDismissMessage}>
            关闭
          </Button>
        </Flash>
      )}
    </Box>
  );
};
