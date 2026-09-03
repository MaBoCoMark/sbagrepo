import React from 'react';
import { Heading, Text, Label, Banner } from '@primer/react';
import {
  ShieldCheckIcon,
  ServerIcon,
  TerminalIcon,
  AlertIcon,
  CheckCircleIcon,
} from '@primer/octicons-react';

interface StatusCardProps {
  configContent: string;
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

export const StatusCard: React.FC<StatusCardProps> = ({ configContent }) => {
  const parsedInfo: ParsedInfo = React.useMemo(() => {
    if (!configContent.trim()) {
      return {
        hasTun: false,
        listenPort: '无配置',
        logLevel: '未知',
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
        (hasTun ? 'TUN Direct' : '未指定');

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
        listenPort: '解析错误',
        logLevel: '解析错误',
        outboundCount: 0,
        rulesCount: 0,
        error: e.message || 'JSON 格式解析失败',
      };
    }
  }, [configContent]);

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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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

        {/* 卡片 2: 监听端口 */}
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
                监听端口 (Listen Port)
              </Text>
              <ServerIcon size={16} fill="var(--fg-muted, #656d76)" />
            </div>
            <Heading
              as="h3"
              style={{
                fontSize: '18px',
                fontWeight: 600,
                margin: '0 0 4px 0',
                fontFamily: 'monospace',
              }}
            >
              {parsedInfo.listenPort}
            </Heading>
          </div>
          <div>
            <Label variant="secondary" size="small">
              Mixed-inbound
            </Label>
            <div style={{ marginTop: '6px' }}>
              <Text as="span" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)' }}>
                本地应用代理访问端口
              </Text>
            </div>
          </div>
        </div>

        {/* 卡片 3: 日志等级 */}
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
                日志级别 (Log Level)
              </Text>
              <TerminalIcon size={16} fill="var(--fg-muted, #656d76)" />
            </div>
            <Heading
              as="h3"
              style={{
                fontSize: '18px',
                fontWeight: 600,
                margin: '0 0 4px 0',
                fontFamily: 'monospace',
              }}
            >
              {parsedInfo.logLevel}
            </Heading>
          </div>
          <div>
            <Label variant="secondary" size="small">
              log.level
            </Label>
            <div style={{ marginTop: '6px' }}>
              <Text as="span" style={{ fontSize: '12px', color: 'var(--fg-muted, #656d76)' }}>
                实时日志输出过滤等级
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
                分流规则与节点配置
              </Text>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
