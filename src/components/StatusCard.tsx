import React, { useState, useEffect } from 'react';
import { Heading, Text, Label, Banner, Button, FormControl, Select } from '@primer/react';
import {
  ShieldCheckIcon,
  ServerIcon,
  TerminalIcon,
  AlertIcon,
  CheckCircleIcon,
  SyncIcon,
} from '@primer/octicons-react';

interface StatusCardProps {
  configContent: string;
  originalPort?: number | string;
  effectivePort?: number | string;
  overridePort?: number | null;
  isPortOverridden?: boolean;
  onOverridePort?: (port: number | null) => void;
  onRevertPort?: () => void;
  originalLogLevel?: string;
  effectiveLogLevel?: string;
  overrideLogLevel?: string | null;
  isLogLevelOverridden?: boolean;
  onOverrideLogLevel?: (level: string | null) => void;
  onRevertLogLevel?: () => void;
}

interface ParsedInfo {
  hasTun: boolean;
  tunInterface?: string;
  listenPort: number | string;
  logLevel: string;
  outboundCount: number;
  rulesCount: number;
  error?: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  configContent,
  originalPort: propOriginalPort,
  effectivePort: propEffectivePort,
  overridePort = null,
  isPortOverridden = false,
  onOverridePort,
  onRevertPort,
  originalLogLevel: propOriginalLogLevel,
  effectiveLogLevel: propEffectiveLogLevel,
  overrideLogLevel = null,
  isLogLevelOverridden = false,
  onOverrideLogLevel,
  onRevertLogLevel,
}) => {
  const parsedInfo: ParsedInfo = React.useMemo(() => {
    if (!configContent.trim()) {
      return {
        hasTun: false,
        listenPort: 2080,
        logLevel: 'INFO',
        outboundCount: 0,
        rulesCount: 0,
      };
    }

    try {
      const parsed = JSON.parse(configContent);
      const inbounds = Array.isArray(parsed.inbounds) ? parsed.inbounds : [];
      const tunInbound = inbounds.find((ib: any) => ib.type === 'tun');
      const hasTun = Boolean(tunInbound);
      const tunInterface = tunInbound?.interface_name;

      // 寻找 mixed-in 或 mixed 类型 inbound
      const mixedInbound =
        inbounds.find((ib: any) => ib.tag === 'mixed-in') ||
        inbounds.find((ib: any) => ib.type === 'mixed') ||
        inbounds[0];

      const listenPort =
        mixedInbound?.listen_port ??
        mixedInbound?.port ??
        (hasTun ? 'TUN Direct' : 2080);

      const logLevel = parsed.log?.level?.toUpperCase() || 'INFO';
      const outboundCount = Array.isArray(parsed.outbounds) ? parsed.outbounds.length : 0;
      const rulesCount = Array.isArray(parsed.route?.rules) ? parsed.route.rules.length : 0;

      return {
        hasTun,
        tunInterface,
        listenPort,
        logLevel,
        outboundCount,
        rulesCount,
      };
    } catch (e: any) {
      return {
        hasTun: false,
        listenPort: 2080,
        logLevel: 'INFO',
        outboundCount: 0,
        rulesCount: 0,
        error: e.message || 'JSON 格式解析失败',
      };
    }
  }, [configContent]);

  const activeOriginalPort = propOriginalPort !== undefined ? propOriginalPort : parsedInfo.listenPort;
  const activeEffectivePort = propEffectivePort !== undefined ? propEffectivePort : activeOriginalPort;
  const activeOriginalLogLevel = propOriginalLogLevel !== undefined ? propOriginalLogLevel : parsedInfo.logLevel;
  const activeEffectiveLogLevel = propEffectiveLogLevel !== undefined ? propEffectiveLogLevel : activeOriginalLogLevel;

  // 本地端口输入框状态
  const [portInput, setPortInput] = useState<string>(String(activeEffectivePort));
  const [portError, setPortError] = useState<string | null>(null);

  useEffect(() => {
    setPortInput(String(activeEffectivePort));
  }, [activeEffectivePort]);

  // 校验并提交端口修改 (仅允许数字，范围 1024 - 65535)
  const handlePortChange = (val: string) => {
    // 强制只保留纯数字输入
    const cleanDigits = val.replace(/\D/g, '');
    setPortInput(cleanDigits);

    if (!cleanDigits) {
      setPortError('端口号不能为空 (请输入 1024 - 65535 范围)');
      return;
    }

    const num = parseInt(cleanDigits, 10);
    if (num < 1024 || num > 65535) {
      setPortError('端口号必须介于 1024 至 65535 之间 (系统保留前 1024 个知名端口)');
      return;
    }

    setPortError(null);
    if (onOverridePort) {
      if (num === activeOriginalPort) {
        onOverridePort(null); // 与原始相同则取消覆盖
      } else {
        onOverridePort(num);
      }
    }
  };

  const handleLogLevelChange = (newLevel: string) => {
    if (onOverrideLogLevel) {
      if (newLevel.toLowerCase() === String(activeOriginalLogLevel).toLowerCase()) {
        onOverrideLogLevel(null);
      } else {
        onOverrideLogLevel(newLevel);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {parsedInfo.error && (
        <Banner
          variant="critical"
          title="配置文件解析错误"
          description={`无法解析当前配置文件内容: ${parsedInfo.error}`}
        />
      )}

      {parsedInfo.hasTun && (
        <Banner
          variant="warning"
          title="已检测到 TUN 虚拟网卡模式"
          description="当前配置启用了 TUN 接口（创建虚拟网卡需要系统底层权限），启动时必须点击【管理员提权运行】方可接管系统流量。"
        />
      )}

      {/* 弱提醒: 临时覆盖状态提示 (存储于 LocalStorage，重开仍保留，原文件不受影响) */}
      {(isPortOverridden || isLogLevelOverridden) && (
        <Banner
          variant="info"
          title="当前已激活临时运行时覆盖 (Temporary Overrides)"
          description={
            <div style={{ fontSize: '12px', lineHeight: '1.6', marginTop: '4px' }}>
              {isPortOverridden && (
                <div>
                  • <strong>监听端口已覆盖</strong>: 配置文件原始端口为{' '}
                  <code style={{ fontFamily: 'monospace' }}>{activeOriginalPort}</code>，当前运行时已被临时覆盖为{' '}
                  <code style={{ fontFamily: 'monospace', color: 'var(--color-accent-fg, #0969da)' }}>
                    {overridePort}
                  </code>
                  。原始文件未受任何修改。
                </div>
              )}
              {isLogLevelOverridden && (
                <div>
                  • <strong>日志级别已覆盖</strong>: 配置文件原始级别为{' '}
                  <code style={{ fontFamily: 'monospace' }}>{String(activeOriginalLogLevel).toUpperCase()}</code>
                  ，当前运行时已被临时覆盖为{' '}
                  <code style={{ fontFamily: 'monospace', color: 'var(--color-accent-fg, #0969da)' }}>
                    {String(overrideLogLevel).toUpperCase()}
                  </code>
                  。
                </div>
              )}
              <div style={{ marginTop: '4px', color: 'var(--fg-muted, #656d76)' }}>
                提示：临时覆盖项已持久化在本地 LocalStorage 中。您可点击输入框右侧的方形还原按钮随时重置回导入文件原始状态。
              </div>
            </div>
          }
        />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* 卡片 1: 运行模式 */}
        <div
          style={{
            backgroundColor: 'var(--bg-subtle, #f6f8fa)',
            border: '1px solid var(--border-default, #d0d7de)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <Text
                as="span"
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--fg-muted, #656d76)',
                  textTransform: 'uppercase',
                }}
              >
                运行模式 (Mode)
              </Text>
              {parsedInfo.hasTun ? (
                <ShieldCheckIcon size={16} fill="var(--color-danger, #cf222e)" />
              ) : (
                <CheckCircleIcon size={16} fill="var(--color-success, #1a7f37)" />
              )}
            </div>
            <Heading
              as="h3"
              style={{
                fontSize: '18px',
                fontWeight: 600,
                margin: '0 0 4px 0',
                color: parsedInfo.hasTun ? 'var(--color-danger, #cf222e)' : 'var(--fg-default, #1f2328)',
              }}
            >
              {parsedInfo.hasTun ? 'TUN 模式' : '普通代理模式'}
            </Heading>
          </div>
          <div>
            {parsedInfo.hasTun ? (
              <Label variant="danger" size="small">
                必须管理员提权启动
              </Label>
            ) : (
              <Label variant="accent" size="small">
                支持普通权限启动
              </Label>
            )}
            <div style={{ marginTop: '6px' }}>
              <Text as="span" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)' }}>
                {parsedInfo.hasTun
                  ? `虚拟接口: ${parsedInfo.tunInterface || 'tun0'}`
                  : 'SOCKS5/HTTP 混合模式'}
              </Text>
            </div>
          </div>
        </div>

        {/* 卡片 2: 监听端口 (支持数字输入、范围 1024-65535、方形 Revert 按钮与覆盖提示) */}
        <div
          style={{
            backgroundColor: 'var(--bg-subtle, #f6f8fa)',
            border: isPortOverridden
              ? '1px solid var(--color-accent-emphasis, #0969da)'
              : '1px solid var(--border-default, #d0d7de)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <Text
                as="span"
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--fg-muted, #656d76)',
                  textTransform: 'uppercase',
                }}
              >
                监听端口 (Listen Port)
              </Text>
              <ServerIcon size={16} fill="var(--fg-muted, #656d76)" />
            </div>

            {/* 端口输入框与方形 Revert 按钮 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={portInput}
                onChange={(e: any) => handlePortChange(e.target.value)}
                placeholder="1024-65535"
                style={{
                  flex: 1,
                  fontFamily: 'monospace',
                  fontSize: '16px',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: portError
                    ? '1px solid var(--color-danger, #cf222e)'
                    : '1px solid var(--border-default, #d0d7de)',
                  backgroundColor: 'var(--bg-canvas, #ffffff)',
                  color: 'var(--fg-default, #1f2328)',
                  outline: 'none',
                }}
                aria-label="临时覆盖监听端口"
              />

              {/* 方形 Revert 按钮 */}
              <Button
                variant="default"
                size="small"
                onClick={() => {
                  if (onRevertPort) onRevertPort();
                  setPortInput(String(activeOriginalPort));
                  setPortError(null);
                }}
                disabled={!isPortOverridden}
                title="还原为原始配置文件端口"
                aria-label="还原为原始配置文件端口"
                style={{
                  width: '32px',
                  height: '32px',
                  minWidth: '32px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                }}
              >
                <SyncIcon size={14} />
              </Button>
            </div>

            {portError && (
              <div style={{ fontSize: '11px', color: 'var(--color-danger, #cf222e)', marginTop: '2px' }}>
                {portError}
              </div>
            )}
          </div>

          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Label variant={isPortOverridden ? 'attention' : 'secondary'} size="small">
                {isPortOverridden ? `已覆盖 (原: ${activeOriginalPort})` : 'Mixed-inbound'}
              </Label>
            </div>
            <div style={{ marginTop: '6px' }}>
              <Text as="span" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)' }}>
                {isPortOverridden
                  ? '当前使用临时端口，原文件未修改'
                  : '本地应用 HTTP/SOCKS 代理访问端口'}
              </Text>
            </div>
          </div>
        </div>

        {/* 卡片 3: 日志级别 (使用 Primer FormControl + Select，方形 Revert 按钮) */}
        <div
          style={{
            backgroundColor: 'var(--bg-subtle, #f6f8fa)',
            border: isLogLevelOverridden
              ? '1px solid var(--color-accent-emphasis, #0969da)'
              : '1px solid var(--border-default, #d0d7de)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <Text
                as="span"
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--fg-muted, #656d76)',
                  textTransform: 'uppercase',
                }}
              >
                日志级别 (Log Level)
              </Text>
              <TerminalIcon size={16} fill="var(--fg-muted, #656d76)" />
            </div>

            {/* Primer 官方 FormControl + Select 组件结构 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <FormControl>
                  <FormControl.Label visuallyHidden>日志级别选择</FormControl.Label>
                  <Select
                    value={String(activeEffectiveLogLevel).toLowerCase()}
                    onChange={(e: any) => handleLogLevelChange(e.target.value)}
                  >
                    <Select.Option value="trace">TRACE</Select.Option>
                    <Select.Option value="debug">DEBUG</Select.Option>
                    <Select.Option value="info">INFO</Select.Option>
                    <Select.Option value="warn">WARN</Select.Option>
                    <Select.Option value="error">ERROR</Select.Option>
                    <Select.Option value="fatal">FATAL</Select.Option>
                  </Select>
                </FormControl>
              </div>

              {/* 方形 Revert 按钮 */}
              <Button
                variant="default"
                size="small"
                onClick={() => {
                  if (onRevertLogLevel) onRevertLogLevel();
                }}
                disabled={!isLogLevelOverridden}
                title="还原为原始配置文件级别"
                aria-label="还原为原始配置文件级别"
                style={{
                  width: '32px',
                  height: '32px',
                  minWidth: '32px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                }}
              >
                <SyncIcon size={14} />
              </Button>
            </div>
          </div>

          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Label variant={isLogLevelOverridden ? 'attention' : 'secondary'} size="small">
                {isLogLevelOverridden
                  ? `已覆盖 (原: ${String(activeOriginalLogLevel).toUpperCase()})`
                  : 'log.level'}
              </Label>
            </div>
            <div style={{ marginTop: '6px' }}>
              <Text as="span" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)' }}>
                {isLogLevelOverridden
                  ? '当前使用临时级别，原文件未修改'
                  : '控制 sing-box 进程控制台输出详细度'}
              </Text>
            </div>
          </div>
        </div>

        {/* 卡片 4: 出站与规则 */}
        <div
          style={{
            backgroundColor: 'var(--bg-subtle, #f6f8fa)',
            border: '1px solid var(--border-default, #d0d7de)',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <Text
                as="span"
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--fg-muted, #656d76)',
                  textTransform: 'uppercase',
                }}
              >
                拓扑信息 (Topology)
              </Text>
              <AlertIcon size={16} fill="var(--fg-muted, #656d76)" />
            </div>
            <Heading
              as="h3"
              style={{
                fontSize: '18px',
                fontWeight: 600,
                margin: '0 0 4px 0',
              }}
            >
              {parsedInfo.outboundCount} 出站 / {parsedInfo.rulesCount} 规则
            </Heading>
          </div>
          <div>
            <Label variant="secondary" size="small">
              Route & Outbounds
            </Label>
            <div style={{ marginTop: '6px' }}>
              <Text as="span" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)' }}>
                分流规则与出站代理节点统计
              </Text>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
