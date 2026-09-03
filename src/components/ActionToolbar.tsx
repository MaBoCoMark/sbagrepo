import React, { useState } from 'react';
import { Button, TextInput, Banner } from '@primer/react';
import {
  CheckIcon,
  PlayIcon,
  ShieldLockIcon,
  StopIcon,
  GearIcon,
  FileCodeIcon,
} from '@primer/octicons-react';
import { invoke } from '@tauri-apps/api/core';

interface ActionToolbarProps {
  binaryPath: string;
  setBinaryPath: (path: string) => void;
  configPath: string;
  setConfigPath: (path: string) => void;
  runningMode: 'stopped' | 'normal' | 'admin';
  setRunningMode: (mode: 'stopped' | 'normal' | 'admin') => void;
  onRefreshConfig: () => void;
}

interface FeedbackState {
  type: 'success' | 'critical' | 'info' | 'warning';
  title: string;
  message: string;
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  binaryPath,
  setBinaryPath,
  configPath,
  setConfigPath,
  runningMode,
  setRunningMode,
  onRefreshConfig,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const handleCheck = async () => {
    setLoadingAction('check');
    try {
      const res = await invoke<string>('check_config', {
        binaryPath,
        configPath,
      });
      setFeedback({
        type: 'success',
        title: '配置检查通过',
        message: res,
      });
      onRefreshConfig();
    } catch (err: any) {
      setFeedback({
        type: 'critical',
        title: '配置语法错误',
        message: String(err),
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStartNormal = async () => {
    setLoadingAction('normal');
    try {
      await invoke('start_normal', {
        binaryPath,
        configPath,
      });
      setRunningMode('normal');
      setFeedback({
        type: 'success',
        title: '普通启动成功',
        message: 'sing-box 已经以普通用户权限启动，实时日志已同步至看板。',
      });
    } catch (err: any) {
      setFeedback({
        type: 'critical',
        title: '普通启动失败',
        message: String(err),
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStartAdmin = async () => {
    setLoadingAction('admin');
    try {
      const res = await invoke<string>('start_admin', {
        binaryPath,
        configPath,
      });
      setRunningMode('admin');
      setFeedback({
        type: 'success',
        title: '管理员提权启动成功',
        message: res || '已通过系统提权认证启动 sing-box。',
      });
    } catch (err: any) {
      setFeedback({
        type: 'critical',
        title: '管理员提权启动失败',
        message: String(err),
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStop = async () => {
    setLoadingAction('stop');
    try {
      const res = await invoke<string>('stop_process');
      setRunningMode('stopped');
      setFeedback({
        type: 'info',
        title: '进程已终止',
        message: res || 'sing-box 后台进程已安全停止。',
      });
    } catch (err: any) {
      setFeedback({
        type: 'critical',
        title: '终止进程异常',
        message: String(err),
      });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px',
        backgroundColor: 'var(--bg-subtle, #f6f8fa)',
        borderRadius: '8px',
        border: '1px solid var(--border-default, #d0d7de)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--fg-muted, #656d76)',
              marginBottom: '6px',
            }}
          >
            sing-box 可执行文件路径 (Binary Path)
          </label>
          <TextInput
            leadingVisual={GearIcon}
            value={binaryPath}
            onChange={(e: any) => setBinaryPath(e.target.value)}
            aria-label="Binary Path"
            block
          />
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--fg-muted, #656d76)',
              marginBottom: '6px',
            }}
          >
            配置文件路径 (Config Path)
          </label>
          <TextInput
            leadingVisual={FileCodeIcon}
            value={configPath}
            onChange={(e: any) => setConfigPath(e.target.value)}
            aria-label="Config Path"
            block
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-muted, #d8dee4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            variant="default"
            leadingVisual={CheckIcon}
            onClick={handleCheck}
            disabled={loadingAction !== null}
            loading={loadingAction === 'check'}
          >
            检查语法
          </Button>

          <Button
            variant="primary"
            leadingVisual={PlayIcon}
            onClick={handleStartNormal}
            disabled={loadingAction !== null || runningMode !== 'stopped'}
            loading={loadingAction === 'normal'}
          >
            普通运行
          </Button>

          <Button
            variant="danger"
            leadingVisual={ShieldLockIcon}
            onClick={handleStartAdmin}
            disabled={loadingAction !== null || runningMode !== 'stopped'}
            loading={loadingAction === 'admin'}
          >
            管理员提权运行
          </Button>
        </div>

        <div>
          <Button
            variant="invisible"
            leadingVisual={StopIcon}
            onClick={handleStop}
            disabled={loadingAction !== null || runningMode === 'stopped'}
            loading={loadingAction === 'stop'}
          >
            终止进程
          </Button>
        </div>
      </div>

      {feedback && (
        <div style={{ marginTop: '4px' }}>
          <Banner
            variant={feedback.type}
            title={feedback.title}
            description={feedback.message}
            onDismiss={() => setFeedback(null)}
          />
        </div>
      )}
    </div>
  );
};
