import React from 'react';
import { Box, Heading, Text, Label, Flash } from '@primer/react';
import {
  ShieldLockIcon,
  ServerIcon,
  FileCodeIcon,
  AlertIcon,
  CheckCircleIcon,
  InfoIcon,
} from '@primer/octicons-react';
import { ConfigMeta } from '../types';

interface StatusCardProps {
  meta: ConfigMeta;
}

export const StatusCard: React.FC<StatusCardProps> = ({ meta }) => {
  return (
    <Box sx={{ mb: 4 }}>
      {/* TUN Mode Elevated Required Notice */}
      {meta.hasTun && (
        <Flash variant="warning" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <AlertIcon size={16} />
          <Box sx={{ flexGrow: 1 }}>
            <Text sx={{ fontWeight: 'bold', mr: 1 }}>
              TUN 虚拟网卡模式已激活：
            </Text>
            <Text>
              检测到配置中包含 TUN 模式入站（<code>type: "tun"</code>）。创建虚拟网络接口需要操作系统内核级权限，必须点击顶部的
              <strong>「管理员提权启动」</strong>方可正常运作！
            </Text>
          </Box>
        </Flash>
      )}

      {/* 3 Main Metric Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: ['1fr', 'repeat(3, 1fr)'],
          gap: 3,
        }}
      >
        {/* Card 1: Run Mode */}
        <Box
          sx={{
            p: 3,
            border: '1px solid',
            borderColor: meta.hasTun ? 'attention.emphasis' : 'border.default',
            borderRadius: 2,
            bg: 'canvas.default',
            boxShadow: 'shadow.subtle',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Text sx={{ fontSize: 1, color: 'fg.muted', fontWeight: 'semibold' }}>
              运行模式 (Run Mode)
            </Text>
            <Box sx={{ color: meta.hasTun ? 'attention.fg' : 'success.fg' }}>
              {meta.hasTun ? <ShieldLockIcon size={20} /> : <CheckCircleIcon size={20} />}
            </Box>
          </Box>

          <Heading as="h3" sx={{ fontSize: 3, m: 0, mb: 1 }}>
            {meta.hasTun ? 'TUN 虚拟网卡' : 'Mixed / Proxy 模式'}
          </Heading>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
            {meta.hasTun ? (
              <Label variant="attention" size="small">
                需管理员提权 (Admin Required)
              </Label>
            ) : (
              <Label variant="success" size="small">
                普通权限即可 (Direct Run)
              </Label>
            )}
          </Box>
        </Box>

        {/* Card 2: Mixed / Inbound Listen Port */}
        <Box
          sx={{
            p: 3,
            border: '1px solid',
            borderColor: 'border.default',
            borderRadius: 2,
            bg: 'canvas.default',
            boxShadow: 'shadow.subtle',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Text sx={{ fontSize: 1, color: 'fg.muted', fontWeight: 'semibold' }}>
              监听端口 (Listen Port)
            </Text>
            <Box sx={{ color: 'accent.fg' }}>
              <ServerIcon size={20} />
            </Box>
          </Box>

          <Heading as="h3" sx={{ fontSize: 3, m: 0, mb: 1 }}>
            {meta.mixedPort !== null ? `:${meta.mixedPort}` : '未指定 / 默认'}
          </Heading>

          <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
            {meta.mixedPort !== null
              ? `Mixed 混合入站代理端口 (SOCKS5 + HTTP)`
              : meta.socksPort !== null
              ? `SOCKS5 端口: :${meta.socksPort}`
              : '未发现 standard mixed-in 监听端口'}
          </Text>
        </Box>

        {/* Card 3: Log Level */}
        <Box
          sx={{
            p: 3,
            border: '1px solid',
            borderColor: 'border.default',
            borderRadius: 2,
            bg: 'canvas.default',
            boxShadow: 'shadow.subtle',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Text sx={{ fontSize: 1, color: 'fg.muted', fontWeight: 'semibold' }}>
              日志等级 (Log Level)
            </Text>
            <Box sx={{ color: 'fg.muted' }}>
              <FileCodeIcon size={20} />
            </Box>
          </Box>

          <Heading as="h3" sx={{ fontSize: 3, m: 0, mb: 1, textTransform: 'uppercase' }}>
            {meta.logLevel || 'INFO'}
          </Heading>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
            <Label
              variant={
                meta.logLevel === 'debug' || meta.logLevel === 'trace'
                  ? 'accent'
                  : meta.logLevel === 'warn' || meta.logLevel === 'error'
                  ? 'danger'
                  : 'secondary'
              }
              size="small"
            >
              {meta.logLevel}
            </Label>
            <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
              规则数: {meta.rulesCount} | 入站: {meta.inboundCount}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
