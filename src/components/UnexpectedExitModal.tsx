import React from 'react';
import { Heading, Text, Button, Label } from '@primer/react';
import { AlertIcon, TerminalIcon } from '@primer/octicons-react';
import { UnexpectedExitPayload } from '../types/singbox';

interface UnexpectedExitModalProps {
  exitInfo: UnexpectedExitPayload | null;
  onClose: () => void;
  onViewLogs: () => void;
}

export const UnexpectedExitModal: React.FC<UnexpectedExitModalProps> = ({
  exitInfo,
  onClose,
  onViewLogs,
}) => {
  if (!exitInfo) return null;

  const modeLabel = exitInfo.mode === 'admin' ? '管理员提权模式 (Sudo)' : '普通运行模式 (Normal)';

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="unexpected-exit-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(1, 4, 9, 0.72)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: 'var(--bg-canvas, #ffffff)',
          borderRadius: '12px',
          border: '1px solid var(--border-danger, #cf222e)',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 顶部强提醒警报条 */}
        <div
          style={{
            backgroundColor: '#cf222e',
            color: '#ffffff',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertIcon size={20} fill="#ffffff" />
          </div>
          <div>
            <Heading
              as="h2"
              id="unexpected-exit-title"
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#ffffff',
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              sing-box 内核意外退出警告
            </Heading>
            <Text
              as="p"
              style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.88)',
                margin: '2px 0 0 0',
              }}
            >
              检测到底层代理内核非预期中断，流量转发已终止
            </Text>
          </div>
        </div>

        {/* 核心内容区域 */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--bg-subtle, #f6f8fa)',
              borderRadius: '6px',
              border: '1px solid var(--border-default, #d0d7de)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg-muted, #656d76)' }}>
                退出前运行模式:
              </Text>
              <Label variant={exitInfo.mode === 'admin' ? 'danger' : 'accent'} size="small">
                {modeLabel}
              </Label>
            </div>

            {exitInfo.code !== null && exitInfo.code !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg-muted, #656d76)' }}>
                  进程退出码 (Exit Code):
                </Text>
                <code
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--color-danger, #cf222e)',
                  }}
                >
                  {exitInfo.code}
                </code>
              </div>
            )}

            <div style={{ marginTop: '4px' }}>
              <Text style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fg-muted, #656d76)' }}>
                异常中断详情:
              </Text>
              <div
                style={{
                  marginTop: '4px',
                  padding: '8px 10px',
                  backgroundColor: 'var(--bg-canvas, #ffffff)',
                  border: '1px solid var(--border-muted, #d8dee4)',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: 'var(--color-danger, #cf222e)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: '100px',
                  overflowY: 'auto',
                }}
              >
                {exitInfo.message}
              </div>
            </div>
          </div>

          {/* 故障排查提示 */}
          <div
            style={{
              fontSize: '12px',
              color: 'var(--fg-muted, #656d76)',
              lineHeight: '1.6',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--fg-default, #1f2328)', marginBottom: '4px' }}>
              常见原因与排查建议：
            </div>
            <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
              <li>
                <strong>监听端口占用</strong>：监听端口已被系统其他代理客户端或服务抢占。
              </li>
              <li>
                <strong>分流语法或节点错误</strong>：出站节点无法解析、证书失效或路由规则格式错误导致 sing-box panic。
              </li>
              <li>
                <strong>网卡特权权限</strong>：TUN 模式创建虚拟适配器需要管理员权限，若以普通模式拉起会立即被操作系统拒绝。
              </li>
              <li>
                <strong>系统内存压力</strong>：系统内存不足可能触发 OOM Killer 杀掉进程。
              </li>
            </ul>
          </div>
        </div>

        {/* 操作按钮区 */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: 'var(--bg-subtle, #f6f8fa)',
            borderTop: '1px solid var(--border-default, #d0d7de)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <Button variant="default" onClick={onClose}>
            我知道了
          </Button>
          <Button
            variant="primary"
            leadingVisual={TerminalIcon}
            onClick={() => {
              onClose();
              onViewLogs();
            }}
          >
            前往查看实时日志
          </Button>
        </div>
      </div>
    </div>
  );
};
