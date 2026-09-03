import React, { useState, useRef } from 'react';
import { Button, Banner, Label, Text } from '@primer/react';
import {
  CheckIcon,
  PlayIcon,
  ShieldLockIcon,
  StopIcon,
  UploadIcon,
  FileCodeIcon,
  CpuIcon,
} from '@primer/octicons-react';
import { invoke } from '@tauri-apps/api/core';
import { BinaryStatusInfo, FeedbackState, RunningMode } from '../types/singbox';

interface ActionToolbarProps {
  binaryPath: string;
  configPath?: string;
  configContent: string;
  runningMode: RunningMode;
  setRunningMode: (mode: RunningMode) => void;
  onRefreshConfig: () => void;
  binaryStatus: BinaryStatusInfo | null;
  onImportConfig: (text: string) => Promise<string>;
  onImportBinary: (base64: string) => Promise<BinaryStatusInfo>;
  onClearUnexpectedExit?: () => void;
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  binaryPath,
  configContent,
  runningMode,
  setRunningMode,
  onRefreshConfig,
  binaryStatus,
  onImportConfig,
  onImportBinary,
  onClearUnexpectedExit,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const configFileRef = useRef<HTMLInputElement | null>(null);
  const binaryFileRef = useRef<HTMLInputElement | null>(null);

  // 检查当前配置是否为空白或未配置
  const isConfigEmpty = !configContent || configContent.trim() === '' || configContent.trim() === '{}';
  const isBinaryReady = binaryStatus ? binaryStatus.imported : Boolean(binaryPath);

  // 处理配置文件上传导入
  const handleConfigFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('[ActionToolbar] 用户选择配置文件:', file.name, '大小:', file.size);
    setLoadingAction('import-config');

    try {
      // 1. 读取为纯文本
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('无法读取文件内容 (非有效文本或权限受限)'));
        reader.readAsText(file, 'utf-8');
      });

      // 2. 验证是否为完整的 JSON 格式
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (jsonErr: any) {
        throw new Error(
          `所选文件不是合法的完整 JSON 格式！\n解析异常: ${jsonErr.message || String(jsonErr)}`
        );
      }

      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('所选文件内容非有效 JSON 对象！');
      }

      // 3. 提交持久化存储至 app_config_dir/config.json
      await onImportConfig(text);

      setFeedback({
        type: 'success',
        title: '配置文件导入成功',
        message: `文件 "${file.name}" 已通过 JSON 校验，并覆盖持久化至软件标准配置存储区 (config.json)。`,
      });
      onRefreshConfig();
    } catch (err: any) {
      console.error('[ActionToolbar] 导入配置文件失败:', err);
      setFeedback({
        type: 'critical',
        title: '配置文件导入失败',
        message: err.message || String(err),
      });
    } finally {
      setLoadingAction(null);
      if (configFileRef.current) {
        configFileRef.current.value = '';
      }
    }
  };

  // 处理可执行内核二进制文件上传导入
  const handleBinaryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('[ActionToolbar] 用户选择内核文件:', file.name, '大小:', file.size);
    setLoadingAction('import-binary');

    try {
      // 读取为 Base64
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result as string;
          const commaIdx = res.indexOf(',');
          resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
        };
        reader.onerror = () => reject(new Error('读取二进制文件失败'));
        reader.readAsDataURL(file);
      });

      const res = await onImportBinary(base64String);

      setFeedback({
        type: 'success',
        title: 'sing-box 内核导入就绪',
        message: `成功导入内核可执行文件 "${res.binary_name}" (${(file.size / 1024 / 1024).toFixed(
          2
        )} MB)。\n已写入应用专属存储区并自动配置可执行权限 (+x)。`,
      });
    } catch (err: any) {
      console.error('[ActionToolbar] 导入内核失败:', err);
      setFeedback({
        type: 'critical',
        title: '内核导入失败',
        message: err.message || String(err),
      });
    } finally {
      setLoadingAction(null);
      if (binaryFileRef.current) {
        binaryFileRef.current.value = '';
      }
    }
  };

  const handleCheck = async () => {
    console.log('[ActionToolbar] 开始检查配置语法...');
    setLoadingAction('check');
    try {
      const res = await invoke<string>('check_config', {
        binaryPath: '',
        configPath: '',
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
        title: '配置检查失败',
        message: String(err),
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStartNormal = async () => {
    if (onClearUnexpectedExit) onClearUnexpectedExit();
    console.log('[ActionToolbar] 正在以普通模式启动 sing-box...');
    setLoadingAction('normal');
    try {
      await invoke('start_normal', {
        binaryPath: '',
        configPath: '',
      });
      setRunningMode('normal');
      setFeedback({
        type: 'success',
        title: '普通启动成功',
        message: 'sing-box 已经以普通用户权限成功拉起，实时日志已同步输出至看板。',
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
    if (onClearUnexpectedExit) onClearUnexpectedExit();
    console.log('[ActionToolbar] 正在以管理员提权模式启动 sing-box...');
    setLoadingAction('admin');
    try {
      const res = await invoke<string>('start_admin', {
        binaryPath: '',
        configPath: '',
      });
      setRunningMode('admin');
      setFeedback({
        type: 'success',
        title: '管理员提权启动成功',
        message: res || '已通过系统原生认证窗口以特权权限拉起 sing-box。',
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
    if (onClearUnexpectedExit) onClearUnexpectedExit();
    console.log('[ActionToolbar] 正在请求终止 sing-box 进程...');
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
      {/* 隐藏的真实文件选择器 */}
      <input
        type="file"
        ref={configFileRef}
        onChange={handleConfigFileChange}
        style={{ display: 'none' }}
        accept=".json,application/json,text/*"
      />
      <input
        type="file"
        ref={binaryFileRef}
        onChange={handleBinaryFileChange}
        style={{ display: 'none' }}
      />

      {/* 核心文件管理区域 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* 配置文件状态与导入 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: 'var(--bg-canvas, #ffffff)',
            borderRadius: '6px',
            border: '1px solid var(--border-default, #d0d7de)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-accent-subtle, #ddf4ff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileCodeIcon size={20} fill="var(--color-accent-fg, #0969da)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Text style={{ fontSize: '13px', fontWeight: 600 }}>配置文件 (config.json)</Text>
                {isConfigEmpty ? (
                  <Label variant="attention" size="small">
                    空配置 ({'{}'})
                  </Label>
                ) : (
                  <Label variant="success" size="small">
                    已就绪
                  </Label>
                )}
              </div>
              <Text as="p" style={{ fontSize: '11px', color: 'var(--fg-muted, #656d76)', margin: 0 }}>
                存储于系统标准应用目录 (无需手动指定绝对路径)
              </Text>
            </div>
          </div>

          <Button
            variant="default"
            size="small"
            leadingVisual={UploadIcon}
            onClick={() => configFileRef.current?.click()}
            loading={loadingAction === 'import-config'}
            disabled={loadingAction !== null}
          >
            导入配置文件
          </Button>
        </div>

        {/* 可执行内核状态与导入 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: 'var(--bg-canvas, #ffffff)',
            borderRadius: '6px',
            border: '1px solid var(--border-default, #d0d7de)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                backgroundColor: isBinaryReady
                  ? 'rgba(46, 160, 67, 0.15)'
                  : 'rgba(217, 153, 0, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CpuIcon
                size={20}
                fill={isBinaryReady ? 'var(--color-success, #1a7f37)' : 'var(--color-warning, #9a6700)'}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Text style={{ fontSize: '13px', fontWeight: 600 }}>
                  {binaryStatus?.binary_name || 'sing-box 内核'}
                </Text>
                {isBinaryReady ? (
                  <Label variant="success" size="small">
                    已导入
                  </Label>
                ) : (
                  <Label variant="attention" size="small">
                    未导入
                  </Label>
                )}
              </div>
              <Text as="p" style={{ fontSize: '11px', color: 'var(--fg-muted, #656d76)', margin: 0 }}>
                {isBinaryReady
                  ? '存放于专属应用目录 (自动 chmod +x)'
                  : '请上传适用于当前系统架构的 sing-box 二进制文件'}
              </Text>
            </div>
          </div>

          <Button
            variant="default"
            size="small"
            leadingVisual={UploadIcon}
            onClick={() => binaryFileRef.current?.click()}
            loading={loadingAction === 'import-binary'}
            disabled={loadingAction !== null}
          >
            导入内核文件
          </Button>
        </div>
      </div>

      {/* 控制操作按钮组 */}
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
            disabled={loadingAction !== null || !isBinaryReady}
            loading={loadingAction === 'check'}
          >
            检查语法
          </Button>

          <Button
            variant="primary"
            leadingVisual={PlayIcon}
            onClick={handleStartNormal}
            disabled={loadingAction !== null || runningMode !== 'stopped' || !isBinaryReady}
            loading={loadingAction === 'normal'}
          >
            普通运行
          </Button>

          <Button
            variant="danger"
            leadingVisual={ShieldLockIcon}
            onClick={handleStartAdmin}
            disabled={loadingAction !== null || runningMode !== 'stopped' || !isBinaryReady}
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
