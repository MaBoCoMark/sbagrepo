import React, { useState } from 'react';
import { Button, TextInput, Banner } from '@primer/react';
import {
  CheckIcon,
  PlayIcon,
  ShieldLockIcon,
  StopIcon,
  GearIcon,
  FileCodeIcon,
  SyncIcon,
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
  onAutoDetect?: () => Promise<any>;
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
  onAutoDetect,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const handleCheck = async () => {
    console.log('[ActionToolbar] 开始检查配置语法...', { binaryPath, configPath });
    setLoadingAction('check');
    try {
      const res = await invoke<string>('check_config', {
        binaryPath,
        configPath,
      });
      console.log('[ActionToolbar] 配置检查通过:', res);
      setFeedback({
        type: 'success',
        title: '配置检查通过',
        message: res,
      });
      onRefreshConfig();
    } catch (err: any) {
      console.error('[ActionToolbar] 检查配置失败:', err);
      setFeedback({
        type: 'critical',
        title: '配置检查失败',
        message: String(err),
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStartNormal = async () => {
    console.log('[ActionToolbar] 正在以普通模式启动 sing-box...', { binaryPath, configPath });
    setLoadingAction('normal');
    try {
      await invoke('start_normal', {
        binaryPath,
        configPath,
      });
      console.log('[ActionToolbar] 普通模式启动成功');
      setRunningMode('normal');
      setFeedback({
        type: 'success',
        title: '普通启动成功',
        message: 'sing-box 已经以普通用户权限成功拉起，实时日志已同步输出至看板。',
      });
    } catch (err: any) {
      console.error('[ActionToolbar] 普通模式启动失败:', err);
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
    console.log('[ActionToolbar] 正在以管理员提权模式启动 sing-box...', { binaryPath, configPath });
    setLoadingAction('admin');
    try {
      const res = await invoke<string>('start_admin', {
        binaryPath,
        configPath,
      });
      console.log('[ActionToolbar] 管理员提权启动成功:', res);
      setRunningMode('admin');
      setFeedback({
        type: 'success',
        title: '管理员提权启动成功',
        message: res || '已通过系统认证以管理员权限启动 sing-box。',
      });
    } catch (err: any) {
      console.error('[ActionToolbar] 管理员提权启动失败:', err);
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
    console.log('[ActionToolbar] 正在请求终止 sing-box 进程...');
    setLoadingAction('stop');
    try {
      const res = await invoke<string>('stop_process');
      console.log('[ActionToolbar] 进程终止结果:', res);
      setRunningMode('stopped');
      setFeedback({
        type: 'info',
        title: '进程已终止',
        message: res || 'sing-box 后台进程已安全停止。',
      });
    } catch (err: any) {
      console.error('[ActionToolbar] 终止进程失败:', err);
      setFeedback({
        type: 'critical',
        title: '终止进程异常',
        message: String(err),
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAutoDetectClick = async () => {
    if (!onAutoDetect) return;
    console.log('[ActionToolbar] 用户点击自动检测路径');
    setLoadingAction('detect');
    try {
      const res = await onAutoDetect();
      if (res) {
        if (res.binary_found && res.config_found) {
          setFeedback({
            type: 'success',
            title: '路径自动检测完成',
            message: `成功检测到现有文件：\n• 可执行文件: ${res.binary_path}\n• 配置文件: ${res.config_path}`,
          });
        } else if (!res.binary_found && !res.config_found) {
          setFeedback({
            type: 'warning',
            title: '未检测到默认文件',
            message: `在系统 PATH、常见目录及项目预设路径中未找到 sing-box 或 config.json。\n请手动在上方输入框填入路径。\n当前工作目录 (CWD): ${res.cwd}`,
          });
        } else if (!res.binary_found) {
          setFeedback({
            type: 'warning',
            title: '未检测到 sing-box 可执行文件',
            message: `配置文件已找到: ${res.config_path}\n但未在系统中找到 sing-box 可执行文件。请在输入框中填入其绝对路径。`,
          });
        } else {
          setFeedback({
            type: 'warning',
            title: '未检测到配置文件',
            message: `sing-box 已找到: ${res.binary_path}\n但未找到 config.json 配置文件。请确认文件是否存在。`,
          });
        }
      }
    } catch (err: any) {
      console.error('[ActionToolbar] 自动检测失败:', err);
      setFeedback({
        type: 'critical',
        title: '自动检测异常',
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--fg-muted, #656d76)',
              }}
            >
              sing-box 可执行文件路径 (Binary Path)
            </label>
            {onAutoDetect && (
              <Button
                variant="invisible"
                size="small"
                leadingVisual={SyncIcon}
                onClick={handleAutoDetectClick}
                disabled={loadingAction !== null}
                style={{ padding: '0 4px', fontSize: '11px', height: '20px' }}
              >
                自动检测
              </Button>
            )}
          </div>
          <TextInput
            leadingVisual={GearIcon}
            value={binaryPath}
            onChange={(e: any) => setBinaryPath(e.target.value)}
            aria-label="Binary Path"
            block
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--fg-muted, #656d76)',
              }}
            >
              配置文件路径 (Config Path)
            </label>
          </div>
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
            description={
              <div
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  marginTop: '4px',
                }}
              >
                {feedback.message}
              </div>
            }
            onDismiss={() => setFeedback(null)}
          />
        </div>
      )}
    </div>
  );
};
